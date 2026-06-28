#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const datasetPath = path.join(projectDir, "dataset.json");
const outputPath = path.join(projectDir, "output.txt");
const resultsPath = path.join(projectDir, "results.json");
const chartPath = path.join(projectDir, "chart.svg");

const tiers = {
  "small-realtime": {
    inputPerMTok: 0.18,
    outputPerMTok: 0.72,
    baseLatencyMs: 650,
    throughputTokensPerSecond: 1550,
    quality: 0.76,
    supportsReasoning: false,
  },
  "batch-small": {
    inputPerMTok: 0.09,
    outputPerMTok: 0.36,
    baseLatencyMs: 5000,
    throughputTokensPerSecond: 900,
    quality: 0.74,
    supportsReasoning: false,
  },
  "flex-balanced": {
    inputPerMTok: 0.55,
    outputPerMTok: 2.2,
    baseLatencyMs: 1400,
    throughputTokensPerSecond: 980,
    quality: 0.84,
    supportsReasoning: false,
  },
  "priority-frontier": {
    inputPerMTok: 2.5,
    outputPerMTok: 10,
    baseLatencyMs: 900,
    throughputTokensPerSecond: 720,
    quality: 0.94,
    supportsReasoning: true,
  },
};

const policies = {
  frontierOnly(task) {
    return task.inputTokens > 10000 && task.latencySlaMs > 60000 ? "batch-small" : "priority-frontier";
  },
  cheapestFirst(task) {
    if (task.latencySlaMs > 30000) return "batch-small";
    if (task.inputTokens < 1200 && task.risk === "low") return "small-realtime";
    return "flex-balanced";
  },
  budgetGate(task) {
    if (task.requiresReasoning || task.risk === "high") return "priority-frontier";
    if (task.latencySlaMs > 30000 || task.taskType === "retrieval-maintenance") return "batch-small";
    if (task.inputTokens < 1200 && task.risk === "low") return "small-realtime";
    return "flex-balanced";
  },
};

function estimateCost(task, tier) {
  const spec = tiers[tier];
  const effectiveInput = task.inputTokens * (1 - task.contextReuse * 0.55);
  return (effectiveInput / 1_000_000) * spec.inputPerMTok + (task.outputTokens / 1_000_000) * spec.outputPerMTok;
}

function estimateLatencyMs(task, tier) {
  const spec = tiers[tier];
  const effectiveTokens = task.inputTokens * (1 - task.contextReuse * 0.35) + task.outputTokens;
  const generationMs = (effectiveTokens / spec.throughputTokensPerSecond) * 1000;
  const cacheBonusMs = Math.min(1800, task.contextReuse * 1600);
  return Math.round(spec.baseLatencyMs + generationMs - cacheBonusMs);
}

function qualityPass(task, tier) {
  const spec = tiers[tier];
  if (task.requiresReasoning && !spec.supportsReasoning) return false;
  if (task.risk === "high" && spec.quality < 0.9) return false;
  if (task.requiresCitation && spec.quality < 0.8 && task.contextReuse < 0.7) return false;
  return true;
}

function evaluatePolicy(name, route, tasks) {
  const decisions = tasks.map((task) => {
    const tier = route(task);
    const cost = estimateCost(task, tier);
    const latencyMs = estimateLatencyMs(task, tier);
    const qualityOk = qualityPass(task, tier);
    const latencyOk = latencyMs <= task.latencySlaMs;
    const expectedMatch = tier === task.expectedTier;
    return {
      id: task.id,
      expectedTier: task.expectedTier,
      tier,
      cost: Number(cost.toFixed(6)),
      latencyMs,
      qualityOk,
      latencyOk,
      expectedMatch,
      pass: qualityOk && latencyOk,
    };
  });

  const totalCost = decisions.reduce((sum, decision) => sum + decision.cost, 0);
  const slaMisses = decisions.filter((decision) => !decision.latencyOk).length;
  const qualityMisses = decisions.filter((decision) => !decision.qualityOk).length;
  const expectedMatches = decisions.filter((decision) => decision.expectedMatch).length;
  const passCount = decisions.filter((decision) => decision.pass).length;
  return {
    name,
    totalCost: Number(totalCost.toFixed(5)),
    meanLatencyMs: Math.round(decisions.reduce((sum, decision) => sum + decision.latencyMs, 0) / decisions.length),
    expectedMatchRate: Number((expectedMatches / decisions.length).toFixed(3)),
    passRate: Number((passCount / decisions.length).toFixed(3)),
    slaMisses,
    qualityMisses,
    decisions,
  };
}

