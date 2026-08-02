---
title: Measure Inference Tail Latency Without Coordinated Omission
description: Use open-loop arrivals, achieved-load checks, and interval correction so an inference load test cannot hide backlog during service stalls.
topic: Inference Performance Evaluation
level: Advanced
date: 2026-08-01
readingTime: 25
tags: inference-serving, load-testing, tail-latency, coordinated-omission, performance-engineering, capacity-planning
image: /content/v1/assets/coordinated-omission-inference-p99.svg
imageAlt: Grouped bars comparing open-loop, closed-loop, and interval-corrected p99 latency under bursty service pauses at 80 and 100 requests per second
evidenceMode: experiment
qualityTier: deep-research
evidenceProject: operator/diy-project-blogs/projects/coordinated-omission-inference-audit
evidenceManifest: operator/diy-project-blogs/projects/coordinated-omission-inference-audit/evidence-manifest.json
---

A load generator can become polite at exactly the wrong moment. A fixed set of virtual users sends requests, waits for responses, and sends again. When an inference server stalls, those users wait too. The offered load falls, arrivals that production would have sent never enter the queue, and the reported latency distribution describes the requests that survived the feedback loop—not the workload the capacity plan promised to test.

That bias is coordinated omission. It is especially dangerous for model serving because pauses can come from allocator pressure, cache misses, model reloads, runtime synchronization, long-prefill interference, or a saturated downstream tool. A healthy-looking p99 can therefore be evidence that the driver stopped asking hard questions.

A controlled discrete-event study makes the decision error concrete. With matched pacing at a nominal 80 requests per second and an 800 ms global pause every 20 seconds, the open-loop median p99 was 752 ms across 320 repeats. The naive closed-loop median was 41 ms while achieved load fell to 76.56 requests per second. An expected-interval correction reconstructed 772 ms. Both drivers passed the no-pause control, although their p99 values differed modestly at 21 and 28 ms.

The preregistered claim was stronger and failed: naive closed-loop was expected to falsely pass a 100 ms p99 SLO in at least 75% of repeats. It falsely passed in 57.5%. That negative result matters. The study supports a large median ranking error and a frequent false release decision, not the claimed three-in-four rate and not a universal correction guarantee.

## Finding and Decision Summary

Do not accept an inference load test from its latency histogram alone. Require the intended arrival schedule, issued and completed request counts, achieved requests per second, queue or admission evidence, and latency from the time each request **should have arrived**. Use an open-loop or scheduled-arrival driver for capacity tests. If a blocking protocol forces a closed loop, report its throughput collapse and use interval correction only as a diagnostic.

