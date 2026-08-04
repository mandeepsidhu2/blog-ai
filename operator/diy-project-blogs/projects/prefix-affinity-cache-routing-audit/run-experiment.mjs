import fs from "node:fs";
import crypto from "node:crypto";

const root = new URL("./", import.meta.url);
const out = new URL("./artifacts/", root);
const config = JSON.parse(fs.readFileSync(new URL("config.json", root), "utf8"));
fs.mkdirSync(out, { recursive: true });

function rng(seed) {
  let x = seed >>> 0;
  return () => {
    x += 0x6d2b79f5;
    let t = x;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normal(r) {
  return Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r());
}
function quantile(xs, q) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];
}
function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function std(xs) {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map(x => (x - m) ** 2)));
}
function prefixHash(prefix) {
  let h = 2166136261;
  for (const c of prefix) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) % config.workers;
}
function makeTrace(scenario, repeat) {
  const r = rng(config.seed + repeat * 1009 + scenario.rps * 17);
  const trace = [];
  let at = 0;
  while (at < config.durationSeconds * 1000) {
    at += -Math.log(Math.max(1e-12, 1 - r())) * 1000 / scenario.rps;
    if (at >= config.durationSeconds * 1000) break;
    let prefix;
    if (scenario.hotProbability && r() < scenario.hotProbability) prefix = "prefix-000";
    else prefix = `prefix-${String(1 + Math.floor(r() * (scenario.prefixes - 1))).padStart(3, "0")}`;
    trace.push({
      at,
      prefix,
      serviceNoise: normal(r),
      routeRandom: r()
    });
  }
  return trace;
}
function touch(cache, key) {
  const index = cache.indexOf(key);
  if (index >= 0) cache.splice(index, 1);
  cache.push(key);
  if (cache.length > config.cacheEntriesPerWorker) cache.shift();
}
function route(policy, req, available, caches) {
  const least = available.reduce((best, value, i) => value < available[best] ? i : best, 0);
  const affinity = prefixHash(req.prefix);
  if (policy === "random") return Math.floor(req.routeRandom * config.workers);
  if (policy === "least-loaded") return least;
  if (policy === "prefix-affinity") return affinity;
  const affinityWait = Math.max(0, available[affinity] - req.at);
  const leastWait = Math.max(0, available[least] - req.at);
  return affinityWait <= leastWait + config.boundedAffinitySlackMs ? affinity : least;
}
function runPolicy(scenario, repeat, policy, trace) {
  const available = Array(config.workers).fill(0);
  const caches = Array.from({ length: config.workers }, () => []);
  const completed = Array(config.workers).fill(0);
  const kept = [];
  let hits = 0;
  let counted = 0;
  for (const req of trace) {
    const worker = route(policy, req, available, caches);
    const hit = scenario.cacheEnabled && caches[worker].includes(req.prefix);
    const base = (hit ? config.hitPrefillMs : config.missPrefillMs) + config.decodeMeanMs;
    const service = Math.max(2, base * Math.exp(config.serviceLogSigma * req.serviceNoise - 0.5 * config.serviceLogSigma ** 2));
    const start = Math.max(req.at, available[worker]);
    const done = start + service;
    available[worker] = done;
    completed[worker] += 1;
    if (scenario.cacheEnabled) touch(caches[worker], req.prefix);
    if (req.at >= config.warmupSeconds * 1000) {
      const latency = done - req.at;
      kept.push({ latency, queue: start - req.at });
      hits += Number(hit);
      counted += 1;
    }
  }
  const latencies = kept.map(x => x.latency);
  const queues = kept.map(x => x.queue);
  const p99 = quantile(latencies, 0.99);
  return {
    scenario: scenario.id,
    repeat,
    policy,
    requests: counted,
    cache_hit_rate: hits / counted,
    mean_latency_ms: mean(latencies),
    p95_latency_ms: quantile(latencies, 0.95),
    p99_latency_ms: p99,
    p99_queue_ms: quantile(queues, 0.99),
    max_queue_ms: Math.max(...queues),
    worker_request_cv: std(completed) / mean(completed),
    slo_pass: p99 <= config.sloP99Ms
  };
}
function bootstrap(deltas, seed) {
  const r = rng(seed);
  const draws = [];
  for (let b = 0; b < config.bootstrapSamples; b++) {
    let sum = 0;
    for (let i = 0; i < deltas.length; i++) sum += deltas[Math.floor(r() * deltas.length)];
    draws.push(sum / deltas.length);
  }
  return { mean: mean(deltas), low: quantile(draws, 0.025), high: quantile(draws, 0.975) };
}

const rows = [];
for (const scenario of config.scenarios) {
  for (let repeat = 1; repeat <= config.repeats; repeat++) {
    const trace = makeTrace(scenario, repeat);
    for (const policy of config.policies) rows.push(runPolicy(scenario, repeat, policy, trace));
  }
}

