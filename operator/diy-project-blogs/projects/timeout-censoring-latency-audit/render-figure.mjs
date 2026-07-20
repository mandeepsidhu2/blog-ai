import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(here, 'aggregate-results.json'), 'utf8'));
const main = data.aggregates.filter(row => row.condition === 'main');
const x = deadline => ({2: 260, 4: 475, 8: 690, 16: 905})[deadline];
const y = seconds => 500 - Math.min(seconds, 16) * 24;
const pathFor = (endpoint, metric) => main.filter(row => row.endpoint === endpoint).sort((a,b) => a.deadline-b.deadline).map((row,index) => `${index ? 'L' : 'M'} ${x(row.deadline)} ${y(row[metric]).toFixed(1)}`).join(' ');
const points = (endpoint, metric, color) => main.filter(row => row.endpoint === endpoint).map(row => `<circle cx="${x(row.deadline)}" cy="${y(row[metric]).toFixed(1)}" r="6" fill="${color}"/>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc" data-visual-quality="publication" data-text-fit="bounded">
<title id="title">Timeout censoring reverses the latency ranking</title><desc id="desc">Completed-only p95 makes the fast but spiky endpoint appear faster, while deadline-aware p95 exposes its six percent timeout tail across deadline settings.</desc>
<rect width="1200" height="630" fill="#09131f"/><text x="72" y="64" fill="#f4f1e8" font-family="Georgia,serif" font-size="32" font-weight="700">Completed-only latency hides the failed tail</text><text x="72" y="98" fill="#a7b8c9" font-family="Georgia,serif" font-size="17">240 repeats × 5,000 requests; same random draws within each repeat</text>
<rect x="70" y="125" width="960" height="420" rx="8" fill="#101f2e" stroke="#294158"/><g stroke="#294158" stroke-width="1">${[4,8,12,16].map(v=>`<line x1="150" y1="${y(v)}" x2="990" y2="${y(v)}"/><text x="105" y="${y(v)+5}" fill="#8fa4b8" font-family="Georgia,serif" font-size="14">${v}s</text>`).join('')}</g>
<text x="150" y="525" fill="#a7b8c9" font-family="Georgia,serif" font-size="14">deadline</text>${[2,4,8,16].map(v=>`<text x="${x(v)-8}" y="525" fill="#d5dde5" font-family="Georgia,serif" font-size="15">${v}s</text>`).join('')}
<path d="${pathFor('steady','completedOnlyP95')}" fill="none" stroke="#72d6c9" stroke-width="4"/>${points('steady','completedOnlyP95','#72d6c9')}<path d="${pathFor('fast_spiky','completedOnlyP95')}" fill="none" stroke="#f6c85f" stroke-width="4"/>${points('fast_spiky','completedOnlyP95','#f6c85f')}<path d="${pathFor('fast_spiky','deadlineAwareP95')}" fill="none" stroke="#ff7d73" stroke-width="5" stroke-dasharray="10 7"/>${points('fast_spiky','deadlineAwareP95','#ff7d73')}
<g font-family="Georgia,serif" font-size="16"><rect x="1050" y="165" width="18" height="4" fill="#72d6c9"/><text x="1080" y="172" fill="#d5dde5">steady p95</text><rect x="1050" y="207" width="18" height="4" fill="#f6c85f"/><text x="1080" y="214" fill="#d5dde5">spiky completed</text><rect x="1050" y="249" width="18" height="4" fill="#ff7d73"/><text x="1080" y="256" fill="#d5dde5">spiky deadline-aware</text></g>
<rect x="1045" y="320" width="120" height="126" rx="8" fill="#152a3d" stroke="#36536d"/><text x="1060" y="347" fill="#f4f1e8" font-family="Georgia,serif" font-size="15" font-weight="700">At 8 seconds</text><text x="1060" y="378" fill="#f6c85f" font-family="Georgia,serif" font-size="14">1.25s shown</text><text x="1060" y="402" fill="#ff7d73" font-family="Georgia,serif" font-size="14">8.00s aware</text><text x="1060" y="426" fill="#a7b8c9" font-family="Georgia,serif" font-size="13">~6% timeout</text>
<text x="72" y="590" fill="#8fa4b8" font-family="Georgia,serif" font-size="15">The dashed series replaces timed-out calls with the declared deadline; it is not an estimate beyond the censoring point.</text></svg>`;
fs.writeFileSync(path.join(here, 'timeout-censoring-ranking.svg'), svg);
console.log('wrote timeout-censoring-ranking.svg');
