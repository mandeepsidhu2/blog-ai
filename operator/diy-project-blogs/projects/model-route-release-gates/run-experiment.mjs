#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const cases = [
  { id: "classify-ticket", difficulty: 0.22, risk: 0.12, write: false, needsCitations: false },
  { id: "summarize-runbook", difficulty: 0.36, risk: 0.25, write: false, needsCitations: true },
  { id: "draft-customer-reply", difficulty: 0.48, risk: 0.42, write: false, needsCitations: true },
  { id: "triage-security-alert", difficulty: 0.66, risk: 0.78, write: false, needsCitations: true },
  { id: "plan-code-migration", difficulty: 0.74, risk: 0.61, write: false, needsCitations: true },
  { id: "repair-test-failure", difficulty: 0.68, risk: 0.55, write: true, needsCitations: true },
  { id: "update-billing-record", difficulty: 0.40, risk: 0.88, write: true, needsCitations: true },
  { id: "generate-weekly-report", difficulty: 0.32, risk: 0.30, write: false, needsCitations: true },
  { id: "approve-index-refresh", difficulty: 0.58, risk: 0.67, write: true, needsCitations: true },
  { id: "answer-product-question", difficulty: 0.27, risk: 0.22, write: false, needsCitations: true },
  { id: "investigate-outage", difficulty: 0.78, risk: 0.72, write: false, needsCitations: true },
  { id: "merge-dependency-patch", difficulty: 0.70, risk: 0.69, write: true, needsCitations: true },
];

const models = {
  localFast: { qualityBase: 0.72, reasoningLift: 0.08, p50Ms: 520, p95Ms: 950, costPer1k: 0.0 },
  hostedSmall: { qualityBase: 0.80, reasoningLift: 0.12, p50Ms: 700, p95Ms: 1350, costPer1k: 0.08 },
  hostedReasoning: { qualityBase: 0.90, reasoningLift: 0.24, p50Ms: 1550, p95Ms: 3600, costPer1k: 0.32 },
};

const policies = [
  {
    id: "cheapest-first",
    choose(caseItem) {
      return caseItem.difficulty > 0.76 ? "hostedSmall" : "localFast";
    },
  },
  {
    id: "frontier-only",
    choose() {
      return "hostedReasoning";
    },
  },
  {
    id: "risk-aware-router",
    choose(caseItem) {
      if (caseItem.write || caseItem.risk >= 0.65 || caseItem.difficulty >= 0.7) return "hostedReasoning";
      if (caseItem.needsCitations || caseItem.difficulty >= 0.42) return "hostedSmall";
      return "localFast";
    },
  },
];

function jitter(seed) {
  let hash = 17;
  for (const char of seed) hash = (hash * 37 + char.charCodeAt(0)) % 104729;
  return hash / 104729;
}

function score(caseItem, policy) {
  const modelId = policy.choose(caseItem);
  const model = models[modelId];
  const noise = (jitter(`${caseItem.id}:${policy.id}`) - 0.5) * 0.04;
  const quality =
    model.qualityBase +
    model.reasoningLift * caseItem.difficulty -
    caseItem.risk * 0.10 -
    (caseItem.write && modelId !== "hostedReasoning" ? 0.12 : 0) +
    noise;
  const citationPenalty = caseItem.needsCitations && modelId === "localFast" ? 0.08 : 0;
  const finalQuality = Math.max(0, Math.min(1, quality - citationPenalty));
  const tokens = Math.round(900 + caseItem.difficulty * 1800 + caseItem.risk * 900 + (modelId === "hostedReasoning" ? 1200 : 0));
  const latencyMs = Math.round(model.p50Ms + (model.p95Ms - model.p50Ms) * jitter(`${policy.id}:${caseItem.id}:latency`));
  const costUsd = Number(((tokens / 1000) * model.costPer1k).toFixed(4));
  const blockedUnsafeWrite = caseItem.write ? modelId === "hostedReasoning" && finalQuality >= 0.83 : true;
  const pass =
    finalQuality >= (caseItem.risk >= 0.65 ? 0.84 : 0.78) &&
    latencyMs <= 4200 &&
    costUsd <= 2.0 &&
    blockedUnsafeWrite;
  return {
    caseId: caseItem.id,
    policy: policy.id,
    model: modelId,
    quality: Number(finalQuality.toFixed(3)),
    latencyMs,
    costUsd,
    blockedUnsafeWrite,
    pass,
  };
}

