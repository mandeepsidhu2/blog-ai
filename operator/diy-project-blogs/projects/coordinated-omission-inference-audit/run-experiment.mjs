import fs from "node:fs";
import crypto from "node:crypto";

const config = JSON.parse(fs.readFileSync(new URL("./config.json", import.meta.url), "utf8"));
const out = new URL("./artifacts/", import.meta.url);
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

const exp = (r, mean) => -Math.log(Math.max(1e-12, 1 - r())) * mean;
function normal(r) {
  return Math.sqrt(-2 * Math.log(Math.max(1e-12, r()))) * Math.cos(2 * Math.PI * r());
}
function serviceMs(r) {
  const sigma = config.baseServiceLogSigma;
  const mu = Math.log(config.baseServiceMeanMs) - (sigma * sigma) / 2;
  return Math.exp(mu + sigma * normal(r));
}
function quantile(values, q) {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];
}
function pausesFor(scenario, r) {
  if (!scenario.pauseEveryMs) return [];
  const pauses = [];
  for (let t = scenario.pauseEveryMs; t < config.durationSeconds * 1000 + 5000; t += scenario.pauseEveryMs) {
    const jitter = (r() - 0.5) * scenario.pauseEveryMs * 0.16;
    pauses.push([t + jitter, t + jitter + scenario.pauseDurationMs]);
  }
  return pauses.sort((a, b) => a[0] - b[0]);
}
function completeAfterPauses(start, workMs, pauses) {
  let cursor = start;
  let remaining = workMs;
  for (const [p0, p1] of pauses) {
    if (p1 <= cursor) continue;
    if (p0 >= cursor + remaining) break;
    if (cursor < p0) {
      remaining -= p0 - cursor;
      cursor = p0;
    }
    cursor = Math.max(cursor, p1);
  }
  return cursor + remaining;
}
function summarize(mode, scenario, latencies, arrivals, completions, corrected = null) {
  const warm = config.warmupSeconds * 1000;
  const end = config.durationSeconds * 1000;
  const kept = latencies.filter((_, i) => arrivals[i] >= warm && arrivals[i] < end);
  const completed = completions.filter((t, i) => arrivals[i] >= warm && arrivals[i] < end && t <= end).length;
  const base = {
    scenario: scenario.id,
    mode,
    offered_rps: scenario.targetRps,
    issued_requests: kept.length,
    completed_by_window_end: completed,
    achieved_rps: kept.length / (config.durationSeconds - config.warmupSeconds),
    p50_ms: quantile(kept, 0.5),
    p95_ms: quantile(kept, 0.95),
    p99_ms: quantile(kept, 0.99),
    max_ms: Math.max(...kept),
    slo_pass: quantile(kept, 0.99) <= config.sloP99Ms
  };
  if (corrected) {
    base.corrected_samples = corrected.length;
    base.corrected_p95_ms = quantile(corrected, 0.95);
    base.corrected_p99_ms = quantile(corrected, 0.99);
  }
  return base;
}
function runOpenLoop(scenario, repeat) {
  const serviceRng = rng(200000 + repeat * 131 + scenario.targetRps);
  const pauseRng = rng(300000 + repeat * 173 + scenario.pauseDurationMs);
  const arrivals = [];
  let t = 0;
  const interval = 1000 / scenario.targetRps;
  const phase = rng(100000 + repeat * 97 + scenario.targetRps)() * interval;
  t = phase;
  while (t < config.durationSeconds * 1000) {
    arrivals.push(t);
    t += interval;
  }
  const pauses = pausesFor(scenario, pauseRng);
  const latencies = [], completions = [];
  let serverFree = 0;
  for (const arrival of arrivals) {
    const start = Math.max(arrival, serverFree);
    const done = completeAfterPauses(start, serviceMs(serviceRng), pauses);
    serverFree = done;
    completions.push(done);
    latencies.push(done - arrival);
  }
  return summarize("open_loop", scenario, latencies, arrivals, completions);
}
function runClosedLoop(scenario, repeat) {
  const serviceRng = rng(400000 + repeat * 131 + scenario.targetRps);
  const pauseRng = rng(300000 + repeat * 173 + scenario.pauseDurationMs);
  const initRng = rng(500000 + repeat * 197 + scenario.targetRps);
  const meanThink = Math.max(0, (config.workers * 1000 / scenario.targetRps) - config.baseServiceMeanMs);
  const clients = Array.from({ length: config.workers }, (_, id) => ({ id, next: initRng() * 1000 / scenario.targetRps }));
  const pauses = pausesFor(scenario, pauseRng);
  const arrivals = [], completions = [], latencies = [];
  let serverFree = 0;
  while (true) {
    clients.sort((a, b) => a.next - b.next || a.id - b.id);
    const client = clients[0];
    const arrival = client.next;
    if (arrival >= config.durationSeconds * 1000) break;
    const start = Math.max(arrival, serverFree);
    const done = completeAfterPauses(start, serviceMs(serviceRng), pauses);
    serverFree = done;
    arrivals.push(arrival);
    completions.push(done);
    latencies.push(done - arrival);
    client.next = done + meanThink;
  }
  const warm = config.warmupSeconds * 1000;
  const corrected = [];
  const expectedInterval = 1000 / scenario.targetRps;
  for (let i = 0; i < latencies.length; i++) {
    if (arrivals[i] < warm || arrivals[i] >= config.durationSeconds * 1000) continue;
    const latency = latencies[i];
    corrected.push(latency);
    for (let missing = latency - expectedInterval; missing > expectedInterval; missing -= expectedInterval) corrected.push(missing);
  }
  return summarize("closed_loop", scenario, latencies, arrivals, completions, corrected);
}

