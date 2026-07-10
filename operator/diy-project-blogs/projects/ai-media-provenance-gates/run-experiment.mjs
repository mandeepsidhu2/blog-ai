#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(await fs.readFile(path.join(__dirname, "cases.json"), "utf8"));

const routes = {
  "trusted-publish": {
    allowsPublicPublish: true,
    requiresVisibleDisclosure: false,
    requiresMachineReadableMark: true,
    requiresReview: false,
    blocksHighRisk: false,
  },
  "publish-with-ai-disclosure": {
    allowsPublicPublish: true,
    requiresVisibleDisclosure: true,
    requiresMachineReadableMark: true,
    requiresReview: false,
    blocksHighRisk: false,
  },
  "provenance-review": {
    allowsPublicPublish: false,
    requiresVisibleDisclosure: true,
    requiresMachineReadableMark: true,
    requiresReview: true,
    blocksHighRisk: false,
  },
  "block-high-risk": {
    allowsPublicPublish: false,
    requiresVisibleDisclosure: true,
    requiresMachineReadableMark: true,
    requiresReview: true,
    blocksHighRisk: true,
  },
};

const credentialIsValid = new Set(["valid-human", "valid-human-assisted", "valid-ai"]);
const credentialClaimsAi = new Set(["valid-ai"]);
const credentialClaimsHuman = new Set(["valid-human", "valid-human-assisted"]);

function hasValidCredential(item) {
  return credentialIsValid.has(item.contentCredential);
}

function signalsConflict(item) {
  const humanCredentialWithAiSignal = credentialClaimsHuman.has(item.contentCredential) && item.watermark === "ai";
  const aiCredentialWithoutDisclosure =
    credentialClaimsAi.has(item.contentCredential) &&
    (item.visibleDisclosure === false || item.machineReadableMark === false);
  const invalidCredential = item.contentCredential === "invalid";
  return humanCredentialWithAiSignal || aiCredentialWithoutDisclosure || invalidCredential;
}

const policies = {
  metadataOnlyPolicy(item) {
    if (item.contentCredential === "invalid") return "block-high-risk";
    if (item.contentCredential === "valid-ai") return "publish-with-ai-disclosure";
    if (credentialClaimsHuman.has(item.contentCredential)) return "trusted-publish";
    return "trusted-publish";
  },
  watermarkOnlyPolicy(item) {
    if (item.watermark === "ai" && item.visibleDisclosure) return "publish-with-ai-disclosure";
    if (item.watermark === "ai" && item.risk === "high") return "block-high-risk";
    return "trusted-publish";
  },
  dualSignalProvenanceGate(item) {
    if (item.risk === "high" && (!hasValidCredential(item) || signalsConflict(item))) return "block-high-risk";
    if (signalsConflict(item)) return "provenance-review";
    if (item.contentCredential === "valid-ai" && item.visibleDisclosure && item.machineReadableMark) {
      return "publish-with-ai-disclosure";
    }
    if (credentialClaimsHuman.has(item.contentCredential) && item.machineReadableMark && item.watermark !== "ai") {
      return "trusted-publish";
    }
    return "provenance-review";
  },
};

function scoreCase(item, routeName) {
  const route = routes[routeName];
  const routeMatch = routeName === item.expectedRoute;
  const conflictMiss = signalsConflict(item) && route.allowsPublicPublish;
  const unsafePublish =
    route.allowsPublicPublish &&
    (item.expectedRoute === "provenance-review" || item.expectedRoute === "block-high-risk" || conflictMiss);
  const disclosureMiss =
    route.allowsPublicPublish &&
    item.contentCredential === "valid-ai" &&
    (route.requiresVisibleDisclosure && !item.visibleDisclosure);
  const machineReadableMiss =
    route.allowsPublicPublish &&
    (route.requiresMachineReadableMark && (!item.machineReadableMark || !item.metadataPreserved));
  const reviewMiss = item.expectedRoute === "provenance-review" && !route.requiresReview;
  const highRiskMiss = item.expectedRoute === "block-high-risk" && !route.blocksHighRisk;
  const unnecessaryBlock = routeName === "block-high-risk" && item.expectedRoute !== "block-high-risk";
  const pass =
    routeMatch &&
    !unsafePublish &&
    !disclosureMiss &&
    !machineReadableMiss &&
    !conflictMiss &&
    !reviewMiss &&
    !highRiskMiss &&
    !unnecessaryBlock;

  return {
    id: item.id,
    modality: item.modality,
    expectedRoute: item.expectedRoute,
    routeName,
    pass,
    routeMatch,
    unsafePublish,
    disclosureMiss,
    machineReadableMiss,
    conflictMiss,
    reviewMiss,
    highRiskMiss,
    unnecessaryBlock,
  };
}

function summarize(policyName, policyCases) {
  const totals = policyCases.reduce(
    (acc, item) => {
      acc.pass += Number(item.pass);
      acc.routeMatch += Number(item.routeMatch);
      acc.unsafePublishes += Number(item.unsafePublish);
      acc.disclosureMisses += Number(item.disclosureMiss);
      acc.machineReadableMisses += Number(item.machineReadableMiss);
      acc.conflictMisses += Number(item.conflictMiss);
      acc.reviewMisses += Number(item.reviewMiss);
      acc.highRiskMisses += Number(item.highRiskMiss);
      acc.unnecessaryBlocks += Number(item.unnecessaryBlock);
      return acc;
    },
    {
      pass: 0,
      routeMatch: 0,
      unsafePublishes: 0,
      disclosureMisses: 0,
      machineReadableMisses: 0,
      conflictMisses: 0,
      reviewMisses: 0,
      highRiskMisses: 0,
      unnecessaryBlocks: 0,
    },
  );

  return {
    policyName,
    cases: policyCases.length,
    passRate: totals.pass / policyCases.length,
    routeMatchRate: totals.routeMatch / policyCases.length,
    ...totals,
  };
}

