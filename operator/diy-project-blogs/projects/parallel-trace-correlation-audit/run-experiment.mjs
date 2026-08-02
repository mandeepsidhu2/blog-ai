import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(here, 'config.json'), 'utf8'));

function mulberry32(seed) {
  return () => {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normal(rng) {
  const u = Math.max(rng(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}
function lognormal(rng, median, sigma) {
  return Math.exp(Math.log(median) + sigma * normal(rng));
}
function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function quantile(xs, q) {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))];
}
function correlation(xs, ys) {
  const mx = mean(xs); const my = mean(ys);
  let num = 0; let dx = 0; let dy = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const a = xs[i] - mx; const b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  return num / Math.sqrt(dx * dy);
}

function generateRows(scenario, repeat) {
  const scenarioIndex = config.scenarios.indexOf(scenario);
  const rng = mulberry32(config.seed + repeat * 104729 + scenarioIndex * 10000019);
  const rows = [];
  for (let id = 0; id < config.workflowsPerRepeat; id += 1) {
    const sharedIncident = scenario === 'shared_incident' && rng() < config.incidentProbability;
    const sharedMultiplier = sharedIncident
      ? lognormal(rng, config.incidentMultiplierMedian, config.incidentMultiplierSigma) : 1;
    const values = config.tools.map(tool => {
      const independentIncident = scenario === 'independent_incidents' && rng() < config.incidentProbability;
      const multiplier = independentIncident
        ? lognormal(rng, config.incidentMultiplierMedian, config.incidentMultiplierSigma) : sharedMultiplier;
      return lognormal(rng, tool.medianSeconds, tool.sigma) * multiplier;
    });
    rows.push({id, incident: sharedIncident, values});
  }
  return rows;
}

function shuffledIndices(n, rng) {
  const indices = Array.from({length: n}, (_, i) => i);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

function replayRows(rows, replay, repeat, scenario) {
  if (replay === 'row_preserved') return rows.map(row => row.values);
  const scenarioIndex = config.scenarios.indexOf(scenario);
  const rng = mulberry32(config.seed + 700000001 + repeat * 130363 + scenarioIndex * 15485863);
  const output = Array.from({length: rows.length}, () => Array(config.tools.length));
  for (let tool = 0; tool < config.tools.length; tool += 1) {
    if (replay === 'column_shuffled' || scenario !== 'shared_incident') {
      const order = shuffledIndices(rows.length, rng);
      for (let i = 0; i < rows.length; i += 1) output[i][tool] = rows[order[i]].values[tool];
    } else {
      for (const incident of [false, true]) {
        const target = rows.map((row, i) => row.incident === incident ? i : -1).filter(i => i >= 0);
        const order = shuffledIndices(target.length, rng);
        for (let i = 0; i < target.length; i += 1) {
          output[target[i]][tool] = rows[target[order[i]]].values[tool];
        }
      }
    }
  }
  return output;
}

function summarize(values) {
  const criticalPath = values.map(row => Math.max(...row));
  const toolSeconds = values.map(row => row.reduce((a, b) => a + b, 0));
  const correlations = [];
  for (let a = 0; a < config.tools.length; a += 1) for (let b = a + 1; b < config.tools.length; b += 1) {
    correlations.push(correlation(values.map(r => r[a]), values.map(r => r[b])));
  }
  return {
    criticalPathP50: quantile(criticalPath, 0.50),
    criticalPathP95: quantile(criticalPath, 0.95),
    criticalPathP99: quantile(criticalPath, 0.99),
    deadlineMissRate: mean(criticalPath.map(x => x > config.deadlineSeconds ? 1 : 0)),
    toolSecondsP50: quantile(toolSeconds, 0.50),
    toolSecondsP95: quantile(toolSeconds, 0.95),
    toolSecondsP99: quantile(toolSeconds, 0.99),
    meanPairwiseCorrelation: mean(correlations)
  };
}

const rows = [];
for (const scenario of config.scenarios) {
  for (let repeat = 0; repeat < config.repeats; repeat += 1) {
    const trace = generateRows(scenario, repeat);
    for (const replay of config.replays) {
      rows.push({scenario, repeat, replay, ...summarize(replayRows(trace, replay, repeat, scenario))});
    }
  }
}

const fields = Object.keys(rows[0]);
fs.writeFileSync(
  path.join(here, 'repeat-results.csv'),
  [fields.join(','), ...rows.map(row => fields.map(f => row[f]).join(','))].join('\n') + '\n',
);

const metricFields = fields.slice(3);
const aggregates = [];
for (const scenario of config.scenarios) for (const replay of config.replays) {
  const group = rows.filter(row => row.scenario === scenario && row.replay === replay);
  const aggregate = {scenario, replay, repeats: group.length};
  for (const metric of metricFields) aggregate[metric] = mean(group.map(row => row[metric]));
  aggregates.push(aggregate);
}

function bootstrap(deltas, seed) {
  const rng = mulberry32(seed); const samples = [];
  for (let b = 0; b < config.bootstrapSamples; b += 1) {
    let total = 0;
    for (let i = 0; i < deltas.length; i += 1) total += deltas[Math.floor(rng() * deltas.length)];
    samples.push(total / deltas.length);
  }
  return {mean: mean(deltas), ciLow: quantile(samples, 0.025), ciHigh: quantile(samples, 0.975)};
}

const comparisons = [];
for (const scenario of config.scenarios) {
  const baseline = rows.filter(row => row.scenario === scenario && row.replay === 'row_preserved');
  for (const replay of ['column_shuffled', 'incident_stratified']) {
    const treatment = rows.filter(row => row.scenario === scenario && row.replay === replay);
    for (const metric of metricFields) {
      comparisons.push({scenario, replay, metric, ...bootstrap(treatment.map((row, i) => row[metric] - baseline[i][metric]), config.seed + comparisons.length * 997)});
    }
  }
}

fs.writeFileSync(path.join(here, 'aggregate-results.json'), JSON.stringify({config, aggregates}, null, 2) + '\n');
fs.writeFileSync(path.join(here, 'statistical-analysis.json'), JSON.stringify({comparisons}, null, 2) + '\n');
const lines = [`Parallel trace correlation audit`, `repeats=${config.repeats} workflows_per_repeat=${config.workflowsPerRepeat} tools=${config.tools.length}`];
for (const row of aggregates) lines.push(`${row.scenario}/${row.replay}: latency_p95=${row.criticalPathP95.toFixed(4)}s work_p95=${row.toolSecondsP95.toFixed(4)}s miss=${(100 * row.deadlineMissRate).toFixed(2)}% corr=${row.meanPairwiseCorrelation.toFixed(3)}`);
fs.writeFileSync(path.join(here, 'focal-summary.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
