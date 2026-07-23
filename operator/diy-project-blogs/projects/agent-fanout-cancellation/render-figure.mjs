import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(here, 'aggregate-results.json'), 'utf8'));
const rows = data.aggregates.filter(r => r.scenario === 'bursty');
const colors = ['#ff8a65','#ffd166','#72d6c9','#55a7ff'];
const labels = {no_cancel:'No cancel',queued_only:'Queued only',cooperative_1000ms:'Coop 1 s',cooperative_250ms:'Coop 250 ms'};
const bars = rows.map((r, i) => {
  const x = 115 + i * 190;
  const h = r.orphanSecondsPerParent * 54;
  return `<rect x="${x}" y="${390-h}" width="86" height="${h}" fill="${colors[i]}"/><text x="${x+43}" y="${374-h}" text-anchor="middle" class="value">${r.orphanSecondsPerParent.toFixed(2)}s</text><text x="${x+43}" y="420" text-anchor="middle" class="label">${labels[r.policy]}</text><text x="${x+43}" y="445" text-anchor="middle" class="small">${(100*r.successRate).toFixed(1)}% success</text>`;
}).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><title>Orphaned worker time under fan-out cancellation policies</title><desc>Bar chart of measured orphan worker seconds per parent request in the bursty scenario, with success rates for four cancellation policies.</desc><rect width="960" height="540" fill="#081525"/><style>.title{font:700 28px ui-monospace,monospace;fill:#f4f7fb}.sub{font:16px ui-monospace,monospace;fill:#a9bdd4}.label{font:700 15px ui-monospace,monospace;fill:#e8eef7}.small{font:13px ui-monospace,monospace;fill:#9eb3ca}.value{font:700 17px ui-monospace,monospace;fill:#f8fbff}</style><text x="60" y="62" class="title">Cancel the work the parent no longer needs</text><text x="60" y="92" class="sub">Bursty workload · 24 workers · six-way fan-out · six-second parent deadline</text><line x1="80" y1="390" x2="875" y2="390" stroke="#5d728b"/><line x1="80" y1="145" x2="80" y2="390" stroke="#5d728b"/><text x="28" y="270" class="small" transform="rotate(-90 28 270)">orphan worker-seconds / parent</text>${bars}<rect x="610" y="112" width="270" height="84" rx="8" fill="#10253c" stroke="#294866"/><text x="630" y="142" class="label">Decision signal</text><text x="630" y="168" class="small">Compare reclaimed work and success;</text><text x="630" y="188" class="small">latency among survivors is insufficient.</text></svg>`;
fs.writeFileSync(path.join(here, 'agent-fanout-cancellation.svg'), svg + '\n');
console.log('wrote agent-fanout-cancellation.svg');
