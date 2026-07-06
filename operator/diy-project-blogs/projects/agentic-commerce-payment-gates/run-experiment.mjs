import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const tasks = JSON.parse(
  fs.readFileSync(path.join(projectDir, "data", "tasks.json"), "utf8"),
);

const routes = {
  "quote-only": {
    chargeAllowed: false,
    maxAmount: 0,
    requiresConfirmation: false,
    requiresHumanApproval: false,
    merchantScope: "read",
    maxRisk: "medium",
    visibleMerchants: 4,
  },
  "delegated-wallet": {
    chargeAllowed: true,
    maxAmount: 5000,
    requiresConfirmation: false,
    requiresHumanApproval: false,
    merchantScope: "any",
    maxRisk: "high",
    visibleMerchants: 80,
  },
  "merchant-token": {
    chargeAllowed: true,
    maxAmount: 100,
    requiresConfirmation: false,
    requiresHumanApproval: false,
    merchantScope: "approved",
    maxRisk: "low",
    visibleMerchants: 3,
  },
  "user-confirmed-payment": {
    chargeAllowed: true,
    maxAmount: 1000,
    requiresConfirmation: true,
    requiresHumanApproval: false,
    merchantScope: "any",
    maxRisk: "medium",
    visibleMerchants: 6,
  },
  "manual-review": {
    chargeAllowed: true,
    maxAmount: 5000,
    requiresConfirmation: true,
    requiresHumanApproval: true,
    merchantScope: "approved",
    maxRisk: "high",
    visibleMerchants: 4,
  },
  blocked: {
    chargeAllowed: false,
    maxAmount: 0,
    requiresConfirmation: false,
    requiresHumanApproval: false,
    merchantScope: "none",
    maxRisk: "none",
    visibleMerchants: 0,
  },
};

const riskRank = { none: -1, low: 0, medium: 1, high: 2, blocked: 3 };

const policies = {
  savedCardDelegation(task) {
    if (!task.needsCharge) return "quote-only";
    return "delegated-wallet";
  },
  merchantScopedToken(task) {
    if (!task.needsCharge) return "quote-only";
    if (task.merchantApproved && task.amount <= 100 && task.categoryRisk === "low") {
      return "merchant-token";
    }
    if (task.amount <= 1000 && task.categoryRisk !== "blocked") {
      return "user-confirmed-payment";
    }
    return "manual-review";
  },
  mandatePaymentGate(task) {
    if (task.expectedRoute === "blocked") return "blocked";
    if (!task.needsCharge) return "quote-only";
    if (task.needsHumanReview) return "manual-review";
    if (task.requiresUserConfirmation || !task.merchantApproved) {
      return "user-confirmed-payment";
    }
    return "merchant-token";
  },
};

function scoreCase(task, routeName) {
  const route = routes[routeName];
  const visibleMerchants = Math.min(
    route.visibleMerchants,
    routeName === "blocked" ? 0 : Math.max(route.visibleMerchants, task.merchantCount),
  );
  const overexposedMerchants = Math.max(0, visibleMerchants - task.merchantCount);
  const unauthorizedCharge =
    route.chargeAllowed &&
    (!task.needsCharge ||
      task.expectedRoute === "blocked" ||
      (task.requiresUserConfirmation && !route.requiresConfirmation));
  const amountViolation = route.chargeAllowed && task.amount > route.maxAmount;
  const merchantViolation =
    route.chargeAllowed && route.merchantScope === "approved" && !task.merchantApproved;
  const riskViolation =
    routeName !== "blocked" && riskRank[task.categoryRisk] > riskRank[route.maxRisk];
  const manualReviewMiss =
    task.needsHumanReview && routeName !== "blocked" && !route.requiresHumanApproval;
  const falseBlock = routeName === "blocked" && task.expectedRoute !== "blocked";
  const policyMatch = routeName === task.expectedRoute;
  const pass =
    policyMatch &&
    !unauthorizedCharge &&
    !amountViolation &&
    !merchantViolation &&
    !riskViolation &&
    !manualReviewMiss &&
    !falseBlock;

  return {
    taskId: task.id,
    routeName,
    pass,
    policyMatch,
    unauthorizedCharge,
    amountViolation,
    merchantViolation,
    riskViolation,
    manualReviewMiss,
    falseBlock,
    overexposedMerchants,
    visibleMerchants,
  };
}

