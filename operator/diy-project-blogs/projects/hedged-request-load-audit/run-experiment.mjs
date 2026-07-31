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
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];
}

function generateTrace(scenario, repeat) {
  const rng = mulberry32(config.seed + repeat * 104729 + Object.keys(config.scenarios).indexOf(scenario) * 10000019);
  const spec = config.scenarios[scenario];
  const rows = [];
  let arrival = 0;
  for (let id = 0; id < config.requestsPerRepeat; id += 1) {
    arrival += -Math.log(Math.max(rng(), Number.EPSILON)) / spec.arrivalRate;
    const sharedTail = rng() < spec.tailProbability && rng() < spec.sharedTailProbability;
    const demands = [];
    for (let copy = 0; copy < 2; copy += 1) {
      const tail = sharedTail || (rng() < spec.tailProbability && !sharedTail);
      demands.push(tail
        ? lognormal(rng, config.service.tailMedianSeconds, config.service.tailSigma)
        : lognormal(rng, config.service.bodyMedianSeconds, config.service.bodySigma));
    }
    rows.push({id, arrival, demands});
  }
  return rows;
}

function simulate(trace, policyName) {
  const policy = config.policies[policyName];
  const queues = Array.from({length: config.workers}, () => []);
  const requests = trace.map(row => ({...row, done: false, hedged: false, completion: null}));
  let nextArrival = 0;
  let time = 0;
  let work = 0;
  let hedges = 0;
  let canceledQueued = 0;
  let maxQueue = 0;
  const hardStop = trace.at(-1).arrival + config.deadlineSeconds + 20;

  function activeDepth(queue) { return queue.reduce((n, job) => n + (!requests[job.id].done ? 1 : 0), 0); }
  function chooseWorker(exclude = -1) {
    let best = -1;
    let bestDepth = Infinity;
    for (let w = 0; w < queues.length; w += 1) {
      if (w === exclude) continue;
      const depth = activeDepth(queues[w]);
      if (depth < bestDepth) { best = w; bestDepth = depth; }
    }
    return {worker: best, depth: bestDepth};
  }
  function enqueue(req, copy, exclude = -1) {
    const {worker, depth} = chooseWorker(exclude);
    queues[worker].push({id: req.id, copy, remaining: req.demands[copy], worker});
    maxQueue = Math.max(maxQueue, depth + 1);
    return worker;
  }

  while (time <= hardStop && requests.some(r => !r.done)) {
    while (nextArrival < requests.length && requests[nextArrival].arrival <= time + 1e-9) {
      const req = requests[nextArrival];
      req.primaryWorker = enqueue(req, 0);
      nextArrival += 1;
    }
    if (policy.delaySeconds !== null) {
      for (let id = 0; id < nextArrival; id += 1) {
        const req = requests[id];
        if (req.done || req.hedged || time + 1e-9 < req.arrival + policy.delaySeconds) continue;
        const target = chooseWorker(req.primaryWorker);
        if (policy.queueCap !== null && target.depth >= policy.queueCap) {
          req.hedged = true;
          req.hedgeSuppressed = true;
          continue;
        }
        queues[target.worker].push({id: req.id, copy: 1, remaining: req.demands[1], worker: target.worker});
        req.hedged = true;
        hedges += 1;
        maxQueue = Math.max(maxQueue, target.depth + 1);
      }
    }
    for (const queue of queues) {
      while (queue.length && requests[queue[0].id].done) { queue.shift(); canceledQueued += 1; }
      if (!queue.length) continue;
      const job = queue[0];
      const consumed = Math.min(config.tickSeconds, job.remaining);
      job.remaining -= consumed;
      work += consumed;
      if (job.remaining <= 1e-12) {
        queue.shift();
        const req = requests[job.id];
        if (!req.done) {
          req.done = true;
          req.completion = time + consumed;
          req.winner = job.copy;
        }
      }
    }
    time += config.tickSeconds;
  }
  const latencies = requests.map(req => Math.min(config.deadlineSeconds, (req.completion ?? hardStop) - req.arrival));
  const completed = requests.filter(req => req.completion !== null && req.completion - req.arrival <= config.deadlineSeconds);
  return {
    completionRate: completed.length / requests.length,
    p50Latency: quantile(latencies, 0.5),
    p95Latency: quantile(latencies, 0.95),
    p99Latency: quantile(latencies, 0.99),
    workSecondsPerRequest: work / requests.length,
    hedgeRate: hedges / requests.length,
    hedgeWinRate: hedges ? requests.filter(r => r.winner === 1).length / hedges : 0,
    maxQueueDepth: maxQueue,
    canceledQueuedPerRequest: canceledQueued / requests.length
  };
}

