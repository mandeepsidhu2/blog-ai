import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(fs.readFileSync(path.join(__dirname, "dataset.json"), "utf8"));

const policies = {
  metadataOnly(record) {
    if (!record.provider || !record.surface || record.scopes.length === 0) return "block";
    if (!record.officialServer && record.writeAction) return "review";
    if (record.destructiveAction) return "review";
    return "allow";
  },
  consentOnly(record) {
    if (record.writeAction && !record.confirmationRequired) return "block";
    if (record.writeAction && vagueConsent(record.consentCopy)) return "review";
    if (record.scopes.some((scope) => scope.includes("admin") || scope.endsWith(".all"))) return "review";
    if (!record.officialServer && record.writeAction) return "review";
    return "allow";
  },
  boundaryGate(record) {
    if (!record.officialServer && record.writeAction) return "block";
    if (record.writeAction && !record.confirmationRequired) return "block";
    if (!record.tokenAudienceBound) return "block";
    if (!record.perClientConsent) return "block";
    if (record.logsTokens) return "block";
    if (record.logsRawPrompt && record.userData === "regulated") return "block";
    if (record.surface === "a2a-agent" && !record.signedAgentCard) return "block";
    if (record.surface === "a2a-agent" && !record.extendedCardRequiresAuth) return "block";
    if (!record.publicCardMinimized && record.surface === "a2a-agent") return "block";
    if (record.networkAllowlist.includes("*") || record.frameDomains.includes("*")) return "review";
    if (record.scopes.some((scope) => scope.includes("admin") || scope.endsWith(".all"))) return "review";
    if (record.writeAction && record.promptInjectionTests < 4) return "review";
    if (record.writeAction && vagueConsent(record.consentCopy)) return "review";
    return "allow";
  },
};

function vagueConsent(copy) {
  return copy.trim().split(/\s+/).length < 6 || /^connect to/i.test(copy);
}

function score(actual, expected) {
  if (actual === expected) return 1;
  if (actual === "review" && expected === "block") return 0.5;
  if (actual === "block" && expected === "review") return 0.75;
  if (actual === "review" && expected === "allow") return 0.5;
  return 0;
}

function summarize(policyName, fn) {
  const decisions = dataset.map((record) => {
    const actual = fn(record);
    return {
      id: record.id,
      expected: record.expected,
      actual,
      score: score(actual, record.expected),
      falseNegative: record.expected === "block" && actual !== "block",
      falsePositive: record.expected === "allow" && actual === "block",
    };
  });
  const counts = countBy(decisions.map((decision) => decision.actual));
  const exact = decisions.filter((decision) => decision.actual === decision.expected).length;
  const falseNegatives = decisions.filter((decision) => decision.falseNegative).length;
  const falsePositives = decisions.filter((decision) => decision.falsePositive).length;
  const meanScore = decisions.reduce((sum, decision) => sum + decision.score, 0) / decisions.length;
  return {
    policyName,
    accuracy: round(exact / decisions.length),
    meanScore: round(meanScore),
    allowed: counts.allow ?? 0,
    reviewed: counts.review ?? 0,
    blocked: counts.block ?? 0,
    falseNegatives,
    falsePositives,
    decisions,
  };
}

