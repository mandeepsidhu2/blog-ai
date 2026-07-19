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

function normal(rng) {
  const u = Math.max(rng(), 1e-12);
  const v = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function percentile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function makeArrivals(rate, workloadName, repeat) {
  const salt = workloadName === 'heavy-tail' ? 17011 : 29009;
  const rng = mulberry32((config.seed + repeat * 104729 + Math.round(rate * 1000) * 97 + salt) >>> 0);
  const requests = [];
  let at = 0;
  while (at < config.durationSeconds) {
    at += -Math.log(Math.max(rng(), 1e-12)) / rate;
    if (at >= config.durationSeconds) break;
    let tokens;
    let sizeClass;
    if (workloadName === 'fixed-control') {
      tokens = config.workloads['fixed-control'].tokens;
      sizeClass = 'fixed';
    } else {
      const spec = config.workloads['heavy-tail'];
      const isShort = rng() < spec.shortProbability;
      sizeClass = isShort ? 'short' : 'long';
      const median = isShort ? spec.shortMedianTokens : spec.longMedianTokens;
      tokens = Math.round(median * Math.exp(spec.logSigma * normal(rng)));
      tokens = Math.max(spec.minTokens, Math.min(spec.maxTokens, tokens));
    }
    requests.push({ id: requests.length, arrival: at, tokens, sizeClass });
  }
  return requests;
}

function estimateTokens(request, policy) {
  if (policy.kind === 'oracle') return request.tokens;
  if (policy.kind === 'count') return 0;
  const classEstimate = request.sizeClass === 'short' ? 280
    : request.sizeClass === 'long' ? 3600
    : config.workloads['fixed-control'].tokens;
  return classEstimate * policy.scale;
}

function simulate(requests, policy) {
  const active = [];
  const queue = [];
  const observations = [];
  let nextArrival = 0;
  let clock = 0;
  let reserved = 0;
  let dropped = 0;
  let oversubscribedSeconds = 0;
  let areaActive = 0;

  const canAdmit = request => {
    if (policy.kind === 'count') return active.length < config.requestLimit;
    const estimate = estimateTokens(request, policy);
    return active.length === 0 || reserved + estimate <= config.tokenBudget;
  };

  const admit = request => {
    const estimate = estimateTokens(request, policy);
    active.push({ ...request, remaining: request.tokens, admitted: clock, reservation: estimate });
    reserved += estimate;
  };

  const expireAndAdmit = () => {
    while (queue.length && clock - queue[0].arrival > config.queueTimeoutSeconds) {
      const request = queue.shift();
      if (request.arrival >= config.warmupSeconds) dropped++;
    }
    let changed = true;
    while (changed && queue.length) {
      changed = false;
      let candidateIndex = 0;
      if (policy.queue === 'shortest-estimate') {
        candidateIndex = queue
          .map((request, index) => ({ index, estimate: estimateTokens(request, policy) }))
          .filter(candidate => canAdmit(queue[candidate.index]))
          .sort((a, b) => a.estimate - b.estimate || a.index - b.index)[0]?.index ?? -1;
      }
      if (candidateIndex >= 0 && canAdmit(queue[candidateIndex])) {
        admit(queue.splice(candidateIndex, 1)[0]);
        changed = true;
      }
    }
  };

  while (nextArrival < requests.length || active.length || queue.length) {
    expireAndAdmit();
    const arrivalTime = nextArrival < requests.length ? requests[nextArrival].arrival : Infinity;
    const completionDelta = active.length
      ? Math.min(...active.map(job => job.remaining)) * active.length / config.serverTokensPerSecond
      : Infinity;
    const completionTime = clock + completionDelta;
    let nextTime = Math.min(arrivalTime, completionTime);
    if (!Number.isFinite(nextTime)) {
      if (queue.length) {
        clock = queue[0].arrival + config.queueTimeoutSeconds + 1e-9;
        continue;
      }
      break;
    }
    const delta = Math.max(0, nextTime - clock);
    if (active.length) {
      const delivered = delta * config.serverTokensPerSecond / active.length;
      for (const job of active) job.remaining = Math.max(0, job.remaining - delivered);
      areaActive += active.length * delta;
      if (active.reduce((sum, job) => sum + job.remaining, 0) > config.tokenBudget) {
        oversubscribedSeconds += delta;
      }
    }
    clock = nextTime;

    if (arrivalTime <= completionTime) {
      const request = requests[nextArrival++];
      if (queue.length || !canAdmit(request)) queue.push(request);
      else admit(request);
      continue;
    }

    const completed = active.filter(job => job.remaining <= 1e-7);
    for (const job of completed) {
      reserved -= job.reservation;
      if (job.arrival >= config.warmupSeconds) {
        observations.push({
          latency: clock - job.arrival,
          queueWait: job.admitted - job.arrival,
          tokens: job.tokens,
          sizeClass: job.sizeClass
        });
      }
    }
    for (let index = active.length - 1; index >= 0; index--) {
      if (active[index].remaining <= 1e-7) active.splice(index, 1);
    }
  }

  const short = observations.filter(row => row.sizeClass === 'short' || row.sizeClass === 'fixed');
  const long = observations.filter(row => row.sizeClass === 'long');
  const horizon = config.durationSeconds - config.warmupSeconds;
  return {
    completed: observations.length,
    dropped,
    throughputRps: observations.length / horizon,
    dropRate: dropped / Math.max(1, dropped + observations.length),
    meanLatencySeconds: observations.reduce((sum, row) => sum + row.latency, 0) / Math.max(1, observations.length),
    p95LatencySeconds: percentile(observations.map(row => row.latency), 0.95),
    p99LatencySeconds: percentile(observations.map(row => row.latency), 0.99),
    p95QueueWaitSeconds: percentile(observations.map(row => row.queueWait), 0.95),
    shortP95LatencySeconds: percentile(short.map(row => row.latency), 0.95),
    longP95LatencySeconds: percentile(long.map(row => row.latency), 0.95),
    sloAttainment: observations.filter(row => row.latency <= config.latencySloSeconds).length / Math.max(1, observations.length),
    oversubscribedFraction: oversubscribedSeconds / Math.max(1e-9, clock),
    meanActive: areaActive / Math.max(1e-9, clock)
  };
}

function summarize(values) {
  const clean = values.filter(Number.isFinite);
  const mean = clean.reduce((a, b) => a + b, 0) / clean.length;
  const sorted = [...clean].sort((a, b) => a - b);
  return {
    mean,
    ci95Low: sorted[Math.floor(0.025 * (sorted.length - 1))],
    ci95High: sorted[Math.ceil(0.975 * (sorted.length - 1))]
  };
}

const raw = [];
const workloadAudit = [];
for (const workload of Object.keys(config.workloads)) {
  for (const rate of config.arrivalRatesPerSecond) {
    for (let repeat = 0; repeat < config.repeats; repeat++) {
      const arrivals = makeArrivals(rate, workload, repeat);
      workloadAudit.push({
        workload,
        rate,
        repeat,
        requests: arrivals.length,
        meanTokens: arrivals.reduce((sum, request) => sum + request.tokens, 0) / arrivals.length,
        p50Tokens: percentile(arrivals.map(request => request.tokens), 0.50),
        p95Tokens: percentile(arrivals.map(request => request.tokens), 0.95),
        p99Tokens: percentile(arrivals.map(request => request.tokens), 0.99),
        longFraction: arrivals.filter(request => request.sizeClass === 'long').length / arrivals.length
      });
      for (const policy of config.policies) {
        raw.push({ workload, rate, repeat, policy: policy.name, ...simulate(arrivals, policy) });
      }
    }
  }
}

const metrics = ['throughputRps','dropRate','meanLatencySeconds','p95LatencySeconds','p99LatencySeconds','p95QueueWaitSeconds','shortP95LatencySeconds','longP95LatencySeconds','sloAttainment','oversubscribedFraction','meanActive'];
const aggregate = [];
for (const workload of Object.keys(config.workloads)) {
  for (const rate of config.arrivalRatesPerSecond) {
    for (const policy of config.policies) {
      const cells = raw.filter(row => row.workload === workload && row.rate === rate && row.policy === policy.name);
      const row = { workload, rate, policy: policy.name, repeats: cells.length };
      for (const metric of metrics) row[metric] = summarize(cells.map(cell => cell[metric]));
      aggregate.push(row);
    }
  }
}

fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts', 'aggregate-results.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  claimBoundary: 'Processor-sharing simulation with declared workloads and class-level token estimates; not a hardware or model-quality benchmark.',
  config,
  aggregate
}, null, 2));
fs.writeFileSync(path.join(root, 'artifacts', 'raw-repeat-results.csv'), [
  ['workload','rate','repeat','policy',...metrics].join(','),
  ...raw.map(row => [row.workload,row.rate,row.repeat,row.policy,...metrics.map(metric => row[metric])].join(','))
].join('\n') + '\n');
fs.writeFileSync(path.join(root, 'artifacts', 'raw-workload-summary.csv'), [
  ['workload','rate','repeat','requests','mean_tokens','p50_tokens','p95_tokens','p99_tokens','long_fraction'].join(','),
  ...workloadAudit.map(row => [row.workload,row.rate,row.repeat,row.requests,row.meanTokens,row.p50Tokens,row.p95Tokens,row.p99Tokens,row.longFraction].join(','))
].join('\n') + '\n');

console.log(`Token-work admission audit: ${config.repeats} repeats per cell; capacity=${config.serverTokensPerSecond} tok/s`);
for (const row of aggregate.filter(row => row.workload === 'heavy-tail' && row.rate === 4)) {
  console.log(`${row.policy}\tshort_p95=${row.shortP95LatencySeconds.mean.toFixed(3)}s\tall_p95=${row.p95LatencySeconds.mean.toFixed(3)}s\tdrop=${(100 * row.dropRate.mean).toFixed(2)}%\tover=${(100 * row.oversubscribedFraction.mean).toFixed(1)}%`);
}
