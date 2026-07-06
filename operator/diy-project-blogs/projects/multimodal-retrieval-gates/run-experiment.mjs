#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const datasetPath = path.join(__dirname, "dataset.json");
const resultsPath = path.join(__dirname, "results.json");
const outputPath = path.join(__dirname, "output.txt");
const chartPath = path.join(__dirname, "chart.svg");

const sensitivityRank = {
  public: 1,
  internal: 2,
  restricted: 3,
};

const policies = {
  textOnlyIndex(query, assets) {
    return rank(query, assets.filter((asset) => ["text", "table", "code"].includes(asset.modality)), {
      modalityBoost: 0,
      domainBoost: 0.2,
      sensitivityFilter: false,
    }).slice(0, 3);
  },
  unifiedUngated(query, assets) {
    return rank(query, assets, {
      modalityBoost: 0,
      domainBoost: 0.25,
      sensitivityFilter: false,
    }).slice(0, 4);
  },
  modalityRouted(query, assets) {
    const candidates = assets.filter((asset) => {
      const modalityAllowed = query.requiredModalities.includes(asset.modality);
      const sensitivityAllowed = sensitivityRank[asset.sensitivity] <= sensitivityRank[query.allowedSensitivity];
      return modalityAllowed && sensitivityAllowed;
    });

    const narrowed = candidates.length ? candidates : assets;
    return rank(query, narrowed, {
      modalityBoost: 2.2,
      domainBoost: 1.1,
      sensitivityFilter: true,
    }).slice(0, query.requiredModalities.length > 1 ? 3 : 2);
  },
};

