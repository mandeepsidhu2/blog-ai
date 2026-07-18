---
title: Tune Inference Batching Against Arrival Shape, Not Mean RPS
description: Reproduce a controlled queueing study showing why identical mean request rates need different batch windows under Poisson and synchronized burst traffic.
topic: Inference Systems
level: Advanced
date: 2026-07-18
readingTime: 25
tags: dynamic-batching, tail-latency, llm-serving, capacity-planning, queueing
image: /content/v1/assets/inference-batching-tail-latency.svg
imageAlt: Two-panel result chart comparing p95 inference latency under Poisson arrivals and synchronized request bursts
evidenceMode: experiment
qualityTier: deep-research
evidenceProject: operator/diy-project-blogs/projects/inference-batching-tail-latency
evidenceManifest: operator/diy-project-blogs/projects/inference-batching-tail-latency/evidence-manifest.json
---

Mean requests per second is not enough information to tune an inference batcher. Two services can each receive 90 requests per second and produce opposite decisions about whether a 10 ms batch-fill window is helpful.

We tested that interaction with a controlled discrete-event simulation. The service curve was declared rather than fitted to a hidden accelerator: `5.5 + 0.9 × batch_size^0.72` milliseconds. Each cell used 60 independently seeded, 60-second arrival traces, a 10-second warm-up, offered loads of 90, 140, and 220 requests per second, seven batching policies, a 100 ms queue timeout, and a 25 ms response-latency objective. Poisson traffic was matched against synchronized 16-request bursts at the same mean rate. A linear per-request service curve removed batching efficiency as a negative control.

The initial hypothesis was wrong. We expected adding batch-formation delay to worsen the bursty tail. At 90 requests per second, however, single-request service produced 96.4 ms p95 latency for synchronized bursts. A maximum batch of 16 with a 10 ms fill window reduced p95 to 18.1 ms and raised 25 ms SLO attainment from 25.0% to 100%. The window let one efficient batch absorb the burst instead of making 16 requests wait through serial service.

The same policy was not free under Poisson arrivals. Immediate maximum-four batching achieved 12.6 ms p95, while the 16/10 ms policy reached 17.5 ms: a 39% latency increase without a throughput gain at that load. Arrival shape flipped the decision even though both traces averaged about 90 requests per second.

The lesson is narrower than “use large batches.” Measure the joint distribution of interarrival gaps, queue depth, batch-fill time, and service time. Select a policy on a throughput–tail-latency frontier for each traffic class, then replay production traces on the target model and hardware. A mean-rate load test can approve the wrong queue delay.

## Finding and decision summary

- At 90 bursty requests per second, the 16/10 ms policy cut mean p95 latency from 96.4 ms for single service to 18.1 ms, an 81.2% reduction.
- At the same Poisson mean rate, moving from immediate maximum-four batching to 16/10 ms increased p95 from 12.6 to 17.5 ms, a 4.9 ms or 39% penalty.
- Under 220 Poisson requests per second, single service completed 156.3 requests per second and dropped 28.9% after the 100 ms queue timeout. Immediate maximum-four batching completed 219.8 requests per second with no modeled drops.
- Under synchronized bursts, maximum-four immediate batching still missed the 25 ms objective: p95 was 32.5 ms and SLO attainment was 56.3%. The issue was not insufficient aggregate service capacity; it was draining each burst in undersized groups.
- The no-efficiency negative control failed to produce a batching advantage. At 220 Poisson requests per second, single and immediate maximum-four service both completed about 156.3 requests per second and dropped 28.9%; maximum-four worsened p95 from 106.0 to 124.4 ms.

Do not copy the numeric 10 ms setting. Copy the experiment shape: matched arrival traces, a single-request baseline, queue-delay and maximum-batch ablations, a no-efficiency control, repeated seeds, and explicit SLO and drop metrics.

## Research question, hypothesis, and claim ladder

The original hypothesis stated that a policy selected for throughput would violate the 25 ms objective more often under bursty arrivals, because extra fill delay would compound queueing. That direction was falsified for the synchronized-burst generator. The burst already placed enough requests in the queue to fill a large batch; waiting briefly prevented the server from starting several smaller, less efficient batches.

The narrowed, supported claim is an interaction: with the declared sublinear service curve, the same fill window is a latency tax for sparse Poisson arrivals and a latency reducer for aligned 16-request bursts. The result supports four levels of inference:

1. **Directly measured:** p50, p95, p99, throughput, drop rate, SLO attainment, and realized batch size for the declared simulator.
2. **Mechanism supported by controls:** the benefit depends on both arrival alignment and sublinear batch service cost.
3. **Operationally plausible:** production batchers should segment trace replays by arrival shape rather than only mean rate.
4. **Not established:** no batch size, wait budget, GPU, model, or serving engine is universally optimal.

This boundary matters because real serving systems add prefill/decode interference, variable sequence lengths, KV-cache pressure, multi-tenancy, cancellation, routing, and accelerator-specific kernels. [Orca](https://www.usenix.org/conference/osdi22/presentation/yu) introduced iteration-level scheduling for generative models; [vLLM/PagedAttention](https://arxiv.org/abs/2309.06180) attacks KV-memory fragmentation; [Sarathi-Serve](https://arxiv.org/abs/2403.02310) studies chunked prefills and stall-free scheduling; and [DistServe](https://www.usenix.org/conference/osdi24/presentation/zhong-yinmin) separates prefill and decoding. Those systems explain why a production service curve is richer than ours. They do not invalidate the isolated queueing interaction.

## Methodology and experimental design

### Arrival processes

Poisson traces use exponential interarrival times. They are a memoryless control, not a claim that user traffic is Poisson. Bursty traces create groups of 16 requests separated by a period that preserves the requested long-run mean; requests within a group are spaced by 0.4 ms and the group receives bounded timing jitter. Thus the 90-request-per-second cells have comparable volume but radically different short-window concurrency.

```javascript
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
```

### Batch and queue model

The server has one execution lane. When work is already queued, it starts immediately and takes up to the maximum batch. When idle, it may wait until either the maximum batch is available or `maxDelayMs` expires. Requests that have waited more than 100 ms are dropped. The policy matrix covers maximum batches 1, 4, 8, and 16 and fill delays 0, 2, 5, and 10 ms.

The key scheduling path is intentionally small enough to audit:

```javascript
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
    const fillIndex = Math.min(
      arrivals.length - 1,
      first + policy.maxBatch - 1
    );
    start = Math.min(
      ready + policy.maxDelayMs,
      arrivals[fillIndex]
    );
  }

  let end = first + 1;
  while (
    end < arrivals.length &&
    end - first < policy.maxBatch &&
    arrivals[end] <= start
  ) end++;

  const size = end - first;
  const finish = start + serviceMs(size, serviceModel);
  available = finish;
  for (let index = first; index < end; index++) {
    if (arrivals[index] >= warmupMs) {
      latencies.push(finish - arrivals[index]);
    }
  }
  cursor = end;
}
```

The production analogue is NVIDIA Triton’s [dynamic batcher](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/batcher.html), which exposes preferred batch sizes, maximum queue delay, queue policies, priorities, timeouts, and preserve-ordering behavior. Our simulator does not reproduce Triton internals; it makes the same decision variables explicit.

### Metrics and uncertainty

We count only post-warm-up arrivals. Throughput is completed requests divided by the 50-second observation window. Latency includes fill wait, queueing, and service. SLO attainment is the fraction of completed requests at or below 25 ms. Drop rate uses completed plus timed-out requests as its denominator.

Each aggregate is a mean across 60 independent traces. The saved result includes normal-approximation 95% confidence intervals over seed-level metrics. These intervals quantify Monte Carlo trace variability inside the model, not uncertainty about whether the model resembles production.

```javascript
function summarize(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce(
    (sum, value) => sum + (value - mean) ** 2,
    0
  ) / (values.length - 1);
  const half = 1.96 * Math.sqrt(variance / values.length);
  return {
    mean,
    ci95Low: mean - half,
    ci95High: mean + half
  };
}
```

## Baselines, controls, and ablations

Single-request service is the latency baseline. Immediate maximum-four batching is the practical batching baseline because it can combine requests already queued without deliberately waiting. Queue-delay ablations separate a maximum batch from the time budget used to fill it.

Three offered loads test different utilization regimes. At 90 requests per second, the single-request capacity implied by 6.4 ms service is about 156 requests per second. At 140 it approaches saturation. At 220 it is overloaded. This is a model-derived boundary, not a GPU measurement.

The matched Poisson trace is the arrival-shape control. The negative service control changes the curve to `6.4 × batch_size` ms. It preserves single-request time while eliminating sublinear batch efficiency. If batching still created capacity there, the simulator would be suspect.

One limitation is visible in the burst generator: its groups are unusually regular. That sharp design isolates alignment but overstates how cleanly a production burst may fill batch boundaries. The next confirmatory replay should use real timestamp traces plus shuffled-gap and phase-randomized controls.

## Results

Source for the serving concepts: [Triton batcher documentation](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/batcher.html). Numeric rows below come from the saved 60-trace aggregate, not from NVIDIA.

| Arrival shape and load | Policy | Throughput | Mean p95 latency | 25 ms SLO attainment | Drop rate |
|---|---|---:|---:|---:|---:|
| Poisson, 90 rps | maximum 4 / 0 ms | 90.0 rps | 12.6 ms | 100.0% | 0.0% |
| Poisson, 90 rps | maximum 16 / 10 ms | 90.0 rps | 17.5 ms | 100.0% | 0.0% |
| Bursty, 90 rps | single / 0 ms | 90.0 rps | 96.4 ms | 25.0% | 0.0% |
| Bursty, 90 rps | maximum 4 / 0 ms | 90.0 rps | 32.5 ms | 56.3% | 0.0% |
| Bursty, 90 rps | maximum 8 / 2 ms | 90.0 rps | 21.7 ms | 100.0% | 0.0% |
| Bursty, 90 rps | maximum 16 / 10 ms | 90.0 rps | 18.1 ms | 100.0% | 0.0% |
| Poisson, 220 rps | single / 0 ms | 156.3 rps | 106.0 ms | 0.02% | 28.9% |
| Poisson, 220 rps | maximum 4 / 0 ms | 219.8 rps | 14.1 ms | 100.0% | 0.0% |

```output
Inference batching tail-latency audit
repeats=60 duration=60s warmup=10s SLO=25ms timeout=100ms
poisson 90 b4-now    throughput=90.0 rps p95=12.6 ms SLO=100.0%
poisson 90 b16-10ms throughput=90.0 rps p95=17.5 ms SLO=100.0%
bursty  90 single    throughput=90.0 rps p95=96.4 ms SLO=25.0%
bursty  90 b4-now    throughput=90.0 rps p95=32.5 ms SLO=56.3%
bursty  90 b8-2ms    throughput=90.0 rps p95=21.7 ms SLO=100.0%
bursty  90 b16-10ms throughput=90.0 rps p95=18.1 ms SLO=100.0%
```

The surprising result is not that batching improved capacity. It is that deliberate fill time lowered end-to-end latency for the designed bursts. Starting a four-request batch immediately took roughly 7.9 ms, but four such batches serialized the tail of a 16-request burst. Waiting long enough to collect 16 requests produced one modeled service of about 12.1 ms. The last request finished sooner even after paying the fill delay.

```output
poisson 220 single    throughput=156.3 rps p95=106.0 ms drop=28.9%
poisson 220 b4-now    throughput=219.8 rps p95=14.1 ms drop=0.0%
bursty  220 single    throughput=156.2 rps p95=104.6 ms drop=29.0%
bursty  220 b4-now    throughput=220.0 rps p95=32.5 ms drop=0.0%
negative-control service(batch)=6.4*batch
single throughput=156.3 rps p95=106.0 ms drop=28.9%
b4-now throughput=156.3 rps p95=124.4 ms drop=28.9%
interpretation=no sublinear service gain; batching cannot create capacity
result boundary=simulation operating characteristic, not hardware benchmark
```

## Statistical analysis and uncertainty

Poisson counts vary across seeds, while the burst generator nearly fixes count and phase structure. As a result, confidence intervals for regular-burst p95 values are extremely narrow. That is not stronger external evidence; it is a warning that the generator has low between-trace variability. Sixty repetitions estimate this designed process precisely but cannot supply missing production heterogeneity.

The saved run is exploratory mechanism evidence, not a confirmatory estimate of production benefit. Configuration, seeds, policies, and metrics are frozen and reproducible, but the narrowed interaction claim was written after the initial directional hypothesis failed. A confirmatory follow-up must preregister the interaction on unseen empirical traces and hardware-derived service curves.

The most useful comparison is paired by configuration, not a null-hypothesis test over arbitrary seeds. At 90 Poisson requests per second, the 16/10 ms policy is 4.9 ms slower at p95 than immediate maximum-four batching. For bursty traffic it is 14.4 ms faster. The sign reversal is much larger than Monte Carlo variation in the saved aggregate.

The no-efficiency control is more important than a tiny p-value. It removes the mechanism that allows a large batch to finish faster than several small batches. With linear work, batching can change scheduling order but cannot reduce required server time per request. This negative result bounds the claim: arrival alignment helps only when the target runtime actually has a favorable service curve over the relevant batch sizes.

## Failure analysis and error boundaries

The simulator treats every request as identical. Real LLM requests vary in prompt length, generated length, modality, adapter, prefix-cache state, and cancellation probability. Continuous batching schedules token steps rather than whole requests. Long prefills can stall decodes; chunking can reduce interference. Sarathi-Serve and [Splitwise](https://www.microsoft.com/en-us/research/publication/splitwise-efficient-generative-llm-inference-using-phase-splitting/) demonstrate why prefill/decode phase behavior needs separate measurement.

There is one execution lane and no replica routing. Autoscaling, cold starts, uneven KV occupancy, and load-balancer stickiness can turn a benign global mean into a hot replica. The study also omits priority classes. Triton can configure priorities and queue-specific timeouts; a production replay must verify that a large low-priority batch cannot delay urgent work.

The service curve is synthetic. Its 0.72 exponent encodes diminishing incremental cost, but no empirical accelerator trace chose that number. A different model, quantization, kernel, device, or sequence-length mix can flatten, steepen, or make the curve non-monotone. The result figure is evidence about this controlled model only.

Finally, timeout occurs before batching and drops are costless. Production cancellations consume coordination and sometimes partial compute. Report timeout, cancellation, and wasted-token rates separately.

## Production readiness and trace-replay protocol

Instrument arrival timestamp, queue-enter and queue-exit time, batch-open and batch-close time, realized batch size, prompt and output tokens, prefill and decode service, cache status, replica, model revision, and terminal status. Preserve raw events long enough to replay them.

Build a batch service surface on target hardware. For each representative prompt/decode bucket, measure batches 1, 2, 4, 8, 16, and any larger supported size with at least 30 repeated observations after warm-up. Record median and p95 service time plus memory use. Do not infer a power law unless residuals justify it.

Then replay at least three arrival views: original timestamps, interarrival-shuffled timestamps preserving volume, and phase-randomized bursts preserving burst sizes. Compare single, immediate batching, and bounded-wait policies. Approve only Pareto candidates that meet throughput, p95/p99, timeout, memory, and fairness requirements across critical slices.

Canary the chosen policy on one traffic shard. Roll back if p95 exceeds its baseline by more than 10% for 15 minutes, timeout rate rises above 0.5%, a priority class loses more than 2 percentage points of SLO attainment, or memory pressure forces more than 1% admission failures. These are example engineering thresholds, not values established by the simulation.

## Reproducibility

The project contains a version-1 evidence manifest, configuration, runner, 84 aggregate cells, 5,040 seed-policy rows in a 649 KB CSV, and the generated SVG. It requires only a Node runtime; no Torch, model inference, GPU, or network call is used.

```sh
node run-experiment.mjs
node render-figure.mjs
```

Reproduction should match the saved configuration and then compare artifact hashes. A useful extension should not overwrite the exploratory artifacts: create a preregistered config for empirical service-time tables or unseen real traces and retain the original falsified hypothesis.

## Claim boundary and adoption rule

The evidence supports one consequential decision: arrival shape belongs in the batching policy, load test, and observability contract. Equal mean rates do not imply equal queue dynamics.

It does not support deploying a 16-request batch, a 10 ms window, or a 25 ms SLO without target measurements. The burst process is deliberately synchronized, the service curve is declared, and sequence heterogeneity is absent. A team that copies the winning values has converted a mechanism study into an unsupported hardware claim.

Use the result to reject mean-RPS-only tuning. Keep immediate small batching as the conservative baseline, measure the actual service curve, replay timestamped traffic, and promote a larger fill window only when it improves the full throughput–tail frontier for the traffic class that will receive it.
