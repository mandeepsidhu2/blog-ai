import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "dataset.json"), "utf8"));

const policies = {
  textOnly(caseRecord) {
    return {
      name: "textOnly",
      detectThreshold: 0.52,
      exploitThreshold: 0.58,
      patchThreshold: 0.62,
      requiresFork: false,
      requiresOracle: false,
      requiresHumanReview: false,
      maxAutonomy: "suggest",
      caseRecord,
    };
  },
  forkValidated(caseRecord) {
    return {
      name: "forkValidated",
      detectThreshold: 0.58,
      exploitThreshold: 0.64,
      patchThreshold: 0.7,
      requiresFork: true,
      requiresOracle: true,
      requiresHumanReview: false,
      maxAutonomy: "validate",
      caseRecord,
    };
  },
  humanReviewedPatch(caseRecord) {
    return {
      name: "humanReviewedPatch",
      detectThreshold: 0.56,
      exploitThreshold: 0.67,
      patchThreshold: 0.72,
      requiresFork: true,
      requiresOracle: true,
      requiresHumanReview: true,
      maxAutonomy: "propose",
      caseRecord,
    };
  },
};

function capability(caseRecord, policy) {
  const base =
    caseRecord.chainState * 0.22 +
    caseRecord.sourceAvailability * 0.18 +
    caseRecord.economicImpact * 0.12 +
    caseRecord.patchability * 0.18 +
    caseRecord.oracleCoverage * 0.18 +
    caseRecord.humanContext * 0.12;

  const forkLift = policy.requiresFork ? caseRecord.chainState * 0.08 : -0.04;
  const oracleLift = policy.requiresOracle ? caseRecord.oracleCoverage * 0.1 : -0.06;
  const reviewLift = policy.requiresHumanReview ? caseRecord.humanContext * 0.08 : 0;
  const criticalDrag = caseRecord.risk === "critical" && !policy.requiresHumanReview ? 0.08 : 0;

  return Math.max(0, Math.min(1, base + forkLift + oracleLift + reviewLift - criticalDrag));
}

function evaluateCase(caseRecord, policy) {
  const score = capability(caseRecord, policy);
  const detected = score >= policy.detectThreshold;
  const exploitValidated = detected && score >= policy.exploitThreshold && policy.requiresFork;
  const patchAccepted =
    exploitValidated &&
    score >= policy.patchThreshold &&
    caseRecord.patchability >= 0.55 &&
    policy.requiresOracle &&
    policy.requiresHumanReview;
  const unsafeAutonomy =
    detected &&
    (caseRecord.risk === "critical" || caseRecord.economicImpact >= 0.8) &&
    !policy.requiresHumanReview;
  const falseConfidence =
    detected &&
    (!exploitValidated || (caseRecord.patchability < 0.55 && policy.maxAutonomy !== "suggest"));

  return {
    id: caseRecord.id,
    score: Number(score.toFixed(3)),
    detected,
    exploitValidated,
    patchAccepted,
    unsafeAutonomy,
    falseConfidence,
  };
}

function summarize(name, rows) {
  const totals = rows.reduce(
    (acc, row) => {
      acc.detected += row.detected ? 1 : 0;
      acc.exploitValidated += row.exploitValidated ? 1 : 0;
      acc.patchAccepted += row.patchAccepted ? 1 : 0;
      acc.unsafeAutonomy += row.unsafeAutonomy ? 1 : 0;
      acc.falseConfidence += row.falseConfidence ? 1 : 0;
      return acc;
    },
    { detected: 0, exploitValidated: 0, patchAccepted: 0, unsafeAutonomy: 0, falseConfidence: 0 },
  );
  return {
    policy: name,
    cases: rows.length,
    ...totals,
    detectionRate: Number((totals.detected / rows.length).toFixed(3)),
    exploitValidationRate: Number((totals.exploitValidated / rows.length).toFixed(3)),
    patchAcceptanceRate: Number((totals.patchAccepted / rows.length).toFixed(3)),
  };
}