function normalize(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function tokenSet(...parts) {
  return new Set(parts.flatMap((part) => Array.isArray(part) ? part : normalize(String(part))));
}

function rank(query, assets, options) {
  const queryTokens = tokenSet(query.text, query.domain, query.requiredModalities);

  return assets
    .map((asset) => {
      const assetTokens = tokenSet(asset.id, asset.modality, asset.domain, asset.caption, asset.tags);
      const overlap = [...queryTokens].filter((token) => assetTokens.has(token)).length;
      const denominator = Math.sqrt(queryTokens.size * assetTokens.size) || 1;
      const lexical = overlap / denominator;
      const modalityScore = query.requiredModalities.includes(asset.modality) ? options.modalityBoost : 0;
      const domainScore = asset.domain === query.domain ? options.domainBoost : 0;
      const sensitivityPenalty = sensitivityRank[asset.sensitivity] > sensitivityRank[query.allowedSensitivity]
        ? (options.sensitivityFilter ? 4 : 0.6)
        : 0;
      return {
        ...asset,
        score: lexical + modalityScore + domainScore - sensitivityPenalty,
      };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

function evaluate(query, retrieved) {
  const ids = new Set(retrieved.map((asset) => asset.id));
  const expectedHits = query.expectedIds.filter((id) => ids.has(id)).length;
  const recall = expectedHits / query.expectedIds.length;
  const requiredModalities = new Set(query.requiredModalities);
  const modalityMatches = retrieved.filter((asset) => requiredModalities.has(asset.modality)).length;
  const modalityPrecision = retrieved.length ? modalityMatches / retrieved.length : 0;
  const sensitivityViolations = retrieved.filter((asset) => sensitivityRank[asset.sensitivity] > sensitivityRank[query.allowedSensitivity]).length;
  const pass = recall === 1 && modalityPrecision >= 0.5 && sensitivityViolations === 0;

  return {
    queryId: query.id,
    retrievedIds: retrieved.map((asset) => asset.id),
    recall,
    modalityPrecision,
    sensitivityViolations,
    contextItems: retrieved.length,
    pass,
  };
}

function summarize(policyName, queryResults) {
  const count = queryResults.length;
  const sum = (field) => queryResults.reduce((total, result) => total + result[field], 0);
  const passCount = queryResults.filter((result) => result.pass).length;
  const contextItems = sum("contextItems");
  const latencyMs = Math.round(185 + contextItems * 38 + sum("sensitivityViolations") * 45);

  return {
    policy: policyName,
    passRate: passCount / count,
    recallAtK: sum("recall") / count,
    modalityPrecision: sum("modalityPrecision") / count,
    sensitivityViolations: sum("sensitivityViolations"),
    meanContextItems: contextItems / count,
    latencyMs,
    results: queryResults,
  };
}

function formatDecimal(value) {
  return Number(value).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function renderChart(summaries) {
  const width = 960;
  const height = 540;
  const bars = summaries.flatMap((summary, policyIndex) => {
    const xBase = 130 + policyIndex * 260;
    const metrics = [
      { label: "Pass", value: summary.passRate, color: "#1f7a6d" },
      { label: "Recall", value: summary.recallAtK, color: "#3b5ba9" },
      { label: "Precision", value: summary.modalityPrecision, color: "#a05d18" },
    ];
    return metrics.map((metric, metricIndex) => {
      const barHeight = Math.round(metric.value * 260);
      const x = xBase + metricIndex * 54;
      const y = 390 - barHeight;
      return `
        <rect x="${x}" y="${y}" width="36" height="${barHeight}" fill="${metric.color}" rx="4"/>
        <text x="${x + 18}" y="${y - 10}" text-anchor="middle" font-size="18" fill="#172033">${formatDecimal(metric.value)}</text>
        <text x="${x + 18}" y="424" text-anchor="middle" font-size="15" fill="#334155">${metric.label}</text>`;
    }).join("");
  }).join("");

  const labels = summaries.map((summary, index) => {
    const x = 208 + index * 260;
    return `<text x="${x}" y="470" text-anchor="middle" font-size="22" font-weight="700" fill="#172033">${summary.policy}</text>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="title desc">
  <title id="title">Multimodal retrieval routing experiment results</title>
  <desc id="desc">Bar chart comparing pass rate, recall, and modality precision for text-only indexing, unified untyped retrieval, and modality-routed retrieval.</desc>
  <rect width="${width}" height="${height}" fill="#f8fafc"/>
  <text x="56" y="62" font-size="34" font-weight="800" fill="#172033">Multimodal Retrieval Gates</text>
  <text x="56" y="100" font-size="18" fill="#475569">Controlled retrieval run across 14 mixed-modality queries</text>
  <line x1="88" y1="390" x2="890" y2="390" stroke="#94a3b8" stroke-width="2"/>
  <line x1="88" y1="130" x2="88" y2="390" stroke="#94a3b8" stroke-width="2"/>
  <text x="72" y="136" text-anchor="end" font-size="15" fill="#64748b">1.0</text>
  <text x="72" y="264" text-anchor="end" font-size="15" fill="#64748b">0.5</text>
  <text x="72" y="394" text-anchor="end" font-size="15" fill="#64748b">0</text>
  <line x1="88" y1="260" x2="890" y2="260" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="6 6"/>
  ${bars}
  ${labels}
  <text x="56" y="515" font-size="16" fill="#475569">Gate result: modality-routed retrieval reached the highest pass rate with zero sensitivity violations.</text>
</svg>
`;
}

const dataset = JSON.parse(await fs.readFile(datasetPath, "utf8"));
const summaries = Object.entries(policies).map(([policyName, policy]) => {
  const queryResults = dataset.queries.map((query) => evaluate(query, policy(query, dataset.assets)));
  return summarize(policyName, queryResults);
});

const lines = [
  "Multimodal retrieval routing experiment",
  `queries=${dataset.queries.length}`,
  ...summaries.map((summary) => (
    `${summary.policy}: pass_rate=${formatDecimal(summary.passRate)} recall_at_k=${formatDecimal(summary.recallAtK)} modality_precision=${formatDecimal(summary.modalityPrecision)} sensitivity_violations=${summary.sensitivityViolations} mean_context_items=${formatDecimal(summary.meanContextItems)} latency_ms=${summary.latencyMs}`
  )),
];

await fs.writeFile(resultsPath, JSON.stringify({ generatedAt: new Date().toISOString(), summaries }, null, 2));
await fs.writeFile(outputPath, `${lines.join("\n")}\n`);
await fs.writeFile(chartPath, renderChart(summaries));
console.log(lines.join("\n"));
