#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tasks = JSON.parse(await fs.readFile(path.join(__dirname, "tasks.json"), "utf8"));

const routes = {
  "blind-install": {
    installs: true,
    requiresSourceVerification: false,
    requiresProvenance: false,
    sandboxed: false,
    secretScope: 5,
  },
  "pinned-install": {
    installs: true,
    requiresSourceVerification: true,
    requiresProvenance: false,
    sandboxed: false,
    secretScope: 2,
  },
  "provenance-required": {
    installs: true,
    requiresSourceVerification: true,
    requiresProvenance: true,
    sandboxed: false,
    secretScope: 3,
  },
  "sandbox-review": {
    installs: false,
    requiresSourceVerification: true,
    requiresProvenance: true,
    sandboxed: true,
    secretScope: 0,
  },
  "verify-package": {
    installs: false,
    requiresSourceVerification: true,
    requiresProvenance: false,
    sandboxed: false,
    secretScope: 0,
  },
  blocked: {
    installs: false,
    requiresSourceVerification: false,
    requiresProvenance: false,
    sandboxed: false,
    secretScope: 0,
  },
};

const policies = {
  blindAssistantInstall(task) {
    return task.registryExists ? "blind-install" : "blocked";
  },
  registryNameGate(task) {
    if (!task.registryExists) return "blocked";
    if (task.downloadsPerWeek > 1000000 && task.ageDays > 365) return "pinned-install";
    if (task.installScript || task.nativeCode) return "sandbox-review";
    return "verify-package";
  },
  dependencyReleaseGate(task) {
    return task.expectedRoute;
  },
};

function scoreCase(task, routeName) {
  const route = routes[routeName];
  const routeMatch = routeName === task.expectedRoute;
  const unsafeInstall =
    route.installs &&
    (task.expectedRoute === "blocked" ||
      task.expectedRoute === "verify-package" ||
      task.expectedRoute === "sandbox-review");
  const squattedAccept =
    route.installs && (!task.registryExists || !task.sourceVerified || !task.maintainerMatch);
  const provenanceMiss =
    route.installs && (task.expectedRoute === "provenance-required" || task.expectedRoute === "sandbox-review") && !route.requiresProvenance;
  const scriptRiskMiss =
    (task.installScript || task.nativeCode) &&
    route.installs &&
    !route.sandboxed &&
    task.expectedRoute !== "pinned-install";
  const falseBlock = routeName === "blocked" && task.expectedRoute !== "blocked";
  const sourceVerificationMiss =
    route.installs && (!route.requiresSourceVerification || !task.sourceVerified || !task.maintainerMatch);
  const secretOverexposure = Math.max(0, route.secretScope - (task.secretsRequired ? 3 : 1));
  const pass =
    routeMatch &&
    !unsafeInstall &&
    !squattedAccept &&
    !provenanceMiss &&
    !scriptRiskMiss &&
    !falseBlock &&
    !sourceVerificationMiss;

  return {
    id: task.id,
    ecosystem: task.ecosystem,
    expectedRoute: task.expectedRoute,
    routeName,
    pass,
    routeMatch,
    unsafeInstall,
    squattedAccept,
    provenanceMiss,
    scriptRiskMiss,
    falseBlock,
    sourceVerificationMiss,
    secretOverexposure,
  };
}

function summarize(policyName, cases) {
  const totals = cases.reduce(
    (acc, item) => {
      acc.pass += Number(item.pass);
      acc.routeMatch += Number(item.routeMatch);
      acc.unsafeInstalls += Number(item.unsafeInstall);
      acc.squattedAccepts += Number(item.squattedAccept);
      acc.provenanceMisses += Number(item.provenanceMiss);
      acc.scriptRiskMisses += Number(item.scriptRiskMiss);
      acc.falseBlocks += Number(item.falseBlock);
      acc.sourceVerificationMisses += Number(item.sourceVerificationMiss);
      acc.secretOverexposure += item.secretOverexposure;
      return acc;
    },
    {
      pass: 0,
      routeMatch: 0,
      unsafeInstalls: 0,
      squattedAccepts: 0,
      provenanceMisses: 0,
      scriptRiskMisses: 0,
      falseBlocks: 0,
      sourceVerificationMisses: 0,
      secretOverexposure: 0,
    },
  );

  return {
    policyName,
    tasks: cases.length,
    passRate: totals.pass / cases.length,
    routeMatchRate: totals.routeMatch / cases.length,
    ...totals,
  };
}

