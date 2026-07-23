---
title: Audit Pairwise LLM Judges Beyond Answer-Order Swaps
description: Reproduce 800 paired evaluation trials showing why answer-order swaps expose position bias but cannot certify a judge against consistent content bias.
topic: LLM Evaluation Reliability
level: Advanced
date: 2026-07-21
readingTime: 27
tags: llm-as-a-judge, pairwise-evaluation, model-selection, position-bias, statistical-testing
image: /content/v1/assets/pairwise-judge-swap-results.svg
imageAlt: Bar chart comparing candidate win-rate estimates from five pairwise judge aggregation policies against a 48 percent latent truth
evidenceMode: experiment
qualityTier: deep-research
evidenceProject: operator/diy-project-blogs/projects/pairwise-judge-swap-audit
evidenceManifest: operator/diy-project-blogs/projects/pairwise-judge-swap-audit/evidence-manifest.json
---

Swapping two answers is a necessary diagnostic for a pairwise LLM judge. It is not a certificate that the resulting model ranking is correct. A judge can choose the same candidate in both orders because that candidate is genuinely better, or because the judge consistently rewards its verbosity, tone, formatting, dialect, or model-family signature. The swap distinguishes those explanations only when the bias changes with position.

We tested this boundary in 800 repeated release samples, each containing 500 paired answers with saved latent winners. The candidate's true win probability was 48%, below the incumbent. Presenting the candidate first produced a 65.90% estimated win rate. Randomizing one presentation per pair reduced the estimate to 55.92%. Evaluating both orders and treating disagreements as ties produced 55.97%, while dropping disagreements increased the estimate to 57.45% and discarded 19.86% of the sample. All four rules promoted the losing candidate in at least 95% of repeats under the focal stress condition.

The controls identify why. With position bias but no candidate-correlated style preference, swap-and-tie estimated 49.18%; with style bias but no position effect, it estimated 57.46%. Order swapping repaired the order mechanism and left the consistent content mechanism untouched. That is the decision-relevant result: swap consistency measures invariance to presentation order, not agreement with human intent.

## Finding and decision summary

- Candidate-first judging added 17.87 percentage points of bias and falsely promoted the candidate in all 800 focal repeats.
- Randomizing one order removed the systematic first-position advantage in expectation, but the surviving style preference left 7.89 points of mean bias.
- Two-order evaluation made 19.86% of pairs discordant. Those pairs are an instability signal, not missing data to erase.
- Dropping discordant pairs retained only 80.14% coverage and increased bias to 9.42 points because the retained set was selected by judge consistency.
- Treating discordance as a tie preserved coverage but still left 7.94 points of bias and a 98.13% false-promotion rate.
- Sending only discordant pairs to perfect adjudication reduced bias by merely 0.39 points relative to swap-and-tie. Consistently wrong pairs never entered the review queue.
- In the position-only control, swap-and-tie reduced the 11.16-point candidate-first bias to 1.16 points. The residual comes from an imperfect binary judge shrinking outcomes toward 50%, not from the removed order effect.
- The experiment supports a release design with randomized ordering, explicit discordance, and a separately sampled human calibration set. It does not supply a universal review fraction or characterize any named production judge.

Use order swaps to detect order sensitivity. Use representative, judge-blinded human labels to estimate accuracy and candidate-correlated error. A judge should not be allowed to validate itself merely by repeating the same preference after the labels move.

## Research question and hypothesis

The confirmatory question was: if a release team evaluates both answer orders, can it safely interpret position-consistent judgments as candidate quality? The hypothesis predicted that swapping would neutralize a pure position override but would not prevent false promotion when the judge had a candidate-correlated content preference. It also predicted that dropping discordant swaps would create a selected denominator and could look more decisive than a full-coverage estimator.

