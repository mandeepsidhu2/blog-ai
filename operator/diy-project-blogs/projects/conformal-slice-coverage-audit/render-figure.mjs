import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const {aggregates} = JSON.parse(fs.readFileSync(path.join(here, 'aggregate-results.json'), 'utf8'));
const scenarios = ['exchangeable_rare_noisy', 'shifted_critical_share', 'equal_noise_control'];
const policies = ['pooled', 'mondrian', 'oracle_normalized'];
const labels = {pooled:'Pooled', mondrian:'Slice-calibrated', oracle_normalized:'Normalized'};
const colors = {pooled:'#c45f3c', mondrian:'#237f78', oracle_normalized:'#375b8c'};
let marks = '';
for (let s = 0; s < scenarios.length; s += 1) {
  const x0 = 120 + s * 340;
  marks += `<text x="${x0+104}" y="502" text-anchor="middle" class="axis">${scenarios[s].replaceAll('_',' ')}</text>`;
  for (let p = 0; p < policies.length; p += 1) {
    const row = aggregates.find(item => item.scenario === scenarios[s] && item.policy === policies[p]);
    const h = 300 * row.criticalCoverage;
    const x = x0 + p * 70;
    marks += `<rect x="${x}" y="${430-h}" width="48" height="${h}" fill="${colors[policies[p]]}"/><text x="${x+24}" y="${416-h}" text-anchor="middle" class="value">${(100*row.criticalCoverage).toFixed(1)}%</text>`;
  }
}
const legend = policies.map((policy,index)=>`<rect x="${190+index*270}" y="92" width="20" height="20" fill="${colors[policy]}"/><text x="${220+index*270}" y="108" class="legend">${labels[policy]}</text>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" data-visual-quality="publication" data-text-fit="bounded" role="img" aria-labelledby="title desc"><title id="title">Critical-slice conformal coverage by calibration policy</title><desc id="desc">Grouped bars show pooled conformal intervals miss the ninety percent target on a rare high-noise slice even when marginal exchangeability holds, while slice-calibrated and correctly normalized intervals restore critical-slice coverage.</desc><style>text{font-family:Georgia,serif;fill:#183247}.title{font-size:30px;font-weight:700}.subtitle{font-size:17px;fill:#506477}.legend,.axis{font-size:14px}.value{font-size:13px;font-weight:700}.grid{stroke:#c8d5dc;stroke-width:2;stroke-dasharray:7 7}</style><rect width="1200" height="675" fill="#f7f4ec"/><text x="68" y="52" class="title">Marginal coverage can abandon the critical slice</text><text x="68" y="76" class="subtitle">Mean critical-slice coverage across ${aggregates[0].repeats} matched repeats; target = 90%</text>${legend}<line x1="76" y1="160" x2="1130" y2="160" class="grid"/><text x="80" y="151" class="axis">90% target</text><line x1="76" y1="430" x2="1130" y2="430" stroke="#8da0ad"/>${marks}<text x="68" y="566" class="subtitle">The equal-noise control removes the gap. The heteroscedastic cells require a declared conditional-coverage policy.</text><text x="68" y="600" class="axis">Synthetic absolute residuals; 4,000 calibration and 12,000 test cases per repeat. Mechanism evidence, not a model benchmark.</text></svg>`;
fs.writeFileSync(path.join(here, 'conformal-slice-coverage.svg'), svg + '\n');
