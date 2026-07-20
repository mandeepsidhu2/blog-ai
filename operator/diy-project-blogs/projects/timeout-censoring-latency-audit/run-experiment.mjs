import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(here, 'config.json'), 'utf8'));

function mulberry32(seed) {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rng) {
  const u = Math.max(rng(), Number.EPSILON);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[index];
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function latency(spec, tailDraw, bodyNoise, tailNoise) {
  const isTail = tailDraw < spec.tailProbability;
  const median = isTail ? spec.tailMedianSeconds : spec.medianSeconds;
  const sigma = isTail ? spec.tailSigma : spec.sigma;
  const noise = isTail ? tailNoise : bodyNoise;
  return Math.exp(Math.log(median) + sigma * noise);
}

function summarize(latencies, deadline) {
  const completed = latencies.filter(value => value <= deadline);
  const observed = latencies.map(value => Math.min(value, deadline));
  return {
    successRate: completed.length / latencies.length,
    completedOnlyP95: completed.length ? quantile(completed, 0.95) : deadline,
    deadlineAwareP95: quantile(observed, 0.95),
    latentP95: quantile(latencies, 0.95),
    restrictedMean: mean(observed),
    timeoutRate: 1 - completed.length / latencies.length
  };
}

const rows = [];
for (let repeat = 0; repeat < config.repeats; repeat += 1) {
  const rng = mulberry32(config.seed + repeat * 7919);
  const samples = Object.fromEntries(Object.keys(config.endpoints).map(name => [name, []]));
  const controlSamples = [];
  for (let i = 0; i < config.requestsPerRepeat; i += 1) {
    const tailDraw = rng();
    const bodyNoise = normal(rng);
    const tailNoise = normal(rng);
    for (const [name, spec] of Object.entries(config.endpoints)) {
      samples[name].push(latency(spec, tailDraw, bodyNoise, tailNoise));
    }
    controlSamples.push(latency({...config.endpoints.fast_spiky, tailProbability: 0}, tailDraw, bodyNoise, tailNoise));
  }
  for (const deadline of config.deadlinesSeconds) {
    for (const [endpoint, values] of Object.entries(samples)) {
      rows.push({repeat, condition: 'main', endpoint, deadline, ...summarize(values, deadline)});
    }
    rows.push({repeat, condition: 'no_tail_control', endpoint: 'fast_spiky', deadline, ...summarize(controlSamples, deadline)});
  }
}

const fields = ['repeat','condition','endpoint','deadline','successRate','completedOnlyP95','deadlineAwareP95','latentP95','restrictedMean','timeoutRate'];
const csv = [fields.join(','), ...rows.map(row => fields.map(field => row[field]).join(','))].join('\n') + '\n';
fs.writeFileSync(path.join(here, 'repeat-results.csv'), csv);

const groups = new Map();
for (const row of rows) {
  const key = `${row.condition}|${row.endpoint}|${row.deadline}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(row);
}
const aggregates = [...groups.entries()].map(([key, group]) => {
  const [condition, endpoint, deadline] = key.split('|');
  return {
    condition, endpoint, deadline: Number(deadline), repeats: group.length,
    successRate: mean(group.map(row => row.successRate)),
    completedOnlyP95: mean(group.map(row => row.completedOnlyP95)),
    deadlineAwareP95: mean(group.map(row => row.deadlineAwareP95)),
    latentP95: mean(group.map(row => row.latentP95)),
    restrictedMean: mean(group.map(row => row.restrictedMean)),
    timeoutRate: mean(group.map(row => row.timeoutRate))
  };
});
fs.writeFileSync(path.join(here, 'aggregate-results.json'), JSON.stringify({config, aggregates}, null, 2) + '\n');

function pairedBootstrap(values, seed) {
  const rng = mulberry32(seed);
  const estimates = [];
  for (let b = 0; b < config.bootstrapSamples; b += 1) {
    let total = 0;
    for (let i = 0; i < values.length; i += 1) total += values[Math.floor(rng() * values.length)];
    estimates.push(total / values.length);
  }
  return {mean: mean(values), ciLow: quantile(estimates, 0.025), ciHigh: quantile(estimates, 0.975)};
}

const focalDeadline = 8;
const steady = rows.filter(row => row.condition === 'main' && row.endpoint === 'steady' && row.deadline === focalDeadline);
const spiky = rows.filter(row => row.condition === 'main' && row.endpoint === 'fast_spiky' && row.deadline === focalDeadline);
const control = rows.filter(row => row.condition === 'no_tail_control' && row.deadline === focalDeadline);
const metrics = ['successRate','completedOnlyP95','deadlineAwareP95','latentP95','restrictedMean','timeoutRate'];
const comparisons = Object.fromEntries(metrics.map((metric, metricIndex) => [metric, pairedBootstrap(
  spiky.map((row, index) => row[metric] - steady[index][metric]),
  config.seed + 1000 + metricIndex
)]));
const controlComparisons = Object.fromEntries(metrics.map((metric, metricIndex) => [metric, pairedBootstrap(
  control.map((row, index) => row[metric] - steady[index][metric]),
  config.seed + 2000 + metricIndex
)]));
const analysis = {focalDeadline, comparison: 'fast_spiky minus steady', comparisons, noTailControlComparison: controlComparisons};
fs.writeFileSync(path.join(here, 'statistical-analysis.json'), JSON.stringify(analysis, null, 2) + '\n');

const focal = aggregates.filter(row => row.condition === 'main' && row.deadline === focalDeadline);
const lines = [
  'Timeout-censoring latency audit',
  `repeats=${config.repeats} requests_per_repeat=${config.requestsPerRepeat} focal_deadline_seconds=${focalDeadline}`,
  ...focal.map(row => `${row.endpoint}: success=${(100 * row.successRate).toFixed(2)}% completed_p95=${row.completedOnlyP95.toFixed(3)}s deadline_p95=${row.deadlineAwareP95.toFixed(3)}s latent_p95=${row.latentP95.toFixed(3)}s timeout=${(100 * row.timeoutRate).toFixed(2)}%`),
  `completed_only_p95_delta=${comparisons.completedOnlyP95.mean.toFixed(3)}s 95%CI[${comparisons.completedOnlyP95.ciLow.toFixed(3)},${comparisons.completedOnlyP95.ciHigh.toFixed(3)}]`,
  `deadline_aware_p95_delta=${comparisons.deadlineAwareP95.mean.toFixed(3)}s 95%CI[${comparisons.deadlineAwareP95.ciLow.toFixed(3)},${comparisons.deadlineAwareP95.ciHigh.toFixed(3)}]`,
  `success_rate_delta=${(100 * comparisons.successRate.mean).toFixed(2)}pp 95%CI[${(100 * comparisons.successRate.ciLow).toFixed(2)},${(100 * comparisons.successRate.ciHigh).toFixed(2)}]`,
  `no_tail_completed_p95_delta=${controlComparisons.completedOnlyP95.mean.toFixed(3)}s`
];
fs.writeFileSync(path.join(here, 'focal-summary.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
