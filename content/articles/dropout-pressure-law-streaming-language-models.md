---
title: Schedule Dropout by Data Pressure in Streaming Language Models
description: Derive and audit a pressure-based dropout schedule using six matched multi-seed transformer runs, confidence intervals, negative controls, and reproducible artifacts.
topic: Transformer Training
level: Advanced
date: 2026-07-10
readingTime: 26
tags: dropout, transformer-training, regularization, scaling-laws, streaming-data, reproducibility
image: /content/v1/assets/dropout-pressure-law.svg
imageAlt: Paired validation-loss gains with confidence intervals for decaying dropout across OpenWebText10K, TinyStories, and WikiText-103
evidenceMode: experiment
qualityTier: deep-research
evidenceProject: operator/diy-project-blogs/projects/dropout-pressure-law-fieldbook
evidenceManifest: operator/diy-project-blogs/projects/dropout-pressure-law-fieldbook/evidence-manifest.json
---

A fixed dropout rate assumes that a model faces the same regularization pressure throughout training. A streaming language model violates that assumption by construction. Its parameter count stays fixed, the unique-token prefix grows, and the optimizer repeatedly samples an expanding corpus. The useful dropout rate can therefore move even when the architecture and optimizer do not.

The practical question is not whether dropout is generally useful. It is whether a schedule computed from measurable training state can beat the best fixed rate under matched conditions. Six locked-stream comparisons provide a qualified yes: a pressure-based decay schedule reduced final validation cross-entropy in all `24` paired seed comparisons across three datasets and two token budgets. The mean paired gains ranged from `0.0093` to `0.0473` nats, and every stored `95%` bootstrap interval stayed above zero.

That result has a sharp boundary. The schedule was initially worse in the `8M` trajectories: by `+0.0630` nats on OpenWebText10K, `+0.0005` on TinyStories, and `+0.0080` on WikiText-103 at the earliest measured prefix. The evidence supports a late-training allocation of regularization for these small transformers. It does not support blindly applying the coefficients to a frontier model or expecting immediate gains.

## Finding and Decision Summary

Use a data-pressure schedule when training behaves like a growing stream, static sweeps show a nonzero dropout optimum, and the team can calibrate the schedule within its own architecture-tokenizer-corpus regime. Keep a static control in every validation run.

The measured decision points are:

- At `4M` unique tokens, the paired gain over each seed's matched best-static run was `0.0473` nats for OpenWebText10K, `0.0123` for TinyStories, and `0.0252` for WikiText-103.
- At `8M`, the corresponding gains were `0.0340`, `0.0093`, and `0.0146` nats.
- The decay schedule won `5/5` seeds in every `4M` regime and `3/3` seeds in every `8M` regime.
- The weakest interval was WikiText-103 at `8M`: `[0.0002, 0.0273]` nats. It is positive but close enough to zero that a new regime should not inherit the conclusion without replication.
- Early prefixes are a failure zone, not a success story. A rollout should be judged over the intended stream horizon and guarded against early under-training.

For a conventional stationary corpus with one known token budget, a well-powered static sweep remains simpler and easier to audit. The schedule earns its complexity only when `U_t`, the unique data available at stage `t`, changes materially during a continuing run.

## Research Question and Hypothesis

The falsifiable hypothesis was: a dropout schedule driven by model-to-data pressure and compute-to-data pressure will lower final held-out next-token cross-entropy relative to matched static-dropout baselines across several streaming regimes.

