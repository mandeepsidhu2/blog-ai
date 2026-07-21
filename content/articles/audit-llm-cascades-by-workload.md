---
title: Audit LLM Cascades by Workload Before Trusting Global Accuracy
description: Reproduce a paired routing study showing how one confidence threshold can cut cost and raise average accuracy while harming rare critical requests.
topic: LLM Routing Evaluation
level: Advanced
date: 2026-07-21
readingTime: 26
tags: model-routing, llm-cascades, calibration, subgroup-evaluation, cost-optimization
image: /content/v1/assets/cascade-case-mix-results.svg
imageAlt: Bar chart comparing critical-workload accuracy and cost for four LLM cascade routing policies
evidenceMode: experiment
qualityTier: deep-research
evidenceProject: operator/diy-project-blogs/projects/cascade-case-mix-audit
evidenceManifest: operator/diy-project-blogs/projects/cascade-case-mix-audit/evidence-manifest.json
---

An LLM cascade can reduce average cost, improve average accuracy, and still be unsafe to ship. The failure appears when the cheap model's confidence is least reliable on a small high-stakes workload. A single threshold routes nearly all of those requests to the cheap model; the population average barely notices because the workload is only five percent of traffic.

We tested that mechanism with 600 paired repeats of 12,000 requests. Strong-only routing reached 95.42% global accuracy and 90.04% critical-workload accuracy at $0.0200 per request. A global threshold improved the population result to 96.46% and cut mean cost to $0.0046, yet critical accuracy collapsed to 75.64%. Under a release rule that allowed a 0.5-point global regression but prohibited a one-point critical regression, the global rule falsely approved the cascade in 100% of repeats.

A preregistered workload-aware threshold routed more critical cases to the strong model. It reached 97.76% global and 91.41% critical accuracy at $0.0049 per request; its false-approval rate was 3.17%, driven by finite-sample variation around the paired tolerance. That policy is not a universal solution. It works here because workload identity is known before routing and the thresholds were designed for the declared score shift. The result supports a measurement contract: route-level averages are necessary for capacity planning, but protected-workload deltas must remain independent release constraints.

## Finding and decision summary

- The global threshold routed only 3.95% of requests to the strong model and saved 76.8% of mean request cost.
- Its critical strong-route rate was only 6.24%, despite a 20-point cheap-versus-strong accuracy gap in that workload.
- Population accuracy increased by 1.04 points because confidence selection preferentially kept easy cheap-model successes.
- Critical accuracy fell by 14.40 points relative to strong-only routing.
- The global release rule falsely approved all 600 shifted-score repeats.
- Workload-aware thresholds spent $0.0002 more per request than the global threshold and removed 96.83% of false approvals.
- In the equal-skill negative control, routing could not create a true model-quality gap; remaining differences were sampling noise.
- In the calibrated-score control, removing the workload-specific score shift materially reduced the central failure mechanism.
- The oracle reached 99.57% global and 97.04% critical accuracy, but it observes counterfactual correctness and is not deployable.

Use a cascade when routing features are available before inference, protected workloads have enough prospective evidence, and the strong path has real capacity headroom. Do not approve it from aggregate accuracy, aggregate cost, or a pooled calibration curve alone.

## Research question and hypothesis

The confirmatory question was whether one global confidence threshold could satisfy an average quality-and-cost objective while violating a preregistered critical-workload constraint. The directional hypothesis required all three events: the global rule passes, the rare workload loses more than one point, and the mismatch repeats under paired traffic.

