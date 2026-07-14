---
title: Test Repository Resampling Before Trusting Coding-Agent Gains
description: Measure when task-level confidence intervals misstate coding-agent gains, and learn the small-repository boundary where a cluster bootstrap also fails.
topic: AI Evaluation
level: Advanced
date: 2026-07-13
readingTime: 20
tags: coding-agents, benchmark-statistics, uncertainty, resampling
image: /content/v1/assets/repository-clustered-benchmark-uncertainty.svg
imageAlt: Coverage chart comparing task-level and repository-level confidence intervals across dependency strengths and repository counts
evidenceMode: experiment
qualityTier: deep-research
evidenceProject: operator/diy-project-blogs/projects/clustered-agent-benchmark-uncertainty
evidenceManifest: operator/diy-project-blogs/projects/clustered-agent-benchmark-uncertainty/evidence-manifest.json
---

A coding-agent leaderboard usually reports one success rate per system. The table looks as if hundreds of tasks supplied hundreds of independent observations. Repository-level benchmarks do not have that sampling structure: multiple issues come from the same codebase, share conventions and dependencies, and often reward the same agent behaviors. Treating every task as independent can make a five-point gain look more certain than it is.

We ran a controlled Monte Carlo study to isolate that failure mode. Across 1,200 simulated benchmark repeats per scenario, task-level intervals covered the true five-point treatment effect only 91.7% of the time under strong repository-level heterogeneity. Resampling whole repositories raised coverage to 93.5%. That is a meaningful correction, but not a universal recipe: with only 10 repositories, the simple percentile cluster bootstrap fell to 90.4% coverage, worse than both task-level methods.

The decision is therefore conditional. Preserve repository boundaries when the agent advantage plausibly varies by codebase, but do not mistake “clustered” for “automatically calibrated.” With few repositories, report the instability and compare a small-cluster method or collect more repositories. The study falsified the broad version of its own hypothesis: repository resampling was not consistently better across controls and cluster counts.

## Key finding and decision rule

Use the unit that could have generated independent variation in the effect you are estimating. If agent B is especially good on repositories with typed APIs and especially weak on repositories with dynamic metaprogramming, tasks inside one repository share an effect component. A task bootstrap destroys that component; a repository bootstrap preserves it.

Our strongest simulated dependency used 40 repositories, eight tasks per repository, and repository-specific treatment shifts drawn uniformly from ±20 percentage points around a population-average effect of +5 points. The task-normal interval reached 91.7% coverage, the task bootstrap 91.4%, and the repository bootstrap 93.5%. Their mean widths were 15.3, 15.1, and 16.2 percentage points respectively. The repository method paid about 0.9–1.1 points of interval width to recover 1.8–2.1 points of coverage.

That trade is useful only after a dependency audit. Under the zero-heterogeneity negative control, all three methods landed between 93.3% and 94.0%; repository resampling did not improve the result. The evidence supports a diagnostic workflow, not a blanket rule.

## Why repository-level coding evaluations create clusters

