import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function poissonArrivals(rate, seconds, rng) {
  const arrivals = [];
  let clock = 0;
  while (clock < seconds * 1000) {
    clock += -Math.log(Math.max(rng(), 1e-12)) * 1000 / rate;
    if (clock < seconds * 1000) arrivals.push(clock);
  }
  return arrivals;
}

function burstyArrivals(rate, seconds, rng) {
  const arrivals = [];
  const period = config.burstSize * 1000 / rate;
  let burst = rng() * period;
  while (burst < seconds * 1000) {
    const jitter = (rng() - 0.5) * period * 0.18;
    for (let i = 0; i < config.burstSize; i++) {
      const arrival = burst + jitter + i * config.burstSpreadMs;
      if (arrival >= 0 && arrival < seconds * 1000) arrivals.push(arrival);
    }
    burst += period;
  }
  return arrivals.sort((a, b) => a - b);
}

function percentile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function serviceMs(batchSize, model) {
  return model.baseMs + model.perRequestMs * batchSize ** model.batchExponent;
}

function simulate(arrivals, policy, serviceModel) {
  let cursor = 0;
  let available = 0;
  let dropped = 0;
  let batches = 0;
  const latencies = [];
  const batchSizes = [];
  const warmupMs = config.warmupSeconds * 1000;

  while (cursor < arrivals.length) {
    if (available - arrivals[cursor] > config.queueTimeoutMs) {
      if (arrivals[cursor] >= warmupMs) dropped++;
      cursor++;
      continue;
    }

    const first = cursor;
    const ready = Math.max(arrivals[first], available);
    let start = ready;
    if (available <= arrivals[first] && policy.maxBatch > 1) {
      const fillIndex = Math.min(arrivals.length - 1, first + policy.maxBatch - 1);
      start = Math.min(ready + policy.maxDelayMs, arrivals[fillIndex]);
    }

    let end = first + 1;
    while (end < arrivals.length && end - first < policy.maxBatch && arrivals[end] <= start) end++;
    const size = end - first;
    const finish = start + serviceMs(size, serviceModel);
    available = finish;
    batches++;
    batchSizes.push(size);

    for (let index = first; index < end; index++) {
      if (arrivals[index] >= warmupMs) latencies.push(finish - arrivals[index]);
    }
    cursor = end;
  }

  const observedSeconds = config.durationSeconds - config.warmupSeconds;
  const completed = latencies.length;
  const withinSlo = latencies.filter(value => value <= config.sloMs).length;
  return {
    completed,
    dropped,
    throughputRps: completed / observedSeconds,
    dropRate: dropped / Math.max(1, completed + dropped),
    meanLatencyMs: latencies.reduce((a, b) => a + b, 0) / Math.max(1, completed),
    p50LatencyMs: percentile(latencies, 0.50),
    p95LatencyMs: percentile(latencies, 0.95),
    p99LatencyMs: percentile(latencies, 0.99),
    sloAttainment: withinSlo / Math.max(1, completed),
    meanBatchSize: batchSizes.reduce((a, b) => a + b, 0) / Math.max(1, batches)
  };
}

function summarize(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  const half = 1.96 * Math.sqrt(variance / values.length);
  return { mean, ci95Low: mean - half, ci95High: mean + half };
}

const raw = [];
const modelVariants = [
  { name: 'batch-efficient', ...config.serviceModel },
  { name: 'no-batch-efficiency-control', baseMs: 0, perRequestMs: 6.4, batchExponent: 1 }
];

for (const model of modelVariants) {
  for (const pattern of config.arrivalPatterns) {
    for (const rate of config.ratesPerSecond) {
      for (let repeat = 0; repeat < config.repeats; repeat++) {
        const seed = ((rate * 100003 + repeat * 7919 + pattern.length * 97) >>> 0);
        const rng = mulberry32(seed);
        const arrivals = pattern === 'poisson'
          ? poissonArrivals(rate, config.durationSeconds, rng)
          : burstyArrivals(rate, config.durationSeconds, rng);
        for (const policy of config.policies) {
          raw.push({ model: model.name, pattern, rate, repeat, policy: policy.name, ...simulate(arrivals, policy, model) });
        }
      }
    }
  }
}

const metrics = ['throughputRps', 'dropRate', 'meanLatencyMs', 'p50LatencyMs', 'p95LatencyMs', 'p99LatencyMs', 'sloAttainment', 'meanBatchSize'];
const aggregate = [];
for (const model of modelVariants) {
  for (const pattern of config.arrivalPatterns) {
    for (const rate of config.ratesPerSecond) {
      for (const policy of config.policies) {
        const cells = raw.filter(row => row.model === model.name && row.pattern === pattern && row.rate === rate && row.policy === policy.name);
        const row = { model: model.name, pattern, rate, policy: policy.name, repeats: cells.length };
        for (const metric of metrics) row[metric] = summarize(cells.map(cell => cell[metric]));
        aggregate.push(row);
      }
    }
  }
}

const result = {
  generatedAt: new Date().toISOString(),
  claimBoundary: 'Discrete-event operating characteristics for the declared arrival and service models; not a hardware benchmark.',
  config,
  aggregate
};
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts', 'aggregate-results.json'), JSON.stringify(result, null, 2));
fs.writeFileSync(path.join(root, 'artifacts', 'raw-seed-results.csv'), [
  ['model','pattern','rate','repeat','policy','throughput_rps','drop_rate','p50_ms','p95_ms','p99_ms','slo_attainment','mean_batch_size'].join(','),
  ...raw.map(row => [row.model,row.pattern,row.rate,row.repeat,row.policy,row.throughputRps,row.dropRate,row.p50LatencyMs,row.p95LatencyMs,row.p99LatencyMs,row.sloAttainment,row.meanBatchSize].join(','))
].join('\n') + '\n');

const focal = aggregate.filter(row => row.model === 'batch-efficient' && row.pattern === 'bursty' && row.rate === 140);
console.log(`Inference batching tail-latency audit: repeats=${config.repeats}, SLO=${config.sloMs}ms, queue_timeout=${config.queueTimeoutMs}ms`);
for (const row of focal) {
  console.log(`${row.policy}\tthroughput=${row.throughputRps.mean.toFixed(1)} rps\tp95=${row.p95LatencyMs.mean.toFixed(1)} ms\tSLO=${(100*row.sloAttainment.mean).toFixed(1)}%\tdrop=${(100*row.dropRate.mean).toFixed(1)}%\tbatch=${row.meanBatchSize.mean.toFixed(2)}`);
}
