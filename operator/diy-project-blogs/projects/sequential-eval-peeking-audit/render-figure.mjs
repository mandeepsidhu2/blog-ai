import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(root, 'artifacts', 'aggregate-results.json'), 'utf8'));
const nullRows = data.rows.filter(r => r.effectLogOdds === 0 && r.maxTasks === 400);
const methods = ['fixed_horizon', 'naive_peeking', 'bonferroni_peeking'];
const labels = ['Fixed horizon', 'Naive peeking', 'Bonferroni peeking'];
const colors = ['#58a6ff', '#ff7b72', '#3fb950'];
const cadences = [10, 25, 50, 100];
const x = c => 220 + cadences.indexOf(c) * 210;
const y = rate => 490 - rate / 0.22 * 330;
let marks = '';
methods.forEach((method, mi) => {
  const points = cadences.map(c => nullRows.find(r => r.method === method && r.lookEvery === c));
  marks += `<polyline fill="none" stroke="${colors[mi]}" stroke-width="4" points="${points.map(r => `${x(r.lookEvery)},${y(r.rate)}`).join(' ')}"/>`;
  points.forEach(r => { marks += `<circle cx="${x(r.lookEvery)}" cy="${y(r.rate)}" r="7" fill="${colors[mi]}"/><text x="${x(r.lookEvery)}" y="${y(r.rate)-13}" text-anchor="middle" class="value">${(100*r.rate).toFixed(1)}%</text>`; });
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 630" role="img">
<title>False-positive rate under repeated evaluation peeking</title>
<desc>Line chart showing false-positive rates for fixed-horizon, naive repeated peeking, and Bonferroni-controlled peeking over four review cadences at 400 paired tasks.</desc>
<rect width="1120" height="630" fill="#0d1117"/>
<text x="70" y="62" class="title">Repeated peeking can triple the false-positive rate</text>
<text x="70" y="94" class="sub">Null effect · 20,000 Monte Carlo repeats per cell · paired binary outcomes · max n=400</text>
<line x1="150" y1="490" x2="900" y2="490" stroke="#8b949e"/><line x1="150" y1="160" x2="150" y2="490" stroke="#8b949e"/>
${[0,0.05,0.10,0.15,0.20].map(v=>`<line x1="150" y1="${y(v)}" x2="900" y2="${y(v)}" stroke="#30363d"/><text x="135" y="${y(v)+5}" text-anchor="end" class="axis">${Math.round(v*100)}%</text>`).join('')}
${cadences.map(c=>`<text x="${x(c)}" y="525" text-anchor="middle" class="axis">every ${c}</text>`).join('')}
<text x="520" y="570" text-anchor="middle" class="axis">Significance review cadence (tasks)</text><text transform="translate(48 330) rotate(-90)" text-anchor="middle" class="axis">False-positive rate</text>
${marks}
${methods.map((m,i)=>`<rect x="930" y="${190+i*55}" width="18" height="18" fill="${colors[i]}"/><text x="960" y="${205+i*55}" class="legend">${labels[i]}</text>`).join('')}
<style>.title{font:700 27px ui-monospace,monospace;fill:#f0f6fc}.sub{font:15px ui-monospace,monospace;fill:#8b949e}.axis,.legend{font:14px ui-monospace,monospace;fill:#c9d1d9}.value{font:700 13px ui-monospace,monospace;fill:#f0f6fc}</style>
</svg>`;
fs.writeFileSync(path.join(root, 'artifacts', 'false-positive-rate.svg'), svg);
