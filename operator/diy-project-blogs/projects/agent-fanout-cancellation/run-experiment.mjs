import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

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
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}
function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function quantile(xs, q) {
  const ys = [...xs].sort((a, b) => a - b);
  return ys[Math.min(ys.length - 1, Math.max(0, Math.ceil(q * ys.length) - 1))];
}

function rateAt(t, spec) {
  if (!spec.burstPeriodSeconds) return spec.arrivalRate;
  const phase = (t % spec.burstPeriodSeconds) / spec.burstPeriodSeconds;
  return spec.arrivalRate * (phase < 0.25 ? spec.burstMultiplier : (4 - spec.burstMultiplier) / 3);
}

function makeWorkload(seed, spec) {
  const rng = mulberry32(seed);
  const parents = [];
  let t = 0;
  const maxRate = spec.arrivalRate * Math.max(1, spec.burstMultiplier);
  while (t < config.durationSeconds) {
    t += -Math.log(Math.max(rng(), Number.EPSILON)) / maxRate;
    if (t >= config.durationSeconds) break;
    if (rng() > rateAt(t, spec) / maxRate) continue;
    const services = Array.from({length: config.fanout}, () =>
      Math.exp(Math.log(config.serviceMedianSeconds) + config.serviceSigma * normal(rng))
    );
    parents.push({id: parents.length, arrival: t, services});
  }
  return parents;
}

function simulate(parents, policy, deadlineSeconds) {
  const events = [];
  const push = event => events.push(event);
  for (const parent of parents) {
    push({time: parent.arrival, type: 'arrival', parent});
    push({time: parent.arrival + deadlineSeconds, type: 'deadline', parentId: parent.id});
  }
  const states = parents.map(parent => ({parent, completed: 0, timedOut: false, successTime: null}));
  const queue = [];
  const running = new Map();
  let taskId = 0;
  let workerSeconds = 0;
  let orphanWorkerSeconds = 0;
  let maxQueue = 0;

  function startQueued(now) {
    while (running.size < config.workers && queue.length) {
      const task = queue.shift();
      if (task.cancelled) continue;
      task.start = now;
      task.finish = now + task.service;
      running.set(task.id, task);
      push({time: task.finish, type: 'complete', taskId: task.id});
    }
  }
  function stopTask(task, now, completed) {
    if (!running.has(task.id)) return;
    running.delete(task.id);
    const worked = Math.max(0, now - task.start);
    workerSeconds += worked;
    const deadline = task.parent.arrival + deadlineSeconds;
    orphanWorkerSeconds += Math.max(0, now - Math.max(task.start, deadline));
    task.cancelled = !completed;
    if (completed) {
      const state = states[task.parent.id];
      state.completed += 1;
      if (!state.timedOut && state.completed === config.fanout) state.successTime = now;
    }
    startQueued(now);
  }

  while (events.length) {
    events.sort((a, b) => a.time - b.time || a.type.localeCompare(b.type));
    const event = events.shift();
    if (event.type === 'arrival') {
      for (const service of event.parent.services) queue.push({id: taskId++, parent: event.parent, service, cancelled: false});
      maxQueue = Math.max(maxQueue, queue.length);
      startQueued(event.time);
    } else if (event.type === 'complete') {
      const task = running.get(event.taskId);
      if (task && Math.abs(task.finish - event.time) < 1e-9) stopTask(task, event.time, true);
    } else if (event.type === 'deadline') {
      const state = states[event.parentId];
      if (state.successTime !== null) continue;
      state.timedOut = true;
      if (policy.cancelQueued) {
        for (const task of queue) if (task.parent.id === event.parentId) task.cancelled = true;
      }
      if (policy.runningCancelDelaySeconds !== null) {
        for (const task of running.values()) {
          if (task.parent.id === event.parentId) push({time: event.time + policy.runningCancelDelaySeconds, type: 'cancel', taskId: task.id});
        }
      }
      startQueued(event.time);
    } else if (event.type === 'cancel') {
      const task = running.get(event.taskId);
      if (task) stopTask(task, event.time, false);
    }
  }
  const successful = states.filter(s => s.successTime !== null);
  const latencies = successful.map(s => s.successTime - s.parent.arrival);
  return {
    parents: parents.length,
    successRate: successful.length / parents.length,
    latencyP95: latencies.length ? quantile(latencies, 0.95) : deadlineSeconds,
    workerSecondsPerParent: workerSeconds / parents.length,
    orphanSecondsPerParent: orphanWorkerSeconds / parents.length,
    orphanShare: workerSeconds ? orphanWorkerSeconds / workerSeconds : 0,
    maxQueue
  };
}

