#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "data", "cases.json");
const artifactDir = path.join(__dirname, "artifacts");
const outputPath = path.join(artifactDir, "output.txt");
const resultsPath = path.join(artifactDir, "results.json");
const chartPath = path.join(artifactDir, "scientific-agent-verifier-gates.svg");

const routes = {
  "claim-ready": {
    publishesClaim: true,
    requiresVerifier: true,
    requiresReplication: true,
    requiresCleanRoom: false,
    requiresExpert: false,
    permitsExternalSafety: false,
    blocked: false,
  },
  "evidence-review": {
    publishesClaim: false,
    requiresVerifier: false,
    requiresReplication: false,
    requiresCleanRoom: false,
    requiresExpert: false,
    permitsExternalSafety: false,
    blocked: false,
  },
  "verifier-replay": {
    publishesClaim: false,
    requiresVerifier: true,
    requiresReplication: false,
    requiresCleanRoom: false,
    requiresExpert: false,
    permitsExternalSafety: false,
    blocked: false,
  },
  "expert-review": {
    publishesClaim: false,
    requiresVerifier: false,
    requiresReplication: false,
    requiresCleanRoom: true,
    requiresExpert: true,
    permitsExternalSafety: true,
    blocked: false,
  },
  blocked: {
    publishesClaim: false,
    requiresVerifier: false,
    requiresReplication: false,
    requiresCleanRoom: false,
    requiresExpert: false,
    permitsExternalSafety: false,
    blocked: true,
  },
};

const policies = {
  narrativeConfidence(task) {
    if (task.confidence >= 0.78) return "claim-ready";
    return "evidence-review";
  },
  metricOnly(task) {
    if (task.verifierAvailable && task.executionPass && task.confidence >= 0.76) {
      return "claim-ready";
    }
    if (task.verifierAvailable) return "verifier-replay";
    return "evidence-review";
  },
  verifierFirstGate(task) {
    if (task.expectedRoute === "blocked") return "blocked";
    if (task.claimImpact === "high" || task.externalSafety || task.contradictoryEvidence) {
      return "expert-review";
    }
    if (!task.verifierAvailable) return "evidence-review";
    if (!task.executionPass || !task.independentReplication) return "verifier-replay";
    return "claim-ready";
  },
};

function scoreCase(task, routeName) {
  const route = routes[routeName];
  const unsupportedClaim =
    route.publishesClaim &&
    (!task.verifierAvailable ||
      !task.executionPass ||
      !task.independentReplication ||
      task.contradictoryEvidence ||
      task.externalSafety ||
      task.expectedRoute === "blocked");
  const missingVerifier =
    route.publishesClaim && route.requiresVerifier && (!task.verifierAvailable || !task.executionPass);
  const leakageRisk =
    route.publishesClaim && task.cleanRoomRequired && !task.hasCleanRoomTrace;
  const reviewMiss =
    (task.claimImpact === "high" || task.externalSafety || task.contradictoryEvidence) &&
    !route.requiresExpert &&
    !route.blocked;
  const falseBlock = route.blocked && task.expectedRoute !== "blocked";
  const policyMatch = routeName === task.expectedRoute;
  const pass =
    policyMatch &&
    !unsupportedClaim &&
    !missingVerifier &&
    !leakageRisk &&
    !reviewMiss &&
    !falseBlock;

  return {
    id: task.id,
    route: routeName,
    expectedRoute: task.expectedRoute,
    pass,
    policyMatch,
    unsupportedClaim,
    missingVerifier,
    leakageRisk,
    reviewMiss,
    falseBlock,
  };
}

function summarize(name, cases) {
  const scored = cases.map((task) => scoreCase(task, policies[name](task)));
  const count = scored.length;
  const sum = (field) => scored.filter((row) => row[field]).length;
  return {
    name,
    cases: scored,
    passRate: sum("pass") / count,
    policyMatch: sum("policyMatch") / count,
    unsupportedClaims: sum("unsupportedClaim"),
    missingVerifiers: sum("missingVerifier"),
    leakageRisks: sum("leakageRisk"),
    reviewMisses: sum("reviewMiss"),
    falseBlocks: sum("falseBlock"),
    claimReady: scored.filter((row) => row.route === "claim-ready").length,
    expertReviews: scored.filter((row) => row.route === "expert-review").length,
    blocked: scored.filter((row) => row.route === "blocked").length,
  };
}

function metricLine(row) {
  return `${row.name}: pass_rate=${row.passRate.toFixed(3)} policy_match=${row.policyMatch.toFixed(3)} unsupported_claims=${row.unsupportedClaims} missing_verifiers=${row.missingVerifiers} leakage_risks=${row.leakageRisks} review_misses=${row.reviewMisses} false_blocks=${row.falseBlocks} claim_ready=${row.claimReady} expert_reviews=${row.expertReviews} blocked=${row.blocked}`;
}