const rows = [];
for (const scenario of config.scenarios) {
  for (let repeat = 1; repeat <= config.repeats; repeat++) {
    rows.push({ repeat, ...runOpenLoop(scenario, repeat) });
    rows.push({ repeat, ...runClosedLoop(scenario, repeat) });
  }
}

function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function median(xs) { return quantile(xs, 0.5); }
function pairedBootstrap(deltas, seed) {
  const r = rng(seed);
  const draws = [];
  for (let b = 0; b < config.bootstrapSamples; b++) {
    let sum = 0;
    for (let i = 0; i < deltas.length; i++) sum += deltas[Math.floor(r() * deltas.length)];
    draws.push(sum / deltas.length);
  }
  return { mean: mean(deltas), low: quantile(draws, 0.025), high: quantile(draws, 0.975) };
}

const aggregates = [];
for (const scenario of config.scenarios) {
  const open = rows.filter(r => r.scenario === scenario.id && r.mode === "open_loop");
  const closed = rows.filter(r => r.scenario === scenario.id && r.mode === "closed_loop");
  const byRepeat = new Map(open.map(r => [r.repeat, r]));
  const p99Deltas = closed.map(r => r.p99_ms - byRepeat.get(r.repeat).p99_ms);
  const correctedDeltas = closed.map(r => r.corrected_p99_ms - byRepeat.get(r.repeat).p99_ms);
  aggregates.push({
    scenario: scenario.id,
    repeats: config.repeats,
    open_loop: {
      median_achieved_rps: median(open.map(r => r.achieved_rps)),
      median_p95_ms: median(open.map(r => r.p95_ms)),
      median_p99_ms: median(open.map(r => r.p99_ms)),
      slo_pass_rate: mean(open.map(r => Number(r.slo_pass)))
    },
    closed_loop: {
      median_achieved_rps: median(closed.map(r => r.achieved_rps)),
      median_p95_ms: median(closed.map(r => r.p95_ms)),
      median_p99_ms: median(closed.map(r => r.p99_ms)),
      median_corrected_p99_ms: median(closed.map(r => r.corrected_p99_ms)),
      slo_pass_rate: mean(closed.map(r => Number(r.slo_pass)))
    },
    paired_closed_minus_open_p99_ms: pairedBootstrap(p99Deltas, 700000 + scenario.targetRps + scenario.pauseDurationMs),
    paired_corrected_minus_open_p99_ms: pairedBootstrap(correctedDeltas, 800000 + scenario.targetRps + scenario.pauseDurationMs)
  });
}

