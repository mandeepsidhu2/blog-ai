---
title: Route Prefix Caches With Queue Slack, Not Strict Affinity
description: Measure when worker-local prefix reuse lowers latency and when a popular prefix turns cache affinity into a hot-shard queue.
topic: Inference Routing
level: Advanced
date: 2026-08-03
readingTime: 25
tags: inference-serving, prefix-caching, kv-cache, load-balancing, tail-latency, capacity-planning
image: /content/v1/assets/prefix-affinity-routing-results.svg
imageAlt: Grouped bars comparing p99 latency for random, least-loaded, strict prefix-affinity, and bounded-affinity routing under moderate and extreme hot-prefix workloads
evidenceMode: experiment
qualityTier: deep-research
evidenceProject: operator/diy-project-blogs/projects/prefix-affinity-cache-routing-audit
evidenceManifest: operator/diy-project-blogs/projects/prefix-affinity-cache-routing-audit/evidence-manifest.json
---

Prefix caching makes repeated system prompts, tool schemas, and shared document prefixes cheaper to prefill. That creates an appealing routing rule: send every request with the same prefix to the same worker. The rule maximizes reuse, but it also converts prefix popularity into load skew. One viral agent template can become a single-worker queue while seven replicas sit available.

A matched discrete-event study shows how abrupt that reversal can be. With eight serial workers, 64 cached prefixes per worker, a 35 ms hit advantage, and 45% of requests sharing one prefix, strict affinity raised median cache hit rate from 58.6% to 99.7%. Yet median p99 latency rose from 79 ms under least-loaded routing to 4,378 ms, and strict affinity failed a 250 ms SLO in every one of 200 repeats. A bounded policy that preferred affinity only when its projected wait was within 25 ms of the least-loaded worker retained a 97.6% hit rate and reduced median p99 to 54 ms.

The result is not “25 ms is the correct threshold.” It is that cache locality and queue delay are competing resources, so a production router needs an explicit exchange rate between them. Strict affinity is safe only while the hottest key remains below the service capacity of its assigned shard. The threshold must be fitted to the real prefill saving, batching behavior, request size, and SLO.

## Finding and Decision Summary

Route by prefix only inside a queue-slack budget. Measure projected start time on the affinity worker and on the best alternative, then choose locality only when the extra wait is smaller than the expected cache-hit benefit and a safety margin. Export hit rate, per-prefix arrival rate, per-worker queue delay, traffic imbalance, and end-to-end tails together. A high hit rate without those denominators is not a serving result.

The table is generated from 3,200 repeat-policy rows. Each scenario replays the same arrivals, prefix identities, and service-time draws through four policies. Values are medians across 200 matched repeats; paired intervals later in the article use 5,000 bootstrap resamples. Source: [vLLM automatic prefix-caching semantics](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/) motivate the measured cache boundary; all numeric rows come from the saved local repeat table.

| Workload | Policy | Cache hit rate | Median p99 | Worker request CV | 250 ms SLO pass rate |
|---|---|---:|---:|---:|---:|
| Uniform, 80 rps | Least loaded | 25.2% | 83.1 ms | 0.009 | 100% |
| Uniform, 80 rps | Strict affinity | 99.7% | 44.2 ms | 0.036 | 100% |
| Uniform, 80 rps | Bounded affinity | 98.6% | 46.4 ms | 0.035 | 100% |
| 45% hot prefix, 120 rps | Least loaded | 58.6% | 79.0 ms | 0.011 | 100% |
| 45% hot prefix, 120 rps | Strict affinity | 99.7% | 4,378.4 ms | 1.186 | 0% |
| 45% hot prefix, 120 rps | Bounded affinity | 97.6% | 54.1 ms | 0.786 | 100% |
| 70% hot prefix, 180 rps | Least loaded | 77.4% | 74.9 ms | 0.011 | 100% |
| 70% hot prefix, 180 rps | Strict affinity | 99.7% | 75,527.3 ms | 1.849 | 0% |
| 70% hot prefix, 180 rps | Bounded affinity | 97.7% | 54.6 ms | 0.573 | 100% |

The worker CV remains high for bounded affinity because requests still prefer the hot prefix's worker when that is harmless. That is not a contradiction: request-count balance is an imperfect proxy when cache hits make service cheaper. Queue delay is the decision variable; balance is a diagnostic.

## Methodology