This differs from asking whether selective prediction can improve accuracy. [SelectiveNet](https://proceedings.mlr.press/v97/geifman19a.html) and work on [learning to defer](https://proceedings.mlr.press/v108/mozannar20a.html) establish that abstention or deferral can allocate difficult cases. The operational question is whether the score used for deferral is calibrated where consequences differ. [On Calibration of Modern Neural Networks](https://proceedings.mlr.press/v70/guo17a.html) shows why a pooled confidence value cannot be assumed to be a probability. [Multi-calibration](https://arxiv.org/abs/1711.08513) makes the subgroup requirement explicit.

## Methodology

### Population, models, and paired requests

The declared traffic mix is 70% routine, 25% important, and 5% critical. The strong model's correctness probabilities are 96.5%, 93.5%, and 90.0%. The cheap model's are 95.5%, 89.5%, and 70.0%. These are transparent stress parameters, not provider measurements.

Every repeat generates one request stream and both potential model outcomes. All four policies see the same group, strong outcome, cheap outcome, and cheap-model score for each request. Pairing prevents traffic composition from being mistaken for a router effect.

```javascript
const requestsPerRepeat = 12_000;
const groups = ["routine", "important", "critical"];
const scoreShift = {routine: 0, important: 0.04, critical: 0.22};
const outcomes = [];

for (let i = 0; i < requestsPerRepeat; i++) {
  const group = chooseGroup(random());
  const strongCorrect = random() < spec.strong[group];
  const smallCorrect = random() < spec.small[group];
  const baseScore = smallCorrect
    ? 0.74 + 0.22 * random()
    : 0.30 + 0.48 * random();
  const score = clamp(baseScore + spec.scoreShift[group]);
  outcomes.push({
    group,
    strongCorrect,
    smallCorrect,
    score
  });
}

if (outcomes.length !== requestsPerRepeat) {
  throw new Error("incomplete paired request stream");
}
for (const group of groups) {
  if (!outcomes.some((row) => row.group === group)) {
    throw new Error(`missing workload: ${group}`);
  }
}
```

The shifted scenario adds 0.04 to important confidence and 0.22 to critical confidence. This represents an unsafe but common pattern: the score remains useful globally while becoming overconfident on a workload with unfamiliar language, tools, or decision structure.

### Routing policies

Strong-only is the incumbent baseline. The global cascade sends a request to the strong model when cheap-model confidence is below 0.62. The workload-aware cascade uses thresholds 0.62, 0.72, and 0.90. The oracle routes only when the cheap model would be wrong and the strong model right.

```javascript
for (const outcome of outcomes) {
  let useStrong;
  if (policy === "oracle") {
    useStrong = !outcome.smallCorrect && outcome.strongCorrect;
  } else {
    useStrong = outcome.score < thresholds[outcome.group];
  }

  const correct = useStrong
    ? outcome.strongCorrect
    : outcome.smallCorrect;
  totals.correct += Number(correct);
  totals.strong += Number(useStrong);
  totals.byGroup[outcome.group].n += 1;
  totals.byGroup[outcome.group].correct += Number(correct);
  totals.byGroup[outcome.group].strong += Number(useStrong);
}
```

Costs are fixed at $0.020 for the strong path and $0.004 for the cheap path. We exclude token-length, cache, retry, and latency effects so the case-mix mechanism is identifiable. A production reproduction must replace those constants with request-level billed units.

### Release rule and uncertainty

The global rule passes when cascade accuracy is no more than 0.5 percentage points below paired strong-only accuracy. The protected rule passes when critical accuracy is no more than one point below strong-only. A false approval occurs when global passes and critical fails.

```javascript
const globalPass =
  (strong.globalAccuracy - routed.globalAccuracy) * 100 <= 0.5;
const criticalPass =
  (strong.criticalAccuracy - routed.criticalAccuracy) * 100 <= 1.0;
const falseApproval = globalPass && !criticalPass;

function bootstrap(values, samples = 5000) {
  const means = [];
  for (let b = 0; b < samples; b++) {
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      sum += values[Math.floor(random() * values.length)];
    }
    means.push(sum / values.length);
  }
  return [quantile(means, 0.025), quantile(means, 0.975)];
}
```

We report 5,000 nonparametric bootstrap resamples across repeat-level metrics. These intervals describe repeated runs of the declared generator; they are not uncertainty intervals for a live product distribution.

## Baselines and controls

Strong-only answers whether routing improves on the incumbent under identical traffic. The oracle bounds the value available from perfect counterfactual routing, but cannot justify a deployable result. Its gap from the learned policies quantifies room for a better routing signal.

The calibrated-score control removes the important and critical score shifts while preserving model skill gaps. False approval for the global threshold falls from 100% to 72.67%, so miscalibration amplifies the failure but is not necessary: a rare workload with a large skill gap can still be hidden by the global denominator. The equal-skill control gives both models identical marginal correctness probabilities while preserving the shifts. Its global-threshold false-approval rate is 4.67%, consistent with finite paired variation plus confidence selection rather than a persistent 20-point skill gap. Both controls reuse the same policy code and repeat count.

The experiment does not tune thresholds on the reported repeats. Treating these results as a search set and choosing 0.90 afterward would invalidate the confirmatory language. A real rollout needs a calibration split, a threshold-selection split, and a sealed release set.

## Results

The table is sourced from `aggregate-results.json` in the [versioned evidence repository](https://github.com/mandeepsidhu/blog-ai); brackets are 95% bootstrap intervals across 600 repeats.

| Policy | Global accuracy | Critical accuracy | Strong route rate | Mean cost/request | False approval |
|---|---:|---:|---:|---:|---:|
| Strong only | 95.42% [95.41, 95.44] | 90.04% [89.94, 90.13] | 100.00% | $0.0200 | 0.00% |
| Global threshold | 96.46% [96.45, 96.47] | 75.64% [75.50, 75.79] | 3.95% | $0.0046 | 100.00% |
| Workload-aware threshold | 97.76% [97.75, 97.77] | 91.41% [91.31, 91.50] | 5.37% | $0.0049 | 3.17% [1.83, 4.67] |
| Counterfactual oracle | 99.57% [99.57, 99.58] | 97.04% [96.98, 97.09] | 6.85% | $0.0051 | 0.00% |

```output
scenario=shifted
repeats=600
requests_per_repeat=12000
strong_only global=95.42% critical=90.04% cost=$0.0200
global_threshold global=96.46% critical=75.64% cost=$0.0046
global_threshold strong_route=3.95% false_approval=100.00%
stratum_threshold global=97.76% critical=91.41% cost=$0.0049
stratum_threshold strong_route=5.37% false_approval=3.17%
oracle global=99.57% critical=97.04% cost=$0.0051
```

Average accuracy rises because the score selects easy requests for the cheap model. That selection benefit dominates the rare workload in the pooled denominator. The same score is shifted upward on critical cases, so the router withholds deferral precisely where the cheap model has the largest skill gap.

## Statistical analysis and negative result

The 100% false-approval result is not a p-value. It is an operating characteristic under the declared traffic generator and tolerance. The critical interval is narrow because each repeat includes roughly 600 critical requests and the study repeats 600 times.

The controls narrow the causal story. Removing the critical score shift does not make a single threshold safe: 436 of 600 calibrated-control repeats still pass globally while missing the protected tolerance. Removing the model skill gap reduces that count to 28 of 600. The evidence therefore supports a joint mechanism—heterogeneous skill plus routing selection—while treating workload-specific overconfidence as an accelerator, not the sole cause.

The workload-aware policy did not eliminate false approval completely. In 19 of 600 repeats, paired sampling variation put the critical delta beyond the one-point boundary while the global rule passed. That negative result matters: subgroup thresholds do not remove the need for enough release-set cases and an uncertainty-aware decision.

```output
global_threshold critical_strong_rate=6.24%
stratum_threshold critical_strong_rate=30.87%
global_threshold critical_delta=-14.40 points
stratum_threshold critical_delta=+1.37 points
global_threshold cost_reduction=76.84%
stratum_threshold cost_reduction=75.48%
global_threshold false_approvals=600/600
stratum_threshold false_approvals=19/600
```

The broader literature warns against treating subgroup calibration as automatic fairness or safety. [Fairness and Abstraction in Sociotechnical Systems](https://dl.acm.org/doi/10.1145/3287560.3287598) explains why the chosen groups and outcomes embed product decisions. [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) requires context-specific measurement and monitoring; it does not supply the loss function. [Conformal risk control](https://arxiv.org/abs/2208.02814) offers useful finite-sample tools, but exchangeability must be defended under routing and drift.

## Error analysis

The first failure mode is hidden workload identity. If the router cannot know that a request is critical before model execution, a stratum threshold is unusable or leaky. Use pre-inference features with an audited classifier, or route conservatively when identity is uncertain.

Second, the protected set may be too coarse. “Critical” can combine several languages, tools, and outcome types whose score errors cancel. Inspect calibration and paired deltas at the smallest decision-relevant unit, then use hierarchical shrinkage or minimum-count rules rather than publishing noisy micro-slices.

Third, the strong model may share the same blind spot. The oracle assumes some complementary correctness, but routing cannot repair a request both models miss. Keep absolute task success and failure severity alongside relative deltas.

Fourth, route decisions change latency and capacity. Sending 31% of critical requests to the strong path may create a queue that violates the critical deadline. The offline quality policy therefore needs a load test with arrival shape, token work, cancellation, and overload behavior.

## Production readiness

Version the route contract: workload classifier, model revisions, prompt templates, score definition, thresholds, token limits, prices, and fallback semantics. Log the pre-route workload label, score, chosen model, billed units, latency, outcome, and reviewer provenance. Never reconstruct the selection probability from a later configuration.

Operate three dashboards. The capacity dashboard reports route volume, token work, p50/p95 latency, retries, and cost. The quality dashboard reports absolute and paired accuracy by protected workload with intervals. The calibration dashboard reports reliability curves and deferral yield by workload. A pooled chart may summarize traffic, but it cannot replace any of those ledgers.

Roll back when any protected workload crosses its preregistered harm limit, when the workload classifier's coverage or precision moves outside its validated range, when the strong path breaches its queue envelope, or when model/version telemetry is incomplete. Keep strong-only routing as a tested switch, not a configuration that first has to be rebuilt during an incident.

### Select thresholds as a constrained decision

Threshold selection is not ordinary metric maximization. Write the decision as a constrained problem: minimize expected billed cost subject to minimum absolute quality, maximum paired regression for each protected workload, maximum p95 latency, and a strong-route capacity ceiling. If no threshold satisfies every constraint on sealed data, the cascade is infeasible at the current model pair and traffic mix. Do not relax the least visible workload until the optimizer returns an answer.

Estimate the frontier on a calibration set, but make the final choice before opening the release set. Include confidence intervals or conservative bounds in the constraints; otherwise a threshold can sit exactly on every empirical boundary and fail half of repeated releases, as the 3.17% workload-aware false-approval result warns. For small protected groups, reserve a fixed minimum count, extend collection time, or use a preregistered hierarchical model. Silently dropping the constraint because the slice is small reverses the purpose of protection.

Costs also need uncertainty. Provider prices may be deterministic, but request token counts, cache eligibility, tool calls, and retries are not. Report cost per eligible request, per completed request, and per accepted outcome. A cheap route that causes more retries or human escalations may move expense outside the model invoice.

Finally, audit threshold monotonicity. Raising a deferral threshold should normally increase strong-route volume, but preprocessing bugs, missing scores, policy overrides, and class-specific fallbacks can break that expectation. Sweep the entire supported threshold range in staging and plot group-level route rate, accuracy, latency, and cost. Unexpected discontinuities are release blockers because they make both rollback and capacity forecasts unreliable.

## Reproducibility

The evidence project contains the exact configuration, dependency-free runner, 7,200 repeat-policy rows, aggregates, bootstrap analysis, output ledger, manifest, and figure. No Torch, provider API, local model, CUDA, CPU-Torch, or cloud resource was used.

```sh
node run-experiment.mjs
jq '.aggregates[] | select(.scenario == "shifted")' aggregate-results.json
```

Reproduction should verify the row count, repeat count, paired policy stream, thresholds, cost constants, negative controls, bootstrap seed path, and figure values. A production extension must replace synthetic outcomes with blinded, independently labeled requests and record inter-rater uncertainty.

## Limitations and claim boundary

The study is a transparent stochastic mechanism test, not an estimate of any commercial model cascade. Outcomes are Bernoulli, requests are independent inside a repeat, workload labels are correct, prices are fixed, and the score distribution is authored. There is no token-length variation, judge noise, multi-turn state, shared queue, cache, retry, or adversarial routing input.

The supported claim is narrow: with heterogeneous model skill and workload-specific confidence shift, a global cascade rule can improve average accuracy and cost while repeatedly violating a rare-workload constraint. Protected-workload evaluation and prospective calibration expose the miss under the declared design.

We have not shown that three groups are sufficient, that threshold 0.90 transfers, that the cheap model should ever handle a safety-critical action, or that the workload-aware policy is cost-optimal. The next confirmatory step is a prospective, sealed shadow route with real request costs, blinded labels, clustered uncertainty, and a capacity test.

## Source and artifact ledger

- [SelectiveNet](https://proceedings.mlr.press/v97/geifman19a.html), ICML 2019: selective prediction baseline.
- [Learning to Defer](https://proceedings.mlr.press/v108/mozannar20a.html), AISTATS 2020: deferral formulation.
- [Calibration of Modern Neural Networks](https://proceedings.mlr.press/v70/guo17a.html), ICML 2017: confidence calibration boundary.
- [Multi-calibration](https://arxiv.org/abs/1711.08513), 2017: calibration across identifiable subpopulations.
- [Conformal Risk Control](https://arxiv.org/abs/2208.02814), 2022: finite-sample risk-control context.
- [Fairness and Abstraction](https://dl.acm.org/doi/10.1145/3287560.3287598), FAT* 2019: sociotechnical boundary for group definitions.
- [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework), accessed 2026-07-21: context, measurement, and monitoring.
- Saved `config.json`, `repeat-results.csv`, `aggregate-results.json`, `statistical-analysis.json`, and `cascade-case-mix-results.svg`: numeric claims.
