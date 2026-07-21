---
title: Detect Rare AI Regressions Without Biasing the Release Estimate
description: Reproduce a controlled canary study that separates rare-risk detection from population prevalence estimation with explicit sampling weights.
topic: AI Release Evaluation
level: Advanced
date: 2026-07-20
readingTime: 25
tags: ai-evaluation, canary-testing, rare-events, statistical-testing, release-engineering
image: /content/v1/assets/risk-weighted-canary-results.svg
imageAlt: Bar chart comparing critical regression detection power for population, risk-weighted, and balanced canary samples
evidenceMode: experiment
qualityTier: deep-research
evidenceProject: operator/diy-project-blogs/projects/risk-weighted-canary-sampling
evidenceManifest: operator/diy-project-blogs/projects/risk-weighted-canary-sampling/evidence-manifest.json
---

A 400-case model canary can be both too small to find the failure that matters and large enough to produce a reassuring overall score. That is not a paradox. It happens when one percent of production traffic carries a disproportionate consequence, while the evaluation sample follows traffic volume.

We tested a specific remedy: oversample the critical stratum to detect its regression, then use inverse-probability weights when estimating the population-average change. Across 4,000 repeat canaries per cell, a population-proportional sample put only 4.00 of 400 cases into the one-percent critical stratum and detected its regression in 0.25% of repeats. A risk-weighted allocation put 79.99 cases there and detected it in 97.70% (bootstrap 95% interval 97.22%–98.15%). A balanced allocation reached 99.95%, but reduced effective population sample size to 156.8.

The useful result is not simply “oversample rare cases.” The unweighted score from the risk-weighted sample overstated the population regression by 3.986 percentage points. The inverse-probability-weighted estimate missed the declared population delta by only 0.016 points on average. Detection and prevalence estimation are different jobs. A release packet should report both, with different estimands and acceptance rules.

These measurements do not show that an arbitrary risk taxonomy is correct. When we deliberately misranked the strata, the risk-weighted design largely missed the nominal critical regression and its naive estimate became badly biased. The operational contract therefore includes held-out validation of risk labels, minimum coverage for every stratum, and a population shadow sample.

## Finding and decision summary

- Population sampling delivered 0.25% critical-regression power because it observed about four critical cases per canary.
- Risk weighting increased critical cases twentyfold and power to 97.70% at the same 400-case budget.
- Balanced allocation reached 99.95% power, but its importance weights reduced effective sample size from 400.0 to 156.8.
- The true heterogeneous population delta was 0.588 percentage points. Risk weighting estimated it with 0.016-point mean weighted bias.
- Ignoring weights produced 3.986 points of bias for risk weighting and 6.613 points for balanced sampling.
- In the no-effect control, false alarms were 0.00%, 0.50%, and 1.32%, below the declared 5% one-sided threshold because the exact test is discrete.
- In the misranked-risk control, risk-weighted critical detection was only 0.15%; a risk score is a hypothesis, not ground truth.
- The confirmatory claim concerns the declared matched-outcome simulation only. It does not select a universal allocation or release threshold.

Use risk-weighted canaries when critical workflows are rare, enumerable before release, and expensive enough to justify directed evidence. Keep a separate population-proportional stream when product owners need an unbiased prevalence estimate. Do not turn a risk-enriched failure rate into a customer-impact forecast.

## Research question and hypothesis

The confirmatory question was: at a fixed evaluation budget, can directed sampling make a rare critical regression observable without sacrificing a defensible population estimate?

The directional hypothesis specified both halves. Oversampling the one-percent critical stratum should materially increase a paired exact test's detection power. The population estimand should remain recoverable only when each observation is weighted by its population share divided by its sampling share. The study was designed to falsify a simpler but tempting claim—that the enriched sample's raw failure delta is itself the production delta.