The question is grounded in observed evaluator behavior. The original [MT-Bench and Chatbot Arena judge study](https://proceedings.neurips.cc/paper_files/paper/2023/file/91f18a1287b398d378ef22505bf41832-Paper-Datasets_and_Benchmarks.pdf) documents position, verbosity, and self-enhancement limitations. A systematic position-bias study evaluated more than 100,000 judgments across 12 judges, 22 tasks, and about 40 candidate models, finding that position effects vary by judge and task rather than behaving as chance alone in [Shi et al.](https://arxiv.org/abs/2406.07791). [Large Language Models Are Not Fair Evaluators](https://huggingface.co/papers/2305.17926) proposes balanced-position calibration, multiple evidence, and human escalation.

Recent work widens the boundary. A 2026 study comparing nine mitigation strategies across five judge models and three benchmarks reports style bias substantially larger than position bias in its tested settings in [Judging the Judges](https://arxiv.org/abs/2604.23178). A multilingual investigation finds that answer language can change pairwise preference beyond what perplexity alone explains in [Fairness or Fluency?](https://arxiv.org/abs/2601.13649). These studies motivate the mechanisms; our saved experiment isolates them rather than claiming new measurements of those models.

## Methodology

### Population and latent truth

Each repeat generates 500 independent answer pairs. The candidate is truly better on 48% in expectation, while 40% of pairs are hard. The judge reads a shared content representation before answer position is applied. Its probability of matching latent truth is 86% on easy pairs and 62% on hard pairs. Those values are declared stress parameters, not estimates from a provider.

The same pairs feed all six aggregation policies inside a repeat. This matched design prevents a lucky task draw from being mistaken for an aggregation effect.

```javascript
for (let i = 0; i < pairsPerRepeat; i++) {
  const truth = random() < 0.48
    ? "candidate"
    : "incumbent";
  const hard = random() < 0.40;
  const judgeAccuracy = hard ? 0.62 : 0.86;

  let contentWinner = random() < judgeAccuracy
    ? truth
    : opposite(truth);

  const styleExposed = random() < 0.35;
  if (
    styleExposed &&
    contentWinner === "incumbent" &&
    random() < styleFlipRate
  ) {
    contentWinner = "candidate";
  }

  pairs.push({
    truth,
    hard,
    styleExposed,
    contentWinner
  });
}
```

The style mechanism applies to 35% of pairs and flips an incumbent content verdict toward the candidate with probability 48% in the focal scenario. It represents any repeatable candidate-correlated feature that the rubric should not reward. We deliberately do not name the feature “verbosity” because the simulation does not generate text or measure length.

### Presentation and judge mechanism

Each pair is evaluated candidate-first and incumbent-first. With probability 20%, position overrides content and the judge selects the first answer. Otherwise, the shared content verdict survives. Reusing the content verdict across the two presentations represents a stable latent judge impression; independent position overrides can still make the pair discordant.

```javascript
function judge(contentWinner, candidateFirst, positionRate) {
  const positionOverride = random() < positionRate;
  if (positionOverride) {
    return candidateFirst ? "candidate" : "incumbent";
  }
  return contentWinner;
}

for (const pair of pairs) {
  pair.ab = judge(
    pair.contentWinner,
    true,
    positionOverrideRate
  );
  pair.ba = judge(
    pair.contentWinner,
    false,
    positionOverrideRate
  );
  pair.randomOne = random() < 0.5
    ? pair.ab
    : pair.ba;
}
```

This is not a conversational judge emulator. It is a causal stress test with transparent knobs: truth, difficulty, content correctness, candidate-correlated preference, and order override. The design asks which errors each policy can identify under those knobs.

### Aggregation policies and promotion rule

Candidate-first uses only the presentation with the candidate in position A. Randomized-single selects one of the two orders at random. Swap-drop counts only pairs whose two judgments select the same candidate identity. Swap-tie assigns 0.5 to discordant pairs. Swap-escalate sends discordant pairs to a perfect reference adjudicator. Truth-reference reads all latent labels and bounds sampling variation.

```javascript
for (const pair of pairs) {
  if (policy === "candidate_first") {
    scores.push(pair.ab === "candidate" ? 1 : 0);
  } else if (policy === "randomized_single") {
    scores.push(pair.randomOne === "candidate" ? 1 : 0);
  } else if (pair.ab === pair.ba) {
    scores.push(pair.ab === "candidate" ? 1 : 0);
  } else if (policy === "swap_tie_aware") {
    scores.push(0.5);
  } else if (policy === "swap_escalate") {
    scores.push(pair.truth === "candidate" ? 1 : 0);
    escalated += 1;
  }
}

const estimatedWinRate = mean(scores);
const promote = estimatedWinRate > 0.52;
const coverage = scores.length / pairs.length;
```

The release rule promotes above a 52% observed win rate. Because finite 500-pair samples vary, even truth-reference exceeds 52% in 4.25% of repeats. We report that sampling risk rather than redefine every truth-sample exceedance as judge bias. A production gate should use a preregistered interval or test, but changing the threshold does not repair systematic judge error.

The policies do not consume equal judge budgets. Randomized-single uses 500 calls; each swap policy uses 1,000 judge calls plus any human reviews. The comparison therefore estimates bias behavior, not cost efficiency. A production decision should put quality against total judge calls, billed tokens, reviewer minutes, and time to decision. Doubling calls is justified only if the additional verdicts change a release risk that matters.

## Baselines and controls

The truth-reference baseline separates aggregation error from sample composition. Candidate-first is the unsafe but common presentation baseline. Randomized-single is a budget-matched baseline using exactly one judgment per pair.

The position-only control sets the style flip rate to zero. It asks whether two-order aggregation repairs the mechanism it observes. The style-only control sets position overrides to zero; both presentations therefore agree, exposing the central negative result. The unbiased negative control removes both injected biases but retains imperfect judge accuracy and the hard/easy mixture. Its estimate is near 49%, not exactly 48%, because symmetric classification error pulls a below-50% rate toward 50%.

All controls use 800 repeats, 500 pairs, identical policy code, and the same 52% promotion threshold. We did not tune scenario parameters after observing the policy ranking. The confirmatory evidence is the complete four-scenario run saved in `repeat-results.csv`; exploratory parameter sweeps would need separate artifacts and labels.

## Results

The table is sourced from `aggregate-results.json` in the [versioned evidence repository](https://github.com/mandeepsidhu/blog-ai). Brackets are 95% nonparametric bootstrap intervals over 800 repeat-level estimates.

| Policy | Estimated candidate win rate | Bias vs paired latent truth | False promotion | Discordant | Coverage |
|---|---:|---:|---:|---:|---:|
| Candidate always first | 65.90% [65.75, 66.05] | +17.87 points [17.70, 18.04] | 100.00% | 0.00% | 100.00% |
| One randomized order | 55.92% [55.76, 56.07] | +7.89 points [7.71, 8.08] | 95.13% [93.63, 96.50] | 0.00% | 100.00% |
| Two orders, drop discordant | 57.45% [57.28, 57.62] | +9.42 points [9.24, 9.61] | 99.00% [98.25, 99.63] | 19.86% | 80.14% |
| Two orders, discordant=tie | 55.97% [55.83, 56.11] | +7.94 points [7.78, 8.12] | 98.13% [97.13, 99.00] | 19.86% | 100.00% |
| Review discordant only | 55.58% [55.42, 55.73] | +7.55 points [7.40, 7.70] | 94.75% [93.25, 96.25] | 19.86% | 100.00% |
| Latent truth reference | 48.03% [47.86, 48.18] | 0.00 points | 4.25% [2.88, 5.63] | 0.00% | 100.00% |

```output
repeats=800
pairs_per_repeat=500
true_candidate_probability=48.00%
single_candidate_first estimate=65.90% bias=17.87pp false_promotion=100.00%
randomized_single estimate=55.92% bias=7.89pp false_promotion=95.13%
swap_drop_discordant estimate=57.45% bias=9.42pp false_promotion=99.00%
swap_tie_aware estimate=55.97% bias=7.94pp false_promotion=98.13%
swap_escalate_discordant estimate=55.58% bias=7.55pp false_promotion=94.75%
truth_reference estimate=48.03% bias=0.00pp false_promotion=4.25%
```

Candidate-first combines both biases. Randomization removes the mean positional advantage across many pairs but cannot remove a candidate-linked preference. Swap-drop makes the retained subset look even stronger because order-unstable pairs leave the denominator. Swap-tie avoids that selection, yet stable judge errors remain candidate wins.

## Statistical analysis and uncertainty

The bootstrap intervals describe repeated 500-pair samples from this generator. They are narrow because there are 800 repeat estimates, not because 500 pairs would precisely characterize a live evaluator. The operational false-promotion rate combines task sampling, judge error, and the declared threshold.

The controls are more informative than the focal point estimate. In the position-only scenario, candidate-first estimated 59.18% and falsely promoted in every repeat. Swap-tie estimated 49.18%, with an 8.38% promotion rate; reviewing discordant pairs estimated 48.77%. Thus two-order evaluation largely removed the injected order effect.

In the style-only scenario, every pair was position-consistent and swap-tie estimated 57.46%, promoting in 99.00% of repeats. There was nothing for an order-discordance queue to catch. That failed mitigation is the central negative result.

Dropping and tying answer different statistical questions. Swap-drop estimates preference among the subset on which the judge is order-consistent; swap-tie estimates a full-sample score after assigning an explicit utility of one-half to instability. Neither is automatically the human win rate. Publish the coverage and discordance beside either estimate, and name the estimand before looking at the candidate result.

```output
position_only candidate_first estimate=59.18% bias=11.16pp promote=100.00%
position_only swap_drop estimate=48.97% bias=0.96pp promote=11.50%
position_only swap_tie estimate=49.18% bias=1.16pp promote=8.38%
position_only swap_review estimate=48.77% bias=0.75pp promote=7.25%
style_only swap_tie estimate=57.46% promote=99.00%
unbiased_control swap_tie estimate=49.00% promote=8.88%
focal discordant_rate=19.86% swap_drop_coverage=80.14%
```

The study does not test nominal p-values for one judge run because its generator parameters are known. A production study should estimate paired differences against human labels with cluster-aware intervals if prompts share users, repositories, documents, or templates. It should also report the calibration sample independently of the release comparison so a human label used to tune the rubric is not reused to certify it.

## Error analysis

First, “style bias” is a broad mechanism. A production judge may respond to length, citations, markdown, assertiveness, dialect, safety language, or model-family fingerprints, and those effects can interact with actual quality. This simulation proves that a consistent candidate-correlated error survives swaps; it does not identify which feature causes an observed disparity.

Second, perfect adjudication of only discordant pairs is intentionally generous and still insufficient. A realistic reviewer also makes errors. More importantly, consistent mistakes are never sampled. Review allocation must include a random sample of consistent candidate wins, consistent incumbent wins, ties, difficulty strata, and safety-critical slices.

Third, a binary latent winner compresses genuine ties and severity. Some release decisions should use per-criterion outcomes or regret-weighted utility rather than a single winner. If a candidate wins prose quality but introduces rare factual failures, an aggregate preference rate can approve the wrong product even with perfect labels.

Fourth, the generator treats pairs as independent. Live evaluation often clusters by conversation, author, locale, repository, or template. Naive pair-level intervals then overstate effective sample size. Resample at the deployment unit or use a hierarchical model.

Fifth, model judges can be nondeterministic and versioned behind an API alias. Save judge model ID, provider version, system prompt, rubric, answer order, sampling parameters, full verdict, parsing status, and usage. A swap audit without replayable inputs cannot distinguish model change from sampling change.

## Production readiness

Build four ledgers. The pair ledger stores the prompt, candidate identities under blinded labels, answer hashes, order, judge revision, verdict, and rationale. The swap ledger stores identity-consistency and whether both calls parsed. The calibration ledger stores independently adjudicated human labels and reviewer disagreement. The decision ledger stores the preregistered estimator, interval, slice constraints, and release action.

Randomize labels and position even when both orders are evaluated; static “candidate=A” creates an avoidable confound in logs and prompts. Do not silently retry malformed judge output until it produces a winner. Parsing failure is an evaluation outcome and may differ by answer style.

Set separate gates for accuracy and stability. For example, require order-discordance below a declared ceiling, human agreement above a minimum on a sealed calibration sample, no candidate-linked error beyond a slice tolerance, and an uncertainty-aware candidate advantage. These are distinct claims. A low discordance rate cannot substitute for human agreement.

Rollback the judge configuration when position preference changes, human agreement falls, a candidate or language slice breaches its error limit, unparseable responses rise, or the provider model revision is no longer pinned. Keep the prior judge, rubric, and calibration sample replayable. Do not roll back the product model solely because the judge moved until the decision is independently adjudicated.

### A calibration design that can falsify the judge

Sample human review before seeing judge consistency. Stratify on business-critical dimensions and oversample severe outcomes, but use weights when estimating population preference. Blind reviewers to candidate identity and randomize display order. Collect at least two labels on a subset to estimate human disagreement.

Then create a 2×2 error table: judge says candidate/incumbent against human says candidate/incumbent. Break it down by presentation order, response length ratio, locale, task family, tool use, refusal status, and candidate identity. Order swapping belongs in that table; it does not replace it.

When human labels are expensive, use a two-phase sample: a probability sample from all pairs plus a larger diagnostic sample from discordant, high-impact, or low-confidence pairs. Report population estimates from the probability sample and diagnostics from the enriched sample. Combining them without weights recreates the selected-denominator problem demonstrated by swap-drop.

## Reproducibility

The reproducibility bundle contains the fixed configuration, dependency-free runner, 19,200 repeat-policy rows plus header, aggregate bootstrap summaries, statistical analysis, console output, and the result figure. After checking out the linked evidence repository and entering the study directory, run:

```sh
node run-experiment.mjs
```

The generator uses a fixed 32-bit seed. The script overwrites derived artifacts deterministically. Reproduction requires no API key, model inference, Torch, GPU, or network. Inspect `config.json` before interpreting any number; changing true win rate, difficulty, judge accuracy, style exposure, override rates, or release threshold defines another experiment.

For a live replication, replace latent labels with a sealed adjudication file and implement the same six policies over saved judge calls. Do not simulate missing labels, fill failed judgments with ties, or use a newer judge alias without recording the change.

## Claim boundary

Supported: answer-order swapping is an effective diagnostic for the injected position override; order-consistent judgments can remain badly biased under a candidate-correlated preference; dropping discordant pairs changes the estimand and reduces coverage; reviewing only discordant pairs misses consistent errors.

Not supported: a claim that all LLM judges have the focal bias magnitude, that 19.86% is a universal discordance rate, that style bias always exceeds position bias, that human review is infallible, or that pairwise judging should be abandoned. The result is a mechanism study with declared stress parameters.

[Chatbot Arena](https://arena.ai/blog/arena/) shows why anonymous randomized pairwise comparison is valuable at scale. [Autorubric](https://scale.stanford.edu/ai/repository/autorubric-unified-framework-rubric-based-llm-evaluation) illustrates a broader implementation surface with option shuffling, atomic criteria, and configurable aggregation. Neither changes the validation principle: invariance checks diagnose specific transformations, while correctness requires an external reference tied to the decision.

## Source and evidence ledger

- [Zheng et al., MT-Bench and Chatbot Arena](https://proceedings.neurips.cc/paper_files/paper/2023/file/91f18a1287b398d378ef22505bf41832-Paper-Datasets_and_Benchmarks.pdf), NeurIPS 2023: pairwise judging, human agreement, and evaluator limitations.
- [Shi et al., position-bias study](https://arxiv.org/abs/2406.07791), June 12, 2024: repetition stability, position consistency, and preference fairness across a large judge/task matrix.
- [Wang et al., Large Language Models Are Not Fair Evaluators](https://huggingface.co/papers/2305.17926), May 2023: balanced-position and human-in-the-loop calibration proposals.
- [Judging the Judges mitigation study](https://arxiv.org/abs/2604.23178), April 2026: nine mitigation strategies, five judge models, three benchmarks, and multiple bias types.
- [Fairness or Fluency?](https://arxiv.org/abs/2601.13649), January 20, 2026: same-language disparities and inter-language preference effects.
- [Chatbot Arena design](https://arena.ai/blog/arena/), accessed July 21, 2026: anonymous randomized pairwise battles and rating aggregation.
- [Autorubric repository page](https://scale.stanford.edu/ai/repository/autorubric-unified-framework-rubric-based-llm-evaluation), accessed July 21, 2026: rubric criteria, judge ensembles, and mitigation controls.

Order swaps belong in every pairwise-judge harness because they reveal a concrete failure mode cheaply. The promotion decision must remain grounded in a calibration sample capable of proving the judge wrong.
