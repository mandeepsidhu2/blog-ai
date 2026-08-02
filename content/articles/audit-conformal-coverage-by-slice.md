---
title: Audit Conformal Prediction Coverage by Decision-Critical Slice
description: Measure when nominal conformal coverage protects the average case but fails a high-variance slice, then choose a defensible calibration policy.
topic: Uncertainty Quantification
level: Advanced
date: 2026-07-31
readingTime: 22
tags: conformal-prediction, uncertainty-quantification, model-evaluation, distribution-shift
image: /content/v1/assets/conformal-slice-coverage.svg
imageAlt: Bar chart comparing critical-slice coverage for pooled, slice-calibrated, and normalized conformal intervals
evidenceMode: experiment
qualityTier: deep-research
evidenceProject: operator/diy-project-blogs/projects/conformal-slice-coverage-audit
evidenceManifest: operator/diy-project-blogs/projects/conformal-slice-coverage-audit/evidence-manifest.json
---

Conformal prediction can give a finite-sample coverage guarantee without assuming that a regression model is correct. That promise is valuable, but the noun after “coverage” matters. A pooled split-conformal interval can cover 90% of future cases on average while missing most cases in a small, high-variance slice that drives the real decision.

In 800 matched simulation repeats, a pooled 90% interval reached 90.01% marginal coverage when calibration and test cases were exchangeable. Yet it covered only 44.62% of the critical slice. The routine slice reached 92.40%, carrying the aggregate across the declared target. When the critical share rose from 5% during calibration to 20% in deployment, pooled marginal coverage fell to 82.82%. Slice-calibrated intervals restored critical coverage to 90.28% in that shifted cell, but only because the slice label was known and its calibration sample was large enough.

The decision is not “use Mondrian conformal everywhere.” It is: state whether the product needs marginal, group-conditional, or pointwise protection; construct calibration data for that contract; and monitor both coverage and interval width at the decision unit. A global green number is not evidence for a slice-level promise.

## Key Finding

The experiment supports four conclusions.

1. Exchangeability protects marginal coverage, not automatically every subgroup. The pooled interval was correctly calibrated for the combined population and still missed 55.38% of critical cases.
2. A case-mix shift can turn conditional undercoverage into marginal failure. Raising the high-noise slice from 5% to 20% lowered global coverage by 7.19 percentage points.
3. Slice calibration can recover a declared group target when groups are observable and represented. Its mean critical width was 4.999 residual units versus 1.774 for pooled calibration in the shifted cell.
4. The equal-noise negative control removed the mechanism: pooled routine and critical coverage were 89.98% and 89.97%, respectively.

This is a coverage-contract result, not a leaderboard result. It does not say the synthetic critical cases resemble a particular production population, and it does not make distribution-free pointwise conditional coverage possible.

## Methodology and Hypothesis

The preregistered hypothesis was that a pooled split-conformal interval targeting 90% marginal coverage would substantially under-cover a rare high-variance slice even under exchangeable sampling, and that increasing that slice’s deployment prevalence would also break the marginal target. Slice-conditional and correctly variance-normalized calibration were expected to restore the declared slice target.

Each repeat drew 4,000 calibration cases and 12,000 test cases. The base predictor was held fixed at zero so that the study isolated calibration behavior: the nonconformity score was the absolute residual. Routine residuals had standard deviation 1; critical residuals had standard deviation 3. The focal exchangeable cell used a 5% critical share in both calibration and test. The shift cell retained 5% in calibration and used 20% in test.

The finite-sample split-conformal quantile used the ceiling rank based on `n + 1`, rather than a library percentile that silently interpolates:

```javascript
function quantile(scores, targetCoverage) {
  const sorted = [...scores].sort((a, b) => a - b);
  const rank = Math.ceil((sorted.length + 1) * targetCoverage) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))];
}

function fitPooled(calibration, targetCoverage = 0.90) {
  const width = quantile(
    calibration.map(row => Math.abs(row.residual)),
    targetCoverage,
  );
  return () => width;
}

function scoreCoverage(testRows, intervalWidth) {
  const covered = testRows.map(row =>
    Math.abs(row.residual) <= intervalWidth(row) ? 1 : 0,
  );
  return covered.reduce((sum, value) => sum + value, 0) / covered.length;
}
```

The Gaussian residual process is intentionally simple. It makes the causal mechanism auditable: the only focal difference between slices is noise scale, and every policy sees identical draws within a repeat. The experiment is confirmatory for this declared process, not exploratory evidence about arbitrary real models.