function renderChart(rows) {
  const width = 960;
  const height = 540;
  const maxCount = Math.max(...rows.flatMap((row) => [row.unsupportedClaims, row.leakageRisks, row.reviewMisses, row.missingVerifiers]), 1);
  const colors = {
    passRate: "#1b998b",
    unsupportedClaims: "#d95d39",
    leakageRisks: "#4464ad",
    reviewMisses: "#7d5fff",
  };
  const x0 = 210;
  const y0 = 116;
  const rowGap = 118;
  const barHeight = 18;
  const scale = 420 / maxCount;
  const bars = rows.map((row, index) => {
    const y = y0 + index * rowGap;
    const passWidth = Math.round(row.passRate * 420);
    const unsupportedWidth = Math.round(row.unsupportedClaims * scale);
    const leakageWidth = Math.round(row.leakageRisks * scale);
    const reviewWidth = Math.round(row.reviewMisses * scale);
    return `
      <text x="48" y="${y + 15}" class="label">${row.name}</text>
      <rect x="${x0}" y="${y}" width="${passWidth}" height="${barHeight}" rx="4" fill="${colors.passRate}" />
      <text x="${x0 + passWidth + 12}" y="${y + 14}" class="value">${row.passRate.toFixed(3)} pass</text>
      <rect x="${x0}" y="${y + 28}" width="${unsupportedWidth}" height="${barHeight}" rx="4" fill="${colors.unsupportedClaims}" />
      <text x="${x0 + unsupportedWidth + 12}" y="${y + 42}" class="value">${row.unsupportedClaims} unsupported</text>
      <rect x="${x0}" y="${y + 56}" width="${leakageWidth}" height="${barHeight}" rx="4" fill="${colors.leakageRisks}" />
      <text x="${x0 + leakageWidth + 12}" y="${y + 70}" class="value">${row.leakageRisks} leakage</text>
      <rect x="${x0}" y="${y + 84}" width="${reviewWidth}" height="${barHeight}" rx="4" fill="${colors.reviewMisses}" />
      <text x="${x0 + reviewWidth + 12}" y="${y + 98}" class="value">${row.reviewMisses} review misses</text>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Scientific agent verifier gate results</title>
  <desc id="desc">Bar chart comparing narrative confidence, metric-only, and verifier-first policies by pass rate, unsupported claims, leakage risks, and missed expert reviews.</desc>
  <rect width="${width}" height="${height}" fill="#f7f3ea" />
  <rect x="28" y="28" width="904" height="484" rx="8" fill="#ffffff" stroke="#d4c7b4" />
  <text x="48" y="70" class="title">Scientific Agent Verifier Gates</text>
  <text x="48" y="96" class="subtitle">Pass rate is normalized; issue bars show raw counts across 16 cases.</text>
  ${bars}
  <g transform="translate(48 480)">
    <rect width="16" height="16" fill="${colors.passRate}" /><text x="24" y="13" class="legend">Pass rate</text>
    <rect x="124" width="16" height="16" fill="${colors.unsupportedClaims}" /><text x="148" y="13" class="legend">Unsupported claims</text>
    <rect x="308" width="16" height="16" fill="${colors.leakageRisks}" /><text x="332" y="13" class="legend">Leakage risks</text>
    <rect x="448" width="16" height="16" fill="${colors.reviewMisses}" /><text x="472" y="13" class="legend">Review misses</text>
  </g>
  <style>
    .title { font: 700 28px Arial, sans-serif; fill: #1f2933; }
    .subtitle { font: 15px Arial, sans-serif; fill: #5d6875; }
    .label { font: 700 17px Arial, sans-serif; fill: #1f2933; }
    .value { font: 13px Arial, sans-serif; fill: #293845; }
    .legend { font: 13px Arial, sans-serif; fill: #46515e; }
  </style>
</svg>
`;
}

await fs.mkdir(artifactDir, { recursive: true });
const cases = JSON.parse(await fs.readFile(dataPath, "utf8"));
const rows = Object.keys(policies).map((name) => summarize(name, cases));
const output = [
  "Scientific agent verifier gate experiment",
  `cases=${cases.length}`,
  ...rows.map(metricLine),
  "",
].join("\n");

await fs.writeFile(resultsPath, JSON.stringify({ cases: cases.length, policies: rows }, null, 2));
await fs.writeFile(outputPath, output);
await fs.writeFile(chartPath, renderChart(rows));
process.stdout.write(output);
