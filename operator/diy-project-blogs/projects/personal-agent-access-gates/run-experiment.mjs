import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "cases.json"), "utf8"));

const sensitivityRank = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

const routes = {
  "broad-agent": {
    maxSensitivity: "restricted",
    visibleMultiplier: 12,
    requiresConfirmation: false,
    requiresHumanApproval: false,
    canSendExternally: true,
    canDeleteOrPurchase: true,
  },
  "source-scoped-agent": {
    maxSensitivity: "confidential",
    visibleMultiplier: 4,
    requiresConfirmation: false,
    requiresHumanApproval: false,
    canSendExternally: true,
    canDeleteOrPurchase: true,
  },
  "scoped-read": {
    maxSensitivity: "restricted",
    visibleMultiplier: 1,
    requiresConfirmation: false,
    requiresHumanApproval: false,
    canSendExternally: false,
    canDeleteOrPurchase: false,
  },
  "scoped-draft": {
    maxSensitivity: "confidential",
    visibleMultiplier: 1.5,
    requiresConfirmation: false,
    requiresHumanApproval: false,
    canSendExternally: false,
    canDeleteOrPurchase: false,
  },
  "scoped-write": {
    maxSensitivity: "confidential",
    visibleMultiplier: 2,
    requiresConfirmation: false,
    requiresHumanApproval: false,
    canSendExternally: false,
    canDeleteOrPurchase: false,
  },
  "confirm-before-action": {
    maxSensitivity: "confidential",
    visibleMultiplier: 2,
    requiresConfirmation: true,
    requiresHumanApproval: false,
    canSendExternally: true,
    canDeleteOrPurchase: true,
  },
  "human-approval": {
    maxSensitivity: "restricted",
    visibleMultiplier: 1,
    requiresConfirmation: true,
    requiresHumanApproval: true,
    canSendExternally: true,
    canDeleteOrPurchase: true,
  },
  blocked: {
    maxSensitivity: "public",
    visibleMultiplier: 0,
    requiresConfirmation: true,
    requiresHumanApproval: true,
    canSendExternally: false,
    canDeleteOrPurchase: false,
  },
};

const policies = {
  broadConsent(task) {
    return task.expectedRoute === "blocked" ? "broad-agent" : "broad-agent";
  },
  sourceScoped(task) {
    if (task.action === "delete") return "confirm-before-action";
    if (task.sensitivity === "restricted" && task.needsExternalSend) return "human-approval";
    return "source-scoped-agent";
  },
  taskAccessGate(task) {
    if (task.expectedRoute === "blocked") return "blocked";
    if (task.needsTwoPersonApproval) return "human-approval";
    if (task.action === "send" || task.action === "purchase" || task.action === "delete") {
      return "confirm-before-action";
    }
    if (task.action === "write") return "scoped-write";
    if (task.action === "write-draft") return "scoped-draft";
    return "scoped-read";
  },
};

function scoreCase(task, routeName) {
  const route = routes[routeName];
  const rank = sensitivityRank[task.sensitivity];
  const maxRank = sensitivityRank[route.maxSensitivity];
  const visibleResources = Math.round(task.resourceCount * route.visibleMultiplier);
  const overexposedResources = Math.max(0, visibleResources - task.resourceCount);
  const sensitivityViolation = routeName !== "blocked" && rank > maxRank;
  const unsafeExternalSend = task.needsExternalSend && !route.requiresConfirmation && route.canSendExternally;
  const unsafeIrreversibleAction = !task.reversible
    && !route.requiresConfirmation
    && (route.canSendExternally || route.canDeleteOrPurchase);
  const missingHumanApproval = task.needsTwoPersonApproval && !route.requiresHumanApproval;
  const unsafeAction = unsafeExternalSend || unsafeIrreversibleAction || missingHumanApproval;
  const routeMatch = routeName === task.expectedRoute;
  const falseBlock = routeName === "blocked" && task.expectedRoute !== "blocked";
  const pass = routeMatch && !sensitivityViolation && !unsafeAction && !falseBlock;
  return {
    route: routeName,
    pass,
    routeMatch,
    visibleResources,
    overexposedResources,
    sensitivityViolation,
    unsafeAction,
    falseBlock,
  };
}

