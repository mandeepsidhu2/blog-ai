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
function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function quantile(xs, q) {
  const s = [...xs].sort((a, b) => a - b);
  const rank = Math.ceil((s.length + 1) * q) - 1;
  return s[Math.min(s.length - 1, Math.max(0, rank))];
}
function generateCases(rng, count, criticalShare, routineSigma, criticalSigma) {
  const cases = [];
  for (let i = 0; i < count; i += 1) {
    const slice = rng() < criticalShare ? 'critical' : 'routine';
    const sigma = slice === 'critical' ? criticalSigma : routineSigma;
    cases.push({slice, sigma, residual: Math.abs(normal(rng) * sigma)});
  }
  return cases;
}
function calibrate(cases, policy) {
  const alpha = policy === 'pooled_95' ? 0.05 : 1 - config.targetCoverage;
  const q = 1 - alpha;
  const bySlice = slice => cases.filter(row => row.slice === slice).map(row => row.residual);
  if (policy === 'pooled' || policy === 'pooled_95') {
    const width = quantile(cases.map(row => row.residual), q);
    return row => width;
  }
  if (policy === 'mondrian') {
    const widths = {routine: quantile(bySlice('routine'), q), critical: quantile(bySlice('critical'), q)};
    return row => widths[row.slice];
  }
  if (policy === 'max_slice') {
    const width = Math.max(quantile(bySlice('routine'), q), quantile(bySlice('critical'), q));
    return row => width;
  }
  if (policy === 'oracle_normalized') {
    const normalized = cases.map(row => row.residual / row.sigma);
    const scale = quantile(normalized, q);
    return row => scale * row.sigma;
  }
  throw new Error(`unknown policy ${policy}`);
}
function evaluate(test, interval) {
  const scored = test.map(row => ({...row, width: interval(row), covered: row.residual <= interval(row)}));
  const metrics = {};
  for (const slice of ['all', 'routine', 'critical']) {
    const rows = slice === 'all' ? scored : scored.filter(row => row.slice === slice);
    metrics[`${slice}Coverage`] = mean(rows.map(row => row.covered ? 1 : 0));
    metrics[`${slice}MeanWidth`] = mean(rows.map(row => row.width));
  }
  metrics.coverageGap = metrics.routineCoverage - metrics.criticalCoverage;
  metrics.criticalCount = scored.filter(row => row.slice === 'critical').length;
  return metrics;
}

const rows = [];
const scenarioNames = Object.keys(config.scenarios);
for (let s = 0; s < scenarioNames.length; s += 1) {
  const scenario = scenarioNames[s];
  const spec = config.scenarios[scenario];
  for (let repeat = 0; repeat < config.repeats; repeat += 1) {
    const rng = mulberry32(config.seed + s * 10000019 + repeat * 104729);
    const calibration = generateCases(rng, config.calibrationCases, spec.calibrationCriticalShare, spec.routineSigma, spec.criticalSigma);
    const test = generateCases(rng, config.testCases, spec.testCriticalShare, spec.routineSigma, spec.criticalSigma);
    for (const policy of config.policies) rows.push({scenario, repeat, policy, ...evaluate(test, calibrate(calibration, policy))});
  }
}

const fields = Object.keys(rows[0]);
fs.writeFileSync(path.join(here, 'repeat-results.csv'), [fields.join(','), ...rows.map(row => fields.map(field => row[field]).join(','))].join('\n') + '\n');

const aggregates = [];
for (const scenario of scenarioNames) for (const policy of config.policies) {
  const group = rows.filter(row => row.scenario === scenario && row.policy === policy);
  const aggregate = {scenario, policy, repeats: group.length};
  for (const metric of fields.slice(3)) aggregate[metric] = mean(group.map(row => row[metric]));
  aggregates.push(aggregate);
}
function bootstrap(deltas, seed) {
  const rng = mulberry32(seed);
  const estimates = [];
  for (let b = 0; b < config.bootstrapSamples; b += 1) {
    let total = 0;
    for (let i = 0; i < deltas.length; i += 1) total += deltas[Math.floor(rng() * deltas.length)];
    estimates.push(total / deltas.length);
  }
  return {mean: mean(deltas), ciLow: quantile(estimates, 0.025), ciHigh: quantile(estimates, 0.975)};
}
const comparisons = [];
for (const scenario of scenarioNames) {
  const pooled = rows.filter(row => row.scenario === scenario && row.policy === 'pooled');
  for (const policy of config.policies.filter(name => name !== 'pooled')) {
    const treatment = rows.filter(row => row.scenario === scenario && row.policy === policy);
    for (const metric of ['allCoverage', 'routineCoverage', 'criticalCoverage', 'allMeanWidth', 'criticalMeanWidth', 'coverageGap']) {
      comparisons.push({scenario, policy, metric, ...bootstrap(treatment.map((row, index) => row[metric] - pooled[index][metric]), config.seed + comparisons.length * 997)});
    }
  }
}
fs.writeFileSync(path.join(here, 'aggregate-results.json'), JSON.stringify({config, aggregates}, null, 2) + '\n');
fs.writeFileSync(path.join(here, 'statistical-analysis.json'), JSON.stringify({comparisons}, null, 2) + '\n');
const focal = aggregates.filter(row => ['exchangeable_rare_noisy', 'shifted_critical_share', 'equal_noise_control'].includes(row.scenario));
const lines = ['Conformal slice coverage audit', `repeats=${config.repeats} calibration=${config.calibrationCases} test=${config.testCases} target=${config.targetCoverage}`,
  ...focal.map(row => `${row.scenario}/${row.policy}: global=${(100*row.allCoverage).toFixed(2)}% routine=${(100*row.routineCoverage).toFixed(2)}% critical=${(100*row.criticalCoverage).toFixed(2)}% mean_width=${row.allMeanWidth.toFixed(3)} critical_width=${row.criticalMeanWidth.toFixed(3)}`)];
fs.writeFileSync(path.join(here, 'focal-summary.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
