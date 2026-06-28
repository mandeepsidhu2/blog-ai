#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(await fs.readFile(path.join(here, "dataset.json"), "utf8"));

function testsOnly(caseItem) {
  return caseItem.tests.length > 0 ? "allow" : "block";
}

function provenanceGate(caseItem) {
  if (caseItem.agentGenerated && !caseItem.hasTrace) return "block";
  if (caseItem.agentGenerated && caseItem.tests.length === 0) return "block";
  if (caseItem.sensitivePath || !caseItem.hasReviewer || caseItem.linesChanged > 300) return "review";
  return "allow";
}

function scoreRun(label, decide) {
  const cases = dataset.map((caseItem) => {
    const decision = decide(caseItem);
    return {
      id: caseItem.id,
      expected: caseItem.expectedDecision,
      decision,
      correct: decision === caseItem.expectedDecision
    };
  });
  const accuracy = cases.filter((item) => item.correct).length / cases.length;
  const unsafeMerges = cases.filter((item) => item.decision === "allow" && item.expected !== "allow").length;
  const unnecessaryBlocks = cases.filter((item) => item.decision === "block" && item.expected === "allow").length;
  const reviewCapture = cases.filter((item) => item.expected === "review" && item.decision === "review").length /
    Math.max(1, cases.filter((item) => item.expected === "review").length);
  return { label, accuracy, unsafeMerges, unnecessaryBlocks, reviewCapture, cases };
}

const results = {
  generatedAt: new Date().toISOString(),
  caseCount: dataset.length,
  baselines: [
    scoreRun("tests-only gate", testsOnly),
    scoreRun("provenance gate", provenanceGate)
  ]
};

const output = [
  `caseCount: ${results.caseCount}`,
  ...results.baselines.map((run) => [
    `${run.label}.accuracy: ${run.accuracy.toFixed(3)}`,
    `${run.label}.unsafeMerges: ${run.unsafeMerges}`,
    `${run.label}.unnecessaryBlocks: ${run.unnecessaryBlocks}`,
    `${run.label}.reviewCapture: ${run.reviewCapture.toFixed(3)}`
  ].join("\n"))
].join("\n");

const chart = `<svg xmlns="http://www.w3.org/2000/svg" width="980" height="520" viewBox="0 0 980 520" role="img" aria-labelledby="title desc">
  <title id="title">AI code provenance gate comparison</title>
  <desc id="desc">Bar chart comparing tests-only and provenance release gates for AI-authored code changes.</desc>
  <rect width="980" height="520" fill="#f8fafc"/>
  <text x="48" y="58" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="700" fill="#111827">AI Code Provenance Gate Results</text>
  <text x="48" y="92" font-family="Inter, Arial, sans-serif" font-size="15" fill="#475569">Eight pull-request traces scored for trace evidence, tests, reviewer coverage, sensitive paths, and patch size.</text>
  ${results.baselines.map((run, index) => {
    const x = 96 + index * 420;
    const accHeight = run.accuracy * 250;
    const reviewHeight = run.reviewCapture * 250;
    return `
    <g transform="translate(${x},130)">
      <text x="0" y="0" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700" fill="#111827">${run.label}</text>
      <rect x="0" y="${280 - accHeight}" width="72" height="${accHeight}" fill="#2563eb"/>
      <text x="0" y="306" font-family="Inter, Arial, sans-serif" font-size="13" fill="#334155">accuracy</text>
      <text x="8" y="${268 - accHeight}" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="700" fill="#111827">${run.accuracy.toFixed(2)}</text>
      <rect x="118" y="${280 - reviewHeight}" width="72" height="${reviewHeight}" fill="#0f766e"/>
      <text x="104" y="306" font-family="Inter, Arial, sans-serif" font-size="13" fill="#334155">review capture</text>
      <text x="126" y="${268 - reviewHeight}" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="700" fill="#111827">${run.reviewCapture.toFixed(2)}</text>
      <text x="236" y="82" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="700" fill="${run.unsafeMerges ? "#b91c1c" : "#15803d"}">${run.unsafeMerges}</text>
      <text x="236" y="110" font-family="Inter, Arial, sans-serif" font-size="14" fill="#334155">unsafe merges</text>
      <text x="236" y="176" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="700" fill="${run.unnecessaryBlocks ? "#b45309" : "#15803d"}">${run.unnecessaryBlocks}</text>
      <text x="236" y="204" font-family="Inter, Arial, sans-serif" font-size="14" fill="#334155">unneeded blocks</text>
    </g>`;
  }).join("")}
</svg>`;

await fs.writeFile(path.join(here, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
await fs.writeFile(path.join(here, "output.txt"), `${output}\n`);
await fs.writeFile(path.join(here, "chart.svg"), chart);
console.log(output);
