#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const datasetPath = path.join(projectDir, "dataset.json");
const outputPath = path.join(projectDir, "output.txt");
const resultsPath = path.join(projectDir, "results.json");
const chartPath = path.join(projectDir, "chart.svg");

const lanes = {
  "parallel-read": {
    maxSubagents: 5,
    concurrencyMultiplier: 0.48,
    tokenMultiplier: 1.08,
    approvalPenalty: 0,
    writeRiskPenalty: 0,
  },
  "bounded-write": {
    maxSubagents: 2,
    concurrencyMultiplier: 0.72,
    tokenMultiplier: 1.18,
    approvalPenalty: 0.08,
    writeRiskPenalty: 0.14,
  },
  "serial-reviewed": {
    maxSubagents: 1,
    concurrencyMultiplier: 1.12,
    tokenMultiplier: 1.02,
    approvalPenalty: 0.2,
    writeRiskPenalty: 0.08,
  },
};

const policies = {
  parallelDefault(task) {
    return task.subagents > 1 ? "parallel-read" : "bounded-write";
  },
  writeAware(task) {
    if (task.writeOperations > 0) return "bounded-write";
    return "parallel-read";
  },
  budgetedGate(task) {
    if (task.risk === "high" && (task.writeOperations > 0 || task.approvalRequests >= 3)) {
      return "serial-reviewed";
    }
    if (task.writeOperations > 0) return "bounded-write";
    return "parallel-read";
  },
};

function qualityPass(task, laneName) {
  if (task.risk === "high" && laneName !== "serial-reviewed") return false;
  if (task.writeOperations > 3 && laneName === "parallel-read") return false;
  if (task.approvalRequests >= 4 && laneName !== "serial-reviewed") return false;
  return true;
}

function estimate(task, laneName) {
  const lane = lanes[laneName];
  const activeSubagents = Math.min(task.subagents, lane.maxSubagents);
  const minutes = Math.round(
    task.estimatedMinutes *
      lane.concurrencyMultiplier *
      Math.max(1, task.subagents / activeSubagents) *
      (1 + lane.approvalPenalty * task.approvalRequests + lane.writeRiskPenalty * Math.min(task.writeOperations, 4)),
  );
  const tokenUnits = Math.round(
    task.promptTokens *
      lane.tokenMultiplier *
      activeSubagents *
      (1 + 0.04 * task.approvalRequests + 0.03 * task.writeOperations),
  );
  return { minutes, tokenUnits, activeSubagents };
}

function evaluatePolicy(name, route, tasks) {
  const decisions = tasks.map((task) => {
    const lane = route(task);
    const estimateResult = estimate(task, lane);
    const qualityOk = qualityPass(task, lane);
    const expectedMatch = lane === task.expectedLane;
    const reviewLoadOk = lane !== "parallel-read" || task.approvalRequests <= 1;
    const pass = qualityOk && reviewLoadOk;
    return {
      id: task.id,
      expectedLane: task.expectedLane,
      lane,
      minutes: estimateResult.minutes,
      tokenUnits: estimateResult.tokenUnits,
      activeSubagents: estimateResult.activeSubagents,
      qualityOk,
      reviewLoadOk,
      expectedMatch,
      pass,
    };
  });
  const totalMinutes = decisions.reduce((sum, decision) => sum + decision.minutes, 0);
  const totalTokens = decisions.reduce((sum, decision) => sum + decision.tokenUnits, 0);
  const qualityMisses = decisions.filter((decision) => !decision.qualityOk).length;
  const reviewMisses = decisions.filter((decision) => !decision.reviewLoadOk).length;
  const expectedMatches = decisions.filter((decision) => decision.expectedMatch).length;
  const passCount = decisions.filter((decision) => decision.pass).length;
  return {
    name,
    passRate: Number((passCount / decisions.length).toFixed(3)),
    expectedMatchRate: Number((expectedMatches / decisions.length).toFixed(3)),
    totalMinutes,
    totalTokens,
    qualityMisses,
    reviewMisses,
    decisions,
  };
}

