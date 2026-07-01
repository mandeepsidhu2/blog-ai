#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(await fs.readFile(path.join(__dirname, "dataset.json"), "utf8"));

const policies = {
  scopeOnly(event) {
    if (!hasRequiredScopes(event)) return "block";
    if (event.risk !== "low") return "review";
    return "allow";
  },
  audienceOnly(event) {
    if (!hasRequiredScopes(event)) return "block";
    if (!audienceMatchesResource(event)) return "block";
    if (event.tokenAudience.length > 1 || event.risk === "medium") return "review";
    return "allow";
  },
  resourceBound(event) {
    if (!hasRequiredScopes(event)) return "block";
    if (!audienceMatchesResource(event)) return event.risk === "high" ? "block" : "review";
    if (event.issuer !== event.expectedIssuer) return "block";
    if (event.transport !== "authorization-header") return "block";
    if (event.tokenType === "refresh") return "block";
    if (!event.protectedResourceMetadataMatched) return "block";
    if (event.passthroughAttempt || event.downstreamResource) return "block";
    if (event.promptRequestedResource && canonicalize(event.promptRequestedResource) !== canonicalize(event.resource)) {
      return "block";
    }
    if (event.tokenAudience.length > 1 || event.risk === "medium") return "review";
    return "allow";
  },
};

function canonicalize(value) {
  try {
    const url = new URL(value);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname === "/") url.pathname = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
}

function hasRequiredScopes(event) {
  return event.requiredScopes.every((scope) => event.scopes.includes(scope));
}

function audienceMatchesResource(event) {
  const resource = canonicalize(event.resource);
  return event.tokenAudience.map(canonicalize).includes(resource);
}

function dispositionScore(actual, expected) {
  if (actual === expected) return 1;
  if (actual === "review" && expected === "block") return 0.5;
  if (actual === "block" && expected === "review") return 0.75;
  if (actual === "review" && expected === "allow") return 0.5;
  return 0;
}

function falseNegative(actual, expected) {
  return expected === "block" && actual !== "block";
}

function falsePositive(actual, expected) {
  return expected === "allow" && actual !== "allow";
}

const policyResults = Object.entries(policies).map(([name, policy]) => {
  const cases = dataset.map((event) => {
    const actual = policy(event);
    return {
      id: event.id,
      expected: event.expectedDisposition,
      actual,
      audienceMatch: audienceMatchesResource(event),
      scopeMatch: hasRequiredScopes(event),
      score: dispositionScore(actual, event.expectedDisposition),
      falseNegative: falseNegative(actual, event.expectedDisposition),
      falsePositive: falsePositive(actual, event.expectedDisposition),
    };
  });

  return {
    policy: name,
    accuracy: Number((cases.filter((item) => item.actual === item.expected).length / cases.length).toFixed(3)),
    meanScore: Number((cases.reduce((sum, item) => sum + item.score, 0) / cases.length).toFixed(3)),
    blocked: cases.filter((item) => item.actual === "block").length,
    reviewed: cases.filter((item) => item.actual === "review").length,
    allowed: cases.filter((item) => item.actual === "allow").length,
    falseNegatives: cases.filter((item) => item.falseNegative).length,
    falsePositives: cases.filter((item) => item.falsePositive).length,
    cases,
  };
});

const outputLines = [
  "MCP token audience gate experiment",
  `cases=${dataset.length}`,
  ...policyResults.map(
    (result) =>
      `${result.policy}: accuracy=${result.accuracy} mean_score=${result.meanScore} blocked=${result.blocked} reviewed=${result.reviewed} allowed=${result.allowed} false_negatives=${result.falseNegatives} false_positives=${result.falsePositives}`,
  ),
];

await fs.writeFile(path.join(__dirname, "results.json"), `${JSON.stringify({ dataset, policyResults }, null, 2)}\n`);
await fs.writeFile(path.join(__dirname, "output.txt"), `${outputLines.join("\n")}\n`);
await fs.writeFile(path.join(__dirname, "chart.svg"), renderChart(policyResults));
console.log(outputLines.join("\n"));

function renderChart(results) {
  const width = 960;
  const height = 540;
  const margin = { left: 84, right: 44, top: 78, bottom: 92 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const groupWidth = plotWidth / results.length;
  const bars = [
    { key: "accuracy", label: "Accuracy", color: "#1f6f8b" },
    { key: "meanScore", label: "Mean score", color: "#b85c38" },
    { key: "falseNegatives", label: "False negatives", color: "#5f4b8b", max: 8 },
  ];
  const y = (value) => margin.top + plotHeight - value * plotHeight;
  const rects = results
    .map((result, groupIndex) =>
      bars
        .map((bar, barIndex) => {
          const raw = result[bar.key];
          const value = bar.key === "falseNegatives" ? raw / bar.max : raw;
          const x = margin.left + groupIndex * groupWidth + 34 + barIndex * 58;
          const h = value * plotHeight;
          const label = bar.key === "falseNegatives" ? raw : raw.toFixed(3);
          return `<rect x="${x}" y="${y(value)}" width="44" height="${h}" rx="5" fill="${bar.color}"/>
<text x="${x + 22}" y="${y(value) - 10}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="15" fill="#17202a">${label}</text>`;
        })
        .join("\n"),
    )
    .join("\n");
  const labels = results
    .map((result, index) => {
      const x = margin.left + index * groupWidth + groupWidth / 2;
      return `<text x="${x}" y="${height - 34}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="18" fill="#17202a">${result.policy}</text>`;
    })
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">MCP token audience release gate results</title>
  <desc id="desc">Grouped bar chart comparing scope-only, audience-only, and resource-bound policies by accuracy, mean score, and false negatives.</desc>
  <rect width="${width}" height="${height}" fill="#f8faf7"/>
  <text x="48" y="42" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="700" fill="#17202a">Resource-bound MCP gates close token reuse paths</text>
  <text x="48" y="68" font-family="Inter, Arial, sans-serif" font-size="15" fill="#51606b">False negatives are scaled against an eight-case ceiling; lower is better.</text>
  <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${width - margin.right}" y2="${margin.top + plotHeight}" stroke="#9aa7b0" stroke-width="1.5"/>
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#9aa7b0" stroke-width="1.5"/>
  <text x="36" y="${margin.top + 8}" font-family="Inter, Arial, sans-serif" font-size="13" fill="#51606b">1.0</text>
  <text x="46" y="${margin.top + plotHeight + 4}" font-family="Inter, Arial, sans-serif" font-size="13" fill="#51606b">0</text>
  ${rects}
  ${labels}
  <g transform="translate(82 482)" font-family="Inter, Arial, sans-serif" font-size="15" fill="#17202a">
    <rect x="0" y="0" width="18" height="18" rx="3" fill="#1f6f8b"/><text x="28" y="14">Accuracy</text>
    <rect x="138" y="0" width="18" height="18" rx="3" fill="#b85c38"/><text x="166" y="14">Mean score</text>
    <rect x="306" y="0" width="18" height="18" rx="3" fill="#5f4b8b"/><text x="334" y="14">False negatives</text>
  </g>
</svg>
`;
}
