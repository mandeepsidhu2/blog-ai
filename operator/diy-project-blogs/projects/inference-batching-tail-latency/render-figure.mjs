import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(root, 'artifacts', 'aggregate-results.json'), 'utf8'));
const policies = ['single', 'b4-now', 'b8-2ms', 'b16-10ms'];
const labels = ['single', '4 / 0 ms', '8 / 2 ms', '16 / 10 ms'];
const colors = ['#ef6f6c', '#f4b860', '#5bc0be', '#5b8def'];
const rows = data.aggregate.filter(row => row.model === 'batch-efficient' && row.rate === 90 && policies.includes(row.policy));
const y = value => 482 - value / 105 * 330;
const panel = (pattern, offset) => {
  const values = policies.map(policy => rows.find(row => row.pattern === pattern && row.policy === policy).p95LatencyMs.mean);
  return values.map((value, index) => {
    const x = offset + index * 105;
    const height = 482 - y(value);
    return `<rect x="${x}" y="${y(value)}" width="68" height="${height}" rx="6" fill="${colors[index]}"/>
      <text x="${x + 34}" y="${y(value) - 12}" text-anchor="middle" class="value">${value.toFixed(1)} ms</text>
      <text x="${x + 34}" y="515" text-anchor="middle" class="axis">${labels[index]}</text>`;
  }).join('\n');
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" role="img">
<title>The same batching delay has opposite tail-latency effects</title>
<desc>Two-panel bar chart comparing p95 latency for four batch policies under Poisson and synchronized burst traffic at 90 requests per second.</desc>
<rect width="1200" height="675" fill="#0b1220"/>
<text x="64" y="62" class="title">Arrival shape flips the batching decision</text>
<text x="64" y="94" class="sub">p95 response latency · 90 requests/s · 60 independent traces · lower is better</text>
<rect x="60" y="125" width="525" height="455" rx="10" fill="#111b2d" stroke="#2a3954"/>
<rect x="615" y="125" width="525" height="455" rx="10" fill="#111b2d" stroke="#2a3954"/>
<text x="86" y="162" class="panel">Poisson arrivals</text>
<text x="641" y="162" class="panel">16-request synchronized bursts</text>
${[0,25,50,75,100].map(value => `<line x1="86" y1="${y(value)}" x2="559" y2="${y(value)}" stroke="#263650"/><line x1="641" y1="${y(value)}" x2="1114" y2="${y(value)}" stroke="#263650"/><text x="78" y="${y(value)+5}" text-anchor="end" class="axis">${value}</text>`).join('')}
<line x1="86" y1="${y(25)}" x2="559" y2="${y(25)}" stroke="#f7d154" stroke-width="2" stroke-dasharray="7 6"/>
<line x1="641" y1="${y(25)}" x2="1114" y2="${y(25)}" stroke="#f7d154" stroke-width="2" stroke-dasharray="7 6"/>
<text x="1078" y="${y(25)-9}" text-anchor="end" class="slo">25 ms SLO</text>
${panel('poisson', 112)}
${panel('bursty', 667)}
<text x="323" y="555" text-anchor="middle" class="axis">max batch / max fill delay</text>
<text x="878" y="555" text-anchor="middle" class="axis">max batch / max fill delay</text>
<text x="60" y="625" class="note">Declared service curve: 5.5 + 0.9 × batch^0.72 ms. Simulation result, not a hardware benchmark.</text>
<style>.title{font:700 29px ui-monospace,monospace;fill:#f2f6ff}.sub,.note{font:15px ui-monospace,monospace;fill:#9fb0ca}.panel{font:700 19px ui-monospace,monospace;fill:#e6edf7}.axis{font:13px ui-monospace,monospace;fill:#b8c5d9}.value{font:700 13px ui-monospace,monospace;fill:#f2f6ff}.slo{font:700 13px ui-monospace,monospace;fill:#f7d154}</style>
</svg>`;

fs.writeFileSync(path.join(root, 'artifacts', 'batching-tail-latency.svg'), svg);