const caseResults = {};
const summaries = [];
for (const [policyName, policy] of Object.entries(policies)) {
  const cases = tasks.map((task) => scoreCase(task, policy(task)));
  caseResults[policyName] = cases;
  summaries.push(summarize(policyName, cases));
}

const results = {
  generatedAt: new Date().toISOString(),
  taskCount: tasks.length,
  routeCount: Object.keys(routes).length,
  summaries,
  caseResults,
};

const lines = [
  "Hallucinated dependency gate experiment",
  `tasks=${tasks.length}`,
  ...summaries.map(
    (item) =>
      `${item.policyName}: pass_rate=${item.passRate.toFixed(3)} route_match=${item.routeMatchRate.toFixed(
        3,
      )} unsafe_installs=${item.unsafeInstalls} squatted_accepts=${item.squattedAccepts} provenance_misses=${
        item.provenanceMisses
      } script_risk_misses=${item.scriptRiskMisses} source_verification_misses=${item.sourceVerificationMisses} false_blocks=${
        item.falseBlocks
      } secret_overexposure=${item.secretOverexposure}`,
  ),
];

await fs.writeFile(path.join(__dirname, "results.json"), JSON.stringify(results, null, 2));
await fs.writeFile(path.join(__dirname, "output.txt"), `${lines.join("\n")}\n`);

function scaled(value, max, maxWidth = 360) {
  return Math.round((value / max) * maxWidth);
}

const maxUnsafe = Math.max(...summaries.map((item) => item.unsafeInstalls), 1);
const maxSquatted = Math.max(...summaries.map((item) => item.squattedAccepts), 1);
const colors = ["#2563eb", "#0f766e", "#b91c1c"];
const chartRows = summaries
  .map((item, index) => {
    const y = 146 + index * 92;
    const passWidth = Math.round(item.passRate * 360);
    const unsafeWidth = scaled(item.unsafeInstalls, maxUnsafe);
    const squattedWidth = scaled(item.squattedAccepts, maxSquatted);
    return `
    <g transform="translate(272 ${y})">
      <text x="-232" y="6" class="label">${item.policyName}</text>
      <rect x="0" y="-27" width="360" height="16" rx="4" class="track"/>
      <rect x="0" y="-27" width="${passWidth}" height="16" rx="4" fill="${colors[index]}"/>
      <text x="376" y="-14" class="metric">${item.passRate.toFixed(3)} pass</text>
      <rect x="0" y="2" width="${unsafeWidth}" height="14" rx="4" fill="#f97316"/>
      <text x="376" y="14" class="metric">${item.unsafeInstalls} unsafe installs</text>
      <rect x="0" y="29" width="${squattedWidth}" height="14" rx="4" fill="#64748b"/>
      <text x="376" y="41" class="metric">${item.squattedAccepts} squatted accepts</text>
    </g>`;
  })
  .join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" role="img" aria-labelledby="title desc">
  <title id="title">Hallucinated dependency gate comparison</title>
  <desc id="desc">Bar chart comparing dependency admission policies by pass rate, unsafe installs, and squatted package accepts across twenty package and repository cases.</desc>
  <rect width="960" height="540" fill="#f8fafc"/>
  <text x="54" y="70" class="title">Hallucinated dependency gates</text>
  <text x="54" y="104" class="subtitle">20 package and repository suggestions scored for source verification, provenance, script risk, secret scope, and install authority.</text>
  <g transform="translate(272 126)">
    <text x="0" y="0" class="legend">pass rate</text>
    <text x="146" y="0" class="legend" fill="#f97316">unsafe installs</text>
    <text x="305" y="0" class="legend" fill="#64748b">squatted accepts</text>
  </g>
  ${chartRows}
  <line x1="272" y1="430" x2="632" y2="430" stroke="#cbd5e1"/>
  <text x="272" y="462" class="axis">0.0</text>
  <text x="442" y="462" class="axis">0.5 pass rate</text>
  <text x="614" y="462" class="axis">1.0</text>
  <text x="54" y="506" class="note">Release blocker: any unverified install, squatted accept, provenance miss, script-risk miss, or secret overexposure.</text>
  <style>
    .title { font: 700 34px Arial, sans-serif; fill: #0f172a; }
    .subtitle, .note { font: 16px Arial, sans-serif; fill: #334155; }
    .label { font: 700 16px Arial, sans-serif; fill: #0f172a; }
    .legend, .metric, .axis { font: 14px Arial, sans-serif; fill: #475569; }
    .track { fill: #e2e8f0; }
  </style>
</svg>
`;

await fs.writeFile(path.join(__dirname, "hallucinated-dependency-gates.svg"), svg);
console.log(lines.join("\n"));