function countBy(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

const summaries = Object.entries(policies).map(([name, fn]) => summarize(name, fn));
const outputLines = [
  "Agent app manifest risk gate experiment",
  `cases=${dataset.length}`,
  ...summaries.map(
    (summary) =>
      `${summary.policyName}: accuracy=${summary.accuracy} mean_score=${summary.meanScore} blocked=${summary.blocked} reviewed=${summary.reviewed} allowed=${summary.allowed} false_negatives=${summary.falseNegatives} false_positives=${summary.falsePositives}`,
  ),
];

fs.writeFileSync(path.join(__dirname, "output.txt"), `${outputLines.join("\n")}\n`);
fs.writeFileSync(
  path.join(__dirname, "results.json"),
  `${JSON.stringify({ cases: dataset.length, summaries }, null, 2)}\n`,
);
fs.writeFileSync(path.join(__dirname, "chart.svg"), renderChart(summaries));
console.log(outputLines.join("\n"));

function renderChart(summaries) {
  const width = 960;
  const height = 540;
  const plotX = 130;
  const plotY = 104;
  const plotW = 720;
  const barH = 34;
  const gap = 36;
  const rows = summaries.map((summary) => ({
    label: summary.policyName,
    accuracy: summary.accuracy,
    falseNegatives: summary.falseNegatives,
    blocked: summary.blocked,
  }));
  const maxFalseNegatives = Math.max(...rows.map((row) => row.falseNegatives), 1);
  const maxBlocked = Math.max(...rows.map((row) => row.blocked), 1);

  const rowSvg = rows
    .map((row, index) => {
      const y = plotY + index * 126;
      const accuracyW = row.accuracy * plotW;
      const fnW = (row.falseNegatives / maxFalseNegatives) * plotW;
      const blockedW = (row.blocked / maxBlocked) * plotW;
      return `
  <text x="52" y="${y + 23}" class="label">${escapeXml(row.label)}</text>
  <rect x="${plotX}" y="${y}" width="${plotW}" height="${barH}" rx="5" class="track"/>
  <rect x="${plotX}" y="${y}" width="${accuracyW}" height="${barH}" rx="5" class="accuracy"/>
  <text x="${plotX + accuracyW + 12}" y="${y + 23}" class="value">accuracy ${row.accuracy}</text>
  <rect x="${plotX}" y="${y + 46}" width="${plotW}" height="${barH}" rx="5" class="track"/>
  <rect x="${plotX}" y="${y + 46}" width="${fnW}" height="${barH}" rx="5" class="fn"/>
  <text x="${plotX + fnW + 12}" y="${y + 69}" class="value">${row.falseNegatives} false negatives</text>
  <rect x="${plotX}" y="${y + 92}" width="${plotW}" height="${barH}" rx="5" class="track"/>
  <rect x="${plotX}" y="${y + 92}" width="${blockedW}" height="${barH}" rx="5" class="blocked"/>
  <text x="${plotX + blockedW + 12}" y="${y + 115}" class="value">${row.blocked} blocked</text>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Agent app manifest risk gate results</title>
  <desc id="desc">Bar chart comparing metadata-only, consent-only, and boundary-gate policies by accuracy, false negatives, and blocked cases.</desc>
  <defs>
    <style>
      .bg { fill: #f7f4ea; }
      .panel { fill: #ffffff; stroke: #d5d0c2; stroke-width: 1.5; }
      .title { font-family: Arial, Helvetica, sans-serif; font-size: 30px; font-weight: 700; fill: #17201b; }
      .subtitle { font-family: Arial, Helvetica, sans-serif; font-size: 17px; fill: #52605a; }
      .label { font-family: Arial, Helvetica, sans-serif; font-size: 17px; font-weight: 700; fill: #17201b; text-anchor: end; }
      .value { font-family: Arial, Helvetica, sans-serif; font-size: 15px; fill: #2f3c36; }
      .track { fill: #e8e2d3; }
      .accuracy { fill: #266f6d; }
      .fn { fill: #b94043; }
      .blocked { fill: #6c5fcb; }
      .legend { font-family: Arial, Helvetica, sans-serif; font-size: 15px; fill: #2f3c36; }
    </style>
  </defs>
  <rect class="bg" width="${width}" height="${height}"/>
  <rect class="panel" x="28" y="28" width="904" height="484" rx="8"/>
  <text class="title" x="52" y="68">Manifest Risk Gate Comparison</text>
  <text class="subtitle" x="52" y="94">Boundary checks remove the missed block cases that metadata and consent checks leave behind.</text>
${rowSvg}
  <circle cx="486" cy="496" r="7" class="accuracy"/><text x="500" y="501" class="legend">Exact-match accuracy</text>
  <circle cx="670" cy="496" r="7" class="fn"/><text x="684" y="501" class="legend">Expected blocks missed</text>
  <circle cx="842" cy="496" r="7" class="blocked"/><text x="856" y="501" class="legend">Blocked cases</text>
</svg>
`;
}

function escapeXml(value) {
  return value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return char;
    }
  });
}