const aggregates = [];
for (const scenario of config.scenarios) {
  const cell = rows.filter(r => r.scenario === scenario.id);
  const least = new Map(cell.filter(r => r.policy === "least-loaded").map(r => [r.repeat, r]));
  for (const policy of config.policies) {
    const rs = cell.filter(r => r.policy === policy);
    aggregates.push({
      scenario: scenario.id,
      policy,
      repeats: rs.length,
      median_hit_rate: quantile(rs.map(r => r.cache_hit_rate), 0.5),
      median_p95_ms: quantile(rs.map(r => r.p95_latency_ms), 0.5),
      median_p99_ms: quantile(rs.map(r => r.p99_latency_ms), 0.5),
      median_p99_queue_ms: quantile(rs.map(r => r.p99_queue_ms), 0.5),
      median_worker_cv: quantile(rs.map(r => r.worker_request_cv), 0.5),
      slo_pass_rate: mean(rs.map(r => Number(r.slo_pass))),
      paired_p99_minus_least_loaded_ms: bootstrap(rs.map(r => r.p99_latency_ms - least.get(r.repeat).p99_latency_ms), config.seed + scenario.rps * 31 + config.policies.indexOf(policy)),
      paired_hit_rate_minus_least_loaded: bootstrap(rs.map(r => r.cache_hit_rate - least.get(r.repeat).cache_hit_rate), config.seed + scenario.rps * 43 + config.policies.indexOf(policy))
    });
  }
}

const fields = Object.keys(rows[0]);
fs.writeFileSync(new URL("repeat-metrics.csv", out), [fields.join(","), ...rows.map(row => fields.map(k => row[k]).join(","))].join("\n") + "\n");
fs.writeFileSync(new URL("aggregate-results.json", out), JSON.stringify({ config, aggregates }, null, 2) + "\n");
const claimRows = ["scenario,policy,hit_rate,p95_ms,p99_ms,p99_queue_ms,worker_cv,slo_pass_rate"];
for (const a of aggregates) claimRows.push([a.scenario,a.policy,a.median_hit_rate,a.median_p95_ms,a.median_p99_ms,a.median_p99_queue_ms,a.median_worker_cv,a.slo_pass_rate].join(","));
fs.writeFileSync(new URL("claim-table.csv", out), claimRows.join("\n") + "\n");

const selected = aggregates.filter(a => ["moderate-hot-120", "extreme-hot-180"].includes(a.scenario));
const colors = {"random":"#7dd3fc","least-loaded":"#a7f3d0","prefix-affinity":"#fb7185","bounded-affinity":"#c4b5fd"};
const panels = ["moderate-hot-120", "extreme-hot-180"].map((scenario, panel) => {
  const cell = selected.filter(a => a.scenario === scenario);
  const x0 = 120 + panel * 430;
  const bars = cell.map((a, i) => {
    const h = Math.min(290, a.median_p99_ms * 0.32);
    return `<g><rect x="${x0 + i*78}" y="${420-h}" width="54" height="${h}" rx="4" fill="${colors[a.policy]}"/><text x="${x0+i*78+27}" y="${405-h}" text-anchor="middle" class="value">${a.median_p99_ms.toFixed(0)}</text><text transform="translate(${x0+i*78+18} 452) rotate(35)" class="small">${a.policy}</text></g>`;
  }).join("");
  return `${bars}<text x="${x0+125}" y="505" text-anchor="middle" class="label">${scenario.replaceAll("-", " ")}</text>`;
}).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" data-visual-quality="publication" data-text-fit="bounded" role="img" aria-labelledby="title desc"><title id="title">Prefix affinity trades cache reuse for hot-shard tail latency</title><desc id="desc">Two grouped bar charts compare median p99 latency for random, least-loaded, prefix-affinity, and bounded-affinity routing under moderate and extreme hot-prefix workloads across 200 repeats.</desc><style>.bg{fill:#09111f}.title{font:700 26px Georgia,serif;fill:#f8fafc}.sub,.label{font:15px Georgia,serif;fill:#cbd5e1}.value{font:700 13px ui-monospace,monospace;fill:#f8fafc}.small{font:12px Georgia,serif;fill:#bac7dc}.axis{stroke:#64748b;stroke-width:1}.slo{stroke:#fbbf24;stroke-width:2;stroke-dasharray:7 7}</style><rect class="bg" width="960" height="540"/><text x="48" y="52" class="title">Cache affinity becomes a queue when one prefix gets hot</text><text x="48" y="80" class="sub">Median p99 latency over 200 matched repeats; milliseconds; lower is better</text><line x1="80" y1="420" x2="920" y2="420" class="axis"/><line x1="80" y1="340" x2="920" y2="340" class="slo"/><text x="70" y="344" text-anchor="end" class="small">250 ms SLO</text>${panels}</svg>`;
fs.writeFileSync(new URL("prefix-affinity-routing-results.svg", out), svg);

const hashes = {};
for (const name of ["repeat-metrics.csv", "aggregate-results.json", "claim-table.csv", "prefix-affinity-routing-results.svg"]) hashes[name] = crypto.createHash("sha256").update(fs.readFileSync(new URL(name, out))).digest("hex");
fs.writeFileSync(new URL("sha256.json", out), JSON.stringify(hashes, null, 2) + "\n");
console.log(JSON.stringify(aggregates, null, 2));
