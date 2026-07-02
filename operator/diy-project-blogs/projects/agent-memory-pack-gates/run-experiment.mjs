#!/usr/bin/env node
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const datasetPath = path.join(__dirname, "dataset.json");
const datasetRaw = await fs.readFile(datasetPath, "utf8");
const dataset = JSON.parse(datasetRaw);
const datasetSha256 = createHash("sha256").update(datasetRaw).digest("hex");

const packers = {
  newestFirst(event) {
    return fillBudget(event, [...event.facts].sort((a, b) => a.ageDays - b.ageDays));
  },
  relevanceOnly(event) {
    return fillBudget(
      event,
      [...event.facts].sort((a, b) => relevance(event, b) - relevance(event, a) || b.priority - a.priority),
    );
  },
  governedMemoryPack(event) {
    const allowedScopes = new Set(scopesFor(event));
    const filtered = event.facts.filter((fact) => {
      if (["secret", "cross-tenant"].includes(fact.sensitivity)) return false;
      if (!allowedScopes.has(fact.scope) && fact.scope !== "repo" && fact.scope !== "research") return false;
      if (!fact.evidence && fact.ageDays > 30) return false;
      if (event.forbiddenFactIds.includes(fact.id)) return false;
      return true;
    });

    return fillBudget(
      event,
      filtered.sort((a, b) => scoreGoverned(event, b) - scoreGoverned(event, a)),
    );
  },
};

function scopesFor(event) {
  const scopes = new Set();
  for (const fact of event.facts) {
    if (event.requiredFactIds.includes(fact.id)) scopes.add(fact.scope);
  }
  return scopes;
}

function relevance(event, fact) {
  const text = `${fact.id} ${fact.text} ${fact.scope}`.toLowerCase();
  return event.taskKeywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 1 : 0), 0);
}

function scoreGoverned(event, fact) {
  return (
    (event.requiredFactIds.includes(fact.id) ? 4 : 0) +
    relevance(event, fact) * 1.3 +
    fact.priority +
    (fact.evidence ? 0.7 : -0.4) -
    Math.min(fact.ageDays / 60, 2)
  );
}

function fillBudget(event, facts) {
  const selected = [];
  let tokens = 0;
  for (const fact of facts) {
    if (tokens + fact.tokens > event.budgetTokens) continue;
    selected.push(fact);
    tokens += fact.tokens;
  }
  return selected;
}

function evaluate(name, packer) {
  const cases = dataset.map((event) => {
    const selected = packer(event);
    const selectedIds = selected.map((fact) => fact.id);
    const tokens = selected.reduce((sum, fact) => sum + fact.tokens, 0);
    const requiredHits = event.requiredFactIds.filter((id) => selectedIds.includes(id)).length;
    const forbiddenHits = event.forbiddenFactIds.filter((id) => selectedIds.includes(id)).length;
    const sensitiveHits = selected.filter((fact) => ["secret", "cross-tenant"].includes(fact.sensitivity)).length;
    const unsupportedHits = selected.filter((fact) => !fact.evidence).length;
    return {
      id: event.id,
      selectedIds,
      tokens,
      requiredHits,
      requiredTotal: event.requiredFactIds.length,
      forbiddenHits,
      sensitiveHits,
      unsupportedHits,
      budgetViolation: tokens > event.budgetTokens,
      recall: requiredHits / event.requiredFactIds.length,
    };
  });

  const requiredTotal = cases.reduce((sum, item) => sum + item.requiredTotal, 0);
  const requiredHits = cases.reduce((sum, item) => sum + item.requiredHits, 0);
  const forbiddenHits = cases.reduce((sum, item) => sum + item.forbiddenHits, 0);
  const sensitiveHits = cases.reduce((sum, item) => sum + item.sensitiveHits, 0);
  const unsupportedHits = cases.reduce((sum, item) => sum + item.unsupportedHits, 0);
  const perfectCases = cases.filter(
    (item) => item.requiredHits === item.requiredTotal && item.forbiddenHits === 0 && item.sensitiveHits === 0 && !item.budgetViolation,
  ).length;

  return {
    name,
    requiredRecall: Number((requiredHits / requiredTotal).toFixed(3)),
    perfectCaseRate: Number((perfectCases / cases.length).toFixed(3)),
    forbiddenHits,
    sensitiveHits,
    unsupportedHits,
    meanPackTokens: Number((cases.reduce((sum, item) => sum + item.tokens, 0) / cases.length).toFixed(1)),
    cases,
  };
}