The original [SWE-bench paper](https://arxiv.org/abs/2310.06770) assembled 2,294 issues from 12 Python repositories. Its public [experiment repository](https://github.com/SWE-bench/experiments) stores results in repository-level subfolders. SWE-bench Pro later expanded to 1,865 problems from 41 repositories, still leaving many tasks nested inside a much smaller number of codebases ([SWE-Bench Pro paper](https://arxiv.org/abs/2509.16941)). SWE-bench-Live broadened the support to 1,319 tasks across 93 repositories ([SWE-bench-Live paper](https://arxiv.org/abs/2505.23419)). Those are better repository counts, but none turns task identity into an independence guarantee.

Repository membership can couple outcomes through at least four mechanisms:

- the same language, build system, and test idioms recur across issues;
- environment failures or flaky fixtures affect multiple tasks together;
- contamination and memorized project conventions are repository-specific;
- an agent scaffold’s navigation, patching, or dependency skills can have a repository-specific advantage.

Recent evidence makes the design issue operational rather than academic. On July 8, 2026, OpenAI reported that automated screening flagged 200 of 730 SWE-Bench Pro tasks as broken and human review identified 249, or 34.1% ([audit and methodology](https://openai.com/index/separating-signal-from-noise-coding-evaluations/)). Broken-task prevalence is a separate problem from clustered uncertainty, but both show why a raw task count is not an effective sample-size certificate.

## Methodology

### Hypothesis and estimand

The confirmatory hypothesis was directional: when paired agent outcomes share repository-level treatment heterogeneity, task-independent 95% intervals will under-cover the true mean effect, while resampling repositories will be materially closer to 95% coverage.

The estimand was the population mean paired success-rate difference, agent B minus agent A. It was fixed at +0.05 in every scenario. Each simulated task produced two Bernoulli outcomes and a paired delta in {-1, 0, +1}. Repository difficulty shifted both agents together by up to ±0.12. A separate repository treatment shift changed B’s advantage by 0, ±0.10, or ±0.20 depending on scenario. All probabilities remained inside [0, 1].

This is a simulation study, not a replay of a named leaderboard. Simulation is appropriate for coverage because the true effect is known; it also makes the claim narrower. We can identify estimator behavior under this hierarchical Bernoulli process. We cannot infer the intraclass correlation of a public benchmark from it.

### Data-generating process

The first implementation excerpt defines the hierarchy. Notice that `treatmentShift` is drawn once per repository and reused for its eight tasks. Moving that draw inside the task loop would remove the treatment-effect clustering we are testing.

```javascript
function simulateDataset(repositoryCount, heterogeneityHalfWidth) {
  const repositories = [];
  for (let repository = 0; repository < repositoryCount; repository += 1) {
    const difficulty = uniform(config.repositoryDifficultyHalfWidth);
    const treatmentShift = uniform(heterogeneityHalfWidth);
    const rows = [];

    for (let task = 0; task < config.tasksPerRepository; task += 1) {
      const probabilityA = config.baseSuccessProbability + difficulty;
      const probabilityB =
        probabilityA + config.trueTreatmentEffect + treatmentShift;

      const successA = bernoulli(probabilityA);
      const successB = bernoulli(probabilityB);
      rows.push(successB - successA);
    }

    repositories.push(rows);
  }
  return repositories;
}
```

The primary design used 40 repositories × 8 tasks = 320 paired task deltas. The repository-count ablation held strong heterogeneity fixed and changed the cluster count to 10, 20, 40, or 80, yielding 80, 160, 320, or 640 tasks. Every scenario used 1,200 independently generated datasets and 400 resamples per bootstrap interval. Monte Carlo standard error was computed as `sqrt(coverage × (1 - coverage) / 1200)`.

### Three interval estimators

The task-normal baseline estimated the standard error from all task deltas and used ±1.96 standard errors. The task bootstrap sampled individual deltas with replacement. The repository bootstrap sampled whole arrays of eight deltas, preserving within-repository dependence.

```javascript
function intervals(repositories) {
  const taskDeltas = repositories.flat();
  const estimate = mean(taskDeltas);
  const variance = taskDeltas.reduce(
    (sum, value) => sum + (value - estimate) ** 2,
    0,
  ) / (taskDeltas.length - 1);
  const standardError = Math.sqrt(variance / taskDeltas.length);
  const naive = [
    estimate - 1.96 * standardError,
    estimate + 1.96 * standardError,
  ];

  const taskBootstrap = [];
  const clusterBootstrap = [];
  for (let repeat = 0; repeat < config.bootstrapRepeats; repeat += 1) {
    let taskSum = 0;
    for (let i = 0; i < taskDeltas.length; i += 1) {
      taskSum += taskDeltas[Math.floor(random() * taskDeltas.length)];
    }
    taskBootstrap.push(taskSum / taskDeltas.length);

    let clusterSum = 0;
    for (let i = 0; i < repositories.length; i += 1) {
      const sampled = repositories[Math.floor(random() * repositories.length)];
      clusterSum += sampled.reduce((sum, value) => sum + value, 0);
    }
    clusterBootstrap.push(clusterSum / taskDeltas.length);
  }
  return percentileIntervals(estimate, naive, taskBootstrap, clusterBootstrap);
}
```

Percentile bootstraps were deliberately held constant so the resampling unit was the treatment. We did not tune interval types per scenario. That choice exposes a known boundary: the cluster percentile bootstrap can be biased with few clusters. Research on the [wild bootstrap with few treated clusters](https://onlinelibrary.wiley.com/doi/10.1111/ectj.12107/pdf) documents why “use a cluster bootstrap” is incomplete advice.

## Baselines, controls, and ablations

The task-normal interval is the common independence baseline. The task bootstrap tests whether nonparametric resampling alone fixes the problem. It should not: if it resamples the wrong unit, it still erases repository-level effect variation.

The zero-heterogeneity scenario is the negative control. Repository difficulty remains, but it shifts A and B together and largely cancels in the paired delta. The treatment effect is constant across repositories. Under that design, the task methods should no longer suffer the targeted mechanism.

The ±0.10 scenario is an effect-strength ablation. It tests whether a mild cluster component is enough to justify a wider interval. The answer was negative: task-normal coverage was 94.7%, closer to nominal than the repository bootstrap’s 94.1%. The strong ±0.20 scenario is where the expected ranking appeared.

Finally, the 10/20/40/80 repository ablation changes the number of independent effect draws without changing eight tasks per cluster. It tests the asymptotic assumption behind cluster resampling rather than merely adding more task rows.

## Results

The figure above is generated directly from the saved aggregate JSON. Error bars are ±1.96 Monte Carlo standard errors, not confidence intervals for an observed benchmark effect. A method that exactly achieved 95% coverage would lie on the horizontal reference.

Results table; source: the saved 1,200-repeat Monte Carlo artifact generated by the reproduction command below. The repository hierarchy is motivated by the public [SWE-bench experiment layout](https://github.com/SWE-bench/experiments); none of the table values comes from that benchmark.

| Scenario | Repositories / tasks | Task normal coverage | Task bootstrap coverage | Repository bootstrap coverage |
|---|---:|---:|---:|---:|
| No treatment heterogeneity | 40 / 320 | 94.0% | 93.8% | 93.3% |
| Moderate heterogeneity ±0.10 | 40 / 320 | 94.7% | 94.3% | 94.1% |
| Strong heterogeneity ±0.20 | 40 / 320 | 91.7% | 91.4% | 93.5% |
| Strong heterogeneity, few clusters | 10 / 80 | 91.9% | 91.7% | 90.4% |
| Strong heterogeneity, medium clusters | 20 / 160 | 91.6% | 91.9% | 92.5% |
| Strong heterogeneity, many clusters | 80 / 640 | 92.5% | 92.1% | 94.1% |

The strongest positive result is not that repository resampling reached a perfect 95%. It did not. The useful result is comparative: at 40 repositories under strong clustered effects, its absolute coverage error was 1.5 points versus 3.3 for the normal interval and 3.6 for the task bootstrap. At 80 repositories, its error fell to 0.9 points while the task methods remained 2.5–2.9 points low.

The strongest negative result is the 10-repository cell. The repository bootstrap covered only 90.4% of true effects, an absolute error of 4.6 points. That failed to outperform both task baselines. The method preserved the right dependency structure but had too few independent units for this percentile procedure to calibrate well.

```output
label repos tasks heterogeneity method coverage mcse width abs_error
heterogeneity-0 40 320 0.00 naive 0.940 0.007 0.153 0.010
heterogeneity-0 40 320 0.00 clusterBootstrap 0.932 0.007 0.149 0.017
heterogeneity-0.2 40 320 0.20 naive 0.917 0.008 0.153 0.033
heterogeneity-0.2 40 320 0.20 taskBootstrap 0.914 0.008 0.151 0.036
heterogeneity-0.2 40 320 0.20 clusterBootstrap 0.935 0.007 0.162 0.015
clusters-10 10 80 0.20 clusterBootstrap 0.904 0.008 0.303 0.046
clusters-80 80 640 0.20 clusterBootstrap 0.941 0.007 0.115 0.009
```

## Statistical analysis and uncertainty

Coverage is itself estimated. At observed coverage near 94%, the Monte Carlo standard error is about 0.7 percentage points; near 91%, it is about 0.8. A difference of three coverage points is therefore more persuasive than a difference of half a point. This is why we do not interpret the 94.7% versus 94.1% moderate-heterogeneity result as a meaningful win for task-normal inference.

The 400 inner bootstrap draws add discretization noise to percentile endpoints. Increasing that number would make each interval more stable but would not add independent datasets. The outer 1,200 repeats determine the precision of the coverage estimate. A production replication should vary both master seed and bootstrap count and verify that the substantive ranking persists.

Interval width supplies the cost side. Under strong heterogeneity with 40 repositories, the repository interval averaged 0.162 wide versus 0.153 for the normal interval. At 80 repositories those widths shrank to 0.115 and 0.108. Collecting more repositories improved the cluster method’s calibration and precision simultaneously; adding only more tasks to the same repositories would not create more independent treatment-effect draws.

```javascript
function summarizeCoverage(accumulator, repeats, confidenceLevel) {
  const coverage = accumulator.covered / repeats;
  const monteCarloSE = Math.sqrt(coverage * (1 - coverage) / repeats);
  return {
    coverage,
    coverageMonteCarloSE: monteCarloSE,
    meanIntervalWidth: mean(accumulator.widths),
    absoluteCoverageError: Math.abs(coverage - confidenceLevel),
  };
}

for (const method of ["naive", "taskBootstrap", "clusterBootstrap"]) {
  const metrics = summarizeCoverage(
    accumulators[method],
    config.monteCarloRepeats,
    config.confidenceLevel,
  );
  console.log(method, metrics);
}
```

```output
true_effect=0.050 confidence_level=0.950
outer_repeats=1200 bootstrap_repeats=400
strong_40_repo normal_abs_error=0.033 width=0.153
strong_40_repo task_bootstrap_abs_error=0.036 width=0.151
strong_40_repo repository_bootstrap_abs_error=0.015 width=0.162
few_10_repo repository_bootstrap_abs_error=0.046 negative_result=true
many_80_repo repository_bootstrap_abs_error=0.009 width=0.115
```

## Error analysis and limitations

The data-generating process is intentionally narrow. Repositories have equal task counts, treatment shifts are uniform and centered, task outcomes are Bernoulli, and clusters are independent of one another. Real benchmarks can have unbalanced repository sizes, heavy-tailed difficulty, shared upstream dependencies, temporal drift, missing runs, and correlated retries. Those conditions may alter every number in the table.

The simulation does not estimate the correlation in SWE-bench, SWE-Bench Pro, or any provider’s private evaluation. It therefore cannot support a claim that a published confidence interval is wrong. The correct next step is to compute repository-level paired deltas, inspect their dispersion, and run sensitivity analyses using the actual task hierarchy.

The simple percentile cluster bootstrap is not the strongest available small-cluster method. Cluster-robust t procedures, restricted wild cluster bootstraps, and randomization tests may perform better depending on the estimand and design. The [ClusterBootstrap package paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC7148287/) also documents multiple interval variants rather than one universal default. Our 10-cluster regression is a warning to compare methods, not evidence for a specific replacement.

Task quality remains orthogonal. An impeccably clustered interval around a score contaminated by broken tasks is still misleading. Conversely, a perfectly curated task set can still yield overconfident comparisons if its effective independent support is a small repository set.

## Production readiness: an evaluation protocol

For a real coding-agent release decision, keep the task-level paired data but make repository identity a first-class column. Report four views:

1. the overall paired effect and raw task count;
2. the number of repositories and task-count distribution per repository;
3. repository-level effect dispersion and leave-one-repository-out sensitivity;
4. at least two uncertainty procedures that preserve the suspected dependence.

Pre-register the primary resampling unit before looking at which interval favors the new agent. Do not derive a general repository-count cutoff from these four cells. In this simulation, the simple percentile cluster bootstrap was clearly unreliable at 10, improved at 20, and was closer to nominal at 40 and 80. A different effect distribution, cluster imbalance, or interval construction could move every transition. Treat the method as provisional whenever its leave-one-cluster-out and alternative-interval decisions disagree, regardless of repository count.

Rollback a promotion when the sign or decision threshold changes under leave-one-repository-out analysis, when a small number of repositories dominates the aggregate gain, or when plausible interval methods disagree about whether the minimum useful effect was reached. The release artifact should preserve per-task outcomes, repository IDs, harness versions, retry policy, and exclusion reasons so the interval can be regenerated.

## Reproducibility

The evidence bundle contains the configuration, experiment runner, 3.4 MB of per-repeat interval records, aggregate results, console audit, figure renderer, and generated SVG. It uses a seeded JavaScript pseudo-random generator and no model service or accelerator.

```sh
node run-experiment.mjs
node render-figure.mjs
sha256sum config.json run-experiment.mjs raw-results.json results.json
```

Reproduction should confirm 1,200 outer repeats, 400 inner bootstrap samples, 40 primary repositories, eight tasks per repository, a +0.05 true effect, and heterogeneity half-widths of 0, 0.10, and 0.20. Exact floating-point values are expected with the recorded runtime and seed; directional replication under a different seed is the stronger audit.

## Claim boundary

Supported: under the declared hierarchical Bernoulli process, task-level intervals under-covered a five-point paired effect when treatment advantage varied strongly by repository; resampling repositories was closer to nominal coverage with 40 and 80 repositories.

Supported negative result: a simple percentile repository bootstrap was worse than task-level alternatives with only 10 repositories, and it did not improve the zero- or moderate-heterogeneity controls.

Not supported: that every coding benchmark has material repository dependence; that these simulated coverage values describe a named leaderboard; that 40 repositories is always sufficient; or that the percentile cluster bootstrap is the best small-sample method.

The practical conclusion is deliberately narrower than “always cluster.” Make the dependency structure explicit, preserve it in uncertainty estimation, and test the few-cluster boundary before letting a leaderboard delta drive deployment.
