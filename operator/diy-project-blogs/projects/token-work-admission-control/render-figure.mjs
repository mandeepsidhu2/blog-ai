import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const result = JSON.parse(fs.readFileSync(path.join(root, 'artifacts', 'aggregate-results.json'), 'utf8'));
const policies = ['request-count-16','estimated-token-budget','estimated-budget-shortest-first','oracle-token-budget'];
const labels = ['16 requests','estimate + FIFO','estimate + short-first','oracle + FIFO'];
const colors = ['#ef6f6c','#5bc0be','#f4b860','#5b8def'];
const rows = result.aggregate.filter(row => row.workload === 'heavy-tail' && row.rate === 4 && policies.includes(row.policy));
const maxLatency = 12;
const y = value => 493 - Math.min(value, maxLatency) / maxLatency * 310;
const bars = policies.map((policy, index) => {
  const row = rows.find(item => item.policy === policy);
  const value = row.shortP95LatencySeconds.mean;
  const x = 105 + index * 132;
  return `<rect x="${x}" y="${y(value)}" width="78" height="${493-y(value)}" rx="6" fill="${colors[index]}"/>
  <text x="${x+39}" y="${y(value)-12}" text-anchor="middle" class="value">${value.toFixed(2)}s</text>
  <text x="${x+39}" y="522" text-anchor="middle" class="axis">${labels[index]}</text>`;
}).join('\n');
const matrix = policies.map((policy, index) => {
  const row = rows.find(item => item.policy === policy);
  const y0 = 225 + index * 66;
  return `<rect x="700" y="${y0}" width="405" height="48" rx="5" fill="#111b2d" stroke="#2a3954"/>
  <text x="718" y="${y0+20}" class="matrix">${labels[index]}</text>
  <text x="900" y="${y0+20}" class="matrix">${(100*row.oversubscribedFraction.mean).toFixed(1)}% over budget</text>
  <text x="900" y="${y0+39}" class="muted">${(100*row.dropRate.mean).toFixed(2)}% dropped</text>`;
}).join('\n');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" role="img">
<title>Token-work admission changes short-request tail latency and overload</title>
<desc>Bar chart and result matrix comparing request-count, estimated-token, underestimated-token, and oracle admission under a heavy-tailed output workload.</desc>
<rect width="1200" height="675" fill="#0b1220"/>
<text x="62" y="62" class="title">Count requests or budget token work?</text>
<text x="62" y="95" class="sub">4.0 requests/s · 4,000 token/s processor-sharing server · 80 paired traces</text>
<rect x="60" y="135" width="570" height="455" rx="10" fill="#111b2d" stroke="#2a3954"/>
<text x="86" y="170" class="panel">Short-request p95 latency · lower is better</text>
${[0,3,6,9,12].map(value => `<line x1="86" y1="${y(value)}" x2="602" y2="${y(value)}" stroke="#263650"/><text x="78" y="${y(value)+5}" text-anchor="end" class="axis">${value}s</text>`).join('')}
${bars}
<rect x="660" y="135" width="480" height="455" rx="10" fill="#0f192a" stroke="#2a3954"/>
<text x="690" y="170" class="panel">Admission consequence</text>
<text x="690" y="197" class="sub">Remaining active work above 12,000 tokens</text>
${matrix}
<text x="62" y="630" class="note">Class estimates use 280 tokens for interactive requests and 3,600 for batch requests. Simulation, not hardware measurement.</text>
<style>.title{font:700 29px ui-monospace,monospace;fill:#f2f6ff}.sub,.note,.muted{font:14px ui-monospace,monospace;fill:#9fb0ca}.panel{font:700 18px ui-monospace,monospace;fill:#e6edf7}.axis{font:12px ui-monospace,monospace;fill:#b8c5d9}.value{font:700 13px ui-monospace,monospace;fill:#f2f6ff}.matrix{font:14px ui-monospace,monospace;fill:#e6edf7}</style>
</svg>`;
fs.writeFileSync(path.join(root, 'artifacts', 'token-work-admission.svg'), svg);
