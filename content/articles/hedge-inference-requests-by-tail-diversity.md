---
title: Hedge Inference Requests Only When Tail Diversity Pays
description: Use matched queueing evidence to decide when duplicate inference requests cut tail latency and when they create congestion instead.
topic: Inference Reliability
level: Advanced
date: 2026-07-31
readingTime: 24
tags: inference-serving, tail-latency, request-hedging, queueing, reliability, capacity-planning
image: /content/v1/assets/hedged-request-load-boundary.svg
imageAlt: Grouped result chart comparing p95 latency for fixed and queue-capped request hedging across moderate load, correlated tails, and a no-tail control
evidenceMode: experiment
qualityTier: deep-research
evidenceProject: operator/diy-project-blogs/projects/hedged-request-load-audit
evidenceManifest: operator/diy-project-blogs/projects/hedged-request-load-audit/evidence-manifest.json
---

Request hedging races a slow inference call against a second copy and returns the first acceptable result. It is attractive because it attacks the latency tail without changing the model. It is dangerous because the duplicate enters the same capacity system whose queue may already be causing the delay.

The decisive variable is not the hedge timer alone. It is **tail diversity**: the probability that a second copy escapes the condition slowing the primary. When slow service is rare and copy-specific, a hedge can cancel a long job early enough to reduce both latency and consumed work. When the service has no escapable tail, the same policy duplicates ordinary requests, expands queues, and makes p95 worse.

A matched discrete-event study makes that boundary concrete. Across 320 repeats of 1,600 requests, a fixed 250 ms hedge reduced moderate-load p95 from 1.464 seconds to 0.422 seconds. In a near-capacity correlated-tail cell it still improved p95 from 4.883 to 3.695 seconds, contrary to the preregistered expectation, but increased maximum queue depth from 9.1 to 17.8. In the no-tail negative control, the hedge raised p95 from 0.690 to 1.721 seconds and increased work by 0.025 seconds per logical request.

The engineering decision is therefore conditional: hedge only an idempotent, cancelable route whose traces demonstrate an escapable tail, and stop admitting duplicates when queue pressure or hedge yield crosses a declared boundary.

## Hypothesis and Decision Question

The preregistered hypothesis had two parts. First, a 250 ms hedge would reduce p95 under moderate independent tails. Second, the same fixed policy would reverse near capacity, especially when 80% of slow events were shared between copies; a queue-capped hedge would limit the amplification.

The first part was supported. The strongest version of the second was falsified. Correlation reduced the value of the second copy and doubled peak queue depth, but did not reverse p95 at the tested load. The reversal appeared only in the no-tail control, where the second copy had no rare slowdown to escape.

That negative result changes the decision question. A useful release gate should not ask, “Did hedging lower p95 in one load test?” It should ask:

1. What fraction of hedges win, and which delay components do they escape?
2. How much additional—or avoided—service work does each logical request create?
3. What happens to queue depth and completion under a matched high-load cell?
4. Does a no-tail or low-diversity control show that ordinary requests are being duplicated?
5. Can the system cancel losing copies before expensive generation continues?

