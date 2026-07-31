import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const {aggregates} = JSON.parse(fs.readFileSync(path.join(here, 'aggregate-results.json'), 'utf8'));
const scenarios = ['moderate_independent', 'near_capacity_independent', 'near_capacity_correlated', 'no_tail_control'];
const policies = ['no_hedge', 'fixed_250ms', 'fixed_500ms', 'queue_capped_250ms'];
const colors = {'no_hedge':'#60758a','fixed_250ms':'#c86b43','fixed_500ms':'#d7a441','queue_capped_250ms':'#2a8c82'};
const labels = {'no_hedge':'No hedge','fixed_250ms':'Fixed 250 ms','fixed_500ms':'Fixed 500 ms','queue_capped_250ms':'Queue-capped 250 ms'};
const maxP95 = Math.max(...aggregates.map(r => r.p95Latency));
let marks = '';
for (let s = 0; s < scenarios.length; s++) {
  const x0 = 100 + s * 250;
  marks += `<text x="${x0+84}" y="468" text-anchor="middle" class="axis">${scenarios[s].replaceAll('_',' ')}</text>`;
  for (let p = 0; p < policies.length; p++) {
    const row = aggregates.find(r => r.scenario === scenarios[s] && r.policy === policies[p]);
    const h = 300 * row.p95Latency / maxP95;
    const x = x0 + p * 42;
    marks += `<rect x="${x}" y="${420-h}" width="32" height="${h}" fill="${colors[policies[p]]}"/><text x="${x+16}" y="${408-h}" text-anchor="middle" class="value">${row.p95Latency.toFixed(2)}</text>`;
  }
}
const legend = policies.map((p,i)=>`<rect x="${130+i*245}" y="78" width="18" height="18" fill="${colors[p]}"/><text x="${156+i*245}" y="92" class="legend">${labels[p]}</text>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" data-visual-quality="publication" data-text-fit="bounded" role="img" aria-labelledby="title desc"><title id="title">Hedged request p95 latency by load and correlation</title><desc id="desc">Grouped bars show that fixed hedging reduces p95 at moderate load but increases it near capacity, especially when slowdowns correlate, while queue-capped hedging limits the reversal.</desc><style>text{font-family:Georgia,serif;fill:#183247}.title{font-size:30px;font-weight:700}.subtitle{font-size:17px;fill:#506477}.legend,.axis{font-size:14px}.value{font-size:12px;font-weight:700}.grid{stroke:#d9e2e8;stroke-width:1}</style><rect width="1200" height="675" fill="#f7f4ec"/><text x="72" y="48" class="title">Hedging has a load boundary</text><text x="72" y="70" class="subtitle">Mean p95 latency across ${aggregates[0].repeats} matched repeats; seconds, lower is better</text>${legend}<line x1="72" y1="420" x2="1125" y2="420" class="grid"/>${marks}<text x="72" y="540" class="subtitle">Fixed-delay duplicates consume spare capacity. Correlated slowdowns reduce the chance that the second copy escapes the tail.</text><text x="72" y="574" class="axis">Synthetic 8-worker FCFS service; 1,600 requests/repeat; 8 s deadline. Mechanism evidence, not a provider estimate.</text></svg>`;
fs.writeFileSync(path.join(here, 'hedged-request-load-boundary.svg'), svg + '\n');
