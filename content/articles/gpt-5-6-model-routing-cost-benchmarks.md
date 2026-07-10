---
title: Route GPT-5.6 by Measured Cost, Coding, and Agent Performance
description: Compare GPT-5.6 Sol, Terra, and Luna with current alternatives, then build a route-level evaluation and migration plan around cost, harness effects, and failure risk.
topic: Model Selection
level: Advanced
date: 2026-07-10
readingTime: 18
tags: gpt-5-6, model-routing, coding-agents, llm-benchmarks, inference-cost, evaluation
image: /content/v1/assets/gpt-5-6-routing-surface.svg
imageAlt: GPT-5.6 routing surface comparing Sol, Terra, and Luna intelligence score, coding-agent score, and measured cost per task
evidenceMode: strategy
qualityTier: timely-analysis
---

GPT-5.6 is not one model upgrade. It is a three-tier routing surface with unusually different price, benchmark, and effort profiles. Sol reaches the highest measured capability, Luna captures much of the family gain at one-fifth of Sol's list price, and Terra occupies the middle without always lying on the independent cost-quality frontier. The engineering task is therefore not “replace GPT-5.5.” It is “decide which routes deserve Sol, which can be moved to Luna, and whether Terra survives a measured bake-off.”

The family became generally available on `2026-07-09`, one day before this analysis. OpenAI reports strong results across professional agents, coding, computer use, science, and cybersecurity. Independent pre-release measurements from Artificial Analysis support the broad efficiency claim but reveal an important nuance: across reasoning settings, Sol and Luna occupy the cost-intelligence frontier more often than Terra. Provider tables also disagree sharply by coding harness. Sol scores `80.0` on one aggregate coding-agent index while Claude Fable 5 wins the listed SWE-Bench Pro comparison `80.0%` to `64.6%`.

That disagreement is the point. A state-of-the-art model can be the right default for long-running terminal work and the wrong choice for a repository issue benchmark. Routing should follow your workload distribution, tool harness, and total successful-task cost, not a single launch chart.

## Finding and Decision Summary

Adopt the family behind a shadow router, not through a global alias change.

- Put Sol in the challenger lane for high-value, long-horizon work where retries, human repair, or missed completion dominate token price.
- Put Luna against the current production default for classification, extraction, short coding edits, and tool routes with strong verifiers. Its list price is `$1` per million input tokens and `$6` per million output tokens.
- Require Terra to beat both adjacent tiers on your own Pareto frontier. Artificial Analysis measured Terra at an Intelligence Index score of `55` and `$0.55` per task, but reported that Luna or Sol dominated Terra at each reasoning level in its evaluation.
- Keep Fable 5 or another strong coding model in the bake-off where issue resolution matters. OpenAI's own table reports Fable 5 at `80.0%` on SWE-Bench Pro versus Sol at `64.6%`.
- Do not normalize cost using characters alone. Anthropic says Sonnet 5's tokenizer can turn the same input into roughly `1.0x` to `1.35x` as many tokens, so list-price comparisons need measured request traces.

A two-week decision window is enough for initial routing if it includes at least `200` representative tasks per high-volume route, paired judgments, failure taxonomy, and end-to-end cost including retries. It is not enough for low-frequency safety-critical workflows, where the acceptance set must be scenario-based and reviewed by domain owners.

## Release Snapshot