## Baselines, Controls, and Ablations

Five policies were compared on the same cases.

- `pooled` fits one 90% absolute-residual quantile.
- `pooled_95` asks whether simply making one global interval more conservative fixes the slice.
- `mondrian` fits separate 90% quantiles for routine and critical cases.
- `max_slice` applies the wider of the two slice quantiles to every case.
- `oracle_normalized` divides residuals by the known slice standard deviation, calibrates one normalized quantile, then restores the case-specific scale.

The slice policy is only a few lines, but its assumptions are substantial:

```javascript
function fitSliceIntervals(calibration, targetCoverage = 0.90) {
  const widths = {};
  for (const slice of ['routine', 'critical']) {
    const scores = calibration
      .filter(row => row.slice === slice)
      .map(row => Math.abs(row.residual));
    if (scores.length < 100) {
      throw new Error(`insufficient calibration support for ${slice}`);
    }
    widths[slice] = quantile(scores, targetCoverage);
  }
  return row => widths[row.slice];
}

function fitNormalized(calibration, targetCoverage = 0.90) {
  const scores = calibration.map(row =>
    Math.abs(row.residual) / row.declaredScale,
  );
  const normalizedWidth = quantile(scores, targetCoverage);
  return row => normalizedWidth * row.declaredScale;
}
```

Two controls distinguish rarity, heteroscedasticity, and shift. The balanced heteroscedastic cell places 50% of cases in each slice; it tests whether the issue disappears when the high-variance group is not rare. The equal-noise negative control preserves the 5%-to-20% mixture shift but gives both slices standard deviation 1. If mixture change alone caused the gap, that control would fail. It did not.

The `max_slice` policy is a width-cost ablation, not a recommendation. It shows what happens when a team demands the worst known group’s interval for every request. The oracle-normalized policy is an information boundary: it uses the true scale that a real system must estimate prospectively.

## Results

