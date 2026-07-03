#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(await readFile(path.join(projectDir, "dataset.json"), "utf8"));

const dataRank = new Map([
  ["aggregate", 1],
  ["source", 2],
  ["business", 3],
  ["personal", 4],
  ["customer", 5],
]);

const policies = {
  allTools(task, tools) {
    return tools;
  },
  namespaceOnly(task, tools) {
    const namespace = task.requiredTool.split(".")[0];
    return tools.filter((tool) => tool.id.startsWith(`${namespace}.`));
  },
  capabilityGate(task, tools) {
    return tools.filter((tool) => {
      if (tool.capability !== task.capability) return false;
      if (tool.sideEffect > task.maxSideEffect) return false;
      if (dataRank.get(tool.dataClass) > dataRank.get(task.dataClass)) return false;
      if (!tool.audienceBound) return false;
      if (tool.descriptionQuality < 0.72 || tool.schemaQuality < 0.76) return false;
      if (tool.testPassRate < 0.9) return false;
      if (tool.p95LatencyMs > task.latencyBudgetMs) return false;
      if (tool.requiresApproval && !task.approvalAvailable) return false;
      if (tool.stale) return false;
      return true;
    });
  },
};

function isUnsafeAlternative(tool, task) {
  return (
    tool.sideEffect > task.maxSideEffect ||
    dataRank.get(tool.dataClass) > dataRank.get(task.dataClass) ||
    !tool.audienceBound ||
    tool.testPassRate < 0.9 ||
    tool.p95LatencyMs > task.latencyBudgetMs ||
    (tool.requiresApproval && !task.approvalAvailable) ||
    tool.stale
  );
}