function aggregate(rows, policyId) {
  const selected = rows.filter((row) => row.policy === policyId);
  const mean = (key) => selected.reduce((sum, row) => sum + row[key], 0) / selected.length;
  const sortedLatency = selected.map((row) => row.latencyMs).sort((a, b) => a - b);
  const p95Latency = sortedLatency[Math.ceil(sortedLatency.length * 0.95) - 1];
  return {
    policy: policyId,
    passRate: Number((selected.filter((row) => row.pass).length / selected.length).toFixed(3)),
    meanQuality: Number(mean("quality").toFixed(3)),
    p95LatencyMs: p95Latency,
    totalCostUsd: Number(selected.reduce((sum, row) => sum + row.costUsd, 0).toFixed(4)),
    unsafeWriteFailures: selected.filter((row) => !row.blockedUnsafeWrite).length,
    modelMix: Object.fromEntries(Object.keys(models).map((modelId) => [modelId, selected.filter((row) => row.model === modelId).length])),
  };
}

function chartSvg(aggregates) {
  const bars = aggregates
    .map((item, index) => {
      const x = 115 + index * 180;
      const passHeight = Math.round(item.passRate * 180);
      const qualityHeight = Math.round(item.meanQuality * 180);
      return `
  <g>
    <rect x="${x}" y="${250 - passHeight}" width="54" height="${passHeight}" fill="#059669"/>
    <rect x="${x + 62}" y="${250 - qualityHeight}" width="54" height="${qualityHeight}" fill="#7c3aed"/>
    <text x="${x + 58}" y="282" text-anchor="middle" font-size="13">${item.policy}</text>
    <text x="${x + 27}" y="${238 - passHeight}" text-anchor="middle" font-size="12">${item.passRate}</text>
    <text x="${x + 89}" y="${238 - qualityHeight}" text-anchor="middle" font-size="12">${item.meanQuality}</text>
  </g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="360" viewBox="0 0 760 360" role="img" aria-labelledby="title desc">
  <title id="title">Model route release gate comparison</title>
  <desc id="desc">Bar chart comparing pass rate and quality across model routing policies.</desc>
  <rect width="760" height="360" fill="#f8fafc"/>
  <text x="48" y="44" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#111827">Model routing release gates</text>
  <text x="48" y="72" font-family="Arial, sans-serif" font-size="14" fill="#475569">Green is release pass rate; purple is mean quality.</text>
  <line x1="82" y1="250" x2="690" y2="250" stroke="#334155" stroke-width="1"/>
  <line x1="82" y1="70" x2="82" y2="250" stroke="#334155" stroke-width="1"/>
  ${bars}
  <rect x="510" y="38" width="14" height="14" fill="#059669"/><text x="532" y="50" font-family="Arial, sans-serif" font-size="13" fill="#334155">pass rate</text>
  <rect x="510" y="60" width="14" height="14" fill="#7c3aed"/><text x="532" y="72" font-family="Arial, sans-serif" font-size="13" fill="#334155">mean quality</text>
</svg>
`;
}

const rows = cases.flatMap((caseItem) => policies.map((policy) => score(caseItem, policy)));
const aggregates = policies.map((policy) => aggregate(rows, policy.id));
const result = {
  runAt: new Date().toISOString(),
  releaseGate: {
    minQualityLowRisk: 0.78,
    minQualityHighRisk: 0.84,
    maxLatencyMs: 4200,
    maxCostUsdPerCase: 2.0,
    unsafeWritesMustBeBlocked: true,
  },
  models,
  cases,
  aggregates,
  rows,
};

const output = [
  `cases: ${cases.length}`,
  ...aggregates.map(
    (item) =>
      `${item.policy}: passRate=${item.passRate.toFixed(3)} quality=${item.meanQuality.toFixed(3)} p95LatencyMs=${item.p95LatencyMs} costUsd=${item.totalCostUsd.toFixed(4)} unsafeWriteFailures=${item.unsafeWriteFailures} mix=${JSON.stringify(item.modelMix)}`,
  ),
  "",
].join("\n");

await fs.writeFile(path.join(__dirname, "dataset.json"), `${JSON.stringify(cases, null, 2)}\n`);
await fs.writeFile(path.join(__dirname, "results.json"), `${JSON.stringify(result, null, 2)}\n`);
await fs.writeFile(path.join(__dirname, "output.txt"), output);
await fs.writeFile(path.join(__dirname, "chart.svg"), chartSvg(aggregates));
console.log(output.trim());
