---
title: Stop Ranking Model Endpoints by Completed-Only Latency
description: Reproduce a controlled study showing how request timeouts can reverse endpoint latency rankings and how to audit the censored tail.
topic: AI Performance Engineering
level: Advanced
date: 2026-07-20
readingTime: 24
tags: llm-latency, performance-testing, observability, survival-analysis, model-serving
image: /content/v1/assets/timeout-censoring-ranking.svg
imageAlt: Measured chart showing completed-only and deadline-aware p95 latency for steady and fast-spiky endpoints across four deadlines
evidenceMode: experiment
qualityTier: deep-research
evidenceProject: operator/diy-project-blogs/projects/timeout-censoring-latency-audit
evidenceManifest: operator/diy-project-blogs/projects/timeout-censoring-latency-audit/evidence-manifest.json
---

A latency dashboard can make the less reliable model endpoint look faster. The failure occurs when timed-out requests disappear from the latency population. The remaining completions are a selected sample: the slowest calls have been removed precisely because they were slow.

We tested that mechanism in a paired stochastic simulation. One endpoint was steady, with a 1.6-second lognormal median and no injected long-tail component. The other had a faster 0.9-second body but sent 6% of calls into a 12-second long-tail component. Across 240 repeats of 5,000 requests, we applied deadlines of 2, 4, 8, and 16 seconds and computed completed-only p95, a deadline-aware p95 over `min(latency, deadline)`, latent uncensored p95, completion rate, timeout rate, and restricted mean observed time.

At the focal eight-second deadline, completed-only p95 ranked the fast/spiky endpoint 1.155 seconds ahead: 1.259 versus 2.414 seconds. The deadline-aware p95 reversed the decision: 7.970 versus 2.414 seconds. The fast/spiky endpoint completed 94.31% of requests versus 100%, and its latent p95 was 9.331 seconds. The paired 95% bootstrap interval for the completed-only advantage was [-1.157, -1.154] seconds; the deadline-aware disadvantage was [5.500, 5.585] seconds.

This does not establish a universal latency statistic. Replacing a timeout with the deadline says only that the event was not observed before that boundary. It does not estimate when the request would have completed. The operational lesson is narrower: never compare conditional latency without displaying the conditioning event, its rate, and a deadline-aware view.

## Finding and decision summary

- Completed-only p95 removed the slowest 5.69% of fast/spiky calls and reported 1.259 seconds, 47.8% below the steady endpoint's 2.414 seconds.
- Deadline-aware p95 retained the failed tail at the declared boundary and reported 7.970 seconds, 5.556 seconds worse than steady.
- The latent p95 of the fast/spiky endpoint was 9.331 seconds, so even the deadline-aware value remained a lower bound on the uncensored tail.
- At the same eight-second deadline, mean observed time was not sufficient for the release decision because the faster body can offset timeout penalties in an average.
- Removing the 6% tail made the fast endpoint's conditional and deadline-aware rankings agree. That negative control ties the reversal to censoring, not merely to different medians.
- Deadline sweeps changed what was observable. A two-second deadline censored part of both distributions; a sixteen-second deadline revealed much more of the injected tail.
- The study used 1.2 million requests per endpoint, paired within repeats, and 5,000 paired-bootstrap resamples per focal contrast.
- No named provider, production trace, queue, token-length distribution, streaming response, retry policy, or cancellation cost was modeled.

For an endpoint canary, report at least `(completion rate by deadline, completed-only latency, deadline-aware latency, and resource consumed by cancelled work)`. Approve a change only against a preregistered joint objective. A lower latency percentile among survivors cannot compensate silently for a lower completion rate.

## Research question, hypothesis, and claim ladder

The confirmatory hypothesis was directional: with an asymmetric timeout tail, completed-only p95 would favor the fast/spiky endpoint while deadline-aware p95 and completion rate would favor the steady endpoint; removing the tail would eliminate the disagreement between conditional and deadline-aware rankings.

The main treatment supported that prediction at eight seconds. The no-tail control did not make the endpoints identical—the fast body remained faster—but both latency views then selected the same endpoint. This matters because the control isolates disagreement, not raw speed.

The claim ladder is intentionally bounded:

1. **Measured:** the saved simulation establishes the ranking reversal, timeout fraction, deadline sweep, and paired intervals under its declared distributions.
2. **Mechanism:** conditioning on completion removes observations based on the outcome being measured, so asymmetric censoring can change a ranking.
3. **Engineering implication:** evaluation pipelines must retain timed-out request IDs and show joint success-latency surfaces.
4. **Not established:** the run does not select a provider, timeout, survival estimator, SLO, or business loss function.