const rows = [];
for (let repeat = 0; repeat < config.repeats; repeat += 1) {
  for (const [scenario, spec] of Object.entries(config.scenarios)) {
    const parents = makeWorkload(config.seed + repeat * 1009 + scenario.length * 9176, spec);
    for (const [policyName, policy] of Object.entries(config.policies)) {
      rows.push({repeat, scenario, policy: policyName, ...simulate(parents, policy, spec.deadlineSeconds ?? config.deadlineSeconds)});
    }
  }
}
const fields = ['repeat','scenario','policy','parents','successRate','latencyP95','workerSecondsPerParent','orphanSecondsPerParent','orphanShare','maxQueue'];
fs.writeFileSync(path.join(here, 'repeat-results.csv'), [fields.join(','), ...rows.map(r => fields.map(f => r[f]).join(','))].join('\n') + '\n');

const grouped = new Map();
for (const row of rows) {
  const key = `${row.scenario}|${row.policy}`;
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push(row);
}
const aggregates = [...grouped.entries()].map(([key, group]) => {
  const [scenario, policy] = key.split('|');
  return {scenario, policy, repeats: group.length, ...Object.fromEntries(fields.slice(3).map(metric => [metric, mean(group.map(r => r[metric]))]))};
});
fs.writeFileSync(path.join(here, 'aggregate-results.json'), JSON.stringify({config, aggregates}, null, 2) + '\n');

function bootstrap(deltas, seed) {
  const rng = mulberry32(seed);
  const draws = [];
  for (let b = 0; b < config.bootstrapSamples; b += 1) {
    let sum = 0;
    for (let i = 0; i < deltas.length; i += 1) sum += deltas[Math.floor(rng() * deltas.length)];
    draws.push(sum / deltas.length);
  }
  return {mean: mean(deltas), ciLow: quantile(draws, 0.025), ciHigh: quantile(draws, 0.975)};
}
const comparisons = {};
for (const scenario of Object.keys(config.scenarios)) {
  const base = rows.filter(r => r.scenario === scenario && r.policy === 'no_cancel');
  const treatment = rows.filter(r => r.scenario === scenario && r.policy === 'cooperative_250ms');
  comparisons[scenario] = {};
  for (const metric of ['successRate','latencyP95','workerSecondsPerParent','orphanSecondsPerParent','orphanShare','maxQueue']) {
    comparisons[scenario][metric] = bootstrap(treatment.map((r, i) => r[metric] - base[i][metric]), config.seed + metric.length * 31 + scenario.length);
  }
}
fs.writeFileSync(path.join(here, 'statistical-analysis.json'), JSON.stringify({comparison: 'cooperative_250ms minus no_cancel', comparisons}, null, 2) + '\n');

const focal = aggregates.filter(r => r.scenario === 'bursty');
const c = comparisons.bursty;
const lines = [
  'Agent fan-out cancellation experiment',
  `repeats=${config.repeats} workers=${config.workers} fanout=${config.fanout} deadline=${config.deadlineSeconds}s`,
  ...focal.map(r => `${r.policy}: success=${(100*r.successRate).toFixed(2)}% p95=${r.latencyP95.toFixed(3)}s work=${r.workerSecondsPerParent.toFixed(3)}s orphan=${r.orphanSecondsPerParent.toFixed(3)}s orphan_share=${(100*r.orphanShare).toFixed(2)}% max_queue=${r.maxQueue.toFixed(1)}`),
  `success_delta=${(100*c.successRate.mean).toFixed(2)}pp 95%CI[${(100*c.successRate.ciLow).toFixed(2)},${(100*c.successRate.ciHigh).toFixed(2)}]`,
  `orphan_delta=${c.orphanSecondsPerParent.mean.toFixed(3)}s 95%CI[${c.orphanSecondsPerParent.ciLow.toFixed(3)},${c.orphanSecondsPerParent.ciHigh.toFixed(3)}]`,
  `work_delta=${c.workerSecondsPerParent.mean.toFixed(3)}s 95%CI[${c.workerSecondsPerParent.ciLow.toFixed(3)},${c.workerSecondsPerParent.ciHigh.toFixed(3)}]`,
  `queue_delta=${c.maxQueue.mean.toFixed(1)} 95%CI[${c.maxQueue.ciLow.toFixed(1)},${c.maxQueue.ciHigh.toFixed(1)}]`
];
fs.writeFileSync(path.join(here, 'focal-summary.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