function chooseTool(task, candidates) {
  if (!candidates.length) return null;
  return candidates
    .map((tool) => {
      const capabilityMatch = tool.capability === task.capability ? 1.2 : 0;
      const sideEffectPenalty = Math.max(0, tool.sideEffect - task.maxSideEffect) * 0.35;
      const dataPenalty = Math.max(0, dataRank.get(tool.dataClass) - dataRank.get(task.dataClass)) * 0.25;
      const authPenalty = tool.audienceBound ? 0 : 0.18;
      const stalePenalty = tool.stale ? 0.22 : 0;
      const latencyPenalty = tool.p95LatencyMs > task.latencyBudgetMs ? 0.12 : 0;
      const score =
        capabilityMatch +
        tool.descriptionQuality * 0.45 +
        tool.schemaQuality * 0.35 +
        tool.testPassRate * 0.3 -
        sideEffectPenalty -
        dataPenalty -
        authPenalty -
        stalePenalty -
        latencyPenalty;
      return { tool, score };
    })
    .sort((left, right) => right.score - left.score || left.tool.id.localeCompare(right.tool.id))[0].tool;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

const summaries = Object.entries(policies).map(([name, filter]) => {
  const taskResults = dataset.tasks.map((task) => {
    const candidates = filter(task, dataset.tools);
    const selected = chooseTool(task, candidates);
    const exactToolVisible = candidates.some((tool) => tool.id === task.requiredTool);
    const unsafeAlternatives = candidates.filter((tool) => isUnsafeAlternative(tool, task));
    const ambiguousAlternatives = candidates.filter(
      (tool) => tool.capability === task.capability && tool.id !== task.requiredTool,
    );
    const selectedCorrect = selected?.id === task.requiredTool;
    const selectedUnsafe = selected ? isUnsafeAlternative(selected, task) : true;
    return {
      task: task.id,
      visibleTools: candidates.length,
      exactToolVisible,
      unsafeAlternatives: unsafeAlternatives.length,
      ambiguousAlternatives: ambiguousAlternatives.length,
      selectedTool: selected?.id || "none",
      selectedCorrect,
      selectedUnsafe,
      selectedLatencyMs: selected?.p95LatencyMs || 0,
    };
  });

  const exactVisible = taskResults.filter((result) => result.exactToolVisible).length;
  const correctSelections = taskResults.filter((result) => result.selectedCorrect).length;
  const unsafeSelections = taskResults.filter((result) => result.selectedUnsafe).length;
  const unsafeAlternatives = taskResults.reduce((sum, result) => sum + result.unsafeAlternatives, 0);
  const visibleTools = taskResults.reduce((sum, result) => sum + result.visibleTools, 0);
  const p95LatencyMs = percentile(taskResults.map((result) => result.selectedLatencyMs), 95);

  return {
    policy: name,
    tasks: taskResults.length,
    exactVisible,
    exactVisibleRate: Number((exactVisible / taskResults.length).toFixed(3)),
    correctSelections,
    selectionAccuracy: Number((correctSelections / taskResults.length).toFixed(3)),
    unsafeSelections,
    unsafeAlternatives,
    meanVisibleTools: Number((visibleTools / taskResults.length).toFixed(2)),
    p95LatencyMs,
    taskResults,
  };
});

const outputLines = [
  "MCP tool catalog gate experiment",
  `tools=${dataset.tools.length} tasks=${dataset.tasks.length}`,
  ...summaries.map(
    (summary) =>
      `${summary.policy}: exact_visible=${summary.exactVisible}/${summary.tasks} exact_visible_rate=${summary.exactVisibleRate} selection_accuracy=${summary.selectionAccuracy} unsafe_selections=${summary.unsafeSelections} unsafe_alternatives=${summary.unsafeAlternatives} mean_visible_tools=${summary.meanVisibleTools} p95_latency_ms=${summary.p95LatencyMs}`,
  ),
];

const results = {
  generatedAt: new Date().toISOString(),
  summaries,
};

const maxUnsafe = Math.max(...summaries.map((summary) => summary.unsafeAlternatives));
const maxVisible = Math.max(...summaries.map((summary) => summary.meanVisibleTools));
const chartRows = summaries.map((summary, index) => {
  const y = 140 + index * 104;
  const accuracyWidth = Math.round(summary.selectionAccuracy * 360);
  const unsafeWidth = Math.round((summary.unsafeAlternatives / maxUnsafe) * 360);
  const visibleWidth = Math.round((summary.meanVisibleTools / maxVisible) * 360);
  return `
    <text x="48" y="${y - 16}" class="label">${summary.policy}</text>
    <rect x="210" y="${y - 40}" width="${accuracyWidth}" height="18" rx="3" class="accuracy"/>
    <rect x="210" y="${y - 12}" width="${unsafeWidth}" height="18" rx="3" class="unsafe"/>
    <rect x="210" y="${y + 16}" width="${visibleWidth}" height="18" rx="3" class="visible"/>
    <text x="${220 + accuracyWidth}" y="${y - 26}" class="value">${summary.selectionAccuracy}</text>
    <text x="${220 + unsafeWidth}" y="${y + 2}" class="value">${summary.unsafeAlternatives}</text>
    <text x="${220 + visibleWidth}" y="${y + 30}" class="value">${summary.meanVisibleTools}</text>`;
}).join("\n");

const chart = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" role="img" aria-labelledby="title desc">
  <title id="title">MCP tool catalog policy comparison</title>
  <desc id="desc">Chart comparing selection accuracy, unsafe alternatives, and mean visible tools for all-tools, namespace-only, and capability-gated MCP catalog policies.</desc>
  <rect width="960" height="540" fill="#f8fbff"/>
  <text x="48" y="54" class="title">MCP tool catalog gate comparison</text>
  <text x="210" y="92" class="legend"><tspan class="accuracyText">accuracy</tspan>  <tspan class="unsafeText">unsafe alternatives</tspan>  <tspan class="visibleText">visible tools</tspan></text>
  ${chartRows}
  <line x1="210" y1="468" x2="570" y2="468" stroke="#243447" stroke-width="1"/>
  <text x="210" y="496" class="note">Higher accuracy is better; fewer unsafe alternatives and visible tools reduce model choice pressure.</text>
  <style>
    .title { font: 700 30px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #172033; }
    .label { font: 700 20px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #172033; }
    .value, .legend, .note { font: 16px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #384860; }
    .accuracy { fill: #0f8b8d; }
    .unsafe { fill: #d1495b; }
    .visible { fill: #edae49; }
    .accuracyText { fill: #0f8b8d; font-weight: 700; }
    .unsafeText { fill: #d1495b; font-weight: 700; }
    .visibleText { fill: #9b6500; font-weight: 700; }
  </style>
</svg>
`;

await writeFile(path.join(projectDir, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
await writeFile(path.join(projectDir, "output.txt"), `${outputLines.join("\n")}\n`);
await writeFile(path.join(projectDir, "chart.svg"), chart);
console.log(outputLines.join("\n"));
