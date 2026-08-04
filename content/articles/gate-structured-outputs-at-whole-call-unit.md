---
title: Gate Structured Outputs at the Whole-Call Unit
description: Measure exact-call and long-schema reliability before a high marginal field score approves an unsafe structured-output release.
topic: Structured Output Evaluation
level: Advanced
date: 2026-08-04
readingTime: 25
tags: structured-outputs, json-schema, llm-evaluation, tool-calling, reliability, release-engineering
image: /content/v1/assets/structured-output-contract-release-units.svg
imageAlt: Three result cards comparing field accuracy, whole-call exact accuracy, and false approvals for structured-output release gates
evidenceMode: experiment
qualityTier: deep-research
evidenceProject: operator/diy-project-blogs/projects/structured-output-contract-audit
evidenceManifest: operator/diy-project-blogs/projects/structured-output-contract-audit/evidence-manifest.json
---

Structured output turns a language-model response into an application input. That changes the unit that matters. A customer record with 16 fields is usable only if every required field passes the contract; an agent tool call is safe only if the complete argument object is valid and semantically acceptable. Yet many release reports average correctness over fields. A 99% field score looks excellent even when errors accumulate across long schemas.

A matched Monte Carlo study makes the mismatch concrete. Across 800 repeats of 3,000 calls, a mixed workload used 4-, 8-, 16-, and 32-field schemas. Marginal field accuracy averaged 99.453%, comfortably above a 99% release threshold. Whole-call exact match averaged 94.956%, below the declared 95% application contract, and exact match on 16- and 32-field calls averaged 90.872%. The field-average gate approved every repeat and falsely approved 54.0% of repeats. A whole-call gate rejected those below-contract repeats by construction; a joint gate also protected the long-schema slice.

This is not evidence that one provider or model has 94.956% exact-call reliability. It is evidence about measurement units under a declared stochastic generator. The engineering decision is to align the release denominator with what the application consumes, then preserve schema-length and critical-field slices so a global exact-match score cannot hide the expensive cases.

## Finding and Decision Summary

Use three nested release metrics: marginal field correctness for diagnosis, whole-call exact match for the primary application contract, and a prespecified slice gate for long or high-impact schemas. The field metric tells you where errors occur; it must not decide whether complete objects are usable.

The following table is generated from 9,600 repeat-policy rows. Every policy sees the same calls and error draws within a repeat. Values are means across 800 repeats. The 95% interval reported later resamples paired repeat-level gaps 5,000 times.

Source: saved repeat-level measurements; [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12) defines the structural validation boundary but does not supply these numeric results.

| Scenario and gate | Field accuracy | Whole-call exact | Long-schema exact | Approval rate | False approvals |
|---|---:|---:|---:|---:|---:|
| Mixed correlated, field average | 99.453% | 94.956% | 90.872% | 100.00% | 54.00% |
| Mixed correlated, whole call | 99.453% | 94.956% | 90.872% | 46.00% | 0.00% |
| Mixed correlated, joint + long schema | 99.453% | 94.956% | 90.872% | 45.38% | 0.00% |
| Mixed independent, field average | 99.548% | 95.206% | 91.173% | 100.00% | 27.25% |
| Fixed eight fields, field average | 99.456% | 96.184% | 96.184% | 100.00% | 0.00% |
| One-field control, field average | 99.458% | 99.458% | 99.458% | 99.50% | 0.00% |

“False approval” has a narrow definition: the gate approved a repeat whose measured whole-call exact match was below 95%. It does not mean the JSON was syntactically invalid, a provider violated an SLA, or a production incident occurred.

## Methodology

The confirmatory generator samples 3,000 calls per repeat. Mixed workloads contain 35% four-field, 30% eight-field, 25% sixteen-field, and 10% thirty-two-field calls. On ordinary calls, each field has a 0.45% error probability. A 0.3% call-level shock raises the per-field error probability to 32%, introducing the correlated failures that retries, truncation, prompt ambiguity, or upstream context damage can create in real systems. These parameters are synthetic and locked in `config.json`; they were chosen to place the whole-call contract near its decision boundary, not estimated from a vendor.