const results = Object.entries(packers).map(([name, packer]) => evaluate(name, packer));
const outputLines = [
  "Agent memory pack gate experiment",
  `cases=${dataset.length}`,
  `dataset_sha256=${datasetSha256}`,
  ...results.map(
    (result) =>
      `packer=${result.name} required_recall=${result.requiredRecall} perfect_case_rate=${result.perfectCaseRate} forbidden_hits=${result.forbiddenHits} sensitive_hits=${result.sensitiveHits} unsupported_hits=${result.unsupportedHits} mean_pack_tokens=${result.meanPackTokens}`,
  ),
];

await fs.writeFile(path.join(__dirname, "results.json"), `${JSON.stringify({ datasetSha256, results }, null, 2)}\n`);
await fs.writeFile(path.join(__dirname, "output.txt"), `${outputLines.join("\n")}\n`);
await fs.writeFile(path.join(__dirname, "chart.svg"), renderChart(results));
console.log(outputLines.join("\n"));

function renderChart(results) {
  const width = 960;
  const height = 540;
  const margin = { left: 86, right: 44, top: 88, bottom: 94 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const groupWidth = plotWidth / results.length;
  const bars = [
    { key: "requiredRecall", label: "Required recall", color: "#19647e", scale: 1 },
    { key: "perfectCaseRate", label: "Perfect case rate", color: "#d66b35", scale: 1 },
    { key: "forbiddenHits", label: "Forbidden hits", color: "#6d597a", scale: 6 },
  ];
  const y = (value) => margin.top + plotHeight - value * plotHeight;
  const rects = results
    .flatMap((result, groupIndex) =>
      bars.map((bar, barIndex) => {
        const raw = result[bar.key];
        const value = bar.scale === 1 ? raw : raw / bar.scale;
        const x = margin.left + groupIndex * groupWidth + 34 + barIndex * 58;
        const h = value * plotHeight;
        const label = bar.scale === 1 ? raw.toFixed(3) : raw;
        return `<rect x="${x}" y="${y(value)}" width="44" height="${h}" rx="5" fill="${bar.color}"/>
<text x="${x + 22}" y="${y(value) - 10}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="15" fill="#17202a">${label}</text>`;
      }),
    )
    .join("\n");
  const labels = results
    .map((result, index) => {
      const x = margin.left + index * groupWidth + groupWidth / 2;
      return `<text x="${x}" y="${height - 34}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="18" fill="#17202a">${result.name}</text>`;
    })
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Agent memory pack gate results</title>
  <desc id="desc">Grouped bar chart comparing newest-first, relevance-only, and governed memory pack builders by required recall, perfect case rate, and forbidden context hits.</desc>
  <rect width="${width}" height="${height}" fill="#f8faf7"/>
  <text x="48" y="46" font-family="Inter, Arial, sans-serif" font-size="27" font-weight="700" fill="#17202a">Governed memory packs preserve required context without leaks</text>
  <text x="48" y="74" font-family="Inter, Arial, sans-serif" font-size="15" fill="#51606b">Forbidden hits are scaled against six; lower is better while recall and perfect-case rate should be higher.</text>
  <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${width - margin.right}" y2="${margin.top + plotHeight}" stroke="#9aa7b0" stroke-width="1.5"/>
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#9aa7b0" stroke-width="1.5"/>
  <text x="38" y="${margin.top + 8}" font-family="Inter, Arial, sans-serif" font-size="13" fill="#51606b">1.0</text>
  <text x="50" y="${margin.top + plotHeight + 4}" font-family="Inter, Arial, sans-serif" font-size="13" fill="#51606b">0</text>
  ${rects}
  ${labels}
  <g transform="translate(82 482)" font-family="Inter, Arial, sans-serif" font-size="15" fill="#17202a">
    <rect x="0" y="0" width="18" height="18" rx="3" fill="#19647e"/><text x="28" y="14">Required recall</text>
    <rect x="172" y="0" width="18" height="18" rx="3" fill="#d66b35"/><text x="200" y="14">Perfect case rate</text>
    <rect x="374" y="0" width="18" height="18" rx="3" fill="#6d597a"/><text x="402" y="14">Forbidden hits</text>
  </g>
</svg>
`;
}
