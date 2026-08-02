---
title: Preserve Parallel Tool Correlation When Replaying Agent Traces
description: Reproduce a matched replay audit showing why independently sampled tool latencies distort both workflow tails and capacity estimates.
topic: AI Reliability
level: Advanced
date: 2026-08-01
readingTime: 25
tags: ai-agents, distributed-tracing, latency, capacity-planning, reliability, evaluation
image: /content/v1/assets/parallel-trace-correlation.svg
imageAlt: Two result charts showing column shuffling raises critical-path latency while lowering total tool occupancy in shared incidents
evidenceMode: experiment
qualityTier: deep-research
evidenceProject: operator/diy-project-blogs/projects/parallel-trace-correlation-audit
evidenceManifest: operator/diy-project-blogs/projects/parallel-trace-correlation-audit/evidence-manifest.json
---

An agent that launches search, retrieval, policy, and database calls in parallel completes when its slowest required branch returns. Capacity, however, is consumed by the sum of all four branches. A trace replay that samples each tool's latency independently preserves every marginal histogram but destroys the joint incident structure connecting those calls.

That seemingly harmless shortcut moved the two decisions in opposite directions in a controlled study. Across 400 matched repeats of 5,000 four-tool workflows, column-wise shuffling raised estimated critical-path p95 from 1.411 to 1.660 seconds, a 17.7% increase. At the same time, it lowered p95 total tool occupancy from 3.603 to 2.460 tool-seconds, a 31.7% decrease. The same replay therefore looked more pessimistic about user latency and more optimistic about capacity.

The effect disappeared in matched independent-incident and no-incident controls. It was not caused by different per-tool distributions: shuffling changes no individual tool value. It was caused entirely by erasing which values occurred in the same workflow.

The practical rule is narrow: preserve whole trace rows when replaying observed fan-out. If rows cannot be retained, model the dependency explicitly and validate both critical-path and aggregate-work metrics. A marginally accurate replay is not a workflow-accurate replay.

## Hypothesis and Decision Question

The preregistered hypothesis was that independent column sampling would destroy shared-incident dependence, understate p95 tool occupancy, and move critical-path latency in the opposite direction. The first two parts were expected; the last was the risky part because maxima do not respond to correlation like sums do.

For a parallel workflow with tool durations \(X_1,\ldots,X_k\), the simplified completion latency is:

```text
L = max(X_1, X_2, ..., X_k)
```

while the resource demand before cancellation is approximately:

```text
W = X_1 + X_2 + ... + X_k
```

Positive dependence clusters slow branches into fewer workflows. That can make the sum's tail heavier because several branches consume capacity together. Yet clustering also reduces the number of workflows in which at least one branch is slow. Independent sampling spreads slow values across more workflows, which can raise the tail of the maximum. The hypothesis was supported at the tested eight-percent incident prevalence, four-tool fan-out, and declared distributions. It is not a universal theorem about every percentile or dependence structure.

