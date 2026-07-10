import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(process.argv[2] || projectDir);
const sourcePath = path.join(projectDir, "paper-results-summary.json");
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

const regimes = [
  { key: "openweb", name: "OpenWebText10K", short: "OWT" },
  { key: "tinystories", name: "TinyStories", short: "Tiny" },
  { key: "wikitext", name: "WikiText-103", short: "Wiki" },
];

const near = (left, right, tolerance = 1e-9) =>
  Math.abs(left - right) <= tolerance;

function normalizeRun(regime, runKey, budgetLabel) {
  const run = source[regime.key][runKey];
  const gains = run.paired_records.map((record) => record.gain);
  const computedMean = gains.reduce((sum, value) => sum + value, 0) / gains.length;

  if (!near(computedMean, run.paired_gain_mean)) {
    throw new Error(`${regime.name} ${budgetLabel}: paired mean mismatch`);
  }
  if (run.paired_wins !== gains.filter((gain) => gain > 0).length) {
    throw new Error(`${regime.name} ${budgetLabel}: win count mismatch`);
  }
  if (run.paired_gain_ci_low > run.paired_gain_mean ||
      run.paired_gain_ci_high < run.paired_gain_mean) {
    throw new Error(`${regime.name} ${budgetLabel}: mean falls outside CI`);
  }

  return {
    regime: regime.name,
    short: regime.short,
    budget: budgetLabel,
    repeats: run.n,
    decayLoss: run.condition_final_mean,
    bestStaticLoss: run.best_static_mean,
    bestStaticCondition: run.best_static_condition,
    pairedGain: run.paired_gain_mean,
    ci95: [run.paired_gain_ci_low, run.paired_gain_ci_high],
    wins: run.paired_wins,
    earlyPrefix: run.stage_deltas[0].prefix,
    earlyDelta: run.stage_deltas[0].delta,
    finalDropout: run.stage_deltas.at(-1).condition_dropout,
  };
}

const rows = regimes.flatMap((regime) => [
  normalizeRun(regime, "small_stream", "4M"),
  normalizeRun(regime, "l20_stream", "8M"),
]);

const coefficients = regimes.map((regime) => ({
  regime: regime.name,
  ...source[regime.key].coefficients,
}));

const result = {
  generatedAt: "2026-07-10",
  metric: "validation cross-entropy reduction versus matched best-static dropout (nats)",
  rows,
  coefficients,
};

fs.writeFileSync(
  path.join(projectDir, "article-results.json"),
  `${JSON.stringify(result, null, 2)}\n`,
);

const output = [
  "paired final-prefix audit (positive gain favors decay)",
  ...rows.map((row) =>
    `${row.regime.padEnd(15)} ${row.budget} gain=${row.pairedGain.toFixed(4)} ` +
    `ci95=[${row.ci95[0].toFixed(4)},${row.ci95[1].toFixed(4)}] ` +
    `wins=${row.wins}/${row.repeats} early_delta=${row.earlyDelta.toFixed(4)}`,
  ),
  "claim boundary: six measured small-transformer regimes; no frontier-scale extrapolation",
];
fs.writeFileSync(path.join(projectDir, "output.txt"), `${output.join("\n")}\n`);

fs.mkdirSync(assetsDir, { recursive: true });
const scaleX = (gain) => 250 + (gain / 0.06) * 690;
const rowY = (index) => 238 + index * 61;
const colors = { OWT: "#14b8a6", Tiny: "#8b5cf6", Wiki: "#38bdf8" };

const bars = rows.map((row, index) => {
  const y = rowY(index);
  const x0 = scaleX(0);
  const x = scaleX(row.pairedGain);
  const low = scaleX(row.ci95[0]);
  const high = scaleX(row.ci95[1]);
  const color = colors[row.short];
  return `
    <text x="82" y="${y + 5}" class="row-label">${row.short} ${row.budget}</text>
    <rect x="${x0}" y="${y - 11}" width="${x - x0}" height="22" rx="5" fill="${color}" opacity="0.82"/>
    <line x1="${low}" y1="${y}" x2="${high}" y2="${y}" stroke="#f8fafc" stroke-width="3"/>
    <line x1="${low}" y1="${y - 7}" x2="${low}" y2="${y + 7}" stroke="#f8fafc" stroke-width="2"/>
    <line x1="${high}" y1="${y - 7}" x2="${high}" y2="${y + 7}" stroke="#f8fafc" stroke-width="2"/>
    <circle cx="${x}" cy="${y}" r="6" fill="#f8fafc"/>
    <text x="970" y="${y + 5}" class="value">${row.pairedGain.toFixed(4)} nats</text>`;
}).join("");

const ticks = [0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06].map((tick) => {
  const x = scaleX(tick);
  return `<line x1="${x}" y1="204" x2="${x}" y2="565" class="grid"/>
    <text x="${x}" y="592" class="tick" text-anchor="middle">${tick.toFixed(2)}</text>`;
}).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" data-visual-quality="publication" data-text-fit="bounded">
  <title>Paired validation-loss gains from decaying dropout across six regimes</title>
  <desc>Horizontal bars show mean validation cross-entropy reduction with 95 percent bootstrap intervals for three datasets at four and eight million token prefixes. Every interval is above zero.</desc>
  <rect width="1200" height="675" fill="#07111f"/>
  <style>
    text { font-family: Inter, ui-sans-serif, system-ui, sans-serif; fill: #f8fafc; }
    .eyebrow { font-size: 15px; font-weight: 700; letter-spacing: 1px; fill: #5eead4; }
    .title { font-size: 35px; font-weight: 760; }
    .subtitle { font-size: 17px; fill: #a8b6ca; }
    .row-label { font-size: 17px; font-weight: 680; }
    .value { font-size: 16px; font-weight: 680; }
    .tick { font-size: 13px; fill: #91a1b7; }
    .grid { stroke: #26364c; stroke-width: 1; }
    .note { font-size: 14px; fill: #fda4af; }
  </style>
  <text x="70" y="66" class="eyebrow">MATCHED MULTI-SEED RESULT</text>
  <text x="70" y="112" class="title">Decay wins late, but not from the first token</text>
  <text x="70" y="146" class="subtitle">Paired gain over each seed's best static-dropout run; whiskers are stored 95% bootstrap intervals.</text>
  <rect x="67" y="177" width="1066" height="425" rx="10" fill="#0c1a2b" stroke="#24364d"/>
  ${ticks}
  ${bars}
  <line x1="250" y1="204" x2="250" y2="565" stroke="#718096" stroke-width="2"/>
  <rect x="67" y="620" width="1066" height="36" rx="8" fill="#231923" stroke="#713b4c"/>
  <text x="86" y="644" class="note">Negative result: at the earliest 8M stage, decay was worse by +0.0630 OWT, +0.0005 TinyStories, and +0.0080 WikiText nats.</text>
</svg>`;

fs.writeFileSync(path.join(assetsDir, "dropout-pressure-law.svg"), svg);
console.log(output.join("\n"));
