import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const results = JSON.parse(fs.readFileSync(path.join(root, "results.json"), "utf8"));
const scenarioLabels = new Map([
  ["heterogeneity-0", "No cluster heterogeneity"],
  ["heterogeneity-0.1", "Moderate heterogeneity"],
  ["heterogeneity-0.2", "Strong heterogeneity"],
  ["clusters-10", "10 repositories"],
  ["clusters-20", "20 repositories"],
  ["clusters-80", "80 repositories"],
]);
const methodLabels = {
  naive: "Task normal",
  taskBootstrap: "Task bootstrap",
  clusterBootstrap: "Repository bootstrap",
};
const colors = {
  naive: "#ff8a65",
  taskBootstrap: "#f6c453",
  clusterBootstrap: "#5eead4",
};

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function panel(scenarios, x, y, width, height, title) {
  const top = y + 58;
  const bottom = y + height - 54;
  const chartHeight = bottom - top;
  const yMin = 0.88;
  const yMax = 0.97;
  const projectY = (value) => bottom - ((value - yMin) / (yMax - yMin)) * chartHeight;
  const groupWidth = (width - 94) / scenarios.length;
  const marks = [];

  marks.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="#111b32" stroke="#2b3b5c"/>`);
  marks.push(`<text x="${x + 24}" y="${y + 34}" class="panel-title">${escapeXml(title)}</text>`);
  for (const tick of [0.90, 0.92, 0.94, 0.95, 0.96]) {
    const tickY = projectY(tick);
    const dash = tick === 0.95 ? "" : ' stroke-dasharray="4 5"';
    const stroke = tick === 0.95 ? "#dbeafe" : "#344464";
    marks.push(`<line x1="${x + 58}" y1="${tickY}" x2="${x + width - 20}" y2="${tickY}" stroke="${stroke}"${dash}/>`);
    marks.push(`<text x="${x + 48}" y="${tickY + 4}" class="axis" text-anchor="end">${Math.round(tick * 100)}%</text>`);
  }

  scenarios.forEach((scenario, index) => {
    const center = x + 70 + groupWidth * index + groupWidth / 2;
    const entries = Object.entries(scenario.methods);
    entries.forEach(([method, metrics], methodIndex) => {
      const cx = center + (methodIndex - 1) * 24;
      const cy = projectY(metrics.coverage);
      const error = metrics.coverageMonteCarloSE * 1.96;
      const high = projectY(Math.min(yMax, metrics.coverage + error));
      const low = projectY(Math.max(yMin, metrics.coverage - error));
      marks.push(`<line x1="${cx}" y1="${high}" x2="${cx}" y2="${low}" stroke="${colors[method]}" stroke-width="2"/>`);
      marks.push(`<line x1="${cx - 5}" y1="${high}" x2="${cx + 5}" y2="${high}" stroke="${colors[method]}" stroke-width="2"/>`);
      marks.push(`<line x1="${cx - 5}" y1="${low}" x2="${cx + 5}" y2="${low}" stroke="${colors[method]}" stroke-width="2"/>`);
      marks.push(`<circle cx="${cx}" cy="${cy}" r="6" fill="${colors[method]}"/>`);
    });
    const label = scenarioLabels.get(scenario.label) ?? scenario.label;
    const words = label.split(" ");
    const split = words.length > 2 ? Math.ceil(words.length / 2) : words.length;
    marks.push(`<text x="${center}" y="${bottom + 25}" class="label" text-anchor="middle">${escapeXml(words.slice(0, split).join(" "))}</text>`);
    if (split < words.length) marks.push(`<text x="${center}" y="${bottom + 42}" class="label" text-anchor="middle">${escapeXml(words.slice(split).join(" "))}</text>`);
  });
  return marks.join("\n");
}

const heterogeneity = results.scenarios.filter((scenario) => scenario.label.startsWith("heterogeneity"));
const clusters = results.scenarios.filter((scenario) => ["clusters-10", "clusters-20", "heterogeneity-0.2", "clusters-80"].includes(scenario.label));
clusters.sort((a, b) => a.repositoryCount - b.repositoryCount);

const legend = Object.entries(methodLabels).map(([method, label], index) => {
  const x = 166 + index * 260;
  return `<circle cx="${x}" cy="129" r="6" fill="${colors[method]}"/><text x="${x + 14}" y="134" class="legend">${escapeXml(label)}</text>`;
}).join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720" data-visual-quality="publication" data-text-fit="bounded" role="img" aria-labelledby="title desc">
<title id="title">Confidence interval coverage under repository-clustered coding tasks</title>
<desc id="desc">Two-panel result chart showing 95 percent interval coverage for task-normal, task-bootstrap, and repository-bootstrap estimators as treatment heterogeneity and repository count change. Error bars show 1.96 Monte Carlo standard errors across 1,200 simulated datasets.</desc>
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#07101f"/><stop offset="1" stop-color="#10213b"/></linearGradient></defs>
<rect width="1280" height="720" fill="url(#bg)"/>
<style>
text{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;fill:#e5eefc}.eyebrow{font-size:15px;letter-spacing:2px;fill:#8fb7ff}.title{font-family:ui-sans-serif,system-ui,sans-serif;font-size:31px;font-weight:700}.subtitle{font-size:15px;fill:#a9bad3}.panel-title{font-size:17px;font-weight:700}.axis{font-size:12px;fill:#9fb0c9}.label{font-size:11px;fill:#c8d5e8}.legend{font-size:13px;fill:#c8d5e8}.note{font-size:13px;fill:#9fb0c9}
</style>
<text x="56" y="45" class="eyebrow">MONTE CARLO RESULT • 1,200 REPEATS PER CELL</text>
<text x="56" y="82" class="title">The correct resampling unit depends on the dependency structure</text>
<text x="56" y="108" class="subtitle">Points are empirical 95% interval coverage; vertical bars are ±1.96 Monte Carlo SE; horizontal reference is nominal 95%.</text>
${legend}
${panel(heterogeneity, 42, 158, 582, 480, "A  Fixed 40 repositories; heterogeneity changes")}
${panel(clusters, 656, 158, 582, 480, "B  Strong heterogeneity; repository count changes")}
<text x="56" y="678" class="note">Negative result: with only 10 repositories, the percentile repository bootstrap covered 90.4%—worse than task-level methods.</text>
<text x="56" y="700" class="note">Scope: hierarchical Bernoulli simulation, 8 tasks/repository, true mean effect +5 points; not an estimate of any named benchmark.</text>
</svg>\n`;

fs.writeFileSync(path.join(root, "clustered-agent-benchmark-uncertainty.svg"), svg);
console.log("wrote clustered-agent-benchmark-uncertainty.svg from results.json");