The [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/) calls for repeatable testing with uncertainty, benchmarks, and ongoing monitoring. The [NIST Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) frames risk as a combination of probability and consequence. Neither source dictates a sampling allocation. Statistical work on [near-optimal stratified sampling](https://arxiv.org/abs/1906.11289) and [stratified sampling for aggregate estimation](https://proceedings.mlr.press/v48/liberty16.html) establishes why allocation and estimation weights must be considered together. Our numerical claims come from the saved artifacts, not those papers.

## Methodology

### Population and matched outcomes

The synthetic population has three preregistered strata: routine (92%), important (7%), and critical (1%). In the heterogeneous scenario, candidate-only versus baseline-only failure discordance is 1.2% versus 1.0% for routine, 5.5% versus 2.0% for important, and 20.0% versus 2.0% for critical. The resulting population-average candidate-minus-baseline discordance is 0.588 percentage points.

Every sampled task produces one of three paired outcomes: candidate-only failure, baseline-only failure, or concordance. Pairing removes task-composition noise from the comparison without pretending model outputs are deterministic. Critical detection uses a one-sided exact sign test on the two discordant counts at alpha 0.05.

```javascript
function oneSidedSignP(candidateOnly, baselineOnly) {
  const discordant = candidateOnly + baselineOnly;
  if (!discordant || candidateOnly <= baselineOnly) return 1;
  let probability = 0;
  for (let k = candidateOnly; k <= discordant; k++) {
    probability += Math.exp(
      logChoose(discordant, k) - discordant * Math.log(2)
    );
  }
  return Math.min(1, probability);
}

const criticalDetected = oneSidedSignP(
  critical.candidateOnly,
  critical.baselineOnly
) < 0.05;
```

This paired construction is deliberately favorable to stable regression testing. A production evaluator with judge noise, changing prompts, or nonrepeatable tool state needs additional repeats and a variance component for those sources.

### Sampling policies

All policies spend exactly 400 paired cases. Population sampling uses shares 92/7/1. Risk weighting uses 55/25/20. Balanced sampling uses one third per stratum. The latter is an aggressive detection baseline, not a default recommendation.

```javascript
const policies = {
  uniform: {routine: 0.92, important: 0.07, critical: 0.01},
  risk_weighted: {routine: 0.55, important: 0.25, critical: 0.20},
  balanced: {
    routine: 0.3333333333,
    important: 0.3333333333,
    critical: 0.3333333334
  }
};

for (let i = 0; i < sampleBudget; i++) {
  const stratum = choose(random(), sampleShares);
  const spec = scenario[stratum];
  const draw = random();
  const candidateOnly = draw < spec.candidateOnlyFailure ? 1 : 0;
  const baselineOnly = draw >= spec.candidateOnlyFailure &&
    draw < spec.candidateOnlyFailure + spec.baselineOnlyFailure ? 1 : 0;
  counts[stratum].candidateOnly += candidateOnly;
  counts[stratum].baselineOnly += baselineOnly;
  const delta = candidateOnly - baselineOnly;
  const weight = populationShares[stratum] / sampleShares[stratum];
  naiveDelta += delta;
  weightedDelta += weight * delta;
  weightSum += weight;
  weightSquareSum += weight * weight;
}

const critical = counts.critical;
const repeatRow = {
  criticalN: critical.n,
  criticalCandidateOnly: critical.candidateOnly,
  criticalBaselineOnly: critical.baselineOnly,
  criticalP: oneSidedSignP(
    critical.candidateOnly,
    critical.baselineOnly
  ),
  naiveDelta: naiveDelta / sampleBudget,
  weightedDelta: weightedDelta / weightSum,
  effectiveN: weightSum * weightSum / weightSquareSum
};
```

Each scenario-policy cell has 4,000 independent repeats. Repeat-level means receive 5,000 nonparametric bootstrap resamples for descriptive 95% intervals. The heterogeneous cell is confirmatory; homogeneous, misranked, and null cells are controls. We report all policies and controls without claiming multiplicity-adjusted significance across the full grid.

## Baselines and controls

Population-proportional sampling is the operational baseline because it estimates an overall traffic-weighted rate without design weights. Balanced sampling is a high-coverage baseline that exposes the power/effective-sample trade.

Three controls challenge the result. The homogeneous scenario assigns the same discordance to all strata, removing a consequence-correlated regression gradient. The misranked scenario moves the 18-point regression to routine traffic while leaving the nominal critical stratum nearly unchanged. The null gives candidate-only and baseline-only discordance equal 2% probabilities in every stratum.

The misranked control matters most. A taxonomy derived from memorable incidents can become a stale map of yesterday's failures. Directed sampling then spends evidence where reviewers expect harm, not where the new model actually changed. That is why minimum per-stratum coverage and a random shadow sample are non-negotiable.

## Results

The table is sourced from the saved aggregate results in the [versioned repository](https://github.com/mandeepsidhu/blog-ai); intervals are bootstrap intervals across 4,000 repeated canaries.

| Policy | Mean critical cases | Critical detection power | Effective population N | Weighted mean bias | Naive mean bias |
|---|---:|---:|---:|---:|---:|
| Population proportional | 4.00 | 0.25% [0.10, 0.43] | 400.0 | -0.013 points | -0.013 points |
| Risk weighted | 79.99 | 97.70% [97.22, 98.15] | 256.4 | +0.016 points | +3.986 points |
| Balanced strata | 133.26 | 99.95% [99.88, 100.00] | 156.8 | +0.025 points | +6.613 points |

```output
repeats_per_cell=4000
sample_budget=400
uniform_critical_detection=0.0025 [0.0010, 0.0043]
uniform_mean_critical_n=4.00
risk_weighted_critical_detection=0.9770 [0.9722, 0.9815]
risk_weighted_mean_critical_n=79.99
balanced_critical_detection=0.9995 [0.9988, 1.0000]
balanced_mean_critical_n=133.26
```

The striking power change is arithmetic before it is sophisticated statistics. A one-percent stratum contributes only four expected cases to a 400-case traffic sample. With 20% allocation, it contributes eighty. The exact test then has enough discordant pairs to distinguish 20% candidate-only from 2% baseline-only failures.

The balanced policy is not “best” without a loss function. It gains 2.25 power points over risk weighting but loses about 100 effective population observations. If the release decision needs precise overall impact as well as critical detection, that trade can be inferior.

## Statistical analysis and weighting

For observation (i) in stratum (h), the design weight is (w_i=P(h)/Q(h)), where (P) is the population share and (Q) is the sampling share. We use the self-normalized weighted delta:

```javascript
const delta = candidateOnly - baselineOnly;
const weight = populationShares[stratum] / sampleShares[stratum];
weightedDelta += weight * delta;
weightSum += weight;
weightSquareSum += weight * weight;

const populationDelta = weightedDelta / weightSum;
const effectiveN = weightSum * weightSum / weightSquareSum;
```

Self-normalization introduces small finite-sample behavior, visible in the nonzero mean biases, but prevents the enriched sample from masquerading as population traffic. The effective sample-size diagnostic makes the variance cost visible.

```output
heterogeneous uniform       power=0.0025 weighted_bias=-0.000129 N_eff=400.0
heterogeneous risk_weighted power=0.9770 weighted_bias= 0.000161 N_eff=256.4
heterogeneous balanced      power=0.9995 weighted_bias= 0.000247 N_eff=156.8
misranked risk_weighted     power=0.0015 naive_bias=-0.060558
null risk_weighted          power=0.0050 weighted_bias=0.000143
null balanced               power=0.0132 weighted_bias=-0.000161
```

The null false-alarm rates fall below 5% because the exact sign test has discrete attainable p-values at finite discordant counts. We did not tune the threshold to force nominal calibration. A randomized exact test could approach 5%, but would be harder to explain in a release review and would not change the principal contrast.

## Error analysis

The strongest counterexample is the misranked control. Risk weighting did not discover the routine stratum's large regression through the nominal critical test. Worse, the naive enriched estimate understated the population regression by 6.056 points because the allocation and the true harm ordering pointed in opposite directions.

There are four practical error modes:

1. **Stale strata:** incident categories reflect an old model or product surface.
2. **Leaky definition:** teams define “critical” after inspecting candidate failures.
3. **Unstable judges:** evaluator changes create discordance unrelated to the candidate.
4. **Zero-probability gaps:** a directed policy gives some production region no chance of selection, making population recovery impossible.

The [rare-outcome sampling literature](https://arxiv.org/abs/1904.00412) supports enrichment when simple random samples contain too few cases, while [distribution-preserving stratification](https://pubmed.ncbi.nlm.nih.gov/28613186/) emphasizes the cost of distorting the target distribution. Those are complementary warnings: enrich for discovery, preserve or reconstruct the population for estimation.

## Production readiness

Define strata from consequence, exposure, and historical miss data before testing the candidate. Version the taxonomy with the evaluation set. Require a nonzero sampling floor for every customer-visible workflow. Keep evaluator prompts, tool versions, and model settings fixed within paired cases.

Operate two ledgers. The detection ledger reports per-stratum discordances, exact or preregistered tests, minimum sample counts, and severity-weighted stop rules. The prevalence ledger reports sampling probabilities, inverse-probability weights, effective sample size, and a population-proportional shadow estimate. Never average the two ledgers into one unexplained “quality score.”

Roll back when a protected stratum crosses its preregistered harm boundary, when risk weights cannot be reconstructed, when effective sample size falls below the analysis plan, or when the random shadow stream contradicts the enriched estimate beyond a declared tolerance. A canary is not publish-ready merely because the global weighted interval includes zero; a critical stop rule can dominate the global estimand.

Before broad rollout, replay at least one held-out incident family that was not used to design the strata. Rotate a portion of the directed budget to uncertainty sampling or newly observed traffic. Compare risk scores with realized candidate-only discordance. If the ordering does not generalize, revise the taxonomy rather than increasing confidence through more repeats of the same misspecified design.

### Pre-register the decision, not only the sample

A sampling plan is incomplete without a decision table. For each protected stratum, write the minimum case count, harmful discordance threshold, statistical rule, severity owner, and required action. Separately define the population estimand, acceptable weighted delta, minimum effective sample size, and maximum difference from the random shadow stream. This prevents a team from switching to the more favorable summary after results arrive.

The rules can disagree legitimately. A candidate might improve the weighted population delta while triggering a critical-stratum stop. That is not an analytical failure; it expresses a consequence constraint. Conversely, a small weighted regression might be acceptable when it comes entirely from a low-severity workflow and the critical cells improve. Product owners must decide that loss function before the canary, not ask the statistic to invent it afterward.

Store selection probabilities with every sampled case. Reconstructing them from a later configuration is unsafe when allocation changes during a run. If sampling adapts, log the probability at selection time and use an estimator valid for that adaptive design. The current study uses fixed probabilities and makes no adaptive-sampling claim.

Finally, protect against evaluation-set overfitting. Retain a sealed incident family and refresh part of every stratum from recent production traffic. A model vendor, internal prompt team, or agent harness can inadvertently optimize against a stable canary. Risk enrichment makes that problem more acute because a small number of highly reused critical cases can dominate release decisions. Track case exposure, create semantically distinct variants, and require prospective evidence on unseen cases before calling a regression fixed.

## Reproducibility

The evidence directory contains the configuration, dependency-free runner, 48,000 repeat-policy rows across four scenarios and three policies, aggregates, statistical declaration, focal summary, manifest, and figure. No Torch, GPU, provider API, or local language model was used.

```sh
node run-experiment.mjs
node render-figure.mjs
```

The run is deterministic under seed `20260720`. Reproduction should verify the saved expected population deltas, row count, cell count, bootstrap configuration, and figure values rather than accepting a screenshot.

## Limitations and claim boundary

This study uses synthetic matched binary outcomes. It does not model free-form judge disagreement, severity uncertainty, correlated production incidents, multi-turn trajectories, adaptive sampling, customer churn, or the cost of a false block. The chosen 92/7/1 population and discordance probabilities are transparent stress conditions, not measurements of a deployed system.

The supported conclusion is narrow: under a valid preregistered risk stratification, directing a fixed canary budget toward a rare critical stratum can transform detection power, but the enriched raw rate is not a population estimate. Inverse-probability weighting and effective-sample reporting repair the declared estimand; they do not repair wrong strata.

Speculation begins beyond that boundary. We have not shown that 20% is an optimal critical allocation, that consequence scores are stable across model families, or that exact sign tests are superior to hierarchical models in live systems. The next confirmatory step is a prospective shadow canary using a frozen taxonomy, an independent population sample, and blinded release outcomes.

## Source and artifact ledger

- NIST AI RMF Core, accessed 2026-07-20: repeatable measurement, uncertainty, monitoring, and change management.
- [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework), updated with a 2026 critical-infrastructure concept note: governance context.
- [NIST Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf), July 2024: probability-and-consequence risk framing.
- [Near Optimal Stratified Sampling](https://arxiv.org/abs/1906.11289), 2019: label-efficient evaluation motivation.
- [Stratified Sampling Meets Machine Learning](https://proceedings.mlr.press/v48/liberty16.html), ICML 2016: allocation for aggregate accuracy.
- [Surrogate-guided rare-outcome sampling](https://arxiv.org/abs/1904.00412), 2019: enrichment for scarce outcomes.
- [Distribution-Preserving Stratified Sampling](https://pubmed.ncbi.nlm.nih.gov/28613186/), 2017: distribution-distance perspective.
- Local `config.json`, `repeat-results.csv`, `aggregate-results.json`, `statistical-analysis.json`, and `risk-weighted-canary-results.svg`: all numeric public claims.