const policyResults = Object.fromEntries(
  Object.entries(policies).map(([name, buildPolicy]) => {
    const rows = cases.map((caseRecord) => evaluateCase(caseRecord, buildPolicy(caseRecord)));
    return [name, { summary: summarize(name, rows), rows }];
  }),
);

const outputLines = [
  "Smart contract agent gate experiment",
  `cases=${cases.length}`,
  ...Object.values(policyResults).map(
    ({ summary }) =>
      `${summary.policy}: detected=${summary.detected} detection_rate=${summary.detectionRate} exploit_validated=${summary.exploitValidated} exploit_validation_rate=${summary.exploitValidationRate} patch_accepted=${summary.patchAccepted} patch_acceptance_rate=${summary.patchAcceptanceRate} unsafe_autonomy=${summary.unsafeAutonomy} false_confidence=${summary.falseConfidence}`,
  ),
];

const chartWidth = 920;
const chartHeight = 520;
const maxBar = cases.length;
const barGroups = Object.values(policyResults).map(({ summary }) => summary);
const colors = {
  detected: "#2563eb",
  exploitValidated: "#0891b2",
  patchAccepted: "#16a34a",
  unsafeAutonomy: "#dc2626",
  falseConfidence: "#f59e0b",
};
const metricLabels = [
  ["detected", "Detected"],
  ["exploitValidated", "Exploit validated"],
  ["patchAccepted", "Patch accepted"],
  ["unsafeAutonomy", "Unsafe autonomy"],
  ["falseConfidence", "False confidence"],
];

const svgBars = barGroups
  .map((summary, policyIndex) => {
    const groupY = 110 + policyIndex * 122;
    const label = `<text x="44" y="${groupY + 28}" font-size="18" font-weight="700" fill="#172033">${summary.policy}</text>`;
    const bars = metricLabels
      .map(([key, labelText], metricIndex) => {
        const value = summary[key];
        const x = 240;
        const y = groupY + metricIndex * 20;
        const width = Math.round((value / maxBar) * 520);
        return `<g><text x="220" y="${y + 14}" text-anchor="end" font-size="12" fill="#475569">${labelText}</text><rect x="${x}" y="${y}" width="${width}" height="14" rx="3" fill="${colors[key]}"/><text x="${x + width + 8}" y="${y + 12}" font-size="12" fill="#172033">${value}</text></g>`;
      })
      .join("");
    return `<g>${label}${bars}</g>`;
  })
  .join("");

const chart = `<svg xmlns="http://www.w3.org/2000/svg" width="${chartWidth}" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-labelledby="title desc">
  <title id="title">Smart contract agent gate comparison</title>
  <desc id="desc">Bar chart comparing detection, exploit validation, patch acceptance, unsafe autonomy, and false confidence across three smart contract agent review policies.</desc>
  <rect width="${chartWidth}" height="${chartHeight}" fill="#f8fafc"/>
  <text x="44" y="48" font-size="26" font-weight="800" fill="#0f172a">Smart Contract Agent Gates</text>
  <text x="44" y="76" font-size="14" fill="#475569">Deterministic comparison across twelve representative audit cases</text>
  <line x1="240" y1="446" x2="760" y2="446" stroke="#cbd5e1"/>
  <text x="240" y="470" font-size="12" fill="#64748b">0</text>
  <text x="750" y="470" font-size="12" fill="#64748b">12 cases</text>
  ${svgBars}
</svg>
`;

fs.writeFileSync(path.join(__dirname, "results.json"), `${JSON.stringify(policyResults, null, 2)}\n`);
fs.writeFileSync(path.join(__dirname, "output.txt"), `${outputLines.join("\n")}\n`);
fs.writeFileSync(path.join(__dirname, "chart.svg"), chart);
console.log(outputLines.join("\n"));