function renderChart(results) {
  const width = 940;
  const height = 520;
  const left = 96;
  const top = 92;
  const chartHeight = 286;
  const groupWidth = 248;
  const maxTokens = Math.max(...results.map((result) => result.totalTokens));
  const maxMisses = Math.max(...results.map((result) => result.qualityMisses + result.reviewMisses), 1);
  const labels = {
    parallelDefault: "parallel default",
    writeAware: "write aware",
    budgetedGate: "budgeted gate",
  };
  const bars = results
    .map((result, index) => {
      const x = left + index * groupWidth;
      const passHeight = result.passRate * chartHeight;
      const tokenHeight = (result.totalTokens / maxTokens) * chartHeight;
      const missHeight = ((result.qualityMisses + result.reviewMisses) / maxMisses) * chartHeight;
      return `
      <g>
        <rect x="${x}" y="${top + chartHeight - passHeight}" width="48" height="${passHeight}" rx="4" fill="#19766f"/>
        <rect x="${x + 66}" y="${top + chartHeight - tokenHeight}" width="48" height="${tokenHeight}" rx="4" fill="#7457c8"/>
        <rect x="${x + 132}" y="${top + chartHeight - missHeight}" width="48" height="${missHeight}" rx="4" fill="#c43b3b"/>
        <text x="${x + 24}" y="${top + chartHeight + 28}" text-anchor="middle" font-size="14" fill="#1f2937">pass</text>
        <text x="${x + 90}" y="${top + chartHeight + 28}" text-anchor="middle" font-size="14" fill="#1f2937">tokens</text>
        <text x="${x + 156}" y="${top + chartHeight + 28}" text-anchor="middle" font-size="14" fill="#1f2937">miss</text>
        <text x="${x + 90}" y="${top + chartHeight + 58}" text-anchor="middle" font-size="17" font-weight="700" fill="#111827">${labels[result.name]}</text>
      </g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="940" height="520" viewBox="0 0 940 520" role="img" aria-labelledby="title desc">
  <title id="title">Agent concurrency budget policy scorecard</title>
  <desc id="desc">Bar chart comparing pass rate, normalized token load, and combined review or quality misses for three agent concurrency policies.</desc>
  <rect width="940" height="520" fill="#f7fafc"/>
  <rect x="36" y="32" width="868" height="456" rx="8" fill="#ffffff" stroke="#cbd5e1"/>
  <text x="72" y="72" font-size="25" font-weight="700" fill="#0f172a">Agent concurrency budget gates</text>
  <text x="72" y="102" font-size="15" fill="#475569">Higher pass is better; token load is normalized; review and quality misses should stay at zero.</text>
  <line x1="${left - 24}" y1="${top + chartHeight}" x2="842" y2="${top + chartHeight}" stroke="#94a3b8"/>
  <line x1="${left - 24}" y1="${top}" x2="${left - 24}" y2="${top + chartHeight}" stroke="#94a3b8"/>
  <text x="48" y="${top + 8}" font-size="13" fill="#64748b">1.0</text>
  <text x="56" y="${top + chartHeight + 4}" font-size="13" fill="#64748b">0</text>
  ${bars}
  <g transform="translate(72 456)">
    <rect width="14" height="14" fill="#19766f"/><text x="22" y="12" font-size="14" fill="#334155">Pass rate</text>
    <rect x="116" width="14" height="14" fill="#7457c8"/><text x="138" y="12" font-size="14" fill="#334155">Normalized token load</text>
    <rect x="314" width="14" height="14" fill="#c43b3b"/><text x="336" y="12" font-size="14" fill="#334155">Review or quality misses</text>
  </g>
</svg>`;
}

async function main() {
  const tasks = JSON.parse(await fs.readFile(datasetPath, "utf8"));
  const results = Object.entries(policies).map(([name, route]) => evaluatePolicy(name, route, tasks));
  const lines = [
    "Agent concurrency budget experiment",
    `tasks=${tasks.length}`,
    ...results.map(
      (result) =>
        `${result.name}: pass_rate=${result.passRate} expected_match=${result.expectedMatchRate} total_minutes=${result.totalMinutes} token_units=${result.totalTokens} quality_misses=${result.qualityMisses} review_misses=${result.reviewMisses}`,
    ),
  ];
  await fs.writeFile(resultsPath, `${JSON.stringify({ tasks: tasks.length, lanes, results }, null, 2)}\n`);
  await fs.writeFile(outputPath, `${lines.join("\n")}\n`);
  await fs.writeFile(chartPath, renderChart(results));
  console.log(lines.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
