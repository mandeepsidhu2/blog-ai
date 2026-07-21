---
title: Evaluate AI Hardware Architects Without Simulator Leakage
description: Turn ArchEval's three feedback levels into a procurement test that separates simulator-assisted optimization from autonomous architecture judgment.
topic: AI for Hardware Design
level: Advanced
date: 2026-07-21
readingTime: 21
tags: computer-architecture, ai-agents, hardware-design, benchmarks, design-space-exploration
image: /content/v1/assets/archeval-feedback-boundary.svg
imageAlt: Matrix comparing ArchEval L1, L2, and L3 feedback settings with measured agent outcomes and adoption boundaries
evidenceMode: strategy
qualityTier: timely-analysis
---

ArchEval asks a better question than whether an AI agent can emit plausible hardware code: can it improve a design when simulator feedback is abundant, build the experiment when only simulator code exists, and predict a useful design before feedback? The July 3, 2026 preprint evaluates 20 challenges across eight simulators under exactly those three conditions.

The answer changes sharply with the information boundary. In L1, a prepared harness provides repeated verifier-simulator feedback and all four evaluated agents reach or exceed the baseline. In L3, the agent receives static evidence but no runnable simulator before submission. Only GPT-5.5 with Codex remains above baseline, at 1.21× geometric-mean performance and a 65% win rate. Even that system passes the paper's performance-modeling criterion on only 15% of challenges.

This does not make current agents useless for architecture. It identifies the valuable product: a design-space exploration assistant inside a controlled simulator loop. It also rejects a stronger product claim: a model that finds improvements after repeated measurements has not demonstrated reliable pre-silicon performance judgment.

## Finding and decision summary

- ArchEval v1 was submitted July 3, 2026 and contains 20 challenges, five architecture domains, and eight verifier simulators.
- L1 supplies a full harness and repeated feedback; L2 supplies simulator source but requires the agent to build its experimental loop; L3 withholds runnable feedback before final submission.
- All four tested agents reach or exceed credible baselines in L1.
- Only GPT-5.5 plus Codex remains above baseline in L3: 1.21× geometric mean and 65% win rate.
- Submitted-design self-evaluation median relative error spans 81%–99% across the four systems.
- The agents' own uncertainty ranges contain verifier results on only 0%–22% of predictions.
- GPT-5.5 plus Codex writes executable performance models for 18 of 20 challenges, yet passes the combined modeling criterion on 15%.
- Gemma 4 31B with MiniSWE produces executable models for 13 of 20 and passes on 5%; both Gemini configurations pass on 0%.
- A valid design is not necessarily a good design: the paper records runnable, constraint-satisfying submissions that agents predicted would win but the verifier measured as losses.

Buy an architecture agent as a measured search worker when your team owns the workload, simulator, constraints, baseline, and review. Do not buy “autonomous architect” claims from L1 improvement alone.

## What ArchEval released

