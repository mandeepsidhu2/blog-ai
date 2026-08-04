import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const rows = JSON.parse(fs.readFileSync(path.join(root, "aggregate-results.json"), "utf8"));
const focal = rows.filter((row) => row.scenario === "mixed-correlated");
const labels = {
  "field-average": "Field-average gate",
  "whole-call": "Whole-call gate",
  "joint-long-schema": "Joint + long-schema gate"
};
const colors = ["#2dd4bf", "#f59e0b", "#f472b6"];
const cards = focal.map((row, index) => {
  const x = 70 + index * 292;
  const field = (100 * row.fieldAccuracy).toFixed(2);
  const whole = (100 * row.wholeAccuracy).toFixed(2);
  const falseApproval = (100 * row.falseApproval).toFixed(1);
  return `
    <g transform="translate(${x} 178)">
      <rect width="246" height="274" rx="10" fill="#121d31" stroke="#30415f"/>
      <text x="20" y="38" class="label">${labels[row.policy]}</text>
      <text x="20" y="78" class="metric" fill="${colors[index]}">${field}%</text>
      <text x="20" y="102" class="caption">field accuracy</text>
      <line x1="20" y1="126" x2="226" y2="126" stroke="#30415f"/>
      <text x="20" y="166" class="metric" fill="#f8fafc">${whole}%</text>
      <text x="20" y="190" class="caption">whole-call exact</text>
      <text x="20" y="238" class="risk">${falseApproval}% false approvals</text>
    </g>`;
}).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <title>Structured-output gate results</title>
  <desc>Comparison of field accuracy, whole-call exact accuracy, and false approvals for three release gates across 800 repeated studies.</desc>
  <rect width="960" height="540" fill="#08111f"/>
  <text x="70" y="64" class="title">A 99% field score can hide broken calls</text>
  <text x="70" y="99" class="subtitle">800 repeats · 3,000 calls each · matched mixed-schema workload</text>
  <text x="70" y="139" class="note">The unit of release evidence must match the unit the application consumes.</text>
  ${cards}
  <text x="70" y="500" class="foot">Synthetic mechanism study; thresholds and effect sizes are not vendor estimates.</text>
  <style>
    .title{font:700 30px Georgia,serif;fill:#f8fafc}.subtitle{font:500 16px ui-monospace,monospace;fill:#9fb0ca}
    .note{font:600 16px system-ui,sans-serif;fill:#cbd5e1}.label{font:700 16px system-ui,sans-serif;fill:#e2e8f0}
    .metric{font:700 34px Georgia,serif}.caption{font:500 14px system-ui,sans-serif;fill:#94a3b8}
    .risk{font:700 15px ui-monospace,monospace;fill:#fda4af}.foot{font:500 13px system-ui,sans-serif;fill:#7f91ad}
  </style>
</svg>`;
fs.writeFileSync(path.join(root, "structured-output-contract-audit.svg"), svg);