This hypothesis starts from a familiar tension. The original [dropout study](https://www.jmlr.org/papers/v15/srivastava14a.html) treats stochastic masking as regularization against co-adaptation. Modern scaling work shows that parameter count and training tokens jointly determine useful compute allocation: compare the empirical framing in [Kaplan et al.](https://arxiv.org/abs/2001.08361) with the compute-optimal correction in [Chinchilla](https://arxiv.org/abs/2203.15556). Neither result directly specifies a time-varying dropout schedule, but together they motivate measuring regularization pressure as the data and sampling budget change.

The schedule family was:

`p_t = clamp(p_min, p_max, A*x_t + B*y_t + D*x_t*y_t + C0)`

where `x_t = log10(P / U_t)` and `y_t = log10(C_t / U_t)`. Here `P` is the trainable parameter count, `U_t` is the revealed unique-token prefix, and `C_t` is cumulative sampled training tokens. The interaction term allows the effect of repeated sampling to change with model-to-data pressure.

The coefficients are regime-specific. A regime includes the architecture family, `4,096`-token BPE, corpus, optimizer, dropout placement, streaming protocol, and evaluation distribution. The transferable object under test is the pressure-law structure, not one universal tuple of `A`, `B`, `D`, and `C0`.

## Methodology

The study used decoder-only causal Transformers derived from the core architecture and tokenizer ideas in [nanochat](https://github.com/karpathy/nanochat), with the standard four-times feed-forward expansion. The `4M` validations used `17.37M`-parameter or `31.46M`-parameter models depending on the dataset. The `8M` extrapolations used a `51.84M`-parameter `L20-H8-D448` model without refitting the dataset-specific coefficients.

Training used AdamW with learning rate `3e-4`, weight decay `0.1`, gradient clipping `1.0`, batch size `16`, block size `128`, and next-token cross-entropy measured in nats. One dropout probability was applied to embeddings, attention weights, attention residual output, and MLP output. All Torch training ran on Apple Silicon MPS; the runner rejected CPU, CUDA, and MPS fallback. Hardware is therefore controlled but narrow, and the measurements say nothing about throughput on distributed accelerators.

The locked-stream protocol preserved model and optimizer state while revealing larger prefixes. OpenWebText10K and WikiText-103 used `250k`, `500k`, `1M`, `2M`, and `4M` prefixes in the five-seed tier. TinyStories started at `500k`. The larger tier extended each stream to `8M` with three seeds. At each stage, minibatches were sampled only from the currently visible prefix.

The public datasets and their construction should be treated as part of the regime. The corpus lineage is documented by the [OpenWebText release](https://zenodo.org/records/3834942), the [WikiText paper](https://arxiv.org/abs/1609.07843), and the [TinyStories paper](https://arxiv.org/abs/2305.07759). Cross-dataset consistency is useful precisely because these distributions are not interchangeable.

The implementation computes pressure from training state and clamps the result to the calibrated range:

```javascript
function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function dropoutAtStage({
  parameters,
  uniqueTokens,
  sampledTokens,
  coefficients,
  minimum = 0.02,
  maximum = 0.65,
}) {
  if (parameters <= 0 || uniqueTokens <= 0 || sampledTokens <= 0) {
    throw new Error("pressure inputs must be positive");
  }

  const x = Math.log10(parameters / uniqueTokens);
  const y = Math.log10(sampledTokens / uniqueTokens);
  const raw =
    coefficients.A * x +
    coefficients.B * y +
    coefficients.D * x * y +
    coefficients.C0;

  return clamp(raw, minimum, maximum);
}
```

Clamping is a guardrail, not evidence that an extrapolation is valid. A schedule that repeatedly hits `0.02` or `0.65` is signaling that its inputs have left the calibrated surface. That should trigger a new static sweep, not confidence in the bound.

## Baselines and Controls

Each locked-stream run competed against a grid of fixed dropout values trained with the same dataset prefix sequence, architecture, optimizer, sampling budget, and seed. The final comparison used the best static condition in that run family. For paired inference, each decay seed was compared with its corresponding static seed rather than only comparing two aggregate means.

This baseline is demanding in one useful way and optimistic in another. It is demanding because decay must beat the best tested fixed rate, not an arbitrary `0.1` default. It is optimistic because the best static rate is identified from the tested grid; a finer unseen rate could perform better. The result should therefore be read as “beats this broad matched grid,” not “beats all constant probabilities.”

The first-order law without the interaction term was an ablation during coefficient development. Calibration used `15` or `16` static-sweep cells per dataset and checked leave-model and leave-prefix error. The interaction fits had mean absolute target errors of `0.0158` for OpenWebText10K, `0.0180` for TinyStories, and `0.0162` for WikiText-103. Those are schedule-fit diagnostics, not validation-loss gains.

The most informative negative control is temporal. If decay were merely a universally better regularizer, it should win immediately. It did not. At the earliest `8M` checkpoint, the decay path was worse than the best static path in all three datasets. The schedule only became favorable after the stream expanded and the prescribed dropout fell.

The strongest unresolved counterargument is schedule shape. The locked-stream evidence shows that this fitted decay beats the tested static grid, but it does not include a matched linear, cosine, or hand-tuned piecewise decay with the same initial and final probabilities. A simpler monotone schedule may capture much of the gain. Until that ablation is run, the interaction formula is an interpretable way to generate the tested path, not proof that its exact functional form is necessary.

## Results

The normalized values below are generated from the archived per-seed records in the study's [reproducibility snapshot](https://doi.org/10.5281/zenodo.20616633). The table reports paired gains, not the difference between independently selected aggregate means; that distinction explains why the OpenWebText10K `8M` paired value is `0.0340` while the aggregate final-mean difference is `0.0363`.

| Dataset | Final prefix | Model scale | Seeds | Decay loss | Best-static loss | Paired gain, nats | Stored 95% bootstrap CI |
|---|---:|---:|---:|---:|---:|---:|---:|
| OpenWebText10K | 4M | 31.46M params | 5 | 4.3981 | 4.4455 | 0.0473 | [0.0383, 0.0553] |
| OpenWebText10K | 8M | 51.84M params | 3 | 4.1793 | 4.2156 | 0.0340 | [0.0255, 0.0394] |
| TinyStories | 4M | 17.37M params | 5 | 2.5311 | 2.5444 | 0.0123 | [0.0059, 0.0179] |
| TinyStories | 8M | 51.84M params | 3 | 2.2086 | 2.2186 | 0.0093 | [0.0061, 0.0130] |
| WikiText-103 | 4M | 17.37M params | 5 | 4.0808 | 4.1105 | 0.0252 | [0.0196, 0.0313] |
| WikiText-103 | 8M | 51.84M params | 3 | 3.9572 | 3.9756 | 0.0146 | [0.0002, 0.0273] |

The generated audit output makes the pairing and early-stage control explicit:

```output
paired final-prefix audit (positive gain favors decay)
OpenWebText10K  4M gain=0.0473 ci95=[0.0383,0.0553] wins=5/5 early_delta=0.0463
OpenWebText10K  8M gain=0.0340 ci95=[0.0255,0.0394] wins=3/3 early_delta=0.0630
TinyStories     4M gain=0.0123 ci95=[0.0059,0.0179] wins=5/5 early_delta=0.0100
TinyStories     8M gain=0.0093 ci95=[0.0061,0.0130] wins=3/3 early_delta=0.0005
WikiText-103    4M gain=0.0252 ci95=[0.0196,0.0313] wins=5/5 early_delta=0.0532
WikiText-103    8M gain=0.0146 ci95=[0.0002,0.0273] wins=3/3 early_delta=0.0080
claim boundary: six measured small-transformer regimes; no frontier-scale extrapolation
```

The direction is consistent, but effect size is dataset-dependent. OpenWebText10K shows the largest measured reduction. TinyStories shows the smallest. That variation is a reason to retain per-regime calibration, not average the coefficients into a single global schedule.

In relative cross-entropy terms, the paired improvements are modest: approximately `0.37%` to `1.06%` of the matched static final loss. Cross-entropy differences can matter at scale, but these values should not be described as double-digit quality gains, and they are not directly equivalent to the same percentage change in perplexity or downstream task accuracy.

## Statistical Analysis and Uncertainty

The primary statistic is the mean of paired per-seed improvements, `static_loss - decay_loss`. Pairing removes some run-to-run variation because both conditions share the same seed and regime. The saved `95%` intervals were produced by bootstrap resampling those paired gains.

The article analyzer independently checks three invariants before publishing a row: the recorded paired mean must equal the mean recomputed from seed records, the win count must equal the number of positive gains, and the interval must contain the mean. The relevant audit logic is intentionally small:

```javascript
function validatePairedRun(run, label) {
  const gains = run.paired_records.map((record) => record.gain);
  const mean = gains.reduce((sum, gain) => sum + gain, 0) / gains.length;
  const wins = gains.filter((gain) => gain > 0).length;
  const tolerance = 1e-9;

  if (Math.abs(mean - run.paired_gain_mean) > tolerance) {
    throw new Error(`${label}: paired mean mismatch`);
  }
  if (wins !== run.paired_wins) {
    throw new Error(`${label}: paired win count mismatch`);
  }
  if (run.paired_gain_ci_low > mean || run.paired_gain_ci_high < mean) {
    throw new Error(`${label}: mean outside stored interval`);
  }

  return {
    repeats: gains.length,
    pairedGain: mean,
    wins,
    ci95: [run.paired_gain_ci_low, run.paired_gain_ci_high],
  };
}
```

Three to five seeds are enough to expose direction and obvious instability, but they are not enough to characterize tails. A bootstrap interval with `n=3` has coarse support and should not be interpreted like a large-sample confidence interval. The WikiText-103 `8M` lower bound of `0.0002` is especially fragile. One replication shift could erase that margin.

No multiple-comparison correction is applied across the six headline regimes. The consistency of `24/24` paired wins is notable, but the experiment family also includes calibration screens and exploratory runs. Confirmatory claims should remain attached to the locked-stream rows, not to every sweep observed during schedule development.

## Failure Analysis

The strongest counterexample is the beginning of training. In the `8M` protocol, OpenWebText10K at `250k` used dropout `0.433` and lost `0.0630` nats to the best static condition. WikiText-103 at `2M` was still worse by `0.0354` nats. A training team that early-stops on an intermediate checkpoint could rationally reject the schedule even though it wins at the final horizon.

```output
earliest and transition checkpoints; positive delta means decay is worse
OpenWebText10K 250k dropout=0.433 delta=+0.0630
OpenWebText10K   1M dropout=0.270 delta=-0.0148
TinyStories    500k dropout=0.253 delta=+0.0005
TinyStories      4M dropout=0.077 delta=-0.0057
WikiText-103   250k dropout=0.284 delta=+0.0080
WikiText-103     4M dropout=0.020 delta=+0.0037
WikiText-103     8M dropout=0.020 delta=-0.0184
```

There are at least four plausible failure mechanisms. First, an over-large early dropout can slow feature acquisition. Second, schedule changes alter optimization state without a restart, so transient loss may reflect path dependence. Third, a corpus shift can invalidate coefficients even when `P`, `U`, and `C` look familiar. Fourth, changing where dropout is applied changes the meaning of `p_t` itself.

An additional methodological risk is baseline selection. “Best static” is conditional on the tested grid. If a static optimum lies between grid points, the reported gain can be overstated. Before a high-cost rollout, fit a local quadratic around the apparent optimum or add rates bracketing it, then rerun matched seeds.

## Implementation in a Training Loop

Production integration needs more than evaluating a formula. The schedule must change only at deterministic stage boundaries, survive checkpoint restoration, and log every input that produced the active rate. A minimal controller can make those invariants explicit:

```javascript
class DropoutPressureController {
  constructor({ coefficients, minimum = 0.02, maximum = 0.65 }) {
    this.coefficients = coefficients;
    this.minimum = minimum;
    this.maximum = maximum;
    this.lastStage = -1;
  }

  transition({ stage, parameters, uniqueTokens, sampledTokens, modules }) {
    if (stage !== this.lastStage + 1) {
      throw new Error(`non-sequential stage transition: ${stage}`);
    }

    const probability = dropoutAtStage({
      parameters,
      uniqueTokens,
      sampledTokens,
      coefficients: this.coefficients,
      minimum: this.minimum,
      maximum: this.maximum,
    });

    for (const module of modules) {
      module.setDropoutProbability(probability);
    }
    this.lastStage = stage;

    return {
      stage,
      parameters,
      uniqueTokens,
      sampledTokens,
      probability,
      coefficientVersion: this.coefficients.version,
    };
  }
}
```

The event returned by `transition` belongs in the training trace and checkpoint metadata. On resume, recompute the expected value from persisted `P`, `U_t`, and `C_t`; fail closed if it differs from the stored probability. Silent schedule drift is worse than using a fixed rate because it creates a result that cannot be reconstructed.

## Production Readiness and Rollout

Start with a shadow comparison, not a full training replacement. Select one representative model size and run at least three matched seeds for decay and the locally best static rate. Pre-register the final prefix, validation split, primary metric, and minimum meaningful gain. Record intermediate deltas because the early loss is operationally important even when final loss improves.

A practical release policy is:

- Require all paired seeds to finish; do not compare survivor means after failed jobs.
- Block promotion if the lower interval bound crosses zero or if any seed regresses beyond the team's tolerance.
- Alert when the computed probability hits a clamp for two consecutive stages.
- Keep a static-dropout checkpoint route so training can resume without the controller.
- Roll back if validation loss remains above the matched static trajectory for two planned stage transitions, not merely two arbitrary log steps.
- Version the coefficient file with the tokenizer, corpus snapshot, architecture family, optimizer, and dropout placement.

The cost trade-off is straightforward: calibration adds static sweeps and paired runs, while the controller adds negligible runtime. The technique is attractive when the same regime will train many models or consume a long-lived stream. It is harder to justify for a one-off run where a small static sweep is cheaper than building evidence for schedule transfer.

## Reproducibility

The archived [study snapshot](https://doi.org/10.5281/zenodo.20616633) contains configs, per-stage metrics, coefficient fits, paper tables, and the MPS-only runner. The article bundle freezes the paper result summary, normalizes the six headline rows, checks paired arithmetic, writes two audit outputs, and generates the figure. It does not rerun long training jobs or infer missing values.

To reproduce the publication artifacts from the frozen summary, run the analyzer with Node.js. To reproduce training, use an MPS-capable PyTorch environment and the study's exact corpus caches, `4,096`-token BPE, seed sets, static grids, and locked-stream commands. The source implementations should retain the [nanochat license and attribution](https://github.com/karpathy/nanochat).

An independent replication should add two tests the current evidence lacks: at least `10` seeds for the weakest WikiText-103 `8M` effect, and an out-of-family architecture or tokenizer holdout. It should also compare against a piecewise schedule with the same start and end rates. That negative control would test whether the pressure formula contributes more than simply “high dropout early, low dropout late.”

## Claim Boundary

Supported: within the six measured small-transformer locked-stream regimes, the fitted pressure schedule beat the matched tested static grid at the final prefix, with positive stored paired bootstrap intervals and wins in every paired seed.

Not supported: universal coefficients, guaranteed gains at intermediate prefixes, frontier-scale transfer, throughput improvement, or superiority to every adaptive regularizer. Recent work on [dynamic dropout optimization](https://arxiv.org/abs/2411.03236) explores a broader design space; this study isolates one interpretable pressure schedule rather than settling that space.

The engineering takeaway is therefore conditional but useful. Treat dropout as a state variable when unique data grows during training. Calibrate it, preserve a static control, measure the whole trajectory, and let the final paired evidence decide whether the added control logic earns its place.
