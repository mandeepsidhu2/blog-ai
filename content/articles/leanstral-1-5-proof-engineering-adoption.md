---
title: Adopt Leanstral 1.5 as a Proof Worker, Not a Proof Authority
description: Compare Leanstral 1.5's formal-proof results, active-parameter footprint, benchmark settings, and rollout boundary for production verification teams.
topic: Formal Verification
level: Advanced
date: 2026-07-13
readingTime: 15
tags: lean4, theorem-proving, formal-methods, model-evaluation
image: /content/v1/assets/leanstral-proof-adoption-matrix.svg
imageAlt: Formal verification adoption matrix comparing Leanstral benchmark evidence with production proof workflow requirements
evidenceMode: strategy
qualityTier: timely-analysis
---

Mistral released Leanstral 1.5 on July 2, 2026 with an unusual combination: Apache-2.0 weights, 119 billion total parameters but roughly 6.5 billion active per token, a 256k-token context window, and results that put an open model near the frontier of Lean 4 proof engineering. The release reports 587 of 672 PutnamBench problems solved, 87% on FATE-H, 34% on FATE-X, and 43.2% pass@8 on a newly open-sourced real-project benchmark.

Those numbers justify an evaluation sprint. They do not justify merging generated proofs unattended. A Lean kernel can certify that a term type-checks against the imported environment; it cannot tell you that the theorem statement captures the intended security property, that the imports are acceptable, or that a generated axiom did not weaken the trust boundary.

The right adoption pattern is therefore asymmetric: give Leanstral broad freedom to search, repair, and propose; keep theorem statements, dependency policy, kernel checking, and merge authorization deterministic and human-owned.

## Decision summary

Evaluate Leanstral 1.5 if your bottleneck is proof search or repair inside an existing Lean 4 repository. The release is especially relevant when a task requires navigating a large local proof context, iterating against compiler feedback, or turning an existing specification into a checked proof.

Do not select it from headline pass rates alone. First reproduce a repository-specific set with the exact Lean, Mathlib, lakefile, imports, timeout, sampling budget, and agent scaffold you intend to deploy. Report pass@1 and total attempts separately. A model that reaches 43.2% pass@8 but 28.9% pass@1 imposes a retry, compute, and review policy that a one-shot score does not reveal.

The production gate is not “the model says proved.” It is: clean checkout, pinned toolchain, allowed imports only, no unapproved axioms or `sorry`, kernel check passes, statement diff approved, and independent tests or counterexamples cover the surrounding executable behavior.

## What changed in Leanstral 1.5