The result table is computed from saved repeat-level rows. The methodological interpretation is grounded in the distinction between finite-sample marginal validity in [Lei et al.](https://arxiv.org/abs/1604.04173), conditional-validity limits in [Vovk](https://proceedings.mlr.press/v25/vovk12/vovk12.pdf), and heteroscedastic adaptation in [Romano, Patterson, and Candès](https://proceedings.neurips.cc/paper_files/paper/2019/hash/5103c3584b063c431bd1268e9b5e76fb-Abstract.html).

| Scenario and policy | Overall coverage | Routine / critical coverage | Mean overall / critical width |
|---|---:|---:|---:|
| Exchangeable, pooled 90% | 90.01% | 92.40% / 44.62% | 1.776 / 1.776 |
| Exchangeable, slice-calibrated | 90.03% | 90.02% / 90.21% | 1.814 / 4.975 |
| Shifted share, pooled 90% | 82.82% | 92.38% / 44.60% | 1.774 / 1.774 |
| Shifted share, pooled 95% | 88.46% | 97.17% / 53.61% | 2.196 / 2.196 |
| Shifted share, slice-calibrated | 90.07% | 90.02% / 90.28% | 2.317 / 4.999 |
| Equal-noise control, pooled 90% | 89.98% | 89.98% / 89.97% | 1.645 / 1.645 |

Making the pooled interval target 95% was a negative result: it did not improve critical coverage enough to meet even the original 90% requirement. Critical coverage rose only to 53.61% under shift, while routine coverage became 97.17%. A global safety factor spends width on the easy majority without resolving the high-variance slice.

The conservative max-slice interval did protect the critical group at 90.28%, but overall mean width expanded to 4.999. Slice calibration reached nearly the same group coverage with 2.317 mean width by spending width where it was needed. Oracle normalization reached 90.02% critical coverage with 2.304 mean width, but that result depends on knowing the true relative scale.

```output
exchangeable_rare_noisy/pooled: global=90.01% routine=92.40% critical=44.62%
exchangeable_rare_noisy/mondrian: global=90.03% routine=90.02% critical=90.21%
shifted_critical_share/pooled: global=82.82% routine=92.38% critical=44.60%
shifted_critical_share/pooled_95: global=88.46% routine=97.17% critical=53.61%
shifted_critical_share/mondrian: global=90.07% routine=90.02% critical=90.28%
shifted_critical_share/oracle_normalized: global=90.01% routine=90.00% critical=90.02%
equal_noise_control/pooled: global=89.98% routine=89.98% critical=89.97%
equal_noise_control/mondrian: global=90.04% routine=89.99% critical=90.23%
```

## Statistical Analysis and Uncertainty

Policies were paired within repeat. For each comparison, 5,000 bootstrap resamples were drawn over the 800 repeat-level differences. In the exchangeable focal cell, slice calibration improved critical coverage over pooled calibration by 45.59 percentage points, with a 95% paired bootstrap interval of 45.39 to 45.79 points. Its mean-width increase was only 0.038 residual units overall, with a 95% interval of 0.036 to 0.040, because critical cases were 5% of traffic.

Under the 20% deployment share, slice calibration improved critical coverage by 45.68 points, with a 95% interval of 45.52 to 45.85. It improved overall coverage by 7.25 points, with a 95% interval of 7.21 to 7.29, while increasing mean width by 0.543 units, with a 95% interval of 0.539 to 0.548.

```javascript
function pairedBootstrap(differences, samples, rng) {
  const estimates = [];
  for (let b = 0; b < samples; b += 1) {
    let total = 0;
    for (let i = 0; i < differences.length; i += 1) {
      total += differences[Math.floor(rng() * differences.length)];
    }
    estimates.push(total / differences.length);
  }
  return {
    mean: differences.reduce((a, b) => a + b, 0) / differences.length,
    low: quantile(estimates, 0.025),
    high: quantile(estimates, 0.975),
  };
}
```

```output
exchangeable mondrian-minus-pooled critical coverage: +45.59 pp
95% paired bootstrap interval: [+45.39, +45.79] pp
exchangeable mean-width change: +0.038 units [0.036, 0.040]
shifted mondrian-minus-pooled overall coverage: +7.25 pp
95% paired bootstrap interval: [+7.21, +7.29] pp
shifted critical coverage change: +45.68 pp [45.52, 45.85]
shifted mean-width change: +0.543 units [0.539, 0.548]
repeats=800 bootstrap_samples=5000 calibration=4000 test=12000
```

These tight intervals reflect a large controlled simulation, not certainty about an external deployment. The dominant production uncertainty is specification error: wrong slices, drifting residual distributions, dependent observations, delayed labels, and estimated scale.

## Why Marginal Validity Is Not a Slice Contract

Split conformal ranks calibration scores and transfers that rank under exchangeability. It does not require the underlying predictor to be unbiased, but it also does not promise equal error allocation. When 95% of cases have narrow residuals, their high coverage can compensate for severe misses on the remaining 5%.

The distinction is established in the literature. [Knowing What You Know](https://jmlr.csail.mit.edu/papers/v22/20-753.html) describes how marginally valid methods may protect easy examples at the expense of difficult ones. [CD-split and HPD-split](https://www.jmlr.org/papers/v23/20-797.html) targets more informative conditional regions. [A Unified Theory of Conditional Coverage](https://arxiv.org/abs/2605.11602), posted May 12, 2026, organizes recent conditional-coverage methods but does not repeal the information and sample-size constraints.

Distribution shift is a separate failure. [Conformal Prediction Under Covariate Shift](https://proceedings.neurips.cc/paper/2019/file/8fb21ee7a2207526da55a679f0332de2-Paper.pdf) derives weighted conformal methods when the likelihood ratio is known or accurately estimated. [Adaptive Conformal Inference](https://proceedings.neurips.cc/paper/2021/hash/0d441de75945e5acbc865406fc9a2559-Abstract.html) addresses online distribution change. Neither method means a team can ignore how traffic is selected or assume an estimated weight is correct.

## Choose the Estimand Before the Interval

Coverage is not one interchangeable metric. Marginal coverage asks whether a randomly drawn future outcome lands in its set. Group coverage asks the same question after conditioning on a declared group. Pointwise conditional coverage asks for protection near each feature value, a much stronger target that cannot generally be obtained distribution-free with useful finite intervals. A product document should name the estimand instead of writing only “90% conformal coverage.”

The action determines the right unit. A daily capacity forecast may legitimately use marginal coverage because the action is taken over the aggregate. A clinical escalation, fraud block, or safety review acts on one case, so an average guarantee may be operationally misaligned. A slice is decision-relevant when membership changes the loss of a miss, the feasible interval width, or the downstream action—not merely because an analyst can enumerate it.

Define a coverage budget and a width budget together. For example, a protected slice might require at least 90% observed coverage with a one-sided lower confidence bound above 87%, while no more than 5% of its intervals may exceed the range in which a human can act. These example thresholds are not validated by this study; they illustrate why statistical validity without usefulness is incomplete.

Slice-label error must be tested as a first-class treatment. Freeze a prospective labeler, measure its confusion matrix on independent cases, then rerun calibration after injecting plausible false-positive and false-negative rates. If the policy’s coverage collapses under observed label uncertainty, route ambiguous cases to the wider interval or abstain. Do not use a post-outcome label that is unavailable when the interval is produced.

Finally, treat coverage monitoring as delayed supervision. Until outcomes arrive, feature drift and width drift are early warnings, not proof of miscoverage. When labels mature, backfill cohort coverage by prediction timestamp and model revision. This prevents a recently widened interval from taking credit for old predictions or a retired model from contaminating the current release window.

## Error Analysis and Limitations

The largest limitation is that the slice label is perfect. Production groups may be inferred, delayed, contested, or only known after an outcome. Misclassification can mix the residual distributions again. A useful follow-up is a sensitivity curve over slice-label precision and recall, not a claim that labels are free.

The second limitation is the 200 expected critical calibration cases. A smaller slice produces a noisier quantile and unstable width. Teams should report the slice calibration count, quantile rank, interval-width distribution, and repeat-to-repeat sensitivity. Hierarchical or localized methods may borrow strength, but their assumptions become part of the release contract.

That sample requirement is the largest reproduction barrier. A rare, delayed-outcome slice may need weeks or months to accumulate 200 independent calibration cases, and dependence within users or sites reduces the effective count. Until the required evidence exists, the honest choices are a conservative shared interval, abstention, or keeping the route in shadow mode—not silently certifying a noisy slice quantile.

The third limitation is Gaussian residuals and a fixed predictor. Real residuals can be skewed, heavy-tailed, autocorrelated, censored, and changed by the interval itself through human escalation. Sequence, user, site, and time dependencies can violate exchangeability even when a dashboard shows a stable marginal histogram.

The fourth limitation is efficiency. A 4.999-unit critical interval may be statistically valid and operationally useless. Coverage must be paired with width, set size, abstention burden, and downstream loss. A method that always returns every answer has perfect coverage and no decision value.

## Production Readiness

Write the coverage contract before selecting a method. If only a population-level forecast is acted on in aggregate, marginal coverage may be appropriate. If an individual critical request triggers an intervention, report coverage at the smallest stable group that changes the action.

Use a sealed calibration window. Preserve model revision, feature transform, score definition, slice policy, quantile rule, calibration counts, and data timestamps. Do not tune slices after seeing the release set and then call the same set confirmatory.

Monitor a two-dimensional surface: coverage and width by slice. Add traffic share, label delay, abstention rate, and downstream cost. Trigger rollback when a protected slice falls below its lower confidence bound, when width exceeds the action’s useful range, or when the slice classifier drifts outside its validated confusion matrix.

Shadow new calibration policies before routing decisions through them. Compare pooled, slice-aware, and adaptive candidates on identical cases. Preserve failures, including empty slices and extreme widths, as first-class outputs rather than dropping them from the denominator.

## Reproducibility

The saved evidence includes the fixed configuration, dependency-free runner, 16,000 repeat-policy rows, aggregate results, paired bootstrap analysis, measured-output summary, and rendered result figure. The complete run represents 38.4 million calibration cases and 115.2 million test cases across policy-matched repeats; policies reuse cases rather than generating independent samples.

Reproduction requires only a current JavaScript runtime:

```sh
node run-experiment.mjs
node render-figure.mjs
```

Check that the equal-noise control eliminates the slice gap before interpreting the focal result. Then verify that the aggregate JSON can be regenerated from the repeat CSV and that the figure values match the saved summaries. No model inference, accelerator, customer data, or external service is involved.

## Claim Boundary

The supported claim is narrow: in the declared two-slice residual process, nominal pooled split-conformal coverage can be exactly correct marginally and severely wrong for a rare high-variance slice; a prevalence shift can then break the marginal target. Slice calibration restores the declared group target when labels are known and calibration support is sufficient.

The evidence does not establish distribution-free pointwise conditional coverage, validate any named model, choose universal slices, or prove that Mondrian calibration is always the most efficient response. The practical lesson is to align the reported coverage unit with the decision unit—and to treat that alignment as part of the model’s release contract.
