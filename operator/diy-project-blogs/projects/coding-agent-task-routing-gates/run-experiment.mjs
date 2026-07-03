#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const tasks = JSON.parse(await fs.readFile(path.join(projectDir, "tasks.json"), "utf8"));

const routeSpec = {
  "agent-fast": {
    reviewHours: 0.25,
    computeCredits: 1.0,
    expectedPass: 0.74,
    maxRisk: "low",
    maxFiles: 5,
    maxTokens: 65000,
  },
  "agent-reviewed": {
    reviewHours: 0.75,
    computeCredits: 1.7,
    expectedPass: 0.83,
    maxRisk: "medium",
    maxFiles: 8,
    maxTokens: 100000,
  },
  "human-paired": {
    reviewHours: 2.25,
    computeCredits: 1.2,
    expectedPass: 0.91,
    maxRisk: "high",
    maxFiles: 10,
    maxTokens: 140000,
  },
  "decompose-first": {
    reviewHours: 1.25,
    computeCredits: 0.9,
    expectedPass: 0.88,
    maxRisk: "medium",
    maxFiles: 6,
    maxTokens: 85000,
  },
};

const riskRank = { low: 1, medium: 2, high: 3 };

const policies = {
  delegateAll(task) {
    if (task.expectedMinutes < 45) return "agent-fast";
    return "agent-reviewed";
  },
  humanReviewOnly(task) {
    if (task.risk === "high" || task.securitySensitive) return "human-paired";
    return task.expectedMinutes > 110 ? "decompose-first" : "agent-reviewed";
  },
  taskGate(task) {
    if (task.needsProductJudgment && task.risk === "high") return "human-paired";
    if (task.filesTouched > 9 || task.tokenBudget > 100000 || task.needsProductJudgment) return "decompose-first";
    if (task.securitySensitive || task.ciRequired || task.risk === "medium") return "agent-reviewed";
    return "agent-fast";
  },
};

function scoreTask(task, route) {
  const spec = routeSpec[route];
  const complexity = task.filesTouched * 0.045 + task.expectedDiffLines / 2400 + task.tokenBudget / 250000;
  const riskPenalty = Math.max(0, riskRank[task.risk] - riskRank[spec.maxRisk]) * 0.18;
  const spanPenalty = Math.max(0, task.filesTouched - spec.maxFiles) * 0.035;
  const budgetPenalty = Math.max(0, task.tokenBudget - spec.maxTokens) / 300000;
  const judgmentPenalty = task.needsProductJudgment && route.startsWith("agent") ? 0.22 : 0;
  const securityPenalty = task.securitySensitive && route === "agent-fast" ? 0.18 : 0;
  const ciPenalty = task.ciRequired && route === "agent-fast" ? 0.07 : 0;
  const predictedPass = Math.max(
    0.05,
    spec.expectedPass - complexity * 0.16 - riskPenalty - spanPenalty - budgetPenalty - judgmentPenalty - securityPenalty - ciPenalty,
  );
  const reviewHours = spec.reviewHours + task.filesTouched * 0.04 + (task.ciRequired ? 0.25 : 0);
  const computeCredits = spec.computeCredits * (task.tokenBudget / 50000) + (task.expectedDiffLines / 350) * 0.08;
  const routeMatch = route === task.expectedRoute;
  const pass = predictedPass >= 0.62 && routeMatch;

  return {
    id: task.id,
    route,
    expectedRoute: task.expectedRoute,
    routeMatch,
    predictedPass: Number(predictedPass.toFixed(3)),
    reviewHours: Number(reviewHours.toFixed(2)),
    computeCredits: Number(computeCredits.toFixed(2)),
    pass,
  };
}

function summarize(policyName, policyFn) {
  const rows = tasks.map((task) => scoreTask(task, policyFn(task)));
  const passCount = rows.filter((row) => row.pass).length;
  const routeMatches = rows.filter((row) => row.routeMatch).length;
  const lowConfidence = rows.filter((row) => row.predictedPass < 0.62).length;
  const reviewHours = rows.reduce((sum, row) => sum + row.reviewHours, 0);
  const computeCredits = rows.reduce((sum, row) => sum + row.computeCredits, 0);
  const highRiskDelegated = rows.filter((row) => {
    const task = tasks.find((item) => item.id === row.id);
    return task.risk === "high" && row.route.startsWith("agent");
  }).length;

  return {
    policyName,
    tasks: rows.length,
    passRate: Number((passCount / rows.length).toFixed(3)),
    routeMatchRate: Number((routeMatches / rows.length).toFixed(3)),
    lowConfidence,
    highRiskDelegated,
    reviewHours: Number(reviewHours.toFixed(2)),
    computeCredits: Number(computeCredits.toFixed(2)),
    rows,
  };
}