The [July 2 release](https://mistral.ai/fr/news/leanstral-1-5/) describes Leanstral 1.5 as a 119B-total mixture-of-experts model with about 6B active parameters. The [Hugging Face model card](https://huggingface.co/mistralai/Leanstral-1.5-119B-A6B) gives the more precise 6.5B activated-per-token figure, 128 experts with four active, a 256k-token maximum context, and a recommendation to stay at or below 200k tokens. It accepts text and image input and emits text.

The release is not merely a math benchmark update. Mistral positions the model as a Lean code agent and reports testing across 57 repositories. Its workflow flagged 47 violated properties; manual investigation classified 11 as genuine bugs, including five that were previously unreported. That funnel is more informative than “five bugs found”: 36 of 47 flags did not become genuine-bug claims, so a verification team should budget triage explicitly.

The distribution terms matter operationally. Apache 2.0 permits self-hosting and modification, but 119B total weights still create storage and memory demands even when only 6.5B parameters activate per token. “6.5B active” describes compute sparsity, not a 6.5B download or memory footprint. Mistral's current [service changelog](https://docs.mistral.ai/resources/changelogs) says the `labs-leanstral-1-5` endpoint will retire on September 30, 2026. A free hosted pilot therefore needs an export or self-hosting path from day one.

## Benchmark comparison and comparability limits

The table keeps each benchmark’s unit visible because the scores are not directly comparable. Sources: Mistral’s [release report](https://mistral.ai/fr/news/leanstral-1-5/), the public [FLTEval harness](https://github.com/mistralai/FLTEval), the [PutnamBench paper](https://arxiv.org/abs/2407.11214) and [leaderboard](https://trishullab.github.io/PutnamBench/leaderboard), and the [FATE paper](https://arxiv.org/abs/2511.02872).

| Benchmark / task unit | Leanstral 1.5 reported result | Scale or budget signal | Adoption meaning |
|---|---:|---:|---|
| PutnamBench Lean problems | 587 / 672 solved (87.4%) | 672 formalized competition problems | strong broad proof search; not repository maintenance |
| FATE-H formal algebra | 87% | 100 graduate-level problems | advanced algebra capability under reported harness |
| FATE-X formal algebra | 34% | 100 extra-hard problems | frontier remains far from saturation |
| FLTEval real-project tasks | 28.9% pass@1; 43.2% pass@8 | 8 attempts raise success by 14.3 points | retry budget materially changes outcome |

PutnamBench, FATE, and FLTEval use different theorem distributions, Lean environments, prompts, attempt budgets, and success aggregation. The comparison is limited further because provider release tables do not expose every decoding and compute detail in one normalized ledger. A 34% FATE-X score must not be compared as if it were the same task as 43.2% FLTEval pass@8.

The historical baseline is useful but also bounded. The original FATE paper reported the best evaluated model at 3% pass@64 on FATE-H and 0% on FATE-X. Seed-Prover 1.5 later reported 80% on FATE-H, 33% on FATE-X, and 88% on PutnamBench ([December 19, 2025 paper](https://arxiv.org/abs/2512.17260)). Leanstral’s 87%/34% figures look stronger, but different systems and test-time workflows can consume different compute. Treat the direction as evidence of rapid progress, not a clean controlled model ranking.

## The retry economics hidden by pass@8

FLTEval is the most actionable result because Mistral open-sourced the [Docker-only evaluation harness](https://github.com/mistralai/FLTEval). Leanstral 1.5 improves the provider-reported benchmark from 21.9% to 28.9% pass@1 and from 31.9% to 43.2% pass@8. For version 1.5, the eight-attempt budget raises the reported solve rate by 14.3 percentage points over one attempt. That is a search-budget yield, not evidence that attempts are independent or that an eightfold compute increase causes a 49.5% capability improvement.

That gain is not free. If attempts are independent enough to explore different proof paths, sampling eight can be rational for high-value obligations. In CI, however, it multiplies token generation, Lean compilation, artifact storage, and failure triage. The expected cost depends on stopping early after the first valid proof, so `8 × one-shot cost` is an upper bound, not a measured average.

Mistral also states that Leanstral’s 43.2% exceeds Claude Opus 4.6’s 39.6% on FLTEval at one-seventh the cost. This is a provider comparison, and the public claim does not supply a universal infrastructure cost. Self-hosted utilization, API rate limits, retry policy, proof length, and cache reuse can reverse the economics. Recompute cost per accepted proof in your environment:

```text
cost_per_accepted_proof =
  (inference_cost + compiler_cost + reviewer_cost + retry_waste)
  / accepted_proofs
```

Track reviewer minutes as seriously as GPU or API spend. The 47→11 triage funnel implies that a system optimized for flag recall can transfer substantial cost to proof engineers.

## Engineering decision: place the model inside a trust envelope

Lean’s value is that proof checking is small relative to proof discovery. Preserve that asymmetry. Run the model in a disposable checkout with a read-only specification baseline and an explicit allowlist of files it may modify. The agent can invoke `lake build`, inspect errors, search Mathlib, and propose proof terms; it cannot change theorem statements, toolchain versions, dependency URLs, or trust-policy files without a separate review path.

A minimal acceptance trace should include:

```text
task_id
repository_commit
lean_version
mathlib_commit
model_identifier
sampling_seed and attempt_index
prompt / tool-policy hash
changed theorem statements
new imports and axioms
kernel-check result
wall time, generated tokens, reviewer disposition
```

Reject `sorry`, `admit`, unsafe native shortcuts outside policy, new axioms, and theorem-statement weakening. Diff the elaborated declaration type, not only source text: notation, namespaces, instances, and coercions can make a small textual edit semantically consequential.

Lean version drift is a real operational dependency. The [Lean release index](https://lean-lang.org/doc/reference/latest/releases/) lists 4.31.0 on June 13, 2026 and 4.32.0-rc1 on June 17. Lean 4.31.0 alone contains 305 changes, including 102 fixes and an LLVM 22 upgrade ([4.31 release notes](https://lean-lang.org/doc/reference/latest/releases/v4.31.0/)). A proof generated against one toolchain can fail—or elaborate differently—after migration. Pin `lean-toolchain` and the package lock in every evaluation record.

## Build a local benchmark that reflects proof work

Sample tasks from the work queue you actually want to accelerate. Use at least four strata:

- local lemma completion with fixed statements;
- proof repair after dependency or compiler upgrades;
- invariant proof for existing executable code;
- counterexample or specification-review tasks where the correct action may be “statement is false.”

The fourth stratum is essential. If every benchmark item is guaranteed provable, the model is rewarded for forcing a proof rather than questioning an invalid property. Include negative controls with subtly false statements and measure whether the system produces a counterexample, requests clarification, or attempts to weaken the statement.

Report pass@1, pass@k, median attempts to first proof, kernel-valid rate, prohibited-import rate, statement-mutation rate, false-property escalation rate, and reviewer acceptance. Stratify by repository and theorem family. A single aggregate score can hide a model that excels on algebra but fails on stateful program verification.

Use a matched baseline: current human/tool workflow with the same repository snapshot, time budget, and allowed automation. Compare accepted proofs per engineer-hour, not only generated proofs per wall-clock hour. If the model creates more review debt than it removes, a higher pass@k is not a production win.

## Production readiness and implications

Long context changes retrieval design but does not eliminate it. The model card advertises 256k and recommends ≤200k tokens; importing an entire monorepo indiscriminately can still bury the relevant declarations. Build a dependency-aware context pack from theorem imports, nearby declarations, compiler errors, and retrieved Mathlib lemmas. Log what was omitted so a failure can be diagnosed.

Mixture-of-experts sparsity changes serving economics. Four of 128 experts active per token reduces active computation, but total weights, expert routing, KV cache, and 200k-token prompts remain material. Benchmark throughput at the proof lengths and concurrency you need. A single interactive researcher and a CI pool of 50 concurrent proof jobs have different bottlenecks.

The model’s multimodal input may help with diagrams or scanned formalization sources, but the output trust boundary remains Lean text checked against a pinned environment. Do not let image-derived statements bypass specification review.

## Failure modes and rollback guidance

The most dangerous failure is a valid proof of the wrong proposition. Others include import inflation that makes builds fragile, reliance on obscure axioms, nontermination or resource blowups in tactics, proofs coupled to unstable implementation details, and retry storms that exhaust CI budgets.

Rollback when any of these predeclared signals regresses: kernel-valid rate, prohibited dependency rate, median reviewer time, p95 proof-check time, false-statement escalation, or accepted proofs per engineer-hour. Keep the prior proof-search toolchain runnable and preserve generated artifacts for comparison. A model rollback must also restore prompts, retrieval, allowed tools, and retry budget; those components can change behavior as much as weights.

For repository bugs, separate detection from disclosure. Reproduce on the exact commit, minimize the failing property, check whether the statement reflects intended behavior, and follow the project’s security policy. “The prover found a violation” is not yet a confirmed vulnerability.

## Adoption boundary: when not to use it

Do not adopt Leanstral 1.5 merely to add formal-method branding to a project with no maintained specifications. The model cannot manufacture agreement about what the software should do. Start with human-owned invariants and a stable Lean build.

Avoid autonomous statement generation for safety-critical obligations unless a separate specification review exists. Avoid self-hosting if your hardware cannot hold the 119B-weight model and serve the required context with predictable latency; 6.5B active parameters do not erase the total memory boundary. Do not make the free Labs API your only CI dependency: the documented September 30, 2026 retirement creates a near-term migration deadline even before rate limits, retention, and availability are considered.

Teams using Isabelle, Coq, Dafny, TLA+, or another verifier should not extrapolate Lean results. Proof languages, libraries, tactics, and feedback loops differ. The transferable decision is the trust-envelope pattern, not the benchmark score.

## Migration plan

Run a two-week shadow evaluation on historical obligations, then a read-only pilot on new pull requests. In shadow mode, compare model proposals with already accepted human proofs and record theorem-statement diffs. In the pilot, allow comments or patch artifacts but prevent automatic merge.

Advance only after the model beats the current workflow on accepted proofs per engineer-hour without increasing prohibited imports or missed false statements. Introduce pass@k gradually—1, then 2, then 4 attempts—while measuring marginal accepted proofs and marginal review cost. Eight attempts should be a budgeted escalation for valuable hard tasks, not the default.

At merge time, rebuild in a clean environment with network disabled after dependencies are vendored or cached. Verify the pinned Lean and Mathlib versions, scan axioms and declarations, run project tests, and require a reviewer who understands the specification boundary.

## Source ledger and dates

- July 2, 2026 — [Mistral release](https://mistral.ai/fr/news/leanstral-1-5/): architecture summary, benchmark results, FLTEval cost claim, and repository-bug funnel.
- June 30, 2026 — [Mistral model documentation](https://docs.mistral.ai/models/model-cards/leanstral-1-5): version designation and service card.
- July 2026 snapshot — [Hugging Face model card](https://huggingface.co/mistralai/Leanstral-1.5-119B-A6B): 119B/6.5B architecture, 128 experts, 256k context, Apache 2.0.
- July 2, 2026 — [FLTEval repository](https://github.com/mistralai/FLTEval): open evaluation harness and task implementation.
- Current July 2026 changelog — [Mistral service changelog](https://docs.mistral.ai/resources/changelogs): `labs-leanstral-1-5` retirement on September 30, 2026.
- June 17, 2026 — [Lean release index](https://lean-lang.org/doc/reference/latest/releases/): current 4.32.0-rc1 and stable-version history.
- June 13, 2026 — [Lean 4.31.0 notes](https://lean-lang.org/doc/reference/latest/releases/v4.31.0/): toolchain changes and performance/security fixes.
- November 4, 2025 — [FATE benchmark paper](https://arxiv.org/abs/2511.02872): dataset scale, difficulty tiers, and original baselines.
- July 16, 2024 — [PutnamBench paper](https://arxiv.org/abs/2407.11214): benchmark construction across Lean, Isabelle, and Coq.
- Current project — [Mathlib](https://mathlib.org/): library ecosystem whose pinned revision is part of reproducibility.

Leanstral 1.5 is consequential because it makes open, agentic proof search credible on tasks that were recently far harder. Its safest value comes from respecting the distinction formal methods were built to enforce: search can be probabilistic; acceptance must remain explicit, reproducible, and checked.