The mechanism is not peculiar to language models. The [AWS Builders' Library timeout guidance](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/) warns that timeouts should derive from downstream latency percentiles and account for false timeouts. Google's [SRE discussion of tail latency](https://sre.google/sre-book/addressing-cascading-failures/) treats high latency as a trigger for resource accumulation and cascading failure. The [MLPerf Inference rules](https://docs.mlcommons.org/inference/index_gh/) define scenario-specific latency constraints and validity requirements rather than one context-free percentile. These sources motivate the measurement problem; the numeric result comes only from the local artifacts.

## Methodology

### Latency distributions and paired requests

Each repeat generates 5,000 shared uniform tail draws plus shared standard-normal body and tail noise. The steady endpoint transforms the body noise with a 1.6-second median and log-space sigma 0.25. The fast/spiky endpoint uses a 0.9-second body with sigma 0.20 unless the shared tail draw is below 0.06; tail calls use a 12-second median and sigma 0.25.

```javascript
function mulberry32(seed) {
  return () => {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function latency(spec, tailDraw, bodyNoise, tailNoise) {
  const isTail = tailDraw < spec.tailProbability;
  const median = isTail ? spec.tailMedianSeconds : spec.medianSeconds;
  const sigma = isTail ? spec.tailSigma : spec.sigma;
  const noise = isTail ? tailNoise : bodyNoise;
  return Math.exp(Math.log(median) + sigma * noise);
}

const endpointSamples = Object.fromEntries(
  Object.keys(endpoints).map(name => [name, []])
);

for (let i = 0; i < requestsPerRepeat; i += 1) {
  const tailDraw = rng();
  const bodyNoise = normal(rng);
  const tailNoise = normal(rng);
  for (const [name, spec] of Object.entries(endpoints)) {
    samples[name].push(latency(spec, tailDraw, bodyNoise, tailNoise));
  }
}
```

Pairing makes endpoint differences less sensitive to Monte Carlo noise. It does not claim that two production providers experience identical network events. A production canary should pair on request identity, input, launch window, region, and client path where possible, then retain provider-specific rate-limit and cache signals as covariates.

The injected distribution is a mechanism probe, not a fitted trace. Lognormal bodies and a two-component tail make the censoring easy to audit. Real inference latencies may be multimodal because of prompt length, output length, queue depth, cache status, reasoning effort, tool calls, safety checks, region, and retry behavior.

### Metrics and censoring boundary

For a deadline `d`, completed-only p95 uses only latency values at or below `d`. Deadline-aware p95 uses `min(latency, d)` for every request. Completion and timeout rates keep the denominator fixed at 5,000.

```javascript
function summarize(latencies, deadline) {
  const completed = latencies.filter(value => value <= deadline);
  const observed = latencies.map(value => Math.min(value, deadline));
  return {
    successRate: completed.length / latencies.length,
    completedOnlyP95: quantile(completed, 0.95),
    deadlineAwareP95: quantile(observed, 0.95),
    latentP95: quantile(latencies, 0.95),
    restrictedMean: mean(observed),
    timeoutRate: 1 - completed.length / latencies.length
  };
}
```

The deadline-aware p95 is descriptive, not a Kaplan-Meier estimator. Classical right-censoring methods assume that censoring is independent of the event time after conditioning on covariates. A client deadline is often deterministic, and cancellation may alter the server process. The [NIST Engineering Statistics Handbook treatment of censored data](https://www.itl.nist.gov/div898/handbook/apr/section1/apr131.htm) explains why censored observations carry partial rather than exact information. The [Kaplan-Meier paper](https://doi.org/10.1080/01621459.1958.10501452) supplies a survival-estimation foundation, but production use requires checking its assumptions.

### Baselines, controls, and repeats

The steady endpoint is the operational baseline. Latent p95 is the oracle diagnostic available only because simulation retains completion times past the deadline. The main ablation removes the fast endpoint's tail probability while leaving its body distribution unchanged. Four deadlines test whether the conclusion depends on one observation window.

Every endpoint-deadline cell has 240 independently seeded repeats. The focal paired contrasts subtract steady from fast/spiky within repeat. Five thousand bootstrap replicates resample repeat-level deltas.

```javascript
function pairedBootstrap(values, seed) {
  const rng = mulberry32(seed);
  const estimates = [];
  for (let b = 0; b < bootstrapSamples; b += 1) {
    let total = 0;
    for (let i = 0; i < values.length; i += 1) {
      total += values[Math.floor(rng() * values.length)];
    }
    estimates.push(total / values.length);
  }
  return {
    mean: mean(values),
    ciLow: quantile(estimates, 0.025),
    ciHigh: quantile(estimates, 0.975)
  };
}
```

Bootstrap uncertainty is Monte Carlo uncertainty over the declared generator. The narrow intervals reflect 1.2 million requests and stable parameters; they do not include model misspecification or production drift.

## Results

The locally generated table below is computed from `aggregate-results.json`. All rows share the same synthetic request generator; values should not be compared with vendor latency claims. The [NIST censored-data guide](https://www.itl.nist.gov/div898/handbook/apr/section1/apr131.htm) supplies the measurement context; every number in the table traces to the saved local rows.

| Endpoint and observation | Completion at 8s | p95 latency | Interpretation |
|---|---:|---:|---|
| steady, completed-only | 100.00% | 2.414s | no censoring at focal deadline |
| fast/spiky, completed-only | 94.31% | 1.259s | conditions on the surviving 94.31% |
| fast/spiky, deadline-aware | 94.31% | 7.970s | timeout mass reaches the 95th percentile |
| fast/spiky, latent oracle | 100% eventually in simulation | 9.331s | unavailable from an ordinary cancelled client trace |

```output
repeats=240 requests_per_repeat=5000 focal_deadline_seconds=8
steady: success=100.00% completed_p95=2.414s deadline_p95=2.414s latent_p95=2.414s
fast_spiky: success=94.31% completed_p95=1.259s deadline_p95=7.970s latent_p95=9.331s
fast_spiky_timeout=5.69%
```

The conditional dashboard says the fast/spiky endpoint is 47.8% faster. The fixed-denominator view says at least one request in twenty is outside the eight-second boundary and that the 95th percentile sits essentially on that boundary. Both statements are arithmetically correct; only the second preserves the release-relevant denominator.

The difference between 7.970 and exactly 8.000 seconds occurs because the realized timeout rate averaged 5.69%, leaving some repeat-level 95th percentiles just below the boundary. The statistic should not be overinterpreted to millisecond precision.

## Statistical analysis and uncertainty

The focal paired results are stable:

```output
completed_only_p95_delta=-1.155s 95%CI[-1.157,-1.154]
deadline_aware_p95_delta=+5.556s 95%CI[+5.500,+5.585]
success_rate_delta=-5.69pp 95%CI[-5.73,-5.65]
no_tail_completed_p95_delta=-1.163s
repeat_rows=2880 bootstrap_samples_per_contrast=5000
```

Statistical precision is not external validity. The tail probability, medians, sigmas, request independence, and absence of queues were fixed by design. A one-point confidence interval around the wrong workload would still be the wrong answer.

The useful uncertainty exercise is therefore two-layered. First quantify repeat variation, as the bootstrap does. Then perform sensitivity analysis over deadlines, prompt/output strata, regions, concurrency, and tail prevalence. The present deadline sweep is the first such ablation, not a complete robustness study.

## Negative control and failed shortcut

Removing the long-tail component left the fast endpoint genuinely faster. Completed-only and deadline-aware p95 then agreed because no focal requests were censored. That is the desired negative-control result: the method does not manufacture a penalty merely because endpoints differ.

A second shortcut failed conceptually: restricted mean observed time alone cannot encode the product decision. A fast body may dominate the average even when failures exceed the release budget. A scalar utility can be valid if the cost of success time, timeout, cancellation work, and user abandonment is declared in advance. An unlabeled mean is not that utility.

The strongest counterargument is that the simulation deliberately creates a ranking reversal. Correct: it is a falsifiable mechanism study, not prevalence estimation. The next evidentiary step is to measure whether the mechanism appears in a real canary, not to generalize the 6% tail.

## Production measurement design

Assign every request a stable evaluation ID before dispatch. Record endpoint version, input and maximum-output tokens, cache state, reasoning level, region, priority tier, queue time if exposed, first-token latency, completion latency, deadline, cancellation timestamp, HTTP status, retry count, and billing or token usage. The attempt table must retain timed-out and cancelled IDs.

Build a joint surface by deadline and workload stratum. For example, require completion at 2, 8, and 30 seconds; completed-only p50 and p95; deadline-aware p95; time to first token; completed output tokens per second; cancellation work; and quality among matched successful outputs. Do not pool short classification calls with long agent runs.

[OpenAI's latency optimization guide](https://platform.openai.com/docs/guides/latency-optimization) separates token generation, request count, and parallelization levers. [vLLM's benchmark documentation](https://docs.vllm.ai/en/latest/contributing/benchmarks.html) distinguishes serving throughput and latency measurements. Neither source makes a conditional percentile safe without its completion denominator; that is the local inference being tested.

Use paired traffic only where duplication is safe and affordable. Shadow requests can change caches and provider load, so randomized interleaving may be preferable. Predeclare the primary deadline and acceptable completion-rate non-inferiority margin. Slice only after defining how multiple comparisons will be handled.

## Production Readiness, rollback, and failure modes

Block promotion when any of these occur: missing terminal records exceed 0.1%; timeout status is conflated with user cancellation; retry attempts are counted as new independent requests; deadline configuration differs across endpoints; or the canary lacks prompt/output strata. These are measurement failures, not model failures.

For rollout, start with a small randomized cohort and dual-write raw attempt events. Compare against a frozen incumbent window and an A/A lane. The A/A lane should show no systematic difference after matching; if it does, routing, clocks, regions, or logging are confounded.

Rollback when the preregistered completion margin fails, deadline-aware p95 breaches its budget, cancellation work grows beyond capacity, or quality regresses in any safety-critical stratum. Keep the previous endpoint and routing policy addressable. A dashboard correction should not require another model deployment.

Common failures include client timeouts shorter than server cancellation propagation, streaming connections recorded as successful before a complete response, background retries after the user has left, and provider logs that report server completion while the client records timeout. Reconcile both sides by evaluation ID.

## Reproducibility

The evidence project contains configuration, executable dependency-free JavaScript, 2,880 repeat-level rows, aggregates, paired-bootstrap analysis, focal output, and the result figure. Run:

```bash
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node run-experiment.mjs
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node render-figure.mjs
```

The run requires no model service and no Torch. Reproduction confirms the declared generator and arithmetic. Production confirmation requires anonymized request-level traces, exact deadline and cancellation semantics, workload strata, and authorization for paired or shadow traffic.

## Limitations, error analysis, and claim boundary

Requests are independent within the generator; real tails cluster during overload, incidents, long prompts, or rate limiting. There is no queue, batching, streaming, speculative decoding, cache, network geography, retry layer, or cost model. Latent completion is always finite, whereas production calls can fail permanently. Deadline-aware p95 collapses all later outcomes onto the censoring point.

The study also knows the counterfactual latency after client timeout. Production clients often do not. Server-side traces may recover it, but only if cancellation and request IDs propagate reliably. Survival models may estimate beyond censoring under assumptions that must be defended; this article does not validate one.

The supported conclusion is therefore precise: under asymmetric timeout censoring, a completed-only latency percentile can reverse an endpoint ranking. Preserve the fixed denominator, display the timeout mass, sweep meaningful deadlines, and make the release decision against a joint quality-success-latency objective. Everything beyond that—including the right endpoint and timeout—requires the target workload.

## Source and artifact ledger

- [AWS Builders' Library, “Timeouts, retries, and backoff with jitter”](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/), accessed July 20, 2026: false-timeout and timeout-selection context.
- [Google SRE, “Addressing Cascading Failures”](https://sre.google/sre-book/addressing-cascading-failures/), accessed July 20, 2026: tail latency and overload context.
- [MLCommons Inference documentation](https://docs.mlcommons.org/inference/index_gh/), accessed July 20, 2026: scenario-specific latency and validity framing.
- [NIST Engineering Statistics Handbook, censored data](https://www.itl.nist.gov/div898/handbook/apr/section1/apr131.htm), accessed July 20, 2026: censoring semantics.
- [Kaplan and Meier, 1958](https://doi.org/10.1080/01621459.1958.10501452): foundational survival estimation.
- [OpenAI latency optimization guide](https://platform.openai.com/docs/guides/latency-optimization), accessed July 20, 2026: inference-latency levers.
- [vLLM benchmark documentation](https://docs.vllm.ai/en/latest/contributing/benchmarks.html), accessed July 20, 2026: serving benchmark categories.
- Local artifacts: `config.json`, `repeat-results.csv`, `aggregate-results.json`, `statistical-analysis.json`, `focal-summary.txt`, and `timeout-censoring-ranking.svg`.