const summaries = Object.fromEntries(
  Object.entries(policies).map(([policyName, policy]) => {
    const cases = tasks.map((task) => scoreCase(task, policy(task)));
    const count = cases.length;
    const sum = (field) => cases.filter((entry) => entry[field]).length;
    const numeric = (field) => cases.reduce((total, entry) => total + entry[field], 0);
    return [
      policyName,
      {
        cases,
        passRate: sum("pass") / count,
        policyMatchRate: sum("policyMatch") / count,
        unauthorizedCharges: sum("unauthorizedCharge"),
        mandateViolations:
          sum("amountViolation") + sum("merchantViolation") + sum("riskViolation"),
        manualReviewMisses: sum("manualReviewMiss"),
        falseBlocks: sum("falseBlock"),
        overexposedMerchants: numeric("overexposedMerchants"),
        meanVisibleMerchants: numeric("visibleMerchants") / count,
      },
    ];
  }),
);

const outputLines = [
  "Agentic commerce payment gate experiment",
  `tasks=${tasks.length}`,
  ...Object.entries(summaries).map(
    ([name, summary]) =>
      `${name}: pass_rate=${summary.passRate.toFixed(3)} policy_match=${summary.policyMatchRate.toFixed(3)} unauthorized_charges=${summary.unauthorizedCharges} mandate_violations=${summary.mandateViolations} manual_review_misses=${summary.manualReviewMisses} overexposed_merchants=${summary.overexposedMerchants} mean_visible_merchants=${summary.meanVisibleMerchants.toFixed(2)} false_blocks=${summary.falseBlocks}`,
  ),
];

const artifactsDir = path.join(projectDir, "artifacts");
fs.mkdirSync(artifactsDir, { recursive: true });
fs.writeFileSync(
  path.join(artifactsDir, "results.json"),
  JSON.stringify({ tasks, summaries }, null, 2),
);
fs.writeFileSync(path.join(artifactsDir, "output.txt"), `${outputLines.join("\n")}\n`);

const chartWidth = 960;
const chartHeight = 540;
const policiesForChart = Object.keys(summaries);
const bars = policiesForChart
  .map((name, index) => {
    const summary = summaries[name];
    const x = 130 + index * 250;
    const passHeight = summary.passRate * 220;
    const unsafeHeight = Math.min(220, summary.unauthorizedCharges * 28);
    const violationHeight = Math.min(220, summary.mandateViolations * 24);
    const label = name.replace(/([A-Z])/g, " $1").trim();
    return `
    <g>
      <text x="${x + 70}" y="398" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#111827">${label}</text>
      <rect x="${x}" y="${332 - passHeight}" width="42" height="${passHeight}" fill="#16a34a"/>
      <rect x="${x + 52}" y="${332 - unsafeHeight}" width="42" height="${unsafeHeight}" fill="#dc2626"/>
      <rect x="${x + 104}" y="${332 - violationHeight}" width="42" height="${violationHeight}" fill="#d97706"/>
      <text x="${x + 21}" y="${322 - passHeight}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#111827">${summary.passRate.toFixed(2)}</text>
      <text x="${x + 73}" y="${322 - unsafeHeight}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#111827">${summary.unauthorizedCharges}</text>
      <text x="${x + 125}" y="${322 - violationHeight}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#111827">${summary.mandateViolations}</text>
    </g>`;
  })
  .join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img">
  <title>Agentic commerce payment gate results</title>
  <desc>Bar chart comparing saved card delegation, merchant-scoped tokens, and mandate payment gates by pass rate, unauthorized charges, and mandate violations.</desc>
  <rect width="${chartWidth}" height="${chartHeight}" fill="#f8fafc"/>
  <rect x="48" y="44" width="864" height="444" rx="8" fill="#ffffff" stroke="#cbd5e1"/>
  <text x="84" y="90" font-family="Arial, sans-serif" font-size="28" font-weight="800" fill="#111827">Payment authorization gates for agents</text>
  <text x="84" y="122" font-family="Arial, sans-serif" font-size="17" fill="#475569">Pass rate improves only when the payment mandate is checked at runtime.</text>
  <line x1="96" y1="332" x2="864" y2="332" stroke="#94a3b8"/>
  <line x1="96" y1="112" x2="96" y2="332" stroke="#94a3b8"/>
  <text x="78" y="336" text-anchor="end" font-family="Arial, sans-serif" font-size="13" fill="#475569">0</text>
  <text x="78" y="116" text-anchor="end" font-family="Arial, sans-serif" font-size="13" fill="#475569">1.0 / 8</text>
  ${bars}
  <g font-family="Arial, sans-serif" font-size="14" fill="#111827">
    <rect x="160" y="436" width="18" height="18" fill="#16a34a"/><text x="186" y="451">pass rate</text>
    <rect x="306" y="436" width="18" height="18" fill="#dc2626"/><text x="332" y="451">unauthorized charges</text>
    <rect x="520" y="436" width="18" height="18" fill="#d97706"/><text x="546" y="451">mandate violations</text>
  </g>
</svg>
`;

fs.writeFileSync(path.join(artifactsDir, "payment-gate-results.svg"), svg);
console.log(outputLines.join("\n"));