const csvFields = Object.keys(rows[0]);
const csv = [csvFields.join(","), ...rows.map(row => csvFields.map(k => row[k] ?? "").join(","))].join("\n") + "\n";
fs.writeFileSync(new URL("repeat-metrics.csv", out), csv);
fs.writeFileSync(new URL("aggregate-results.json", out), JSON.stringify({ config, aggregates }, null, 2) + "\n");

const claims = ["scenario,open_p99_ms,closed_p99_ms,corrected_p99_ms,open_slo_pass_rate,closed_slo_pass_rate,open_rps,closed_rps"];
for (const a of aggregates) claims.push([a.scenario,a.open_loop.median_p99_ms,a.closed_loop.median_p99_ms,a.closed_loop.median_corrected_p99_ms,a.open_loop.slo_pass_rate,a.closed_loop.slo_pass_rate,a.open_loop.median_achieved_rps,a.closed_loop.median_achieved_rps].join(","));
fs.writeFileSync(new URL("claim-table.csv", out), claims.join("\n") + "\n");

const focal = aggregates.filter(a => a.scenario.includes("bursty"));
const bars = focal.flatMap((a, i) => {
  const x = 150 + i * 380;
  const vals = [a.open_loop.median_p99_ms, a.closed_loop.median_p99_ms, a.closed_loop.median_corrected_p99_ms];
  const colors = ["#ff7a5c", "#4ecdc4", "#a78bfa"];
  return vals.map((v, j) => `<g><rect x="${x + j * 74}" y="${430 - Math.min(330, v * 0.55)}" width="52" height="${Math.min(330, v * 0.55)}" rx="4" fill="${colors[j]}"/><text x="${x + j * 74 + 26}" y="${414 - Math.min(330, v * 0.55)}" text-anchor="middle" class="value">${v.toFixed(0)}</text></g>`).join("") + `<text x="${x + 100}" y="470" text-anchor="middle" class="label">${a.scenario.replaceAll("-", " ")}</text>`;
}).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" data-visual-quality="publication" data-text-fit="bounded" role="img" aria-labelledby="title desc"><title id="title">Coordinated omission changes measured p99 latency</title><desc id="desc">Grouped bars compare open-loop, naive closed-loop, and corrected closed-loop p99 latency under bursty server pauses at 80 and 100 requests per second.</desc><style>.bg{fill:#0b1020}.title{font:700 26px Georgia,serif;fill:#f8fafc}.sub{font:15px Georgia,serif;fill:#bac7dc}.label{font:14px Georgia,serif;fill:#dbe5f3}.value{font:700 13px ui-monospace,monospace;fill:#f8fafc}.axis{stroke:#60708f;stroke-width:1}.tick{font:12px ui-monospace,monospace;fill:#93a4bd}</style><rect class="bg" width="960" height="540"/><text x="48" y="52" class="title">A quiet load generator can hide a loud queue</text><text x="48" y="80" class="sub">Median p99 across ${config.repeats} repeats; milliseconds; lower is better</text><line x1="90" y1="430" x2="900" y2="430" class="axis"/><line x1="90" y1="100" x2="90" y2="430" class="axis"/><line x1="90" y1="375" x2="900" y2="375" class="axis" stroke-dasharray="4 6"/><text x="80" y="379" text-anchor="end" class="tick">100</text>${bars}<g transform="translate(120 505)"><rect width="14" height="14" fill="#ff7a5c"/><text x="22" y="12" class="label">open loop</text><rect x="160" width="14" height="14" fill="#4ecdc4"/><text x="182" y="12" class="label">closed loop</text><rect x="330" width="14" height="14" fill="#a78bfa"/><text x="352" y="12" class="label">closed + interval correction</text></g></svg>`;
fs.writeFileSync(new URL("coordinated-omission-p99.svg", out), svg);

const hashes = {};
for (const name of ["repeat-metrics.csv", "aggregate-results.json", "claim-table.csv", "coordinated-omission-p99.svg"]) {
  hashes[name] = crypto.createHash("sha256").update(fs.readFileSync(new URL(name, out))).digest("hex");
}
fs.writeFileSync(new URL("sha256.json", out), JSON.stringify(hashes, null, 2) + "\n");
console.log(JSON.stringify(aggregates, null, 2));
