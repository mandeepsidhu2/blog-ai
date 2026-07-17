---
title: Stop Peeking at LLM Evals Without a Sequential Test
description: Measure how repeated significance checks turn null benchmark runs into false wins, then choose a stopping rule that matches your release process.
topic: Evaluation Statistics
level: Advanced
date: 2026-07-17
readingTime: 24
tags: llm-evaluation, sequential-testing, benchmark-design, statistical-inference
image: /content/v1/assets/sequential-eval-peeking-audit.svg
imageAlt: False-positive rates for fixed-horizon, repeatedly peeked, and Bonferroni-controlled paired evaluation tests across review cadences
evidenceMode: experiment
qualityTier: deep-research
evidenceProject: operator/diy-project-blogs/projects/sequential-eval-peeking-audit
evidenceManifest: operator/diy-project-blogs/projects/sequential-eval-peeking-audit/evidence-manifest.json
---

An evaluation can use a valid paired test and still produce an invalid release decision. The failure happens when a team checks the same accumulating benchmark after every batch, stops when `p < 0.05`, and reports that crossing as though the sample size had been fixed in advance.

In a controlled simulation of paired binary LLM-evaluation outcomes, checking an ordinary two-sided McNemar-style test every 25 tasks until 400 tasks raised the null false-positive rate from 5.27% at a fixed horizon to 22.95%. The 95% Wilson intervals were 4.96–5.58% and 22.37–23.54%, respectively. A Bonferroni threshold controlled false positives at 1.57%, but it also reduced detection of the moderate simulated effect from 44.66% at the fixed horizon to 18.82%.

The operational conclusion is not “never look.” It is: decide whether an interim look is diagnostic or decision-making, pre-register the maximum sample and review schedule, and use an inference method whose error guarantee survives the stopping behavior you actually operate.

## Finding and decision summary

- Sixteen unadjusted looks made a nominal 5% test reject a true null in 22.95% of 20,000 runs: 4.36 times the fixed-horizon rate.
- More frequent reviews were worse. At 400 maximum tasks, naïve false positives were 13.10% with four looks, 16.96% with eight, 22.95% with 16, and 28.27% with 40.
- Bonferroni stayed below 5% in every declared null cell, but the focal 1.57% rate shows that “controlled” is not synonymous with “efficient.”
- A positive log-odds shift of 0.2 was detected in 61.57% of naïvely peeked runs, yet that apparent advantage mixes real power with the same invalid stopping process that inflated null discoveries.
- Use a fixed horizon when early stopping has little value. If early decisions matter, use a validated group-sequential, alpha-spending, or anytime-valid method and size it for that method.
- Before adopting any replacement, replay the complete procedure with an exact or continuity-corrected paired test, production-shaped task dependence, and the actual number of metrics and candidate models. This study demonstrates the stopping failure; it does not certify a drop-in sequential implementation.

## Hypothesis and claim ladder

The preregistered hypothesis was that unadjusted checks every 25 tasks would exceed the nominal 5% false-positive rate under a true null, while a one-time fixed-horizon analysis and a Bonferroni-controlled sequence would remain at or below 5%.

The first and third parts were supported. The fixed-horizon point estimate was 5.27%, slightly above 5%, although its 95% interval included 5%. That is a useful negative result: this experiment uses a normal approximation to the paired discordance count, so finite-sample calibration is not exact. The study therefore does not certify this particular test implementation as an exact 5% procedure.

The claim ladder is deliberately narrow:

1. **Supported:** repeated use of the declared unadjusted paired test inflated the family-wise chance of a false win under the declared generator.
2. **Supported:** Bonferroni controlled that error in these cells and paid a substantial detection-rate cost.
3. **Operational inference:** an eval pipeline should bind its release rule to its review schedule before outcomes arrive.
4. **Not established:** the best sequential method for a real benchmark, the effective number of independent looks, or the error rate under clustered tasks, judge noise, contamination, adaptive task selection, or model-version drift.