The focal results are generated locally from the saved repeat table. Values are medians across 320 independent repeat seeds; confidence intervals below are paired bootstrap intervals over repeat-level p99 differences. Source: [scheduled-arrival semantics in `wrk2`](https://github.com/giltene/wrk2); the numeric rows are produced by the reproducible simulator described below.

| Scenario and nominal load | Open-loop p99 / achieved load | Naive closed-loop p99 / achieved load | Interval-corrected p99 | Release consequence |
|---|---:|---:|---:|---|
| No pause, 80 rps | 21.45 ms / 80.00 rps | 28.39 ms / 79.10 rps | 28.49 ms | Both pass 100 ms; negative control |
| 400 ms pause every 20 s, 80 rps | 353.21 ms / 80.00 rps | 42.88 ms / 77.82 rps | 376.66 ms | Naive method passes in 53.44% of repeats; open loop never passes |
| 800 ms pause every 20 s, 80 rps | 751.55 ms / 80.00 rps | 41.33 ms / 76.56 rps | 772.18 ms | Naive method passes in 57.50%; open loop never passes |
| 800 ms pause every 20 s, 100 rps | 795.48 ms / 100.00 rps | 47.37 ms / 93.66 rps | 787.13 ms | Naive method passes in 58.13%; open loop never passes |

The engineering decision is not “always trust the corrected number.” It is “never call two runs equivalent when one stopped issuing the scheduled work.” The corrected histogram recovered the focal open-loop p99 within 20.6 ms at 80 rps and within 8.4 ms at 100 rps, but it is synthetic and depends on a defensible expected interval.

## Methodology

The study models one first-come, first-served service lane for 60 seconds with a 10-second warm-up. Base service demand is lognormal with a 9 ms mean and log-space sigma 0.35. The closed-loop driver has 16 workers. Its think time is calibrated from the nominal target rate and base service mean. The open-loop driver issues evenly paced requests at 80 or 100 requests per second, independent of completions.

Global pauses stop service progress. Three confirmatory pause cells use 400 or 800 ms pauses every 20 seconds with a repeat-specific phase jitter. A no-pause 80 rps cell is the negative control. Each of the four scenario cells has 320 independent repeats for both measurement modes, producing 2,560 repeat-mode rows. Paired bootstrap intervals use 5,000 resamples.

This is mechanism evidence, not a model benchmark. No model, network service, Torch runtime, GPU, or accelerator is used. The simulated hardware boundary is a single abstract service lane. That choice isolates the arrival-feedback mechanism and prevents claims about a named inference stack.

The open-loop generator preserves scheduled work regardless of response time:

```javascript
function runOpenLoop(scenario, repeat) {
  const serviceRng = rng(200000 + repeat * 131 + scenario.targetRps);
  const pauseRng = rng(300000 + repeat * 173 + scenario.pauseDurationMs);
  const arrivals = [];
  const interval = 1000 / scenario.targetRps;
  const phase = rng(100000 + repeat * 97 + scenario.targetRps)() * interval;

  for (let t = phase; t < durationMs; t += interval) arrivals.push(t);

  const pauses = pausesFor(scenario, pauseRng);
  const latencies = [];
  let serverFree = 0;
  for (const arrival of arrivals) {
    const start = Math.max(arrival, serverFree);
    const done = completeAfterPauses(start, serviceMs(serviceRng), pauses);
    serverFree = done;
    latencies.push(done - arrival);
  }
  return summarize("open_loop", scenario, latencies, arrivals);
}
```

The closed-loop driver exposes the feedback. A worker cannot issue its next request until its current response completes and the calibrated think time elapses:

```javascript
function runClosedLoop(scenario, repeat) {
  const clients = makeClients(16, repeat, scenario.targetRps);
  const meanThink = Math.max(
    0,
    (16 * 1000 / scenario.targetRps) - baseServiceMeanMs
  );
  const arrivals = [];
  const latencies = [];
  let serverFree = 0;

  while (true) {
    clients.sort((a, b) => a.next - b.next || a.id - b.id);
    const client = clients[0];
    if (client.next >= durationMs) break;

    const arrival = client.next;
    const start = Math.max(arrival, serverFree);
    const done = completeAfterPauses(start, serviceMs(serviceRng), pauses);
    serverFree = done;
    arrivals.push(arrival);
    latencies.push(done - arrival);
    client.next = done + meanThink;
  }
  return { arrivals, latencies };
}
```

That loop is valid for modeling a population of interactive users. It is invalid as proof that a service sustains a fixed external arrival rate, because the achieved rate is partly determined by the service response time.

## Baselines and Controls

The primary baseline is the scheduled open-loop arrival stream. The treatment is the fixed-population closed loop at the same nominal rate. Expected-interval correction is a diagnostic ablation, not a ground-truth baseline. It inserts the waiting observations that would have occurred at each nominal interval while a measured request remained outstanding:

```javascript
function correctHistogram(latencies, arrivals, expectedInterval, warmup, end) {
  const corrected = [];
  for (let i = 0; i < latencies.length; i++) {
    if (arrivals[i] < warmup || arrivals[i] >= end) continue;
    const latency = latencies[i];
    corrected.push(latency);

    for (
      let missing = latency - expectedInterval;
      missing > expectedInterval;
      missing -= expectedInterval
    ) {
      corrected.push(missing);
    }
  }
  return corrected;
}
```

The no-pause control checks that the test does not manufacture a release disagreement in an ordinary low-latency regime. Both methods passed the 100 ms SLO in every repeat. The remaining 6.89 ms mean p99 difference, with a paired 95% interval of 6.72 to 7.06 ms, is a scope warning: fixed client populations and scheduled arrivals are not identical traffic distributions even after nominal pacing is aligned.

The 400 ms pause cell is an amplitude ablation. It tests whether the effect appears only with the longer 800 ms disruption. It does not: median naive p99 remained 42.88 ms while open-loop reached 353.21 ms. The 100 rps cell is a utilization ablation. Closed-loop achieved load fell 6.34 rps below target, and its naive p99 remained below 50 ms even while open-loop approached 800 ms.

An initial exploratory screen used Poisson open-loop arrivals against nearly regular closed-loop traffic. The no-pause control diverged sharply because arrival shape, not just feedback, changed queueing. Those outputs are retained separately and excluded from confirmatory claims. The final design locks evenly paced arrivals to remove that confound.

## Results

The focal 80 rps pause cell produced an 18.2-fold median p99 ratio: 751.55 ms open-loop versus 41.33 ms naive closed-loop. The paired closed-minus-open p99 difference averaged -404.40 ms, with a 95% bootstrap interval from -442.69 to -366.96 ms. The wide gap between the difference in medians and the mean paired difference reflects repeat-level mixtures: pause phase relative to the measurement window determines whether the naive p99 includes one of the bounded set of stalled client requests.

```output
scenario=bursty-pause-80 repeats=320
open_loop median_p95_ms=478.393 median_p99_ms=751.554 achieved_rps=80.000
closed_loop median_p95_ms=22.661 median_p99_ms=41.330 achieved_rps=76.560
closed_loop corrected_p99_ms=772.177
paired closed-minus-open p99 mean=-404.399 ms 95%CI=[-442.693,-366.959]
open_loop_slo_pass_rate=0.000 closed_loop_slo_pass_rate=0.575
```

The p95 is even more visually deceptive: 22.66 ms closed-loop versus 478.39 ms open-loop in the focal cell. That is expected because at most 16 virtual users can be outstanding in the closed loop. Once they are all waiting, no more observations are created until the service resumes. Production arrivals do not necessarily share that cap.

At 100 rps, the naive median p99 was 47.37 ms and the open-loop value was 795.48 ms. Interval correction returned 787.13 ms, with a paired corrected-minus-open mean of -8.07 ms and 95% interval from -9.54 to -6.60 ms. The corrected statistic is close in this mechanism because the missing schedule is regular and known.

```output
scenario=bursty-pause-100 repeats=320
open_loop median_p99_ms=795.484 achieved_rps=100.000 slo_pass_rate=0.0000
closed_loop median_p99_ms=47.374 achieved_rps=93.660 slo_pass_rate=0.5813
corrected median_p99_ms=787.129
paired corrected-minus-open p99 mean=-8.068 ms 95%CI=[-9.541,-6.599]
negative_control open_p99_ms=21.451 closed_p99_ms=28.389 both_pass=1.0000
```

## Statistical Analysis and Uncertainty

Repeats are the unit of analysis. Each repeat shares scenario parameters and pause-generation logic across the two measurement modes, then uses independent service draws to avoid pretending request-level pairing where request counts differ. The paired bootstrap resamples repeat identifiers, preserving the decision-level unit instead of treating thousands of correlated requests as independent.

The central uncertainty is not whether the focal gap is nonzero; its interval is far from zero. It is how often a percentile-based SLO catches the bounded set of slow closed-loop requests. The preregistered 75% false-pass prediction failed. Observed false-pass rates were 53.44%, 57.50%, and 58.13% in the three pause cells. The honest conclusion is that a false release happened in more than half the repeats under this setup, not that it happens at a universal rate.

Interval correction slightly overshot open-loop p99 at 80 rps by a mean 20.55 ms (95% interval 18.90 to 22.19 ms) and undershot at 100 rps by 8.07 ms. It is not an estimator with a general unbiasedness proof here. It works directionally because the scheduled interval is fixed and pauses dominate the tail.

## Failure Analysis and Production Readiness

Three dashboards should be joined before a load test can approve a release.

First, compare scheduled, issued, admitted, completed, timed-out, and canceled request counts by interval. If scheduled work disappears before admission, the latency histogram is conditioned on generator behavior. Second, graph achieved RPS beside p95 and p99. A latency improvement accompanied by falling throughput is not a capacity improvement. Third, retain server-side enqueue, start, first-token, last-token, and cancellation timestamps. Client-only latency cannot separate queue delay from execution or reveal abandoned work.

For token-streaming inference, report time to first token, inter-token gap, time per output token, and end-to-end completion separately. Use prompt-length and output-length strata. A single request latency percentile can move merely because the completion-length mix changed. Preserve admission rejects and deadline expirations in the denominator.

Inject a controlled pause before trusting the harness. A brief process suspension, worker barrier, or synthetic service delay should create a known missing-arrival opportunity. The driver passes this harness test only if scheduled work remains visible, achieved throughput is reported, and the corrected or open-loop distribution reflects the disruption. Red Hat's performance guidance describes this practical stop/resume diagnostic, while `wrk2` documents the scheduled-arrival approach in detail.

Rollback the benchmark configuration—not only the service—if the generator changes its concurrency, pacing, connection reuse, timeout, retry, or histogram semantics. Pin the driver version and command. Keep a small invariant trace whose expected schedule and server completions can be audited by hand.

## Reproducibility

The saved configuration, simulator, 2,560-row repeat table, aggregate JSON, claim table, figure, exploratory screen, and artifact hashes form the evidence chain. A clean reproduction requires a recent Node runtime and no external packages:

```sh
cd coordinated-omission-inference-audit
node run-experiment.mjs
sha256sum artifacts/repeat-metrics.csv artifacts/aggregate-results.json \
  artifacts/claim-table.csv artifacts/coordinated-omission-p99.svg
```

The exact runtime version is not a scientific treatment because the simulator uses only integer-seeded JavaScript arithmetic and standard-library file output, but a reproduction should still record it. Compare aggregate values and artifact hashes, not wall-clock run time.

## Limitations and Error Analysis

The simulator has one FCFS lane. Real model servers batch prefill and decode, schedule tokens, share KV-cache capacity, route across accelerators, and may reject work before queueing. A fixed 16-user population is only one closed-loop design. Real browser, mobile, and agent workloads can have think times, retries, abandonment, and bounded sessions that legitimately create feedback.

The pause schedule is synthetic and globally visible to the service lane. It does not model partial fleet failures, correlated client retries, autoscaler lag, network loss, streaming cancellation, or heterogeneous prompt work. Evenly paced open-loop arrivals are a control, not a claim that production traffic is periodic. A production replay should use a declared non-homogeneous arrival trace and preserve its intended timestamps.

Expected-interval correction cannot recreate content, token length, priority, or routing labels for requests that were never sent. It repairs a histogram under a schedule model; it cannot repair capacity state or per-class fairness. When the intended rate varies, correction requires the original schedule, not one global interval.

Open-loop generators also fail. They can exhaust client sockets, CPU, memory, or connections and then miss their schedule. The University of Illinois study of open-loop generators documents generator-side limitations; Lancet separates workload generation from latency measurement to reduce such interference. Validate the driver machine and record schedule lag.

## Claim Boundary

The supported claim is narrow: in the declared single-lane mechanism, a fixed-worker closed loop suppressed offered work during rare pauses, reduced achieved load, and produced a median p99 that reversed a 100 ms release decision relative to scheduled open-loop arrivals. Expected-interval correction recovered the direction and approximate magnitude in the pause cells.

The evidence does not establish that every closed-loop load test is invalid, that the correction is universally accurate, or that any named inference server has this behavior. It does establish a review burden: a capacity result without an arrival ledger and achieved-load trace is incomplete.

## Engineering Decision

Use closed-loop tests to model a truly closed user population. Use scheduled open-loop tests to answer a fixed-arrival capacity question. Never substitute one question for the other because both commands display “RPS” and “p99.”

For a release gate, require the challenger to sustain the target schedule, remain within generator-lag bounds, meet stratified latency and completion SLOs, and avoid excess admission rejection or cancellation. If the generator falls behind, the run is invalid for capacity approval even when its histogram is green.

## Sources

- [wrk2 constant-throughput and coordinated-omission measurement notes](https://github.com/giltene/wrk2), accessed 2026-08-01.
- [HdrHistogram coordinated omission correction](https://github.com/HdrHistogram/HdrHistogram), current implementation and design documentation.
- [Seldon Core model-serving load testing guidance](https://docs.seldon.ai/seldon-core-2/user-guide/performance-tuning/models/load-testing), accessed 2026-08-01.
- [Lancet: A Self-Correcting Latency Measuring Tool](https://www.usenix.org/conference/atc19/presentation/kogias), USENIX ATC 2019.
- [An empirical study of open-loop load generators](https://hdl.handle.net/2142/129222), University of Illinois, 2025.
- [The Tail at Scale](https://research.google/pubs/the-tail-at-scale/), Google Research / Communications of the ACM, 2013.
- [Coordinated Omission benchmark-design guidance](https://redhatperf.github.io/post/coordinated-omission/), Red Hat Performance and Scale, accessed 2026-08-01.
- [Load Testing for Machine Learning Model Serving Systems at Scale](https://arxiv.org/abs/2606.22013), arXiv, 2026.