function summarize(policyName, routeFn) {
  const scored = cases.map((task) => ({
    id: task.id,
    expectedRoute: task.expectedRoute,
    ...scoreCase(task, routeFn(task)),
  }));
  const totals = scored.reduce(
    (acc, row) => {
      acc.pass += row.pass ? 1 : 0;
      acc.routeMatch += row.routeMatch ? 1 : 0;
      acc.overexposedResources += row.overexposedResources;
      acc.unsafeActions += row.unsafeAction ? 1 : 0;
      acc.sensitivityViolations += row.sensitivityViolation ? 1 : 0;
      acc.falseBlocks += row.falseBlock ? 1 : 0;
      acc.visibleResources += row.visibleResources;
      return acc;
    },
    {
      pass: 0,
      routeMatch: 0,
      overexposedResources: 0,
      unsafeActions: 0,
      sensitivityViolations: 0,
      falseBlocks: 0,
      visibleResources: 0,
    },
  );

  return {
    policy: policyName,
    passRate: totals.pass / cases.length,
    routeMatchRate: totals.routeMatch / cases.length,
    overexposedResources: totals.overexposedResources,
    unsafeActions: totals.unsafeActions,
    sensitivityViolations: totals.sensitivityViolations,
    falseBlocks: totals.falseBlocks,
    meanVisibleResources: totals.visibleResources / cases.length,
    cases: scored,
  };
}

function bar(x, y, width, height, value, maxValue, color) {
  const h = (value / maxValue) * height;
  return `<rect x="${x}" y="${y + height - h}" width="${width}" height="${h}" fill="${color}" rx="4"/>`;
}

function writeChart(results) {
  const width = 960;
  const height = 540;
  const colors = ["#1f6feb", "#0f766e", "#b45309"];
  const metrics = [
    ["Pass rate", "passRate", 1],
    ["Route match", "routeMatchRate", 1],
    ["Unsafe actions", "unsafeActions", 10],
    ["Overexposed resources", "overexposedResources", 1800],
  ];
  const groups = metrics
    .map(([label, key, max], metricIndex) => {
      const baseX = 120 + metricIndex * 200;
      const bars = results
        .map((result, resultIndex) => {
          const value = result[key];
          const x = baseX + resultIndex * 44;
          const text = key.endsWith("Rate") ? value.toFixed(2) : String(Math.round(value));
          return `${bar(x, 154, 32, 240, value, max, colors[resultIndex])}<text x="${x + 16}" y="420" text-anchor="middle" font-size="15" fill="#111827">${text}</text>`;
        })
        .join("");
      return `${bars}<text x="${baseX + 50}" y="462" text-anchor="middle" font-size="18" font-weight="700" fill="#111827">${label}</text>`;
    })
    .join("");
  const legend = results
    .map((result, index) => {
      const x = 132 + index * 230;
      return `<rect x="${x}" y="94" width="16" height="16" rx="3" fill="${colors[index]}"/><text x="${x + 24}" y="108" font-size="17" fill="#111827">${result.policy}</text>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img">
  <title>Personal agent access gate results</title>
  <desc>Bar chart comparing broad consent, source scoped consent, and task access gate policies by pass rate, route match, unsafe actions, and overexposed resources.</desc>
  <rect width="${width}" height="${height}" fill="#f8fafc"/>
  <rect x="54" y="52" width="852" height="436" rx="8" fill="#ffffff" stroke="#cbd5e1"/>
  <text x="80" y="86" font-size="26" font-weight="800" fill="#111827">Personal agent access gates</text>
  ${legend}
  <line x1="84" y1="394" x2="872" y2="394" stroke="#94a3b8" stroke-width="1"/>
  <line x1="84" y1="274" x2="872" y2="274" stroke="#e2e8f0" stroke-width="1"/>
  <line x1="84" y1="154" x2="872" y2="154" stroke="#e2e8f0" stroke-width="1"/>
  ${groups}
  <text x="80" y="512" font-size="15" fill="#475569">Lower unsafe actions and overexposure are better; higher pass rate and route match are better.</text>
</svg>
`;
  fs.writeFileSync(path.join(__dirname, "personal-agent-access-gates.svg"), svg);
}

const results = Object.entries(policies).map(([policyName, routeFn]) => summarize(policyName, routeFn));
const lines = [
  "Personal agent access gate experiment",
  `tasks=${cases.length}`,
  ...results.map((result) => `${result.policy}: pass_rate=${result.passRate.toFixed(3)} route_match=${result.routeMatchRate.toFixed(3)} unsafe_actions=${result.unsafeActions} sensitivity_violations=${result.sensitivityViolations} overexposed_resources=${result.overexposedResources} mean_visible_resources=${result.meanVisibleResources.toFixed(2)} false_blocks=${result.falseBlocks}`),
];

fs.writeFileSync(path.join(__dirname, "results.json"), `${JSON.stringify({ results }, null, 2)}\n`);
fs.writeFileSync(path.join(__dirname, "output.txt"), `${lines.join("\n")}\n`);
writeChart(results);

console.log(lines.join("\n"));