The simulation models eight independent serial workers for 60 seconds with a 10-second warm-up. Each has a 64-entry worker-local LRU prefix cache. A cache miss consumes 42 ms of prefill work and a hit consumes 7 ms; both add a 10 ms mean decode component. Per-request service time is lognormal with log-space sigma 0.22. Arrivals are Poisson, and four scenarios cover uniform prefixes, moderate and extreme hot-prefix skew, and a cache-disabled control.

The simulated hardware boundary is deliberately abstract. No model, accelerator, Torch runtime, network service, continuous batching engine, or local inference endpoint is used. The experiment isolates routing, cache-locality, and queueing interactions. It cannot estimate tokens per second or memory consumption for vLLM, SGLang, TensorRT-LLM, or a named GPU.

The trace generator fixes all stochastic inputs before policies diverge:

```javascript
function makeTrace(scenario, repeat) {
  const r = rng(seed + repeat * 1009 + scenario.rps * 17);
  const trace = [];
  let at = 0;
  while (at < durationSeconds * 1000) {
    at += -Math.log(Math.max(1e-12, 1 - r())) * 1000 / scenario.rps;
    if (at >= durationSeconds * 1000) break;
    const prefix = scenario.hotProbability && r() < scenario.hotProbability
      ? "prefix-000"
      : `prefix-${1 + Math.floor(r() * (scenario.prefixes - 1))}`;
    trace.push({ at, prefix, serviceNoise: normal(r), routeRandom: r() });
  }
  return trace;
}
```

Each policy sees identical arrival times, prefix keys, and service-noise draws within a repeat. This paired design removes request-mix luck from policy differences. Repeat seeds remain independent across the 200 replications per scenario.

The bounded policy makes the locality trade-off explicit:

```javascript
function route(policy, req, available) {
  const least = available.reduce(
    (best, value, i) => value < available[best] ? i : best,
    0
  );
  const affinity = prefixHash(req.prefix);
  if (policy === "random") return Math.floor(req.routeRandom * workers);
  if (policy === "least-loaded") return least;
  if (policy === "prefix-affinity") return affinity;

  const affinityWait = Math.max(0, available[affinity] - req.at);
  const leastWait = Math.max(0, available[least] - req.at);
  return affinityWait <= leastWait + boundedAffinitySlackMs
    ? affinity
    : least;
}
```

This is a queue-wait rule, not a utilization rule. A production implementation should replace `available` with a better projected-start estimator that accounts for batched tokens, active sequences, preemption, and prefill/decode interference.

## Baselines and Controls

Least-loaded routing is the primary baseline because it responds to queue state but ignores cache locality. Random routing is a deliberately weak operational baseline that shows the cost of abandoning both signals. Strict affinity is the treatment. Bounded affinity is the preregistered ablation.

The uniform 80 rps cell is a negative control for popularity skew. Strict affinity is beneficial there: it improves median p99 by 38.9 ms versus least loaded, with a paired 95% interval from 38.6 to 39.2 ms, while adding only modest request imbalance. That result prevents the article from claiming affinity is intrinsically harmful.

The cache-disabled 120 rps cell removes the 35 ms reuse benefit. Bounded affinity then worsens p99 by a mean 7.43 ms versus least loaded, with a 95% interval from 7.17 to 7.67 ms, and provides exactly zero hit-rate gain. This is the clearest negative result: if cache savings disappear, even a bounded preference is unjustified overhead. Strict affinity is catastrophic in this control because deterministic prefix hashing still concentrates the hot key while offering no service reduction.

The 70% hot-prefix cell is a skew-amplitude stress test. It is not used to tune the 25 ms threshold. The configuration and directional hypothesis were locked before the first completed run.

## Results

Under 45% hot-prefix probability, strict affinity gains 41.1 percentage points of hit rate over least loaded but adds a mean 4,375.0 ms to p99; the paired interval is 4,247.0 to 4,503.4 ms. The affinity worker receives enough of the 120 rps stream that its queue becomes unstable over the fixed window. Median p99 queue delay alone is 4,362.7 ms.

Bounded affinity gains 39.0 percentage points of hit rate over least loaded and reduces p99 by a mean 24.77 ms, with a paired interval from 24.50 to 25.04 ms. Its median p99 queue delay is 24.3 ms. The rule moves overflow requests away before the preferred worker accumulates an unbounded tail.

Relative to strict affinity, the bounded rule retains 94.9% of the *incremental* hit-rate gain over least loaded in the moderate cell: `(0.9758 - 0.5856) / (0.9967 - 0.5856)`. That derived ratio is more informative than saying it retains “most” reuse, but it remains specific to this cache size and key distribution. In the extreme cell the corresponding ratio is 91.3%. Neither ratio measures saved tokens or dollars; production should weight hits by reusable prefix length.