This distinction follows the broader sequential-inference literature. Johari and colleagues show why fixed-horizon p-values become unreliable under continuous monitoring and construct always-valid alternatives ([Operations Research, 2021](https://pubsonline.informs.org/doi/10.1287/opre.2021.2135)). Maharaj and colleagues describe deploying anytime-valid confidence sequences in an enterprise experimentation platform ([arXiv, 2023](https://arxiv.org/abs/2302.10108)). Those methods motivate the decision boundary here; this simulation does not implement or benchmark them.

## Methodology

### Data-generating process

Each simulated task has a latent difficulty sampled from a standard normal and scaled by 0.9. The baseline correctness probability is logistic with intercept -0.2. The treatment probability adds a log-odds effect of 0, 0.1, or 0.2. With probability 0.55, baseline and treatment share the same uniform draw; otherwise they draw independently. This produces paired outcomes and a realistic mixture of agreements and discordances without claiming to reproduce any named benchmark.

The confirmatory cell has a maximum of 400 paired tasks and one look every 25 tasks. The full ablation crosses maximum samples of 100, 200, 400, and 800 with review intervals of 10, 25, 50, and 100 tasks when the interval fits the maximum. Every method/effect/design cell uses 20,000 deterministic seeds.

```javascript
function simulateTrial(seed, maxTasks, lookEvery, effect, method) {
  const rng = mulberry32(seed);
  const looks = Math.floor(maxTasks / lookEvery);
  const threshold = method === 'bonferroni_peeking'
    ? config.alpha / looks
    : config.alpha;
  let wins = 0;
  let losses = 0;

  for (let task = 1; task <= maxTasks; task++) {
    const difficulty = normal(rng) * 0.9;
    const pBase = logistic(-0.2 + difficulty);
    const pTreat = logistic(-0.2 + difficulty + effect);
    const shared = rng() < config.pairCorrelation;
    const uBase = rng();
    const uTreat = shared ? uBase : rng();
    const base = uBase < pBase;
    const treat = uTreat < pTreat;
    if (treat && !base) wins++;
    if (base && !treat) losses++;
```

The outcome is not the observed accuracy difference. The decision statistic uses discordant pairs: tasks where treatment alone succeeds and tasks where baseline alone succeeds. Pairing matters because the two systems see the same task. Work on paired NLP evaluation likewise warns that instance-level pairing changes the comparison ([ACL-IJCNLP 2021](https://aclanthology.org/2021.acl-long.179/)).

### Decision rule

The fixed-horizon method tests once at the maximum sample. Naïve peeking tests at every scheduled look with alpha 0.05. Bonferroni peeking divides alpha by the number of planned looks and can stop at the first crossing.

```javascript
function mcnemarP(wins, losses) {
  const discordant = wins + losses;
  if (discordant === 0) return 1;
  const z = Math.abs(wins - losses) / Math.sqrt(discordant);
  return Math.min(1, 2 * (1 - normalCdf(z)));
}

const atLook = task % lookEvery === 0;
const eligible = method === 'fixed_horizon'
  ? task === maxTasks
  : atLook;
if (eligible && mcnemarP(wins, losses) < threshold) {
  return {
    significant: true,
    tasks: task,
    direction: Math.sign(wins - losses),
    wins,
    losses
  };
}
```

The approximation intentionally mirrors a lightweight evaluation pipeline. It also creates a boundary: an exact conditional McNemar test, continuity correction, permutation test, clustered model, or judge-aware hierarchical analysis can have different calibration.

### Uncertainty

For every rejection rate, the analysis reports a two-sided 95% Wilson interval over 20,000 independent repetitions. Monte Carlo uncertainty is therefore visible instead of hidden behind two decimal places.

```javascript
function wilson(k, n) {
  const z = 1.959964;
  const p = k / n;
  const den = 1 + z * z / n;
  const center = (p + z * z / (2 * n)) / den;
  const half = z * Math.sqrt(
    p * (1 - p) / n + z * z / (4 * n * n)
  ) / den;
  return [center - half, center + half];
}

rows.push({
  maxTasks,
  lookEvery,
  looks,
  effectLogOdds: effect,
  method,
  significantRuns: positives,
  rate: positives / config.seedCount,
  ci95Low: ci[0],
  ci95High: ci[1],
  medianTasks: median(stopTasks)
});
```

## Baselines and controls

The fixed-horizon test is the matched baseline because it uses the same generator, statistic, maximum sample, and nominal alpha while removing optional stopping. The zero-effect condition is the negative control. Review cadence and maximum sample are mechanism ablations. Effects of 0.1 and 0.2 show the power and stopping trade-off but are not estimates of real model gains.

Source: saved focal simulation rows; the test family is motivated by [always-valid inference](https://pubsonline.informs.org/doi/10.1287/opre.2021.2135), while the numeric values are generated by the reproducible run below.

| Method, focal 400-task design | Null rejection rate (95% CI) | Effect 0.1 detection | Effect 0.2 detection | Decision meaning |
|---|---:|---:|---:|---|
| Fixed horizon, one look | 5.27% (4.96–5.58) | 15.17% | 44.66% | Valid only for the declared final analysis |
| Naïve peeking, 16 looks | 22.95% (22.37–23.54) | 34.64% | 61.57% | Invalid mixture of power and false discovery |
| Bonferroni, 16 looks | 1.57% (1.41–1.75) | 4.76% | 18.82% | Controlled but highly conservative here |

The table is generated from the saved aggregate artifact. The simulated effects change treatment log odds, not percentage points of benchmark accuracy. Rates across effect rows are therefore not portable sample-size recommendations.

## Results

```output
Focal design: maxTasks=400, lookEvery=25, repeats=20,000
effect  method                rate     95% interval       median n
0.0     fixed_horizon         5.27%    [4.96%, 5.58%]    400
0.0     naive_peeking        22.95%    [22.37%, 23.54%]  400
0.0     bonferroni_peeking    1.57%    [1.41%, 1.75%]    400
0.1     fixed_horizon        15.17%    [14.67%, 15.67%]  400
0.1     naive_peeking        34.64%    [33.99%, 35.31%]  400
0.2     fixed_horizon        44.66%    [43.97%, 45.34%]  400
0.2     naive_peeking        61.57%    [60.89%, 62.24%]  300
0.2     bonferroni_peeking   18.82%    [18.28%, 19.36%]  400
```

The focal false-positive increase is 17.69 percentage points. Put differently, among 100 null comparisons operated this way, the simulation predicts roughly 23 declarations rather than roughly five. This is a property of the complete test-and-stop policy, not evidence that the underlying paired statistic is useless.

The cadence ablation exposes the mechanism:

```output
Null effect, maxTasks=400, repeats=20,000
review cadence   planned looks   fixed    naive    Bonferroni
every 100        4               4.91%    13.10%   3.36%
every 50         8               4.98%    16.96%   2.28%
every 25         16              5.27%    22.95%   1.57%
every 10         40              5.03%    28.27%   0.68%

At cadence=25:
maxTasks=100  naive=12.06%  Bonferroni=2.37%
maxTasks=200  naive=17.47%  Bonferroni=1.80%
maxTasks=400  naive=22.95%  Bonferroni=1.57%
maxTasks=800  naive=27.93%  Bonferroni=1.00%
```

Both more looks and a longer opportunity to cross inflate the naïve rule. Bonferroni becomes more conservative as the number of planned looks grows because it spends the same family-wise alpha equally even though test statistics are strongly correlated across nested samples.

## Statistical analysis and uncertainty

The null comparison is confirmatory: method, cadence, maximum sample, pairing, alpha, and repetition count were declared in `config.json` before the saved run. The other sample/cadence cells are ablations, and the nonzero effects are operating-characteristic screens.

The Wilson intervals quantify only Monte Carlo error. They do not include uncertainty over the data-generating process. Twenty thousand repeats can estimate the wrong world very precisely. This is why the article reports 22.95% for this generator rather than saying peeking “always quadruples” false discoveries. The methods also use distinct deterministic seed streams, so the displayed rate differences are comparisons of precisely estimated operating rates, not paired per-repeat treatment effects.

The Bonferroni result is a control, not the recommended endpoint. Modern anytime-valid methods build boundaries around the entire path rather than treating every correlated look as a separate independent test. Recent work continues to quantify the power and sizing cost of those boundaries ([Schultzberg, 2026](https://arxiv.org/abs/2606.18366)); counting-process variants show that sequential design must match the outcome process ([AISTATS 2025](https://proceedings.mlr.press/v258/lindon25a.html)).

## Production readiness: bind inference to the release state machine

Write four fields into every evaluation plan before the first outcome:

1. `max_tasks`: the largest confirmatory sample.
2. `decision_looks`: task counts at which ship/no-ship can change.
3. `test_family`: fixed-horizon, group-sequential, alpha-spending, or anytime-valid.
4. `terminal_actions`: ship, stop for harm, continue, or declare inconclusive.

A dashboard refresh is not automatically a statistical look. It becomes one when someone can stop, ship, change prompts, remove tasks, swap judges, or promote a model because of it. Preserve exploratory traces, but do not let them mutate the confirmatory cohort.

For a fixed-horizon workflow, hide inferential p-values until `max_tasks`; show quality diagnostics such as missing outputs, judge failures, latency, and category coverage. For a sequential workflow, compute the pre-registered boundary on every decision look and log cumulative alpha or the anytime-valid evidence process.

### Separate exploratory iteration from confirmation

Most model teams need fast feedback while prompts, tools, and rubrics are still changing. That is legitimate exploration, but it should end with a frozen candidate and a fresh confirmatory sample. Reusing the same tasks after selecting the winning prompt creates another selection channel that none of the three simulated methods covers.

A practical run ledger should record the candidate hash, model revision, sampling parameters, task-set revision, judge revision, retry policy, decision schedule, and every human-visible interim view. When an engineer changes the candidate after seeing outcomes, close that run as exploratory. Do not reset the dashboard counter while retaining the favorable evidence.

The same rule applies to multiple metrics. If release can occur when any of accuracy, tool success, safety, latency, or cost crosses its preferred threshold, the decision family is larger than a single McNemar test. Specify one primary favorable endpoint and treat the rest as guardrails or adjust the complete family. Safety guardrails can remain hard stops without being repurposed as evidence that the candidate is better.

An inconclusive result is an expected terminal state, not a pipeline error. If the maximum sample arrives without crossing a valid boundary, report the effect estimate and uncertainty, preserve the candidate, and decide whether a newly powered study is worth running. Quietly adding another 100 tasks because the p-value is 0.06 is exactly the optional extension this audit is designed to expose.

Finally, distinguish model randomness from task sampling. Repeating generations on the same tasks estimates within-task stochasticity; adding independently sampled tasks estimates broader task variation. A production-shaped analysis may need both levels, but twenty generations of ten tasks are not interchangeable with one generation of 200 independent tasks.

## Error analysis and limitations

The largest limitation is synthetic task generation. Real LLM evaluations can have repository clusters, repeated templates, shared judge biases, nondeterministic model sampling, and adaptive retries. Those dependencies change the effective sample size. The earlier library article on repository resampling addresses a different mechanism: cluster uncertainty at a fixed analysis horizon. Neither study licenses combining a cluster bootstrap with optional stopping without validating the combined procedure.

The normal approximation can be imperfect when discordant counts are small. That likely contributes to the focal fixed-horizon estimate above 5%. An exact conditional or continuity-corrected McNemar implementation is a required replication before turning these numeric rates into a release template. The study also uses one-sided operational interest but a two-sided statistical test, no correction for comparing multiple candidate models or metrics, and no futility boundary. Bonferroni is included because it is transparent, not because it is optimal.

Finally, stopping on safety harm is not the same as stopping for a favorable efficacy claim. A release process may and often should stop immediately for a critical regression. The consequence is that the favorable claim still needs an inference contract that accounts for how its data were inspected.

## Reproducibility

The evidence project contains the versioned configuration, runner, 4.8 MB focal trial table, aggregate results, figure renderer, and result SVG. It uses deterministic JavaScript and no model inference or Torch.

```sh
cd sequential-eval-peeking-audit
node run-experiment.mjs
node render-figure.mjs
shasum -a 256 artifacts/*
```

Expected artifact hashes for this run are `49c6bcce…1f9` for aggregate results, `e38a3ba9…b075` for focal trials, and `6357e45f…1f9` for the result SVG. The manifest traces the public claims to all three artifacts and to the code/config inputs.

Useful methodological references include the original always-valid inference preprint ([arXiv](https://arxiv.org/abs/1512.04922)), the production confidence-sequence report ([arXiv](https://arxiv.org/abs/2302.10108)), paired NLP evaluation guidance ([ACL Anthology](https://aclanthology.org/2021.acl-long.179/)), and a classical discussion of paired classifier tests ([JMLR](https://jmlr.org/papers/volume5/rifkin04a/rifkin04a.pdf)).

## Claim boundary

This study supports an operating claim: under the declared paired Bernoulli generator, unadjusted repeated looks materially inflate false wins, and a simple family-wise correction trades away substantial sensitivity. It does not estimate the error rate of a named benchmark or endorse Bonferroni as the best sequential design.

The production rule is therefore conditional and testable: if evaluation outcomes can change the release before the planned maximum sample, validate a sequential procedure under production-shaped dependence and judge noise. Otherwise, keep the confirmatory analysis fixed-horizon and treat interim views as diagnostics, not evidence of a win.
