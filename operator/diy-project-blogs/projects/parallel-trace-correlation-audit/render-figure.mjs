import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const {aggregates} = JSON.parse(fs.readFileSync(path.join(here, 'aggregate-results.json'), 'utf8'));
const shared = aggregates.filter(row => row.scenario === 'shared_incident');
const labels = {row_preserved: 'Rows preserved', column_shuffled: 'Columns shuffled', incident_stratified: 'Incident-stratified'};
const colors = {row_preserved: '#16a394', column_shuffled: '#e36a47', incident_stratified: '#d4a62a'};
const leftMax = 1.8; const rightMax = 4.2;
const barWidth = 72; const gap = 34;
function bars(metric, max, panelX, baselineY, height) {
  return shared.map((row, i) => {
    const value = row[metric]; const h = value / max * height; const x = panelX + 42 + i * (barWidth + gap);
    return `<rect x="${x}" y="${baselineY - h}" width="${barWidth}" height="${h}" rx="5" fill="${colors[row.replay]}"/>\n` +
      `<text x="${x + barWidth / 2}" y="${baselineY - h - 10}" text-anchor="middle" class="value">${value.toFixed(3)}</text>`;
  }).join('\n');
}
function legend() {
  return shared.map((row, i) => `<rect x="${170 + i * 220}" y="482" width="14" height="14" rx="3" fill="${colors[row.replay]}"/><text x="${192 + i * 220}" y="494" class="legend">${labels[row.replay]}</text>`).join('\n');
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" role="img" aria-labelledby="title desc" data-visual-quality="publication" data-text-fit="bounded">
<title id="title">Replay correlation changes latency and capacity estimates in opposite directions</title>
<desc id="desc">Two grouped bar charts show that column shuffling raises parallel workflow critical-path p95 but lowers total tool occupancy p95 relative to preserving trace rows in a shared-incident simulation.</desc>
<style>
  .bg{fill:#071b26}.panel{fill:#0d2935;stroke:#2d5361;stroke-width:1}.grid{stroke:#31515d;stroke-width:1;opacity:.6}.axis{fill:#93acb5;font:12px ui-monospace,SFMono-Regular,Menlo,monospace}.heading{fill:#f4f0df;font:700 25px ui-serif,Georgia,serif}.sub{fill:#bad0d6;font:14px ui-sans-serif,system-ui,sans-serif}.panel-title{fill:#f4f0df;font:700 16px ui-sans-serif,system-ui,sans-serif}.value{fill:#fff7db;font:700 13px ui-monospace,SFMono-Regular,Menlo,monospace}.legend{fill:#d9e5e7;font:13px ui-sans-serif,system-ui,sans-serif}.note{fill:#a9c2c8;font:12px ui-sans-serif,system-ui,sans-serif}
</style>
<rect class="bg" width="960" height="540"/>
<text x="48" y="52" class="heading">Destroyed correlation moves two decisions apart</text>
<text x="48" y="78" class="sub">Shared-incident cell · mean across 400 matched repeats · 5,000 four-tool workflows each</text>
<rect x="44" y="108" width="418" height="342" rx="8" class="panel"/><rect x="498" y="108" width="418" height="342" rx="8" class="panel"/>
<text x="66" y="140" class="panel-title">Critical-path p95 (seconds)</text><text x="520" y="140" class="panel-title">Total occupancy p95 (tool-seconds)</text>
<line x1="76" y1="402" x2="430" y2="402" class="grid"/><line x1="530" y1="402" x2="884" y2="402" class="grid"/>
<line x1="76" y1="282" x2="430" y2="282" class="grid"/><line x1="530" y1="282" x2="884" y2="282" class="grid"/>
<line x1="76" y1="162" x2="430" y2="162" class="grid"/><line x1="530" y1="162" x2="884" y2="162" class="grid"/>
<text x="58" y="407" text-anchor="end" class="axis">0</text><text x="58" y="287" text-anchor="end" class="axis">0.9</text><text x="58" y="167" text-anchor="end" class="axis">1.8</text>
<text x="512" y="407" text-anchor="end" class="axis">0</text><text x="512" y="287" text-anchor="end" class="axis">2.1</text><text x="512" y="167" text-anchor="end" class="axis">4.2</text>
${bars('criticalPathP95', leftMax, 66, 402, 240)}
${bars('toolSecondsP95', rightMax, 520, 402, 240)}
<text x="253" y="433" text-anchor="middle" class="note">shuffle: +0.250 s (+17.7%)</text>
<text x="707" y="433" text-anchor="middle" class="note">shuffle: -1.143 tool-s (-31.7%)</text>
${legend()}
<text x="480" y="522" text-anchor="middle" class="note">Independent-incident and no-incident controls changed by less than 0.002 s on either p95 metric.</text>
</svg>`;
fs.writeFileSync(path.join(here, 'parallel-trace-correlation.svg'), svg + '\n');
console.log(path.join(here, 'parallel-trace-correlation.svg'));