function renderChart(summaries) {
  const width = 960;
  const height = 520;
  const chartX = 100;
  const chartY = 120;
  const chartW = 760;
  const chartH = 230;
  const barW = 68;
  const groups = summaries.map((item, index) => ({
    ...item,
    x: chartX + 80 + index * 235,
  }));

  const colors = {
    passRate: "#2f7d5f",
    unsafePublishes: "#b43f3f",
    reviewMisses: "#d18b2f",
    conflictMisses: "#6d5bd0",
  };

  const bars = groups
    .map((group) => {
      const passHeight = group.passRate * chartH;
      const unsafeHeight = (group.unsafePublishes / group.cases) * chartH;
      const reviewHeight = (group.reviewMisses / group.cases) * chartH;
      const conflictHeight = (group.conflictMisses / group.cases) * chartH;
      return `
        <g>
          <rect x="${group.x}" y="${chartY + chartH - passHeight}" width="${barW}" height="${passHeight}" fill="${colors.passRate}" rx="4"/>
          <rect x="${group.x + 76}" y="${chartY + chartH - unsafeHeight}" width="${barW}" height="${unsafeHeight}" fill="${colors.unsafePublishes}" rx="4"/>
          <rect x="${group.x + 152}" y="${chartY + chartH - reviewHeight}" width="${barW}" height="${reviewHeight}" fill="${colors.reviewMisses}" rx="4"/>
          <rect x="${group.x + 228}" y="${chartY + chartH - conflictHeight}" width="${barW}" height="${conflictHeight}" fill="${colors.conflictMisses}" rx="4"/>
          <text x="${group.x + 114}" y="${chartY + chartH + 42}" text-anchor="middle" font-size="16" font-weight="700" fill="#1d2733">${group.policyName}</text>
          <text x="${group.x + 114}" y="${chartY + chartH + 66}" text-anchor="middle" font-size="13" fill="#53616f">pass ${(group.passRate * 100).toFixed(0)}%</text>
        </g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">AI media provenance gate experiment results</title>
  <desc id="desc">Grouped bar chart comparing metadata-only, watermark-only, and dual-signal provenance gates by pass rate and missed safety conditions.</desc>
  <rect width="${width}" height="${height}" fill="#f8fbfd"/>
  <rect x="38" y="36" width="884" height="448" fill="#ffffff" stroke="#d5dde6" stroke-width="2" rx="8"/>
  <text x="72" y="82" font-size="28" font-weight="800" fill="#1d2733">AI Media Provenance Gate Results</text>
  <text x="72" y="110" font-size="15" fill="#53616f">Twenty synthetic media handoff cases scored across provenance metadata, watermark, disclosure, and high-risk review routes.</text>
  <line x1="${chartX}" y1="${chartY + chartH}" x2="${chartX + chartW}" y2="${chartY + chartH}" stroke="#8290a0" stroke-width="2"/>
  <line x1="${chartX}" y1="${chartY}" x2="${chartX}" y2="${chartY + chartH}" stroke="#8290a0" stroke-width="2"/>
  <text x="80" y="${chartY + 7}" text-anchor="end" font-size="12" fill="#53616f">100%</text>
  <text x="80" y="${chartY + chartH + 5}" text-anchor="end" font-size="12" fill="#53616f">0</text>
  ${bars}
  <g transform="translate(72 438)" font-size="13" fill="#344050">
    <rect x="0" y="-12" width="14" height="14" fill="${colors.passRate}" rx="2"/><text x="22" y="0">pass rate</text>
    <rect x="130" y="-12" width="14" height="14" fill="${colors.unsafePublishes}" rx="2"/><text x="152" y="0">unsafe publish rate</text>
    <rect x="308" y="-12" width="14" height="14" fill="${colors.reviewMisses}" rx="2"/><text x="330" y="0">review miss rate</text>
    <rect x="482" y="-12" width="14" height="14" fill="${colors.conflictMisses}" rx="2"/><text x="504" y="0">conflict miss rate</text>
  </g>
</svg>
`;
}

const caseResults = {};
const summaries = [];
for (const [policyName, policy] of Object.entries(policies)) {
  const policyCases = cases.map((item) => scoreCase(item, policy(item)));
  caseResults[policyName] = policyCases;
  summaries.push(summarize(policyName, policyCases));
}

const outputLines = [
  "AI media provenance gate experiment",
  `cases=${cases.length}`,
  ...summaries.map(
    (summary) =>
      `${summary.policyName}: pass_rate=${summary.passRate.toFixed(3)} route_match=${summary.routeMatchRate.toFixed(3)} unsafe_publishes=${summary.unsafePublishes} disclosure_misses=${summary.disclosureMisses} machine_readable_misses=${summary.machineReadableMisses} conflict_misses=${summary.conflictMisses} review_misses=${summary.reviewMisses} high_risk_misses=${summary.highRiskMisses} unnecessary_blocks=${summary.unnecessaryBlocks}`,
  ),
];

await fs.writeFile(path.join(__dirname, "results.json"), JSON.stringify({ summaries, caseResults }, null, 2));
await fs.writeFile(path.join(__dirname, "output.txt"), `${outputLines.join("\n")}\n`);
await fs.writeFile(path.join(__dirname, "ai-media-provenance-gates.svg"), renderChart(summaries));

console.log(outputLines.join("\n"));
