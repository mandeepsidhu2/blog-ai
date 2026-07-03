#!/usr/bin/env node
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const datasetPath = path.join(projectDir, "dataset.json");
const outputPath = path.join(projectDir, "output.txt");
const resultsPath = path.join(projectDir, "results.json");
const chartPath = path.join(projectDir, "chart.svg");

const raw = await fs.readFile(datasetPath, "utf8");
const cases = JSON.parse(raw);
const datasetSha256 = createHash("sha256").update(raw).digest("hex");

const rank = { block: 2, review: 1, allow: 0 };

function seatRolloutGate(row) {
  if (row.activeRate >= 0.5) return "allow";
  return "review";
}

function adoptionOnlyGate(row) {
  if (row.activeRate < 0.45 || row.retentionRate < 0.35) return "block";
  if (row.mergedPrLift < 0.08 || row.peerNeighborRate < 0.40) return "review";
  return "allow";
}

function adoptionCostQualityGate(row) {
  if (!row.evalLogging || row.traceCoverage < 0.75) return "block";
  if (row.securityIncidents > 0) return "block";
  if (row.reviewFailureRate > 0.12) return "block";
  if (row.costPerActiveUserUsd > row.costBudgetUsd * 1.35) return "block";
  if (row.retentionRate < 0.25) return "block";
  if (row.mergedPrLift < 0.02) return "block";
  if (row.sampleSize < 25) return "review";
  if (row.costPerActiveUserUsd > row.costBudgetUsd * 0.90) return "review";
  if (row.mergedPrLift < 0.10) return "review";
  if (row.activeRate < 0.50 || row.retentionRate < 0.40) return "review";
  if (row.peerNeighborRate < 0.50) return "review";
  return "allow";
}

function evaluate(name, gate) {
  const predictions = cases.map((row) => ({
    id: row.id,
    expected: row.expected,
    predicted: gate(row),
  }));
  const exact = predictions.filter((row) => row.expected === row.predicted).length;
  const expectedBlocks = predictions.filter((row) => row.expected === "block").length;
  const falseNegatives = predictions.filter(
    (row) => row.expected === "block" && rank[row.predicted] < rank[row.expected],
  ).length;
  const reviewLoad = predictions.filter((row) => row.predicted === "review").length;
  return {
    name,
    exact,
    total: cases.length,
    accuracy: exact / cases.length,
    blockRecall: expectedBlocks ? (expectedBlocks - falseNegatives) / expectedBlocks : 1,
    falseNegatives,
    reviewLoad,
    predictions,
  };
}

const results = [
  evaluate("seatRolloutGate", seatRolloutGate),
  evaluate("adoptionOnlyGate", adoptionOnlyGate),
  evaluate("adoptionCostQualityGate", adoptionCostQualityGate),
];

const lines = [
  `dataset_cases=${cases.length}`,
  `dataset_sha256=${datasetSha256}`,
  ...results.map(
    (result) =>
      `gate=${result.name} accuracy=${result.accuracy.toFixed(3)} block_recall=${result.blockRecall.toFixed(3)} false_negatives=${result.falseNegatives} review_load=${result.reviewLoad}`,
  ),
];

function bar(x, y, width, height, label, value, color) {
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4" fill="${color}" />
    <text x="${x + width / 2}" y="${y - 10}" text-anchor="middle" font-size="20" font-weight="700" fill="#202124">${value}</text>
    <text x="${x + width / 2}" y="430" text-anchor="middle" font-size="17" fill="#3c4043">${label}</text>`;
}

const maxHeight = 260;
const bars = results
  .map((result, index) => {
    const height = Math.round(result.blockRecall * maxHeight);
    return bar(165 + index * 225, 360 - height, 118, height, result.name.replace("Gate", ""), result.blockRecall.toFixed(2), ["#b3261e", "#f29900", "#188038"][index]);
  })
  .join("\n");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" role="img" aria-labelledby="title desc">
  <title id="title">AI coding agent rollout gate block recall comparison</title>
  <desc id="desc">Bar chart comparing block recall for seat rollout, adoption only, and adoption cost quality rollout gates.</desc>
  <rect width="960" height="540" fill="#f8fafd"/>
  <text x="60" y="62" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#202124">Rollout gate block recall</text>
  <text x="60" y="98" font-family="Arial, sans-serif" font-size="18" fill="#5f6368">Strong rollout gates catch unsafe expansion decisions before cost, quality, or security failures scale.</text>
  <line x1="110" y1="360" x2="850" y2="360" stroke="#9aa0a6" stroke-width="2"/>
  <line x1="110" y1="100" x2="110" y2="360" stroke="#9aa0a6" stroke-width="2"/>
  <text x="72" y="112" font-family="Arial, sans-serif" font-size="14" fill="#5f6368">1.0</text>
  <text x="72" y="238" font-family="Arial, sans-serif" font-size="14" fill="#5f6368">0.5</text>
  <text x="80" y="365" font-family="Arial, sans-serif" font-size="14" fill="#5f6368">0</text>
  <g font-family="Arial, sans-serif">${bars}</g>
  <text x="60" y="492" font-family="Arial, sans-serif" font-size="18" fill="#202124">Dataset: ${cases.length} rollout scenarios, ${results.at(-1).falseNegatives} false negatives for the tested gate.</text>
</svg>
`;

await fs.writeFile(outputPath, `${lines.join("\n")}\n`);
await fs.writeFile(
  resultsPath,
  JSON.stringify({ datasetSha256, caseCount: cases.length, results }, null, 2),
);
await fs.writeFile(chartPath, svg);
console.log(lines.join("\n"));