```output
moderate-hot-120 / least-loaded
hit_rate=0.5856  p99_ms=78.97  p99_queue_ms=8.72  slo_pass=1.00
moderate-hot-120 / prefix-affinity
hit_rate=0.9967  p99_ms=4378.38  p99_queue_ms=4362.65  slo_pass=0.00
moderate-hot-120 / bounded-affinity
hit_rate=0.9758  p99_ms=54.14  p99_queue_ms=24.30  slo_pass=1.00
paired bounded-minus-least p99 mean=-24.77 ms  95%=[-25.04,-24.50]
```

At 70% hot-prefix probability, strict affinity adds 75.5 seconds to mean paired p99 relative to least loaded. That magnitude is not a general production estimate; it reflects an overloaded serial shard in a 60-second simulation. The consequential observation is the phase change from cache win to unbounded queue, not the exact number.

```output
extreme-hot-180 / least-loaded: p99=74.91 ms, hit=77.40%, pass=100%
extreme-hot-180 / strict-affinity: p99=75527.28 ms, hit=99.66%, pass=0%
extreme-hot-180 / bounded-affinity: p99=54.64 ms, hit=97.73%, pass=100%
cache-disabled / bounded-minus-least p99=+7.43 ms [7.17,7.67]
uniform / strict-minus-least p99=-38.91 ms [-39.18,-38.64]
repeat_rows=3200, matched_repeats_per_scenario=200, bootstrap_samples=5000
```

## Statistical Analysis and Uncertainty

Policy effects are computed within repeat, then resampled over the 200 paired deltas. Percentile bootstrap intervals use 5,000 deterministic resamples. Pairing is important because arrival counts and the timing of long service draws vary across repeats. Unpaired intervals would mix policy effects with trace difficulty.

The intervals quantify Monte Carlo uncertainty under the declared generator. They do not cover model misspecification: real prefixes have variable token lengths, hits save different amounts of work, request sizes correlate with tenants, and batching can share or interfere with service. Those uncertainties require a trace replay on the target stack.

The strict-affinity tail in overloaded cells also violates the comfortable intuition that a 60-second measurement has reached stationarity. It has not; the queue is still growing. Reporting the finite-window p99 is useful for a release decision but not an equilibrium estimate. The correct conclusion is “unstable under this offered load,” not “production p99 will be 75.5 seconds.”

### Estimate the hot-key capacity boundary

Before a canary, compute a coarse stability check. If one prefix receives fraction `h` of offered rate `lambda`, and an affinity hit consumes mean worker time `s_hit`, strict single-owner affinity needs `h * lambda * s_hit < 1` even before other prefixes reach that worker. In the moderate cell, `0.45 * 120 * 0.017` is about 0.918 using the unperturbed 7 ms prefill plus 10 ms decode mean. Randomly hashed cold prefixes and service variance consume the remaining margin, so the owner crosses into sustained backlog. In the extreme cell, the hot prefix alone gives `0.70 * 180 * 0.017 = 2.142`; no queue discipline can make one serial owner stable at that load.

This calculation is deliberately conservative and incomplete. A real server batches sequences, hit service time depends on decode length, and prefix blocks may be replicated. Use it to reject obviously unsafe affinity, not to certify a rollout. Replace `s_hit` with a measured conditional distribution by prefix length and active-batch state. Track the hottest key over short windows because a daily average can hide a five-minute overload.

Replication is another treatment worth testing. Two owners approximately double hot-key service capacity but consume extra KV memory and can reduce reuse for the long tail. Compare one-owner affinity, bounded overflow, two-owner rendezvous hashing, and adaptive replication under the same trace. Include replication traffic and cache-eviction externalities; otherwise the apparent win merely moves cost out of the latency column.

## Production Readiness and Implementation Plan

A practical router should estimate value rather than hard-code a prefix rule:

```python
def choose_worker(request, workers, hit_value_ms, safety_ms):
    best_queue = min(workers, key=lambda w: w.projected_start_ms(request))
    affinity = rendezvous_owner(request.cache_key, workers)
    queue_penalty = (
        affinity.projected_start_ms(request)
        - best_queue.projected_start_ms(request)
    )
    expected_value = hit_value_ms(request, affinity)

    if affinity.can_reuse(request.cache_key):
        if queue_penalty <= max(0.0, expected_value - safety_ms):
            selected, reason = affinity, "reuse_inside_slack"
        else:
            selected, reason = best_queue, "queue_override"
    else:
        selected, reason = best_queue, "cold_prefix"
    emit_route_decision(
        request_id=request.id,
        selected_worker=selected.id,
        affinity_worker=affinity.id,
        queue_penalty_ms=queue_penalty,
        expected_hit_value_ms=expected_value,
        reason=reason,
    )
    return selected, reason

def hit_value_ms(request, worker):
    reusable_tokens = worker.cached_prefix_tokens(request.cache_key)
    return prefill_model.predict_ms(reusable_tokens, request.model_revision)

def cache_key(request):
    return hash_bytes(
        request.model_revision,
        request.tokenizer_revision,
        request.adapter_revision,
        request.prompt_prefix_bytes,
    )
```

Use rendezvous hashing only to nominate an owner, not to force placement. Version the key by model, tokenizer, adapter, cache format, and prompt bytes. Otherwise an apparent hit may be semantically invalid. Cap tenant share per worker, and make the queue override observable rather than silently falling back.

Roll out in shadow mode first. For at least one peak cycle, compute the chosen worker without changing traffic. Then canary at 1% with thresholds such as: p99 no worse than 5%, queue-override rate below the planned capacity envelope, hit-value prediction error within 20%, and zero cross-version cache reuse. The numbers are starting points, not universal standards.

Add a fairness gate before promotion. No tenant's p99 may worsen by more than 10% while the global p99 improves, and no single prefix may consume more than its declared worker share for two consecutive windows. A global bounded-affinity win can otherwise hide that the overflow path repeatedly sends cold work to the same fallback replicas. Compare per-tenant queue overrides and cache evictions with the shadow decision, and roll back when the improvement depends on one cohort absorbing another cohort's misses.

## Error Analysis and Limitations

The simulator hashes a prefix to one worker. Real systems may replicate hot blocks, transfer KV state, use a shared cache tier, or route by partial-prefix overlap. Those mechanisms can soften the hot-shard failure but introduce copy bandwidth, invalidation, and memory-accounting costs.

Serial workers omit continuous batching. In a batcher, a hot prefix may improve throughput through shared prefill while long decodes still dominate scheduling. Replace request-count queue length with projected token work, and measure time-to-first-token separately from inter-token latency and completion time.

The 35 ms hit value is fixed. Production reuse value varies with prefix length, attention architecture, quantization, and hardware. [PagedAttention](https://arxiv.org/abs/2309.06180) explains why block-level KV management changes memory waste; [DistServe](https://arxiv.org/abs/2401.09670) shows that separating prefill and decode changes scheduling; and [Mooncake](https://arxiv.org/abs/2407.00079) demonstrates a KV-cache-centric disaggregated architecture. None makes strict affinity universally safe.

The experiment has no request cancellation, autoscaling, failures, or fairness objective. A bounded rule could still starve a tenant or thrash a cache during a rolling deployment. Evaluate per-tenant and per-prefix tails, not only global latency.

## Reproducibility

The evidence project contains the locked configuration, dependency-free simulator, repeat-level CSV, aggregate JSON, claim table, result figure, and SHA-256 ledger. Run:

```bash
cd prefix-affinity-cache-routing-audit
node run-experiment.mjs
```

The run uses seed `20260802`, 200 repeats per scenario, four policies, and 5,000 bootstrap draws. It writes 3,200 repeat-policy rows. No model download, network call, or Torch runtime is required. Verify artifact hashes after rerunning before comparing values.

Relevant implementation references include [vLLM automatic prefix caching](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/), the [SGLang RadixAttention design](https://lmsys.org/blog/2024-01-17-sglang/), [NVIDIA Dynamo KV-aware routing](https://docs.nvidia.com/dynamo/latest/components/router/README.html), and [KServe generative inference guidance](https://kserve.github.io/website/latest/modelserving/generative_inference/). Their architectures motivate the production test surface; they are not evidence for the simulator's numeric results.

## Claim Boundary

Supported: in the declared eight-worker simulation, strict prefix affinity turns hot-prefix skew into an SLO-breaking queue despite near-perfect cache hits; a queue-slack rule preserves most reuse and avoids that failure across the tested cells.

Not supported: that 25 ms is optimal, that bounded affinity beats production routers, that the effect has the same magnitude on GPUs, or that one policy fits every prefix distribution. The production decision is to measure queue cost and reuse value jointly, preserve an escape from affinity, and reject any rollout whose cache win is purchased with unstable tail latency.