The generator uses one seeded stream for schema length and field outcomes. All three release policies reuse the same computed metrics:

```javascript
const policies = ["field-average", "whole-call", "joint-long-schema"];
for (const [scenarioName, scenario] of Object.entries(config.scenarios)) {
  for (let repeat = 0; repeat < config.repeats; repeat++) {
    const random = rng(config.seed + repeat * 7919 + scenarioName.length * 104729);
    let fields = 0;
    let correctFields = 0;
    let exactCalls = 0;
    let longCalls = 0;
    let longExact = 0;

    for (let call = 0; call < config.callsPerRepeat; call++) {
      const fieldCount = chooseFields(random(), scenario);
      const shocked = random() < scenario.callShock;
      let exact = true;
      for (let field = 0; field < fieldCount; field++) {
        const p = shocked ? scenario.shockFieldError : scenario.fieldError;
        const okay = random() >= p;
        fields++;
        if (okay) correctFields++;
        else exact = false;
      }
      if (exact) exactCalls++;
      if (fieldCount >= 16) {
        longCalls++;
        if (exact) longExact++;
      }
    }
  }
}
```

This is a matched comparison rather than three separately sampled experiments. A difficult repeat lowers all policies' observed exact-call rate equally; only the decision rule changes. The runtime is dependency-free JavaScript with no model inference, Torch, accelerator, network request, or provider API. It isolates metric behavior, not generation quality.

The release decisions are intentionally simple:

```javascript
const fieldAccuracy = correctFields / fields;
const wholeAccuracy = exactCalls / config.callsPerRepeat;
const longAccuracy = longCalls ? longExact / longCalls : wholeAccuracy;

const approvals = {
  "field-average": fieldAccuracy >= 0.99,
  "whole-call": wholeAccuracy >= 0.95,
  "joint-long-schema": wholeAccuracy >= 0.95 && longAccuracy >= 0.90,
};

for (const policy of policies) {
  rows.push({
    scenario: scenarioName,
    repeat,
    policy,
    fieldAccuracy,
    wholeAccuracy,
    longAccuracy,
    approved: Number(approvals[policy]),
    falseApproval: Number(approvals[policy] && wholeAccuracy < 0.95),
  });
}
```

The 99%, 95%, and 90% thresholds are experimental contracts. A production team should derive its thresholds from the cost of malformed, incomplete, or semantically wrong calls. The hierarchy is the transferable part: diagnosis at field level, release at call level, and risk protection at a declared slice level.

## Baselines and Controls

The field-average gate is the treatment under audit. Whole-call exact match is the primary baseline because it uses the same unit as the downstream parser and application. The joint gate is an ablation that asks whether global whole-call reliability is sufficient when schema length varies.

The one-field control removes the unit mismatch. Field accuracy and whole-call exact match become numerically identical at 99.458%, and every gate has zero false approvals. This negative control is important: the field metric is not intrinsically misleading. It becomes misleading when multiple opportunities for failure are aggregated into one application action.

The fixed-eight control removes schema-length mixture. Field accuracy remains 99.456%, while whole-call exact rises to 96.184%; all policies approve and none falsely approves. The result narrows the claim. The focal failure is driven by accumulation across mixed, sometimes long schemas, not merely by call-level correlation.

The independent-error ablation removes the 0.3% correlated shock. Whole-call exact improves from 94.956% to 95.206%, but the field gate still falsely approves 27.25% of repeats because finite-sample variation places many studies below the application threshold. Correlation amplifies the problem; it is not required for the problem to exist.

```output
mixed-correlated: field=99.453% whole=94.956% long=90.872%
field-average: approve=100.00% false_approve=54.00%
whole-call: approve=46.00% false_approve=0.00%
joint-long-schema: approve=45.38% false_approve=0.00%
mixed-independent field-gate false_approve=27.25%
fixed-eight field-gate false_approve=0.00%
one-field field-minus-whole gap=0.000 percentage points
```

## Results

