---
title: Budget Token Work and Queue Discipline Together
description: Reproduce a controlled serving study showing why token-aware admission reduces overload but needs queue discipline to protect short LLM requests.
topic: LLM Capacity Planning
level: Advanced
date: 2026-07-19
readingTime: 24
tags: llm-serving, admission-control, scheduling, tail-latency, capacity-planning
image: /content/v1/assets/token-work-admission-control.svg
imageAlt: Result chart comparing short-request tail latency and active token-work overload across four admission policies
evidenceMode: experiment
qualityTier: deep-research
evidenceProject: operator/diy-project-blogs/projects/token-work-admission-control
evidenceManifest: operator/diy-project-blogs/projects/token-work-admission-control/evidence-manifest.json
---

A fixed concurrency limit treats a 100-token reply and an 8,000-token reply as the same unit of work. That is convenient for a semaphore and risky for an autoregressive server. Token budgeting looks like the obvious correction—but our controlled study found that changing the admission unit without changing queue discipline can make latency-sensitive requests slower.

We simulated a 4,000-token-per-second processor-sharing server with Poisson arrivals, a heavy-tailed mixture of interactive and batch completions, three request rates, a ten-second queue timeout, and 80 independently seeded traces per cell. The baseline admitted at most 16 requests. Treatments admitted against a 12,000-token work budget using class estimates, half- and double-scale calibration ablations, an oracle that knew actual output length, and a shortest-estimate-first queue. A fixed 900-token workload removed output-length heterogeneity as a negative control.

The directional hypothesis was only half right. At 4.0 requests per second, estimated-token admission reduced all-request p95 latency from 13.14 to 8.83 seconds and cut the fraction of simulated time above 12,000 active tokens from 51.6% to 4.1%. Yet FIFO estimated-token admission increased short-request p95 from 5.31 to 7.48 seconds. Even the oracle reached 7.60 seconds. Better size estimates did not solve head-of-line blocking.

The queue ablation did. Pairing the same class estimates with shortest-estimate-first selection reduced short-request p95 to 0.73 seconds, all-request p95 to 8.31 seconds, and modeled oversubscription to 3.3%. At 5.5 requests per second it reduced drop rate from 21.2% for the request-count baseline to 6.0%, while short-request p95 fell from 11.71 to 0.92 seconds. The cost was explicit: long-request p95 at 4.0 requests per second was 12.21 seconds rather than 11.87 seconds under estimated FIFO, so fairness policy remains part of the decision.

The consequential result is not “use shortest job first.” Admission and queue order form one control surface. A token budget can stabilize active work while FIFO hides the benefit from interactive users; aggressive short-first scheduling can then starve long generations. Production approval therefore needs token-estimate calibration, class-specific latency, queue age, drop rate, and long-job fairness—not only aggregate throughput.

## Finding and decision summary

- At 4.0 requests per second, 16-request admission spent 51.6% of simulated time with more than 12,000 remaining active tokens; class-estimated admission reduced that to 4.1%.
- Estimated FIFO reduced all-request p95 latency by 32.8%, from 13.14 to 8.83 seconds, but worsened short-request p95 by 40.9%, from 5.31 to 7.48 seconds.
- Exact output lengths did not fix FIFO: oracle-token admission still produced 7.60-second short-request p95. Prediction error was not the sole mechanism.
- Estimated admission plus shortest-estimate-first queueing produced 0.73-second short-request p95, 8.31-second all-request p95, 89.6% five-second SLO attainment, and 3.3% oversubscribed time.
- Halving every estimate raised oversubscribed time to 34.8%; doubling estimates eliminated oversubscription but increased drops to 0.69% and short-request p95 to 7.91 seconds under FIFO.
- At 5.5 requests per second, the count baseline dropped 21.2% of requests; estimated short-first dropped 6.0%. This is overload behavior inside the declared model, not a hardware capacity claim.
- Under the fixed 900-token control at 2.5 requests per second, count, estimated FIFO, estimated short-first, and oracle policies all produced 1.19-second p95 latency. The scheduling advantage depended on length heterogeneity.

The engineering decision is to evaluate admission units and queue discipline factorially. Do not replace `max_concurrent_requests` with a token budget and declare the scheduler token-aware.