[OpenAI's general-availability announcement](https://openai.com/index/gpt-5-6/) names three models: GPT-5.6 Sol, Terra, and Luna. Sol is the flagship; Terra is positioned for everyday work; Luna is the cost-efficient tier. The earlier [Sol preview](https://openai.com/index/previewing-gpt-5-6-sol/) introduced higher-compute `max` and multi-agent `ultra` operation before the full family launch. These are not free quality settings: more reasoning and parallel agents trade additional token and compute use for a different score-latency frontier.

On `2026-07-09`, the independent [Artificial Analysis launch evaluation](https://artificialanalysis.ai/articles/gpt-5-6-has-landed) reported the following maximum-effort results. The comparison below uses that one evaluation source so score and cost units remain internally consistent.

| GPT-5.6 tier | AA Intelligence Index v4.1 | Measured cost per index task | AA Coding Agent Index v1.1 | List input/output per 1M tokens |
|---|---:|---:|---:|---:|
| Sol, max | 59 | $1.04 | 80.0 | $5 / $30 |
| Terra, max | 55 | $0.55 | 77.4 | $2.50 / $15 |
| Luna, max | 51 | $0.21 | 74.6 | $1 / $6 |

Sol buys `8` index points over Luna at roughly `4.95x` the measured cost per task. Terra buys `4` points over Luna at roughly `2.62x` the task cost. Those ratios are not universal API economics; they are measured outcomes of the index's prompts, harness, reasoning configuration, and token use. They are useful for forming a hypothesis, not setting a budget forecast.

The launch also adds a `1.25x` cache-write price multiplier while retaining a `90%` discount for cache reads. That changes the economics of long-lived agents. A route that writes a large context once and reuses it many times can still benefit. A route that constantly mutates the prefix and rarely hits the cache may pay the write premium without receiving the read discount.

## Benchmark Comparison and Disagreement

OpenAI publishes a broad table with exact model and harness results. The independent [Artificial Analysis methodology and trends page](https://artificialanalysis.ai/trends) explains that its current Intelligence Index v4.1 aggregates several categories, while [Agents' Last Exam](https://arxiv.org/abs/2606.05405) is a separate living benchmark of more than `1,000` tasks across `55` subfields and `13` industry clusters. These benchmarks answer different questions and are not directly comparable.

| Evaluation | GPT-5.6 Sol | GPT-5.6 Terra | GPT-5.6 Luna | Strong external comparator in OpenAI table |
|---|---:|---:|---:|---:|
| AA Coding Agent Index v1.1 | 80.0 | 77.4 | 74.6 | Fable 5: 77.2 |
| SWE-Bench Pro | 64.6% | 63.4% | 62.7% | Fable 5: 80.0% |
| Terminal-Bench 2.1 | 88.8% | 87.4% | 84.7% | Fable 5: 83.1% |
| Agents' Last Exam | 52.7% | 50.4% | 50.3% | Fable 5: 40.5% |
| OSWorld 2.0 | 62.6% | 50.2% | 45.6% | Opus 4.8: 54.8% |
| BrowseComp | 90.4% | 87.5% | 83.3% | Fable 5: 84.3% |
| GeneBench Pro | 28.7% | 23.3% | 10.8% | Opus 4.8: 16.0% |

The source for the table is the [OpenAI GPT-5.6 evaluation appendix](https://openai.com/index/gpt-5-6/). It contains provider-reported results, several internal evaluations, and harness-specific settings. Treat rows as separate signals, not as samples from one common scale.

Three patterns matter. First, the family compresses on SWE-Bench Pro: only `1.9` points separate Sol and Luna, while Fable 5 leads Sol by `15.4` points. Second, Sol's advantage expands on computer use: it leads Luna by `17.0` points on OSWorld 2.0. Third, Terminal-Bench 2.1 reverses the SWE-Bench ordering against Fable 5: Sol leads by `5.7` points.

Likely confounders include the agent scaffold, allowed tools, reasoning effort, patch-validation loop, timeout, token budget, refusal behavior, and benchmark contamination. Even a benchmark name may hide version or harness differences. OpenAI reports Terminal-Bench `2.1`; Artificial Analysis describes Terminal-Bench `v2` inside its coding index. Do not merge those values unless the task set, runner, and scoring commit are identical.

## Cost Comparison Beyond List Price

At standard list price, Sol is `$5/$30`, Terra is `$2.50/$15`, and Luna is `$1/$6` per million input/output tokens. For context, [Claude Sonnet 5](https://www.anthropic.com/news/claude-sonnet-5), released on `2026-06-30`, has introductory pricing of `$2/$10` through `2026-08-31`, then `$3/$15`. [Gemini 3.1 Pro Preview pricing](https://ai.google.dev/gemini-api/docs/pricing) is `$2/$12` for prompts at or below `200k` tokens and `$4/$18` above `200k` under standard service.

Those numbers are a procurement input, not cost per successful task. A useful route metric is:

`successful_task_cost = (model_tokens + cache + tool_compute + retries + review_minutes) / accepted_tasks`

Suppose a route averages `120k` uncached input tokens and `18k` output tokens. Ignoring tools and retries, list-price model cost is approximately `$1.14` on Sol, `$0.57` on Terra, and `$0.228` on Luna. If Luna's accepted completion rate is `70%` and Sol's is `90%`, the model-only cost per accepted task becomes about `$0.326` versus `$1.267`; Luna still wins on cost. If each Luna failure triggers ten minutes of senior review, that conclusion can reverse immediately.

The break-even test makes that judgment explicit. For this token mix, Sol costs `$0.912` more per attempt than Luna. If Sol reduces failure probability by `20` percentage points, it is economically preferable only when the avoided retry, delay, or human-repair cost exceeds about `$4.56` per failed attempt (`$0.912 / 0.20`). Replace those assumptions with measured route values; the formula is more useful than a universal tier recommendation.

Tokenizer and cache behavior can move these estimates. Anthropic explicitly reports a `1.0x-1.35x` token expansion for the same input after the Sonnet 5 tokenizer change. OpenAI introduces paid cache writes for this family. Google changes price above `200k` prompt tokens. Replay a captured request set through each provider's tokenizer and billing response rather than applying one provider's token count to another provider's rates.

## Route-Level Engineering Decision

Define routes by failure consequence and verifier strength, then assign challengers.

**Sol candidates:** repository-scale changes, long terminal sessions, computer-use workflows, cross-document analysis, cybersecurity defense under authorized access, and scientific analysis where incomplete work is expensive. Sol's measured Terminal-Bench `88.8%`, OSWorld `62.6%`, and GeneBench Pro `28.7%` justify testing, but they do not prove performance on your tools.

**Luna candidates:** high-volume support transformations, structured extraction, test generation with deterministic execution, retrieval synthesis with citation checks, and smaller code changes. Luna's `50.3%` Agents' Last Exam result is close to Terra's `50.4%` despite much lower list price, which makes it a serious default challenger rather than a “small model” fallback.

**Terra candidates:** workloads where Luna repeatedly misses a quality threshold but Sol's marginal gain does not cover cost. Terra should not receive traffic just because it is the middle SKU. In the independent index, every Terra reasoning setting was reportedly dominated by a Sol or Luna setting. Your own route may differ because token mix, latency, and task distribution differ.

Give Terra an exit condition. After at least `200` paired route tasks, remove it from the catalog if it is not Pareto-superior on any route after counting acceptance, p95 latency, and total successful-task cost. A middle tier with no winning workload adds evaluation surface, operational aliases, and incident complexity without buying resilience.

**External-model candidates:** issue-resolution coding, routes with provider concentration risk, and workloads already tuned to another harness. [Anthropic's June 30 release](https://www.anthropic.com/news/claude-sonnet-5) positions Sonnet 5 as an agentic model with lower cost than Opus, while the [Fable 5 redeployment notice](https://www.anthropic.com/news/redeploying-fable-5) documents a separate high-capability option and its safety boundary. Keep at least one non-OpenAI challenger until paired route evidence says otherwise.

## Evaluation and Rollout Plan

Freeze a production sample before changing prompts. For each route, select at least `200` recent tasks or all tasks from the last `30` days if volume is lower. Remove secrets, retain tool traces, and label the acceptance rubric before running challengers. Stratify by difficulty and failure consequence so easy tasks do not hide regressions.

Run each model with the harness it would actually use in production. Record model identifier, effort setting, prompt version, tool schema, timeout, token usage, cache reads and writes, wall time, retries, verifier results, and human repair minutes. Blind pairwise review where subjective quality matters. For deterministic routes, acceptance should come from tests or domain validators rather than an LLM judge alone.

Use a staged rollout:

1. Shadow `5%` of traffic with no user-visible output.
2. Canary `1%` on low-risk requests after offline acceptance passes.
3. Expand to `10%`, `25%`, and `50%` only when accepted-task cost and severe-failure rate remain within pre-registered bounds.
4. Preserve the prior model alias and prompt for one-click rollback.
5. Re-evaluate after provider model, tokenizer, or pricing changes.

The primary metric should be accepted tasks per dollar, with hard constraints on severe failures and p95 latency. A model that is cheap because it times out or returns partial work is not efficient. A model that passes a generic benchmark but requires more human review is not a production improvement.

## Failure Modes and Rollback

The largest risk is silent route drift: a global model alias changes while prompts, tool policies, and token budgets remain tuned to the old model. That can raise tool-call count, alter abstention behavior, or expose a different context-window failure without an obvious application deploy.

Other failure modes include cache-write cost surprises, `ultra` parallelism multiplying tool side effects, effort settings exceeding latency objectives, model-specific refusals, and benchmark-targeted overfitting. The launch page also mixes public and internal evaluations; internal scores are useful provider evidence but cannot be independently reproduced from the announcement.

Rollback when any high-severity policy breach occurs, accepted-task rate falls more than `3` percentage points relative to control, p95 latency rises more than `20%`, or cost per accepted task rises more than `15%` for two consecutive daily windows. Roll back the complete route tuple: model, effort, prompt, tools, and timeout. Reverting only the model while leaving a new harness in place does not restore the control.

## Production Readiness and Operating Model

Model families increasingly expose compute as a runtime choice. The router must therefore budget effort, not only choose a model name. Store the chosen tier and effort in every trace. Make cache policy visible. Cap subagent fan-out and require idempotency keys before using multi-agent operation with write-capable tools.

Procurement should negotiate around workload shape: cached versus uncached input, typical output ratio, priority processing, rate limits, and failure credits. Platform teams should publish a route catalog with owner, acceptance suite, current model tuple, fallback, maximum cost, and next review date. This turns a launch-driven migration into a controlled operating process.

## Adoption Boundary

Do not adopt GPT-5.6 solely because Sol leads an aggregate index. Avoid immediate migration for regulated decisions, irreversible tool actions, workflows without replayable traces, or routes whose ground truth cannot be reviewed. Do not use `ultra` until every parallel branch is isolated from duplicate writes and aggregate budgets are enforced.

Prefer Luna when verification is strong and task value is modest. Prefer Sol when the cost of an incomplete task dominates inference spend. Treat Terra as an empirical candidate, not the automatic compromise. Retain another provider when resilience, benchmark disagreement, or route-specific evidence supports it.

## Source Ledger

- `2026-07-09`: [GPT-5.6 general availability, prices, provider evaluations, and model family](https://openai.com/index/gpt-5-6/).
- `2026-06-26`: [GPT-5.6 Sol preview, max effort, ultra operation, and availability boundary](https://openai.com/index/previewing-gpt-5-6-sol/).
- `2026-07-09`: [Artificial Analysis independent launch measurements](https://artificialanalysis.ai/articles/gpt-5-6-has-landed).
- Current `v4.1`: [Artificial Analysis index composition and trends](https://artificialanalysis.ai/trends).
- `2026-06-30`: [Claude Sonnet 5 pricing, tokenizer caveat, and effort comparison](https://www.anthropic.com/news/claude-sonnet-5).
- `2026-06-30`: [Claude Fable 5 redeployment and access boundary](https://www.anthropic.com/news/redeploying-fable-5).
- Current on `2026-07-10`: [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing).
- `2026-06-03`, revised `2026-06-11`: [Agents' Last Exam benchmark paper](https://arxiv.org/abs/2606.05405).

The ledger is a snapshot, not a permanent ranking. Prices, preview identifiers, effort defaults, and benchmark leaderboards can change. Pin the exact model version in experiments and repeat the route evaluation before any broad production cutover.