This distinction matters because [The Tail at Scale](https://research.google/pubs/the-tail-at-scale/) describes how fan-out amplifies rare component delays, while OpenTelemetry's [trace data model](https://opentelemetry.io/docs/concepts/signals/traces/) gives systems the trace and parent identifiers needed to retain workflow membership. Teams often collect that structure and then discard it while building load-test inputs.

## Methodology

The confirmatory simulator generates four parallel tools: search, retrieval, policy, and database. Body latencies are lognormal, with medians of 0.18, 0.24, 0.12, and 0.31 seconds and log-space sigmas from 0.32 to 0.45. In the shared-incident cell, eight percent of workflows receive one common multiplicative slowdown with median 4.5× and sigma 0.28. Each tool still has independent body noise.

Every repeat creates 5,000 source rows. Three replay methods consume the same values:

- `row_preserved` keeps the original four values together;
- `column_shuffled` independently permutes each tool column;
- `incident_stratified` shuffles within the observed shared-incident label.

The third method is an oracle ablation. Production traces rarely carry a perfect incident label. It asks whether retaining a coarse state label is enough; it is not presented as a deployable default.

Two controls test whether the effect really requires cross-tool dependence. `independent_incidents` assigns the same eight-percent marginal incident probability separately to each tool. `no_incident_control` removes the multiplicative incident component. In both, row preservation and column shuffling should agree within Monte Carlo uncertainty.

The generator makes the common state explicit:

```javascript
function generateRows(scenario, repeat) {
  const rng = mulberry32(seedFor(scenario, repeat));
  const rows = [];

  for (let id = 0; id < workflowsPerRepeat; id += 1) {
    const shared = scenario === "shared_incident"
      && rng() < incidentProbability;
    const sharedMultiplier = shared
      ? lognormal(rng, incidentMultiplierMedian, incidentMultiplierSigma)
      : 1;

    const values = tools.map((tool) => {
      const independent = scenario === "independent_incidents"
        && rng() < incidentProbability;
      const multiplier = independent
        ? lognormal(rng, incidentMultiplierMedian, incidentMultiplierSigma)
        : sharedMultiplier;
      return lognormal(rng, tool.medianSeconds, tool.sigma)
        * multiplier;
    });

    rows.push({id, incident: shared, values});
  }
  return rows;
}
```

The inferential unit is the repeat, not any of the two million generated workflows in one scenario. We compute p50, p95, p99, the miss rate against a 1.5-second deadline, and mean pairwise Pearson correlation inside each repeat. Treatment-minus-baseline intervals use 5,000 paired bootstrap resamples of the 400 repeat-level differences.

## Baselines, Controls, and Ablations

Row-preserved replay is the baseline because it answers the question posed by the observed data: what do workflow-level latency and work look like when the observed joint rows recur? It does not claim that historical rows predict future traffic. It preserves only the dependence already represented by the generator.

Column shuffling is the treatment. It preserves the exact multiset of values for every tool. Consequently, any difference in a workflow metric comes from reassignment across workflow IDs, not a changed marginal distribution, sample size, incident rate, or tool speed.

The shuffler is deliberately simple:

```javascript
function replayColumns(rows, rng) {
  const output = Array.from(
    {length: rows.length},
    () => Array(toolCount),
  );

  for (let tool = 0; tool < toolCount; tool += 1) {
    const order = shuffledIndices(rows.length, rng);
    for (let workflow = 0; workflow < rows.length; workflow += 1) {
      output[workflow][tool] = rows[order[workflow]].values[tool];
    }
  }
  return output;
}
```

The independent-incident negative control produced a mean pairwise correlation of approximately zero before shuffling. Its critical-path p95 changed by -0.00013 seconds with a 95% interval spanning -0.00097 to +0.00068 seconds. Its tool-occupancy p95 changed by +0.00108 tool-seconds with an interval spanning -0.00195 to +0.00417. The no-incident control was similarly null.

The incident-stratified ablation retained the binary shared-state label but shuffled each tool within the two strata. It recovered the median almost exactly, yet still raised critical-path p95 by 0.0996 seconds and tool-occupancy p95 by 0.193 tool-seconds. A binary label preserves state membership but loses continuous common-severity and body-noise relationships. This negative result is useful: a coarse “incident versus normal” tag did not fully reproduce the joint tail.

## Results

The primary result table comes from the saved repeat-level artifact. The definitions follow the workflow distinctions above; for broader benchmark discipline, MLCommons likewise requires declared scenarios and replicable implementations in its [Inference rules](https://github.com/mlcommons/inference_policies/blob/master/inference_rules.adoc).

| Scenario and replay | Critical-path p95 | Tool-occupancy p95 | Deadline misses | Mean pairwise correlation |
|---|---:|---:|---:|---:|
| Shared incident, rows preserved | 1.411 s | 3.603 tool-s | 4.56% | 0.707 |
| Shared incident, columns shuffled | 1.660 s | 2.460 tool-s | 6.37% | approximately 0.000 |
| Shared incident, incident-stratified | 1.511 s | 3.796 tool-s | 5.07% | 0.619 |
| Independent incidents, rows preserved | 1.661 s | 2.460 tool-s | 6.37% | approximately 0.000 |
| Independent incidents, columns shuffled | 1.661 s | 2.461 tool-s | 6.37% | approximately 0.000 |
| No incident, rows preserved | 0.663 s | 1.314 tool-s | 0.02% | approximately 0.000 |
| No incident, columns shuffled | 0.663 s | 1.314 tool-s | 0.02% | approximately 0.000 |

The shared-incident output is:

```output
shared/rows: latency_p95=1.4109s work_p95=3.6030 tool-s
shared/shuffled: latency_p95=1.6604s work_p95=2.4601 tool-s
shared/stratified: latency_p95=1.5106s work_p95=3.7961 tool-s
shared/rows: deadline_miss=4.56% correlation=0.707
shared/shuffled: deadline_miss=6.37% correlation=-0.000
```

Column shuffling made slow branches land in different workflows. More workflows acquired at least one slow branch, so the p95 maximum and 1.5-second miss rate rose. But fewer workflows received several slow branches simultaneously, so the p95 sum fell. Neither estimate is intrinsically “conservative.” Each is conservative for a different metric.

The controls show why checking marginal histograms is insufficient. All tool-specific histograms are identical before and after every shuffle by construction. Even a perfect Kolmogorov-Smirnov comparison per tool would pass. Only joint diagnostics—workflow-row retention, pairwise dependence, conditional tails, or copula-sensitive checks—can expose the changed workload.

## Statistical Analysis and Uncertainty

The paired bootstrap operates on one difference per repeat:

```javascript
function pairedBootstrap(deltas, samples, rng) {
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
    low: quantile(estimates, 0.025),
    high: quantile(estimates, 0.975),
  };
}
```

Representative paired effects are:

```output
shared shuffled-minus-rows latency p95: +0.2494 s [0.2460, 0.2530]
shared shuffled-minus-rows work p95: -1.1430 tool-s [-1.1514, -1.1347]
shared shuffled-minus-rows deadline misses: +1.805 pp [1.785, 1.827]
shared stratified-minus-rows latency p95: +0.0996 s [0.0966, 0.1027]
independent shuffled-minus-rows latency p95: -0.0001 s [-0.0010, 0.0007]
no-incident shuffled-minus-rows latency p95: approximately 0.0000 s
```

The narrow intervals quantify simulation uncertainty under this generator. They do not quantify model-form uncertainty. Four tools, an eight-percent state prevalence, a 4.5× median multiplier, parallel completion, and a 1.5-second deadline are design choices. A production system may have serial dependencies, partial joins, branch cancellation, caching, queue feedback, or time-varying incidents.

For that reason, report a sensitivity surface rather than importing these percentages. Vary fan-out width, incident prevalence, shared severity, deadline, and join policy. The important invariant is methodological: the replay must preserve or deliberately reconstruct the joint object on which the metric is computed.

### Sensitivity and external validation

The visual headline uses one confirmatory cell, so it must not be read as a calibrated production forecast. Before a replay informs capacity, sweep incident prevalence below and above the observed estimate, replace the common multiplier with empirical conditional distributions, and move the deadline across the product's actual service-level range. A conclusion is robust only if the intended decision remains stable across plausible cells; a sign change is a reason to collect better joint data.

External validation needs two held-out windows. Use one ordinary period to test marginal and workflow-level fit, and one known degradation period to test whether the replay preserves clustered work. Freeze the replay method before opening either window. Compare error against a marginal-only baseline and a naive row bootstrap; do not select the dependence model on the same incident later used to claim accuracy.

Three invariants should fail the build if violated. First, the source and replay must have identical per-tool value multisets for a pure shuffle audit. Second, repeat IDs must align across treatments before paired intervals are computed. Third, every published aggregate must be reproducible from `repeat-results.csv` without reading prose or the figure. These checks separate an implementation mistake from the substantive dependence effect.

The strongest alternative explanation in production is request heterogeneity rather than a shared incident. Large requests can make all child calls slower and produce positive correlation without any infrastructure event. That does not rescue column shuffling—the joint rows still matter—but it changes remediation. Preserve request-size and route fields, estimate dependence within those strata, and avoid calling every common slowdown an incident.

## Failure and Error Analysis

The first failure is incomplete traces. If a timeout drops unfinished child spans, row preservation can encode survivorship bias. OpenTelemetry's [sampling specification](https://opentelemetry.io/docs/concepts/sampling/) explains that sampling decisions affect which traces are recorded; a replay needs completion and censoring fields, not just finished spans.

The second failure is a false parent boundary. A background retrieval refresh may share a trace with a user request but not lie on its critical path. Conversely, calls split across queues may lose the parent identifier while sharing one incident. Define the evaluation unit from execution semantics, then validate it against span links and scheduler state.

The third is nonstationarity. Row-preserving a Tuesday incident does not predict a Friday fleet after routing or cache changes. AWS's guidance on [timeouts, retries, and backoff](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/) emphasizes that retry behavior interacts with overload. Replays should pin service version, routing policy, region, and incident window.

The fourth is confusing correlation with cause. Shared latency can reflect common load, request size, tenant, network path, or an upstream dependency. This study establishes estimator bias under controlled dependence; it does not diagnose production incidents. Use traces to generate hypotheses, then corroborate with service metrics and controlled fault injection.

The fifth is metric substitution. A low p95 sum does not prove enough capacity when mean work or burst concurrency drives cost. A low p95 maximum does not prove good user experience when timeout-censored requests are omitted. Report deadline-aware latency, completion, total work, concurrency, and cost together.

## Production Readiness and Release Gate

Build a replay record with one row per logical workflow and one field per branch attempt. Store parent trace ID, child span IDs, tool name and version, start and end timestamps, status, censoring reason, retry number, request-size bucket, route, region, and a redacted incident label if available. Keep raw payloads out of the replay unless they are essential and governed.

Before accepting a replay harness, require these checks:

1. Per-tool counts, quantiles, and censoring rates match the source trace within declared tolerances.
2. Pairwise rank correlation and conditional exceedance rates match for tool pairs with enough data.
3. Workflow fan-out width, branch start offsets, join semantics, and deadline treatment match the source.
4. Critical-path latency and total tool work both reproduce a held-out trace window.
5. Results are stratified by route, request-size bucket, and incident state; the global result cannot hide a failing slice.
6. A row-shuffle negative control changes joint metrics when shared incidents exist and stays null in an independent slice.

Rollback the replay-derived capacity or latency decision if held-out error exceeds the preregistered tolerance, if missing-span rate changes materially, if a service migration changes the trace topology, or if production canary behavior falls outside the replay interval. The harness is evidence for a decision, not a permanent workload model.

## Reproducibility

The study uses a dependency-free JavaScript runner and no model endpoint, accelerator, customer trace, or Torch runtime. The configuration fixes the random seed, tool distributions, repeat count, workflow count, deadline, and bootstrap count. Running the experiment writes repeat-level CSV, aggregate JSON, bootstrap JSON, a concise output summary, and the result figure.

The public excerpts are sufficient to audit the mechanism, while the linked standards provide the broader observability context. For statistical background, Efron and Tibshirani's [bootstrap overview](https://doi.org/10.1214/ss/1177013815) motivates resampling experimental units rather than treating dependent observations as independent; the [USENIX hedging study](https://www.usenix.org/conference/nsdi21/presentation/primorac) is a useful comparison for how redundancy, dependence, and load interact in services.

Reproduce from the repository root:

```sh
cd parallel-trace-correlation-audit
node run-experiment.mjs
node render-figure.mjs
```

Confirm that the independent and no-incident controls remain null before interpreting the shared cell. If they move, inspect seeding, row alignment, or the shuffler before trusting any headline effect.

## Claim Boundary

The supported conclusion is that independently resampling tool columns can preserve every marginal distribution while materially distorting workflow-level latency and capacity metrics when tool durations share incident structure. The direction depends on the functional: maxima and sums need not move together.

The evidence does not show that positive correlation always improves critical-path latency, always worsens capacity, or has the same magnitude in production. It does not select a universal dependence model, prove an incident cause, or replace held-out production validation. The decision-grade claim is procedural: preserve workflow rows by default, measure joint structure, and gate adoption on both user-facing and resource-facing metrics.