function renderChart(results) {
  const width = 920;
  const height = 520;
  const left = 90;
  const top = 78;
  const groupWidth = 240;
  const chartHeight = 310;
  const maxCost = Math.max(...results.map((result) => result.totalCost));
  const colors = ["#1f766e", "#b45309", "#315fba"];
  const bars = results
    .map((result, index) => {
      const x = left + index * groupWidth;
      const passHeight = result.passRate * chartHeight;
      const missHeight = (result.qualityMisses + result.slaMisses) * 24;
      const costHeight = (result.totalCost / maxCost) * chartHeight;
      return `
        <g>
          <rect x="${x}" y="${top + chartHeight - passHeight}" width="48" height="${passHeight}" rx="4" fill="${colors[index]}"/>
          <rect x="${x + 64}" y="${top + chartHeight - costHeight}" width="48" height="${costHeight}" rx="4" fill="#7c3aed"/>
          <rect x="${x + 128}" y="${top + chartHeight - missHeight}" width="48" height="${missHeight}" rx="4" fill="#dc2626"/>
          <text x="${x + 24}" y="${top + chartHeight + 28}" text-anchor="middle" font-size="15" fill="#172033">pass</text>
          <text x="${x + 88}" y="${top + chartHeight + 28}" text-anchor="middle" font-size="15" fill="#172033">cost</text>
          <text x="${x + 152}" y="${top + chartHeight + 28}" text-anchor="middle" font-size="15" fill="#172033">miss</text>
          <text x="${x + 88}" y="${top + chartHeight + 58}" text-anchor="middle" font-size="18" font-weight="700" fill="#172033">${result.name}</text>
        </g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="520" viewBox="0 0 920 520" role="img" aria-labelledby="title desc">
  <title id="title">Token budget routing policy comparison</title>
  <desc id="desc">Bar chart comparing pass rate, normalized cost, and combined SLA or quality misses for frontier-only, cheapest-first, and budget-gate routing policies.</desc>
  <rect width="920" height="520" fill="#f8fafc"/>
  <rect x="38" y="34" width="844" height="448" rx="8" fill="#ffffff" stroke="#cbd5e1"/>
  <text x="70" y="70" font-size="24" font-weight="700" fill="#111827">Token-budget routing scorecard</text>
  <text x="70" y="99" font-size="15" fill="#475569">Higher pass bars are better; cost is normalized to the most expensive policy; misses should be zero.</text>
  <line x1="${left - 20}" y1="${top + chartHeight}" x2="835" y2="${top + chartHeight}" stroke="#94a3b8"/>
  <line x1="${left - 20}" y1="${top}" x2="${left - 20}" y2="${top + chartHeight}" stroke="#94a3b8"/>
  <text x="42" y="${top + 8}" font-size="13" fill="#64748b">1.0</text>
  <text x="42" y="${top + chartHeight + 4}" font-size="13" fill="#64748b">0</text>
  ${bars}
  <g transform="translate(70 455)">
    <rect width="14" height="14" fill="#315fba"/><text x="22" y="12" font-size="14" fill="#334155">Pass rate</text>
    <rect x="128" width="14" height="14" fill="#7c3aed"/><text x="150" y="12" font-size="14" fill="#334155">Normalized total cost</text>
    <rect x="320" width="14" height="14" fill="#dc2626"/><text x="342" y="12" font-size="14" fill="#334155">SLA or quality misses</text>
  </g>
</svg>`;
}

async function main() {
  const tasks = JSON.parse(await fs.readFile(datasetPath, "utf8"));
  const results = Object.entries(policies).map(([name, route]) => evaluatePolicy(name, route, tasks));
  const lines = [
    "Token-budget routing experiment",
    `tasks=${tasks.length}`,
    ...results.map(
      (result) =>
        `${result.name}: pass_rate=${result.passRate} expected_match=${result.expectedMatchRate} total_cost=$${result.totalCost.toFixed(5)} mean_latency_ms=${result.meanLatencyMs} sla_misses=${result.slaMisses} quality_misses=${result.qualityMisses}`,
    ),
  ];
  await fs.writeFile(resultsPath, `${JSON.stringify({ tasks: tasks.length, tiers, results }, null, 2)}\n`);
  await fs.writeFile(outputPath, `${lines.join("\n")}\n`);
  await fs.writeFile(chartPath, renderChart(results));
  console.log(lines.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