The [ArchEval paper](https://arxiv.org/abs/2607.03601) defines architecture work as prediction, optimization, and generation. Twenty challenges span CPU mechanisms, system architecture, memory systems, accelerators, and compute-in-memory. Each uses the same verifier, workload, constraint checker, metric parser, and baseline for incumbent and submitted designs.

The baseline is intentionally credible rather than globally optimal. It may be a standard policy such as LRU, a simulator default, or a published design. That makes relative performance meaningful within a challenge but prevents a benchmark win from proving novelty or production superiority.

The planned [IISWC 2026 tutorial](https://iiswc.org/iiswc2026/program.html) is useful corroboration of the protocol's purpose: progressively removing harness and feedback distinguishes assisted exploration from autonomous judgment. ArchEval is a preprint, not yet a settled industry standard, so pin arXiv v1 and the task release you evaluate.

## Comparison: three settings, three product claims

The table below is transcribed from [ArchEval v1](https://arxiv.org/abs/2607.03601), submitted July 3, 2026. Values from different levels are not interchangeable because the agent receives different evidence.

| Setting | What the agent receives | What success establishes | Reported boundary |
|---|---|---|---|
| L1 full harness | Prepared workflow plus repeated simulator feedback | Can search and improve inside a supplied measurement loop | All four systems reach/exceed baseline; feedback count drives improvement |
| L2 simulator-code container | Simulator source, build environment, constraints; agent assembles loop | Can operationalize a simulator and conduct experiments | Tool and workflow construction failures emerge; not directly comparable with L1 |
| L3 agent-only | Static workload evidence and constraints; no runnable feedback before submission | Can judge and predict a design before verifier measurement | Only GPT-5.5 + Codex above baseline at 1.21× and 65% win rate |
| L3 performance modeling | Saved candidates plus an agent-written model | Can rank candidate designs without using the verifier as an oracle | Pass rates: 15%, 5%, 0%, 0% across evaluated systems |

The rows are levels of assistance, not difficulty points to average. L1 tests closed-loop optimization. L3 tests pre-feedback judgment. Reporting a single “ArchEval score” would destroy the central information in the benchmark.

## Benchmark results and comparability limits

The most consequential table concerns self-evaluation. GPT-5.5 plus Codex supplies a prediction for all 20 submitted designs, has 93% median relative error, captures the verifier result in its stated range on 15%, and overestimates on 65% of computable cases. Gemini 3.5 Flash with MiniSWE supplies nine of 20 predictions, has 81% median error, 22% range hits, and 100% overestimation. Gemini 3.1 Flash-Lite reports 17 of 20, 96% error, no range hits, and 82% overestimation. Gemma 4 31B reports 16 of 20, 99% error, 12% range hits, and 100% overestimation.

Those measurements are not a general model leaderboard. Model and framework are coupled: GPT-5.5 uses Codex while the other models use MiniSWE. Tool descriptions, budgets, retry behavior, context handling, and model effort can all affect the result. The paper evaluates 20 heterogeneous tasks, so one aggregate can also hide a domain that matters to your design program.

For procurement, run a small factorial parity study before attributing the gap to a model. Hold the harness fixed while swapping models, then hold the model fixed while swapping the agent framework where licenses and APIs permit. Match simulator-call budgets, context limits, wall time, retry policy, and starting artifacts. If the cells cannot be matched, label the object being purchased as the complete model-plus-harness system and refuse model-only claims.

The geometric mean normalizes each challenge to its baseline. That is appropriate for multiplicative performance ratios, but a 1.2× cache result and a 1.2× accelerator result may have different cost, power, area, and verification consequences. Inspect hard failures and per-challenge constraints before using the aggregate.

## Engineering decision: test the assistance level you will deploy

If engineers will provide a simulator harness, compare agents in an L1-like lane. Freeze simulator version, workload traces, baseline, candidate budget, wall time, tool API, and number of feedback events. Measure best valid improvement versus feedback count, not only the final artifact. An agent that needs ten expensive simulations for a marginal gain may lose to a simpler optimizer.

If the product must enter unfamiliar repositories and build the experiment, add an L2 lane. Score successful builds, valid workload execution, parser correctness, saved artifacts, and reproducible commands before performance. A beautiful final number is invalid if the agent changed the workload, bypassed a constraint, or parsed the wrong metric.

If the product will recommend an unmeasured design, require L3. Ask for a point prediction, uncertainty range, expected direction, constraint proof, and the next measurement that would most change the decision. Seal the verifier result until the prediction is committed. A plausible explanation after simulation is not prospective judgment.

## Comparison with adjacent tools

[gem5](https://www.gem5.org/) is a modular computer-system simulator; [ChampSim](https://github.com/ChampSim/ChampSim) focuses on trace-based microarchitecture studies; [Timeloop/Accelergy](https://github.com/NVlabs/timeloop) models accelerator mappings and energy. Their outputs are not interchangeable, and an agent that succeeds in one tool has not demonstrated portability.

[ArchAgent](https://arxiv.org/abs/2602.22425) reports new cache-replacement policies with 5.3% IPC improvement on public multi-core Google workload traces and 0.9% on SPEC06 in a longer search. [CHIA](https://openreview.net/pdf?id=lLxEUReWHG) provides an open framework for AI-driven hardware/software co-design loops across heterogeneous tools. Those systems demonstrate what intensive search can achieve. ArchEval adds a diagnostic axis: how much of the loop was supplied and whether the agent can predict before feedback.

[QuArch](https://openreview.net/forum?id=yU6X1XZl8t) evaluates computer-architecture reasoning with questions rather than full verifier execution. It can screen domain knowledge cheaply, but it cannot replace a design benchmark. Conversely, an ArchEval L1 win does not prove broad conceptual knowledge. Use both only if the two constructs matter to the job.

## Production readiness

Place the agent inside a sandbox with explicit CPU, memory, storage, simulator-license, and wall-time budgets. Separate read-only workload evidence from writable candidate space. Hash baseline configurations and verifier scripts. Store every tool call, build log, candidate diff, metric parse, constraint result, prediction, and simulator output.

Require two reviewers: a domain architect reviews mechanism and constraints; a systems reviewer checks experiment integrity. Neither should see only the agent's summary. Re-run the winning candidate from a clean environment and test unseen workloads. A design optimized against one trace can overfit as easily as a model optimized against one benchmark.

Novelty needs its own review. A candidate may reproduce a known mechanism, rename a baseline, or exploit a simulator corner while still scoring well. Search cited literature and baseline implementations before calling a design new; compare structural behavior, not only identifiers. Keep benchmark performance, engineering utility, and scientific novelty as three separate verdicts.

For commercial evaluation, calculate improvement per simulator-hour and reviewer-hour. The agent may improve a metric while consuming more verification capacity than the team can supply. Include failure recovery: how often does it poison a workspace, leave nondeterministic state, or require manual repair?

## Failure modes and rollback

The clearest failure is self-evaluation error. Do not let the agent's confidence authorize tape-out, RTL merge, or a baseline replacement. Treat its prediction as a feature to calibrate against verifier outcomes over time.

Other failures include workload leakage, invalid metric parsing, silent constraint relaxation, simulator-version drift, cherry-picked candidates, repeated testing against a nominal holdout, and architecture changes that improve the measured objective while worsening power, area, reliability, or verification burden.

Roll back the agent workflow when clean replay changes the result, a hard constraint is violated, the baseline hash changes, the tool budget is exceeded, the prediction ledger is incomplete, or performance reverses on a sealed workload. Rollback means restoring the previous design and experiment environment, not merely removing the generated diff.

## Adoption boundary and when not to use it

Use current agents for bounded design-space exploration, candidate implementation, simulator orchestration, and evidence packaging. Keep a human architect responsible for objectives, constraints, workload validity, novelty, and the decision to advance a design.

Do not deploy one where simulators or PDK tools cannot be isolated, where licenses prohibit automated access, where the metric parser is unaudited, or where the organization lacks a credible baseline. Do not claim autonomous architecture from L1 results. Do not compare L1 and L3 as though only prompt difficulty changed.

A mature rollout starts with retrospective tasks whose outcomes are known, advances to sealed historical workloads, and then runs prospective shadow design work. Production authority should remain separated until predictions are calibrated and clean-room reproductions survive independent review.

## Source ledger

- [ArchEval v1](https://arxiv.org/abs/2607.03601), submitted July 3, 2026: 20 challenges, eight simulators, L1/L2/L3 protocol, measured results.
- [IISWC 2026 program](https://iiswc.org/iiswc2026/program.html), accessed July 21, 2026: scheduled QuArch/ArchEval tutorial and protocol framing.
- [gem5](https://www.gem5.org/), accessed July 21, 2026: simulator scope and documentation.
- [ChampSim](https://github.com/ChampSim/ChampSim), accessed July 21, 2026: trace-based simulator and reproducibility surface.
- [Timeloop](https://github.com/NVlabs/timeloop), accessed July 21, 2026: accelerator mapping/modeling boundary.
- [ArchAgent](https://arxiv.org/abs/2602.22425), February 25, 2026: intensive agentic cache-policy search results.
- [CHIA](https://openreview.net/pdf?id=lLxEUReWHG), June 2026: open co-design loop framework.
- [QuArch](https://openreview.net/forum?id=yU6X1XZl8t), 2026: question-answering benchmark for architecture reasoning.
- [PARSEC](https://dl.acm.org/doi/10.1145/1454115.1454128), 2008: workload-suite context; not directly comparable to ArchEval scores.

The procurement conclusion is deliberately narrow: ArchEval shows that agents can be useful search workers when measurement is supplied, while reliable pre-feedback architecture judgment remains the harder and less-supported claim.