const rows = [];
for (const scenario of Object.keys(config.scenarios)) {
  for (let repeat = 0; repeat < config.repeats; repeat += 1) {
    const trace = generateTrace(scenario, repeat);
    for (const policy of Object.keys(config.policies)) rows.push({scenario, repeat, policy, ...simulate(trace, policy)});
  }
}
const fields = Object.keys(rows[0]);
fs.writeFileSync(path.join(here, 'repeat-results.csv'), [fields.join(','), ...rows.map(r => fields.map(f => r[f]).join(','))].join('\n') + '\n');

const aggregates = [];
for (const scenario of Object.keys(config.scenarios)) for (const policy of Object.keys(config.policies)) {
  const group = rows.filter(r => r.scenario === scenario && r.policy === policy);
  const out = {scenario, policy, repeats: group.length};
  for (const metric of fields.slice(3)) out[metric] = mean(group.map(r => r[metric]));
  aggregates.push(out);
}

function bootstrap(deltas, seed) {
  const rng = mulberry32(seed);
  const estimates = [];
  for (let b = 0; b < config.bootstrapSamples; b += 1) {
    let sum = 0;
    for (let i = 0; i < deltas.length; i += 1) sum += deltas[Math.floor(rng() * deltas.length)];
    estimates.push(sum / deltas.length);
  }
  return {mean: mean(deltas), ciLow: quantile(estimates, 0.025), ciHigh: quantile(estimates, 0.975)};
}
const comparisons = [];
for (const scenario of Object.keys(config.scenarios)) {
  const base = rows.filter(r => r.scenario === scenario && r.policy === 'no_hedge');
  for (const policy of Object.keys(config.policies).filter(p => p !== 'no_hedge')) {
    const treatment = rows.filter(r => r.scenario === scenario && r.policy === policy);
    for (const metric of ['completionRate', 'p95Latency', 'p99Latency', 'workSecondsPerRequest', 'maxQueueDepth']) {
      comparisons.push({scenario, policy, metric, ...bootstrap(treatment.map((r, i) => r[metric] - base[i][metric]), config.seed + comparisons.length * 997)});
    }
  }
}
fs.writeFileSync(path.join(here, 'aggregate-results.json'), JSON.stringify({config, aggregates}, null, 2) + '\n');
fs.writeFileSync(path.join(here, 'statistical-analysis.json'), JSON.stringify({comparisons}, null, 2) + '\n');
const focal = aggregates.filter(r => ['moderate_independent', 'near_capacity_correlated', 'no_tail_control'].includes(r.scenario));
const lines = ['Hedged request load audit', `repeats=${config.repeats} requests_per_repeat=${config.requestsPerRepeat} workers=${config.workers}`,
  ...focal.map(r => `${r.scenario}/${r.policy}: completion=${(100*r.completionRate).toFixed(2)}% p95=${r.p95Latency.toFixed(3)}s p99=${r.p99Latency.toFixed(3)}s work=${r.workSecondsPerRequest.toFixed(3)}s hedge=${(100*r.hedgeRate).toFixed(1)}% max_queue=${r.maxQueueDepth.toFixed(1)}`)];
fs.writeFileSync(path.join(here, 'focal-summary.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