The classic [Tail at Scale paper](https://research.google/pubs/the-tail-at-scale/) explains why rare component delays dominate large fan-out systems. [When to Hedge in Interactive Services](https://www.usenix.org/conference/nsdi21/presentation/primorac) adds the crucial warning: redundancy can create congestion more harmful than the hiccups it masks. The present study does not supersede those production and analytical results. It isolates a small inference-serving mechanism with explicit cancellation, queueing, load, and correlation controls.

## Methodology

The simulator represents eight first-come, first-served workers. Logical requests arrive as a Poisson process and join the shortest active queue. Each request has a primary service demand and one potential copy demand. Body service is lognormal with a 0.18 second median and 0.45 log-space sigma. Tail service has a 2.4 second median, 0.40 sigma, and a five-percent base probability.

Four policies receive exactly the same arrival and service trace inside a repeat:

- no hedge;
- a fixed hedge after 250 ms;
- a fixed hedge after 500 ms;
- a 250 ms hedge admitted only when the selected destination has fewer than two active jobs.

When either copy finishes, its logical request completes and queued or running losing copies are canceled. The simulator charges every worker-second consumed before cancellation. It records completion by an eight-second deadline, p50, p95, p99, work per logical request, hedge rate, hedge win rate, maximum queue depth, and queued cancellations.

The four scenarios separate load and tail structure. `moderate_independent` runs at 12 requests per second. `near_capacity_independent`, `near_capacity_correlated`, and `no_tail_control` use scenario-specific arrival rates so the no-hedge baseline offers approximately seven worker-seconds of service per wall second to an eight-worker system. This load matching matters: an exploratory screen reused one arrival rate, but shared tails changed mean service demand and made baseline utilization incomparable. Those screening results were rejected before confirmatory interpretation.

The generator creates a matched trace before any policy runs:

```javascript
function generateTrace(scenario, repeat) {
  const rng = mulberry32(seedFor(scenario, repeat));
  const spec = scenarios[scenario];
  const rows = [];
  let arrival = 0;

  for (let id = 0; id < requestsPerRepeat; id += 1) {
    arrival += -Math.log(Math.max(rng(), Number.EPSILON))
      / spec.arrivalRate;
    const sharedTail = rng() < spec.tailProbability
      && rng() < spec.sharedTailProbability;
    const demands = [];

    for (let copy = 0; copy < 2; copy += 1) {
      const tail = sharedTail
        || (rng() < spec.tailProbability && !sharedTail);
      demands.push(sampleService(rng, tail));
    }
    rows.push({id, arrival, demands});
  }
  return rows;
}
```

This is a controlled mechanism study, not a fitted provider model. It uses no production traces, accelerator, tokenizer, model server, or provider endpoint. The scale is 320 repeats × 1,600 requests × four scenarios × four policies: 8,192,000 logical policy-request observations. Uncertainty comes from paired bootstrap intervals over repeat-level differences, using 5,000 resamples.

## Baselines and Controls

The no-hedge policy is the matched baseline. It uses the same join-shortest-queue placement as the treatments, so the comparison does not attribute better load balancing to hedging. The 500 ms policy is a timing baseline: it sends fewer duplicates but may wait too long to escape a tail.

The no-tail control is the most important falsification cell. It preserves high baseline utilization while removing the rare long component. If hedging still helps there, the result cannot be explained by escaping stragglers. It did not help.

The correlated-tail stress tests whether two copies share a slowdown. A shared event applies the tail state to both service draws. This is deliberately harsher than independent replicas, but it is not a complete model of shared GPU saturation, network congestion, prompt length, cache state, or common model behavior.

The queue-cap ablation changes duplicate admission without changing the 250 ms timer. It is intentionally simple. It is not claimed as an optimal controller; it tests whether a visible capacity boundary can trade some latency gain for much smaller queue amplification.

The cancellation path is explicit:

```javascript
for (const queue of queues) {
  while (queue.length && requests[queue[0].id].done) {
    queue.shift();
    canceledQueued += 1;
  }
  if (!queue.length) continue;

  const job = queue[0];
  const consumed = Math.min(tickSeconds, job.remaining);
  job.remaining -= consumed;
  workerSeconds += consumed;

  if (job.remaining <= 1e-12) {
    queue.shift();
    const request = requests[job.id];
    if (!request.done) {
      request.done = true;
      request.completion = now + consumed;
      request.winner = job.copy;
    }
  }
}
```

Real inference cancellation is often weaker. A client may stop reading while the server continues decoding. A proxy may cancel an HTTP stream without freeing an accelerator slot immediately. A provider may bill both attempts. The public decision must therefore use server-side consumed work and billed tokens, not client-observed cancellation alone.

## Results

The primary table reports mean repeat-level outcomes. P95 is deadline-aware: requests not completed within eight seconds contribute eight seconds rather than disappearing from the latency sample. Its interpretation follows the congestion boundary documented by [When to Hedge in Interactive Services](https://www.usenix.org/conference/nsdi21/presentation/primorac); the numbers themselves come from the saved matched run.

| Scenario and policy | Completion | p95 latency | p99 latency | Work/request | Hedge rate | Max queue |
|---|---:|---:|---:|---:|---:|---:|
| Moderate, no hedge | 99.99% | 1.464 s | 3.474 s | 0.320 s | 0.0% | 2.2 |
| Moderate, fixed 250 ms | 100.00% | 0.422 s | 0.567 s | 0.244 s | 27.8% | 2.1 |
| Moderate, queue-capped 250 ms | 100.00% | 0.422 s | 0.566 s | 0.244 s | 27.8% | 2.0 |
| Near-capacity correlated, no hedge | 98.73% | 4.883 s | 6.734 s | 0.410 s | 0.0% | 9.1 |
| Near-capacity correlated, fixed 250 ms | 99.49% | 3.695 s | 4.833 s | 0.408 s | 78.9% | 17.8 |
| Near-capacity correlated, queue-capped 250 ms | 98.91% | 4.539 s | 6.454 s | 0.407 s | 22.7% | 8.8 |
| No-tail control, no hedge | 100.00% | 0.690 s | 0.900 s | 0.199 s | 0.0% | 4.3 |
| No-tail control, fixed 250 ms | 100.00% | 1.721 s | 1.937 s | 0.225 s | 87.5% | 15.7 |
| No-tail control, queue-capped 250 ms | 100.00% | 0.784 s | 1.002 s | 0.213 s | 31.1% | 4.7 |

The moderate result is not simply “more calls buy speed.” Fixed 250 ms hedging reduced mean work by 0.0766 worker-seconds per request because a fast copy often canceled a long primary. That behavior requires genuine copy diversity and prompt cancellation. Without both, duplicate work will not disappear.

The correlated cell is the negative result. The fixed hedge sent a copy for 78.9% of requests and added 8.69 jobs to maximum queue depth, yet p95 still improved by 1.188 seconds. The simple queue cap kept maximum depth slightly below baseline and reduced work by 0.0031 seconds, but retained only a 0.345-second p95 improvement. Capacity protection has a visible opportunity cost.

The no-tail cell supplies the causal boundary. A 250 ms timer fired on 87.5% of logical requests even though there was no rare long-service component to escape. Work increased 12.7%, maximum queue depth increased from 4.3 to 15.7, and p95 worsened by 1.032 seconds. A later 500 ms hedge was less damaging—0.793 seconds p95 and 22.1% hedge rate—but still did not improve the baseline.

Representative measured output is:

```output
moderate/no_hedge p95=1.464s work=0.320s max_queue=2.2
moderate/fixed_250ms p95=0.422s work=0.244s max_queue=2.1
correlated/no_hedge completion=98.73% p95=4.883s
correlated/fixed_250ms completion=99.49% p95=3.695s
correlated/fixed_250ms hedge=78.9% max_queue=17.8
correlated/queue_capped p95=4.539s max_queue=8.8
no_tail/no_hedge p95=0.690s work=0.199s
no_tail/fixed_250ms p95=1.721s work=0.225s
no_tail/fixed_250ms hedge=87.5% max_queue=15.7
```

## Statistical Analysis and Uncertainty

All intervals are paired across repeats. Each treatment-minus-baseline delta uses the same generated arrivals and service demands within a repeat. That removes much of the between-trace noise without pretending individual requests are independent experimental replicates.

| Scenario, fixed 250 ms minus no hedge | Mean delta | Paired 95% bootstrap interval |
|---|---:|---:|
| Moderate p95 | -1.042 s | [-1.083, -1.000] |
| Moderate work/request | -0.0766 s | [-0.0780, -0.0752] |
| Correlated p95 | -1.188 s | [-1.324, -1.055] |
| Correlated completion | +0.767 pp | [+0.474, +1.029] pp |
| Correlated maximum queue | +8.69 | [+8.07, +9.32] |
| No-tail p95 | +1.032 s | [+0.963, +1.101] |
| No-tail work/request | +0.0254 s | [+0.0251, +0.0256] |
| No-tail maximum queue | +11.45 | [+10.81, +12.09] |

The bootstrap code resamples repeat-level paired deltas:

```javascript
function pairedBootstrap(deltas, samples, seed) {
  const rng = mulberry32(seed);
  const estimates = [];

  for (let b = 0; b < samples; b += 1) {
    let total = 0;
    for (let i = 0; i < deltas.length; i += 1) {
      total += deltas[Math.floor(rng() * deltas.length)];
    }
    estimates.push(total / deltas.length);
  }

  return {
    mean: mean(deltas),
    ciLow: quantile(estimates, 0.025),
    ciHigh: quantile(estimates, 0.975)
  };
}
```

These intervals quantify Monte Carlo uncertainty under the generator. They do not cover uncertainty about the generator itself. Changing request lengths, batching, replica placement, cancellation lag, token streaming, or the slow-event process could move the decision boundary substantially.

## Failure Analysis

The first failure mode is correlated placement. Two provider aliases may land on the same accelerator pool, availability zone, cache tier, or overloaded dependency. A “second endpoint” is not evidence of independent failure domains. Record destination identity and measure conditional hedge win rate by incident class.

The second is non-cancelable generation. gRPC describes hedging as racing copies and canceling the remaining attempts, but protocol cancellation is not proof that the backend stopped computing. [Envoy's hedging documentation](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/http/http_routing.html) notes that its hedge can leave the original timed-out request active while awaiting the first good response. For inference, observe server tokens, active slots, and billing on losing attempts.

The third is side effects. Hedging a read-only embedding request is different from hedging an agent tool call, a payment, or a write to memory. Amazon's guidance on [timeouts, retries, and jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/) emphasizes that a timeout does not mean a side effect did not occur. Require an idempotency key or a single-commit arbiter before any duplicated route can mutate state.

The fourth is threshold feedback. Apache Cassandra warns that percentile-based [speculative retry](https://cassandra.apache.org/doc/latest/cassandra/developing/cql/ddl.html) can backfire when an unavailable host raises the percentile used to trigger speculation. A rolling threshold can also collapse if it measures only time to headers while expensive decoding happens later. Pin the latency phase being controlled: queue wait, time to first token, inter-token gap, or full completion.

The fifth is fleet-wide synchronization. A fixed 250 ms timer can create a duplicate wave at exactly 250 ms during a shared slowdown. Add jitter, a global hedge token budget, and per-destination admission. Queue-capping is only one possible controller.

## Production Readiness and Release Gate

Run a shadow experiment on replayable, side-effect-free traffic before enabling duplicates. Stratify by prompt length, output length, model, cache hit, region, and load. Preserve the no-hedge control and randomize logical requests between policies so a traffic shift cannot masquerade as a hedge benefit.

Promote only if all of these hold for the intended route:

- deadline-aware p95 or p99 improves by the preregistered margin;
- completion does not regress;
- billed tokens and server work per accepted result remain within budget;
- maximum or high-percentile queue depth stays inside the saturation envelope;
- hedge win rate remains above a minimum that justifies duplicate traffic;
- severe side effects remain exactly zero;
- the effect persists in an incident or injected-tail cell, not only steady state.

Make tail diversity a tested factor rather than an intuition. Run a 2×2 screen
that crosses copy placement (same failure pool versus demonstrably separate
pool) with cancellation (client-only versus verified server stop). Repeat that
screen under natural traffic and an injected copy-specific delay. The hedge is
eligible only if the separate-pool cell increases hedge wins without a
corresponding rise in losing-copy server work. This design distinguishes
diversity from the simpler explanation that a second request merely received a
better queue position.

Publish the four cells even when one is unfavorable. If only the injected-tail
cell improves, retain hedging as an incident tool rather than an always-on
policy. If client cancellation improves latency but server work does not fall,
budget the route as duplicate inference even though the user sees one answer.

Throttle or disable hedging when queue depth, active generation slots, or recent hedge rate crosses its cap. Roll back if the p95 gain disappears for two consecutive windows, work per accepted result rises more than 10%, or a shared-failure incident pushes duplicate rate above the tested envelope.

Do not use one global timer. A short extraction route and a long reasoning route have different time-to-first-token and completion distributions. Learn thresholds from each route's controlled traces, then freeze them for a canary window. Adaptive controllers must themselves be versioned and evaluated.

## Reproducibility

The saved evidence includes the configuration, runner, 5,120 repeat-policy rows, aggregate results, bootstrap analysis, focal text output, and the result figure. The study is dependency-free and deterministic under Node.js.

```sh
node run-experiment.mjs
node render-figure.mjs
sha256sum config.json repeat-results.csv aggregate-results.json
```

Expected scale and focal deltas are:

```output
repeats=320
requests_per_repeat=1600
workers=8
repeat_policy_rows=5120
bootstrap_samples=5000
moderate_fixed_250_p95_delta_seconds=-1.042
correlated_fixed_250_max_queue_delta=+8.69
no_tail_fixed_250_p95_delta_seconds=+1.032
```

Reproduction validates the declared simulation, not external validity. A production replication must replace generated service demands with server-side traces, preserve copy placement, record losing-copy compute, and predeclare route-level acceptance thresholds.

## Limitations and Claim Boundary

The simulator uses FCFS workers and 10 ms time steps. It omits continuous batching, prefill/decode separation, KV-cache reuse, prompt-dependent work, streaming acceptance, network retries, autoscaling, priority classes, heterogeneous accelerators, and provider rate limits. Join-shortest-queue placement has instantaneous queue visibility that real routers may not possess.

The correlated-tail generator shares a binary slow state but still draws separate durations. It cannot establish the effect of a regional outage or a fleet-wide model-server regression. The queue cap of two is an ablation, not an optimized value. The eight-second deadline is a declared study boundary, not a recommendation.

The supported claim is narrow: under the declared mechanism, fixed hedging produced large gains when copies could escape rare slow work, remained beneficial but queue-expensive under the tested correlated stress, and became harmful when the tail was removed. The evidence does not prove that hedging improves any named inference service or that queue-capped 250 ms is a universal policy.

## Claim Boundary and Decision

Hedging is not a latency switch. It is a capacity allocation policy whose return depends on diversity, cancellation, and load.

Use it when server traces show rare, escapable slow work; losing attempts can be stopped; the operation is idempotent; and a capacity gate can suppress duplicates during shared stress. Do not use it merely because p99 is high. First determine whether the tail comes from copy-specific stragglers or from ordinary queueing, long prompts, shared saturation, and non-cancelable decoding.

The result to carry into design review is not the 1.042-second moderate-load gain. It is the contrast with the no-tail control: the same timer that looked efficient under diversity tripled peak queue depth and more than doubled the p95 penalty when there was nothing useful to race around.

## Sources

- [The Tail at Scale](https://research.google/pubs/the-tail-at-scale/), Google Research / Communications of the ACM, 2013.
- [Tales of the Tail](https://research.google/pubs/tales-of-the-tail-hardware-os-and-application-level-sources-of-tail-latency/), Google Research / ACM SoCC, 2014.
- [When to Hedge in Interactive Services](https://www.usenix.org/conference/nsdi21/presentation/primorac), USENIX NSDI, 2021.
- [gRPC request hedging guide](https://grpc.io/docs/guides/request-hedging/), current protocol documentation.
- [Envoy request hedging](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/http/http_routing.html), current proxy documentation.
- [Apache Cassandra speculative retry](https://cassandra.apache.org/doc/latest/cassandra/developing/cql/ddl.html), current database documentation.
- [Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/), Amazon Builders' Library.
- [Reducing Tail Latency via Safe and Simple Duplication](https://arxiv.org/abs/1905.13352), analytical duplication study.