The focal paired gap between field accuracy and whole-call exact match is 4.497 percentage points. The 95% bootstrap interval is 4.472 to 4.522 points. Because both metrics come from the same calls, the interval quantifies repeat-to-repeat variation in the unit mismatch under the generator rather than variation between unrelated samples.

The field gate approved 800 of 800 focal repeats. Only 368 repeats met the 95% whole-call contract, so 432 approvals were false under the prespecified definition. The whole-call gate approved those 368 and rejected the other 432. The joint gate approved 363 repeats because five repeats met the global call contract while their long-schema exact rate fell below 90%.

That five-repeat difference is small, but it illustrates why a slice gate is not redundant. The global rate weights four- and eight-field calls more heavily because they are 65% of traffic and have fewer failure opportunities. If long schemas correspond to payments, infrastructure mutations, or regulated records, their risk weight can be much larger than their traffic share.

```output
repeats=800 calls_per_repeat=3000 repeat_policy_rows=9600
paired field-minus-whole=4.497 pp
paired bootstrap 95%=[4.472, 4.522] pp samples=5000
focal whole-call approvals=368/800
focal field-gate false approvals=432/800
focal joint-gate approvals=363/800
mean critical-first-two-field accuracy=99.458%
```

The critical-first-two-field metric is intentionally diagnostic and does not drive a claim. It remains near the marginal field score because the generator gives all fields equal error probabilities. Real systems should not assume equal criticality. An `amount`, `account_id`, or `delete_scope` field may deserve a zero-tolerance semantic validator even when optional descriptive fields can be repaired.

The strongest challenge to whole-call exact match is that it can be too strict in one direction and too weak in another. It marks a harmless canonicalization difference wrong, yet marks a schema-valid but dangerous identifier right if the reference itself is incomplete. Production should therefore publish a decision tuple rather than one replacement scalar: first-pass structural validity, canonicalized semantic exactness, critical-field validity, whole-call acceptance, and eventual acceptance after repair. The simulation supports changing the release unit; it does not prove exact string equality is the best semantic oracle.

## Statistical Analysis and Uncertainty

The analysis resamples the 800 paired gaps with replacement 5,000 times and takes the 2.5th and 97.5th percentiles. Approval-rate intervals are bootstrapped over repeat-level binary decisions. The whole-call approval interval is 42.625% to 49.5%; the joint-gate interval is 42.0% to 48.75%. The field gate's interval is exactly 100% because it approved every simulated repeat.

```javascript
function bootstrap(values, seed) {
  const random = rng(seed);
  const draws = [];
  for (let sample = 0; sample < 5000; sample++) {
    let total = 0;
    for (let i = 0; i < values.length; i++) {
      total += values[Math.floor(random() * values.length)];
    }
    draws.push(total / values.length);
  }
  return {
    low: quantile(draws, 0.025),
    high: quantile(draws, 0.975),
  };
}

const gaps = focal.map(row => row.fieldAccuracy - row.wholeAccuracy);
const interval = bootstrap(gaps, config.seed ^ 0xa5a5a5a5);
```

These intervals do not cover model misspecification. Production errors may cluster by prompt, language, schema feature, response length, provider revision, or retry path. They may also be semantically correlated in ways that syntactic validation never sees. The synthetic confidence interval can be extremely narrow while the external-validity boundary remains wide.

## Why Schema Conformance Is Not Application Correctness

[JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12) defines structural validation. Provider features can improve adherence: OpenAI describes [dynamic constrained decoding](https://openai.com/index/introducing-structured-outputs-in-the-api/), Anthropic tools accept an [`input_schema`](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools), and Gemini supports a [subset of JSON Schema](https://ai.google.dev/gemini-api/docs/structured-output). These are valuable controls, but a schema-valid object can still select the wrong customer, hallucinate an identifier, use stale units, or request an unsafe action.

The [JSONSchemaBench study](https://arxiv.org/abs/2501.10868) compares constrained-decoding frameworks against official schema tests, while recent work finds that [schema key wording itself can change model performance](https://arxiv.org/abs/2604.14862). Another study reports [structured formatting can shift answer distributions](https://arxiv.org/abs/2607.18476). Together, these sources motivate separate measurements for structural adherence, semantic field correctness, and application-level exactness. They do not validate the numeric simulation results above.

For a production evaluation, classify each call into at least four layers: parseable JSON, schema-valid JSON, semantically valid fields, and application-acceptable whole call. Report refusals, truncations, timeouts, and repair attempts in the original denominator. A repaired success is operationally useful but should not be indistinguishable from a first-pass success because it has different cost and latency.

## Production Readiness

Build the evaluation set from real versioned schemas and replay representative inputs through the exact provider, model ID, decoding configuration, tool wrapper, and parser used in production. Stratify by field count, nesting depth, unions, arrays, optionality, free-text length, locale, and risk class. Lock the release rule before running the candidate.

Store one row per attempted call with model revision, schema hash, prompt hash, call outcome, field-level validator results, whole-call result, repair count, latency, token usage, and application consequence. That lets the same trace answer both debugging and release questions without averaging away failures.

Keep the original attempt denominator. Classify each attempt as `accepted_first_pass`, `refusal`, `timeout`, `truncated`, `schema_invalid`, `semantic_invalid`, or `accepted_after_repair`. Report first-pass acceptance over all attempts and eventual acceptance over all attempts; never divide only by parseable responses. This revision matters because a perfect validator can appear to improve reliability merely by discarding the calls it cannot classify.

Use a decision ladder:

1. Block any parser or schema regression relative to the incumbent.
2. Require whole-call exact match to clear its confidence bound, not only its point estimate.
3. Require critical slices to clear their own bounds.
4. Compare completed-call cost and p95 latency including validation and repair.
5. Shadow the candidate, then canary only low-impact schemas before expanding authority.

Rollback when the whole-call lower bound crosses the contract, any critical semantic validator regresses, repair volume exceeds capacity, or the provider changes model behavior without a pinned revision. Retain the incumbent response path and schema adapter until the canary has covered peak traffic and long-schema cohorts.

## Error Analysis and Limitations

The simulation assumes every ordinary field shares one error probability and every shocked field shares another. Real schemas have heterogeneous fields, dependencies, conditional requirements, and correlated semantics. The model may get all fields wrong together or make one high-impact mistake while every other field is correct.

The design also counts exact field values. Some applications permit semantic equivalence, normalized dates, reordered sets, or harmless formatting differences. Define canonicalization before evaluation and keep it deterministic. Do not let an LLM judge silently redefine exactness after seeing the candidate.

There is no retry or repair loop. Retries can recover failures, but they change the estimand to completed-call reliability and introduce correlated model errors, extra tokens, latency, and possible duplicate side effects. Evaluate first-pass and eventual success separately.

Finally, the long-schema threshold of 90% is illustrative. It is not a recommendation. For irreversible tools, 90% may be unacceptable; for a draft extraction reviewed by a human, it may be overly strict. The contract must follow consequence, not article precedent.

## Reproducibility

The evidence directory contains the locked configuration, simulator, 9,601-line repeat CSV including its header, aggregate results, statistical analysis, output summary, result SVG, and version-1 evidence manifest. Reproduce with the repository's bundled or system Node runtime:

```bash
cd structured-output-contract-audit
node run-experiment.mjs
node render-figure.mjs
```

The run uses seed `20260727`, 800 repeats, 3,000 calls per repeat, four scenarios, three gates, and 5,000 bootstrap resamples. It needs no network, model download, Torch runtime, or accelerator. Compare regenerated JSON and CSV before treating a changed configuration as the same experiment.

## Claim Boundary

Supported: under the declared mixed-schema generator, a 99% marginal field gate approves every repeat even though whole-call exact match averages below a 95% application contract; one-field and fixed-eight controls remove the false-approval pattern, while an independent-error ablation reduces but does not eliminate it.

Not supported: that a named model has these error rates, that 95% is universally safe, that exact match captures business correctness, or that the joint gate is optimal. The durable decision is narrower: diagnose fields, release complete calls, preserve risk slices, and keep semantic validation outside the model's own confidence report.