## Research question, hypothesis, and claim ladder

The preregistered hypothesis expected class-estimated token admission to reduce both short-request p95 and oversubscription relative to a 16-request limit under matched heavy-tailed work, with a smaller advantage under fixed lengths. Oversubscription and aggregate-tail predictions were supported; the short-tail prediction was falsified for FIFO.

The failure produced a sharper question: is poor short latency caused by inaccurate token estimates, or by placing a large request at the head of a capacity-constrained FIFO queue? The oracle control answers the first part. Exact sizes did not protect short jobs. The shortest-estimate-first ablation answers the second: queue selection, not just estimate accuracy, controlled interactive latency in this setup.

The supported claim ladder is:

1. **Direct measurement:** repeat-level latency, queue wait, drops, SLO attainment, active-work oversubscription, throughput, and class-specific tails for the declared simulator.
2. **Mechanism supported by controls:** length heterogeneity creates the gap between request counts and token work; FIFO creates head-of-line blocking after admission becomes capacity-aware.
3. **Operational implication:** production canaries should cross admission unit with queue order and report short and long classes separately.
4. **Not established:** no universal token budget, concurrency limit, estimator, fairness rule, GPU throughput, or production latency is claimed.

[vLLM's current scheduler contract](https://docs.vllm.ai/en/stable/api/vllm/config/scheduler/) exposes both `max_num_seqs` and token budgets, and defaults to first-come-first-served unless priority scheduling is chosen. Its [optimization guidance](https://github.com/vllm-project/vllm/blob/main/docs/configuration/optimization.md) also documents a real trade-off: smaller batched-token budgets can improve inter-token latency, while larger values can help time to first token and throughput. Those are engine controls, not direct equivalents of our admission budget, but they show why requests and tokens are distinct scheduling currencies.

## Methodology

### Workloads and matched arrivals

Every cell uses a Poisson arrival trace generated once and replayed across all policies for that repeat. Offered rates are 2.5, 4.0, and 5.5 requests per second. The server delivers 4,000 output tokens per second divided equally across active requests. Processor sharing is a transparent abstraction for decode contention; it omits iteration batching, KV-cache state, prompt prefill, kernels, and replica routing.

Heavy-tailed requests are an 80/20 mixture. Interactive requests have a 240-token median; batch requests have a 3,200-token median. Both use lognormal sigma 0.55 and are clipped to 32–8,000 tokens. The fixed control assigns 900 tokens to every request. We selected 900 as a rounded workload-scale control, not as an exact moment match; conclusions rely on within-workload policy contrasts.

The saved workload audit makes that boundary inspectable. Across the 80 focal 4.0-request traces, generated requests averaged 939.5 tokens, the mean per-trace median was 286.3, the mean per-trace p95 was 4,614, the mean per-trace p99 was 7,716.7, and the long-class fraction was 19.8%. The 900-token control approximately matches mean work while intentionally removing the 16-fold p50-to-p95 separation. It is not a distributional match.

```javascript
function makeArrivals(rate, workloadName, repeat) {
  const rng = mulberry32(seedFor(rate, workloadName, repeat));
  const requests = [];
  let at = 0;
  while (at < config.durationSeconds) {
    at += -Math.log(Math.max(rng(), 1e-12)) / rate;
    if (at >= config.durationSeconds) break;

    const isShort = rng() < 0.8;
    const median = isShort ? 240 : 3200;
    let tokens = Math.round(median * Math.exp(0.55 * normal(rng)));
    tokens = Math.max(32, Math.min(8000, tokens));
    requests.push({
      arrival: at,
      tokens,
      sizeClass: isShort ? "short" : "long"
    });
  }
  return requests;
}
```

Output-length variability is not hypothetical. The April 2026 paper on [uncertainty-aware output-length scheduling](https://arxiv.org/abs/2604.00499) reports heavy-tailed empirical lengths and argues for distributions rather than point estimates. Earlier [proxy-model sequence-length work](https://arxiv.org/abs/2404.08509) identifies head-of-line blocking under FCFS and reports benefits from speculative shortest-job-first on its real traces. We use neither paper's model nor reported speedups; they motivate the controlled factors.

### Admission policies and queue order

The count baseline admits while fewer than 16 requests are active. Estimated policies reserve 280 tokens for an interactive request and 3,600 for a batch request. Half- and double-scale treatments stress calibration. The oracle reserves actual output length. A request larger than the 12,000-token budget can run alone so the queue cannot deadlock.

FIFO examines the first waiting request. The short-first ablation chooses the smallest estimated request that fits the remaining budget, with arrival order breaking ties. Requests waiting more than ten seconds expire.

```javascript
function canAdmit(request) {
  if (policy.kind === "count") {
    return active.length < config.requestLimit;
  }
  const estimate = estimateTokens(request, policy);
  return active.length === 0 || reserved + estimate <= config.tokenBudget;
}

function chooseQueuedRequest(queue) {
  if (policy.queue !== "shortest-estimate") return 0;
  return queue
    .map((request, index) => ({
      index,
      estimate: estimateTokens(request, policy)
    }))
    .filter(candidate => canAdmit(queue[candidate.index]))
    .sort((a, b) => a.estimate - b.estimate || a.index - b.index)[0]
    ?.index ?? -1;
}

while (queue.length) {
  const index = chooseQueuedRequest(queue);
  if (index < 0 || !canAdmit(queue[index])) break;
  admit(queue.splice(index, 1)[0]);
}
```

This is deliberately simpler than [DistServe](https://www.usenix.org/conference/osdi24/presentation/zhong-yinmin), which separates prefill and decode placement, or [Orca](https://www.usenix.org/conference/osdi22/presentation/yu), which introduced iteration-level scheduling. Simplicity isolates admission and queue order. It also limits transfer.

### Service, metrics, and repeats

Between events, all active requests receive an equal share of 4,000 tokens per second. The next event is an arrival or the next completion. We count post-warm-up arrivals and allow admitted requests to drain. A five-second end-to-end latency target supplies SLO attainment. Oversubscription is the fraction of simulated time when actual remaining active tokens exceed 12,000, independent of the policy's reservation estimate.

Twelve thousand tokens is a declared comparison threshold, not measured KV-cache capacity. We did not sweep that threshold, so the article supports relative behavior at one work envelope rather than an optimal budget. A production replay must derive its envelope from memory, decode service, and tenant SLOs.

```javascript
const completionDelta = active.length
  ? Math.min(...active.map(job => job.remaining))
      * active.length / config.serverTokensPerSecond
  : Infinity;

const nextTime = Math.min(arrivalTime, clock + completionDelta);
const delta = nextTime - clock;
if (active.length) {
  const delivered = delta * config.serverTokensPerSecond / active.length;
  for (const job of active) {
    job.remaining = Math.max(0, job.remaining - delivered);
  }
  if (active.reduce((sum, job) => sum + job.remaining, 0)
      > config.tokenBudget) {
    oversubscribedSeconds += delta;
  }
}
clock = nextTime;
```

Each aggregate is a mean across 80 independently seeded five-minute traces with a 30-second warm-up. Saved intervals are empirical 2.5th and 97.5th percentiles across repeat-level metrics. They quantify trace variation under the generator; they are not confidence that the abstraction matches a real service.

## Baselines, controls, and ablations

The 16-request policy is the matched baseline. The oracle is a positive control for estimation error. Fixed lengths are the heterogeneity negative control. Half- and double-scale estimates expose calibration sensitivity. Shortest-estimate-first isolates FIFO blocking.

The design also contains a negative result that guards against a seductive interpretation. At the 4.0-request focal load, the exact oracle did not outperform the coarser class estimate on short p95 under FIFO: 7.60 versus 7.48 seconds. If output prediction alone were the solution, the oracle should have won. Instead, both waited behind the queue head.

At 2.5 fixed-length requests per second, the four focal policies tied at 1.19-second p95. Under identical job sizes, short-first and FIFO are the same ordering, and count admission does not overfill the work budget. The central benefit therefore does not arise from a generic implementation advantage.

## Results

Serving concepts are grounded in [vLLM's scheduler documentation](https://docs.vllm.ai/en/stable/api/vllm/config/scheduler/). Every numeric row below is from the saved simulator artifacts, not from vLLM or a hardware run.

| Workload and load | Admission / queue | All p95 | Short p95 | Long p95 | Drop rate | Time over 12K tokens |
|---|---|---:|---:|---:|---:|---:|
| heavy tail, 4.0 rps | 16 requests / FIFO | 13.14 s | 5.31 s | 23.22 s | 0.43% | 51.6% |
| heavy tail, 4.0 rps | class estimate / FIFO | 8.83 s | 7.48 s | 11.87 s | 0.56% | 4.1% |
| heavy tail, 4.0 rps | class estimate / short-first | 8.31 s | 0.73 s | 12.21 s | 0.61% | 3.3% |
| heavy tail, 4.0 rps | half estimate / FIFO | 10.38 s | 6.72 s | 16.10 s | 0.42% | 34.8% |
| heavy tail, 4.0 rps | double estimate / FIFO | 8.30 s | 7.91 s | 9.41 s | 0.69% | 0.0% |
| heavy tail, 4.0 rps | oracle tokens / FIFO | 8.56 s | 7.60 s | 10.89 s | 0.57% | 0.0% |
| heavy tail, 5.5 rps | 16 requests / FIFO | 26.84 s | 11.71 s | 38.38 s | 21.2% | 94.9% |
| heavy tail, 5.5 rps | class estimate / short-first | 12.67 s | 0.92 s | 16.45 s | 6.0% | 5.5% |
| fixed 900, 2.5 rps | class estimate / FIFO | 1.19 s | 1.19 s | n/a | 0.0% | 0.0% |
| fixed 900, 2.5 rps | class estimate / short-first | 1.19 s | 1.19 s | n/a | 0.0% | 0.0% |

```output
Token-work admission audit: 80 repeats per cell; capacity=4000 tok/s
heavy-tail rate=4.0 request-count-16 all_p95=13.141s short_p95=5.310s
heavy-tail rate=4.0 estimated-token-budget all_p95=8.830s short_p95=7.481s
heavy-tail rate=4.0 estimated-budget-shortest-first all_p95=8.312s short_p95=0.728s
heavy-tail rate=4.0 oracle-token-budget all_p95=8.560s short_p95=7.599s
count oversubscribed=51.6% estimated-FIFO=4.1% estimated-short-first=3.3%
estimated-FIFO long_p95=11.871s estimated-short-first long_p95=12.213s
fixed-control rate=2.5 focal policies p95=1.19s
```

## Statistical analysis and uncertainty

At the focal 4.0-request load, trace-to-trace variation is large because a five-minute trace can receive a different number and timing of capped long completions. The count baseline's all-request p95 spans 4.10–22.22 seconds across the empirical 95% repeat interval. Estimated FIFO spans 4.59–11.56 seconds, and estimated short-first spans 3.79–11.63 seconds.

Short-first has a much tighter short-request interval: 0.60–0.85 seconds around a 0.73-second mean. The count baseline spans 0.93–10.73 seconds. This precision is conditional on the class label being available and correctly mapped to 280 versus 3,600 reserved tokens. Real predictors drift.

The overload cell is more stable in direction. At 5.5 requests per second, count admission's p95 interval is 24.25–29.56 seconds and its drop-rate interval is 13.6–29.2%. Estimated short-first spans 11.85–13.22 seconds p95 and 3.46–8.15% drops. These are operating distributions, not a formal production effect estimate.

The study is exploratory because the queue ablation was added to diagnose the falsified short-tail hypothesis. A confirmatory run should freeze the chosen admission and aging rules before reading unseen production traces.

```output
heavy-tail 5.5 rps
request-count-16 p95=26.84s [24.25,29.56] drop=21.2% [13.6,29.2]
estimated-FIFO p95=13.08s [12.41,13.61] drop=8.9% [4.8,11.8]
estimated-short-first p95=12.67s [11.85,13.22] drop=6.0% [3.5,8.2]
underestimated-FIFO over-budget=62.3% [53.2,71.7]
oracle-FIFO short-p95=10.37s [10.22,10.50]
estimated-short-first short-p95=0.92s [0.84,1.04]
claim=declared processor-sharing simulation only
```

## Error analysis and fairness boundary

Shortest-first can indefinitely defer large jobs if short work keeps arriving. Our ten-second timeout turns that starvation into a drop, and the drop denominator does not distinguish interactive from batch work. A production scheduler needs age-based promotion, separate class quotas, or a weighted-fair policy. Report long-job wait and completion probability by tenant and class.

For that reason, shortest-estimate-first is a diagnostic control here, not the recommended production policy. It proves that queue order explains the interactive regression under the declared model. The confirmatory candidate should be an aged or weighted policy frozen before unseen replay, and it must beat FIFO without moving long-job completion outside a predeclared fairness margin.

Class estimates are privileged metadata. A caller may mislabel work, a prompt may expand unpredictably, and model revisions can move the length distribution. Underestimating by half raised oversubscribed time from 4.1% to 34.8% at the focal load. Calibration is an operational dependency, not a one-time model metric.

The server has no KV cache, prefill phase, token-level batch efficiency, cancellations, streaming backpressure, priority tiers, or replicas. [PagedAttention](https://arxiv.org/abs/2309.06180) exists because KV-cache memory changes feasible concurrency. [Microsoft's tail-aware scheduling work](https://www.microsoft.com/en-us/research/publication/beyond-prediction-tail-aware-scheduling-for-llm-inference/) likewise emphasizes extreme length variability. Our result should motivate target replay, not substitute for those mechanisms.

Finally, active remaining tokens are observable only after completion unless estimated online. The oracle is deliberately impossible. Its value is diagnostic: if an oracle with FIFO still misses the interactive objective, spending more on the estimator alone is misdirected.

## Production readiness and rollback

Collect arrival time, queue-enter time, admission time, first-token time, completion time, cancellation, prompt tokens, generated tokens, estimate at admission, estimate revision over time, class, tenant, model revision, KV blocks, and replica. Preserve a sampled event stream for deterministic replay.

Run a factorial canary with request-count/FIFO, estimated-token/FIFO, estimated-token/aged-short-first, and the existing production scheduler. Replay identical traces first. Randomize live traffic only after the offline comparison passes. Predeclare class-specific p95/p99, queue timeout, throughput, wasted tokens, and fairness margins.

Use an aging rule rather than pure short-first: for example, increase priority with queue time and cap how many short jobs may pass an older long job. Test adversarial class labels and a model revision that doubles the long-tail rate. Reject any policy whose aggregate tail improves by dropping long work.

Rollback if short-request p95 exceeds baseline by 10% for 15 minutes, long-request timeout rises by 2 percentage points, estimate calibration error exceeds 25% for a critical class, oversubscription exceeds the approved memory/work envelope for 5% of minutes, or throughput falls without an SLO gain. These are illustrative canary thresholds, not conclusions from the simulator.

## Reproducibility

The saved project contains the frozen config, dependency-free runner, six-policy matrix across two workloads and three loads, 2,880 repeat-policy rows, aggregate JSON, generated result SVG, and version-1 evidence manifest. No Torch, local model, GPU, or external service is required.

```sh
cd token-work-admission-control
node run-experiment.mjs
node render-figure.mjs
```

To extend the evidence, write a new config rather than overwriting this run. Replace the synthetic length mixture with a time-split production sample, derive service capacity from target hardware, freeze aging and class rules, and retain the fixed-length and calibration controls.

## Claim boundary and adoption rule

The study supports a narrow decision: request count, token-work admission, and queue order must be evaluated together when completion lengths vary. Token budgets reduced modeled active-work overload and aggregate tails, but FIFO erased the short-request benefit. An oracle estimate could not repair the wrong queue order, while pure short-first remains only a mechanism probe because fairness was not established.

It does not establish that 12,000 tokens, 16 requests, 4,000 tokens per second, or shortest-first is correct for any deployed model. The result is a controlled mechanism test with broad trace intervals and a post-hypothesis diagnostic ablation.

Adopt only after an aged or fair token-aware policy wins on unseen target traces, real hardware service curves, cancellation behavior, and class-specific SLOs. If a dashboard cannot show who waited, who dropped, and how wrong the token estimate was, the scheduler is not ready for production.