const summaries = Object.entries(policies).map(([name, fn]) => summarize(name, fn));

const lines = [
  "Coding-agent task routing gate experiment",
  `tasks=${tasks.length}`,
  ...summaries.map(
    (summary) =>
      `${summary.policyName}: pass_rate=${summary.passRate} route_match=${summary.routeMatchRate} low_confidence=${summary.lowConfidence} high_risk_delegated=${summary.highRiskDelegated} review_hours=${summary.reviewHours} compute_credits=${summary.computeCredits}`,
  ),
];

function bar(value, maxValue, width) {
  return Math.round((value / maxValue) * width);
}

function chartSvg() {
  const width = 960;
  const height = 540;
  const left = 170;
  const top = 92;
  const rowHeight = 110;
  const maxCredits = Math.max(...summaries.map((summary) => summary.computeCredits));
  const maxHours = Math.max(...summaries.map((summary) => summary.reviewHours));
  const colors = {
    pass: "#167c6b",
    match: "#275dad",
    credits: "#b86125",
    hours: "#6c4bb5",
  };

  const rows = summaries
    .map((summary, index) => {
      const y = top + index * rowHeight;
      const passWidth = bar(summary.passRate, 1, 250);
      const matchWidth = bar(summary.routeMatchRate, 1, 250);
      const creditWidth = bar(summary.computeCredits, maxCredits, 250);
      const hourWidth = bar(summary.reviewHours, maxHours, 250);
      return `
      <g transform="translate(0 ${y})">
        <text x="36" y="24" class="label">${summary.policyName}</text>
        <rect x="${left}" y="0" width="${passWidth}" height="18" rx="3" fill="${colors.pass}"/>
        <text x="${left + passWidth + 10}" y="14" class="metric">pass ${summary.passRate}</text>
        <rect x="${left}" y="28" width="${matchWidth}" height="18" rx="3" fill="${colors.match}"/>
        <text x="${left + matchWidth + 10}" y="42" class="metric">match ${summary.routeMatchRate}</text>
        <rect x="${left}" y="56" width="${creditWidth}" height="18" rx="3" fill="${colors.credits}"/>
        <text x="${left + creditWidth + 10}" y="70" class="metric">credits ${summary.computeCredits}</text>
        <rect x="${left}" y="84" width="${hourWidth}" height="18" rx="3" fill="${colors.hours}"/>
        <text x="${left + hourWidth + 10}" y="98" class="metric">review ${summary.reviewHours}h</text>
      </g>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Coding-agent routing policy comparison</title>
  <desc id="desc">Bar chart comparing delegate-all, human-review-only, and task-gate routing policies by pass rate, route match, compute credits, and review hours.</desc>
  <rect width="${width}" height="${height}" fill="#f8faf7"/>
  <text x="36" y="46" class="title">Coding-agent task routing gates</text>
  <text x="36" y="72" class="subtitle">Higher pass and match are better; lower credits and review hours are better.</text>
  ${rows}
  <g transform="translate(36 470)">
    <rect width="16" height="16" fill="${colors.pass}" rx="2"/><text x="24" y="13" class="legend">pass rate</text>
    <rect x="132" width="16" height="16" fill="${colors.match}" rx="2"/><text x="156" y="13" class="legend">route match</text>
    <rect x="286" width="16" height="16" fill="${colors.credits}" rx="2"/><text x="310" y="13" class="legend">compute credits</text>
    <rect x="470" width="16" height="16" fill="${colors.hours}" rx="2"/><text x="494" y="13" class="legend">review hours</text>
  </g>
  <style>
    .title { font: 700 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #17202a; }
    .subtitle, .legend { font: 400 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #4f5b66; }
    .label { font: 650 17px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #17202a; }
    .metric { font: 500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #28323c; }
  </style>
</svg>`;
}

await fs.writeFile(path.join(projectDir, "results.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), summaries }, null, 2)}\n`);
await fs.writeFile(path.join(projectDir, "output.txt"), `${lines.join("\n")}\n`);
await fs.writeFile(path.join(projectDir, "routing-gate-results.svg"), chartSvg());

console.log(lines.join("\n"));
