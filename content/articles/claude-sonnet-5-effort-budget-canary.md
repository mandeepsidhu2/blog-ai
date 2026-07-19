---
title: Canary Claude Sonnet 5 With Fixed Effort and Token Budgets
description: Separate Sonnet 5 capability gains from effort, harness, tokenizer, and introductory-price effects before changing an agent production route.
topic: Agent Models
level: Advanced
date: 2026-07-18
readingTime: 18
tags: claude-sonnet-5, agent-evaluation, model-routing, token-economics, coding-agents
image: /content/v1/assets/claude-sonnet-5-effort-budget.svg
imageAlt: Decision surface showing how effort level, tokenizer expansion, and introductory pricing affect a Claude Sonnet 5 production canary
evidenceMode: strategy
qualityTier: timely-analysis
---

Claude Sonnet 5 is a credible candidate to replace a more expensive agent model. The launch evidence does not support replacing one at an unconstrained effort setting and calling the result a model win.

Anthropic released Sonnet 5 on June 30, 2026 with introductory API pricing of $2 per million input tokens and $10 per million output tokens through August 31. Standard pricing then becomes $3 and $15. The model also uses a new tokenizer that can map the same input to roughly 1.0–1.35× as many tokens, depending on content. Meanwhile, several headline evaluations use high or extra-high effort, different harnesses, multiple attempts, tool access, or token budgets as large as 10 million.

Those facts change the adoption question. The right comparison is not “Sonnet 5 versus the incumbent at each provider's best published score.” It is verified task success at a fixed effort policy, fixed wall-clock and token ceilings, equivalent tools, and both promotional and steady-state prices.

The public numbers are promising. The June 30 system card reports 63.2% on SWE-bench Pro versus 58.1% for Sonnet 4.6; 80.4% on Terminal-Bench 2.1 versus 67.0%; 57.4% on Humanity's Last Exam with tools versus 46.8%; and 81.2% on OSWorld-Verified versus 78.5%. But these rows do not share one harness or budget, and the release itself corrected its BrowseComp chart to use the documented 10-million-token methodology. A production decision needs a task-level canary that makes those variables visible.

## Finding and decision summary

- Sonnet 5 launches at $2/MTok input and $10/MTok output until August 31, 2026; steady-state pricing is 50% higher at $3/$15.
- Opus 4.8 is listed at $5/MTok input and $25/MTok output, but a higher-effort Sonnet run can consume enough tokens and tool time to erase some sticker-price advantage.
- The new tokenizer can expand the same input to 1.0–1.35× the prior token count. A cost canary must replay exact requests through both tokenizers rather than multiply old usage by the new list price.
- SWE-bench Pro improves 5.1 points over Sonnet 4.6 in the system-card table; Terminal-Bench 2.1 improves 13.4 points. The evaluation settings differ and are not directly comparable to each other.
- Terminal-Bench uses 89 tasks, five attempts per task, a GKE environment, mini-SWE-agent, extra-high Sonnet 5 effort, and high Sonnet 4.6 effort. That row mixes a model change with an effort change.
- BrowseComp reports 84.7% for a single agent and 86.6% for multi-agent Sonnet 5 under a 10M-token methodology with compaction and programmatic tool calling. That is a search-system result, not a bare-model score.
- Approve Sonnet 5 first for bounded coding and knowledge workflows where lower unit prices matter and verification is automatic. Keep the incumbent for high-consequence tasks until equal-budget evidence accumulates.

The recommendation is a dual-price, fixed-budget canary. Report launch economics for near-term capacity planning, standard economics for architecture decisions, and cost per verified success for both.

## What changed with Sonnet 5

Anthropic's [June 30 release](https://www.anthropic.com/news/claude-sonnet-5) positions Sonnet 5 as an agentic Sonnet-class model close to Opus 4.8 on some workloads. It is available through model ID `claude-sonnet-5`, is the default for Free and Pro users, and is offered on the native platform plus cloud channels.

The model exposes effort levels that trade tokens and latency for capability. The release's cost-performance curves are therefore more informative than a single maximum-effort point: teams can choose a lower effort for routine steps and reserve higher effort for hard cases. That flexibility is operationally valuable only if the router can predict or detect when escalation is justified.

The tokenizer change is easy to miss. Anthropic says the same input can produce approximately 1.0–1.35× the tokens seen by Sonnet 4.6, depending on content type. At the 1.35× boundary, standard Sonnet 5 input cost per identical text is `1.35 × $3 = $4.05` per old-token-equivalent million, not $3. The model still has a large discount versus Opus 4.8's $5 input price, but the discount is smaller than the price sheet alone suggests. Output length and reasoning tokens can dominate further.

Cloud availability also affects the rollout contract. [AWS announced Sonnet 5](https://aws.amazon.com/blogs/machine-learning/introducing-claude-sonnet-5-on-aws-anthropics-most-capable-sonnet-model/) on Bedrock and Claude Platform on AWS, and the [AWS model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-5.html) records the June 30 launch and provider-specific identifiers. [Microsoft Foundry](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/claude-sonnet-5-is-now-generally-available-in-microsoft-foundry/4530737) announced general availability as well. Region coverage, request schema, rate limits, safety controls, telemetry, and promotional pricing can differ, so “same model” is not automatically “same route.”

## Benchmark and price comparison

Sources: Anthropic's [release and changelog](https://www.anthropic.com/news/claude-sonnet-5), the dated [Sonnet 5 system card](https://www-cdn.anthropic.com/d9bb04416ffe1352af84721476c1fa9994c07fde/Claude%20Sonnet%205%20System%20Card.pdf), the [SWE-bench paper](https://arxiv.org/abs/2310.06770), and the [Terminal-Bench 2.1 paper](https://arxiv.org/abs/2601.11868).

| Signal | Sonnet 5 | Sonnet 4.6 | Comparability limit |
|---|---:|---:|---|
| SWE-bench Pro | 63.2% | 58.1% | same named benchmark; five-trial means, harness details matter |
| Terminal-Bench 2.1 | 80.4% | 67.0% | Sonnet 5 xhigh vs Sonnet 4.6 high effort; 445 attempts/model |
| HLE, no tools | 43.2% | 34.6% | grader revision changed the historical 4.6 figure |
| HLE, with tools | 57.4% | 46.8% | web, fetch, code, and programmatic tools are part of system |
| OSWorld-Verified | 81.2% | 78.5% | updated zoom tool and batched-action fix changed prior result |
| FrontierCode v1 | 38.8% | 15.1% | 150 tasks; cost varies with effort and harness |
| Input price through Aug. 31 | $2/MTok | not a controlled benchmark | promotional, not durable architecture price |
| Standard input/output price | $3/$15 per MTok | deployment-dependent | tokenizers differ; identical text may not mean equal tokens |

The table should not be averaged into one score. Coding tasks, web search, computer use, and knowledge questions measure different systems. “Benchmark limitation” is not a disclaimer to ignore results; it is the instruction to preserve the variables that make each result interpretable.

The tokenizer and price interaction is large enough to show explicitly. Consider a monthly workload that Sonnet 4.6 records as 100 million input tokens and 10 million output tokens, holding output count fixed only for illustration:

| Pricing case | Input-token replay assumption | Input cost | Output cost | Illustrative total |
|---|---:|---:|---:|---:|
| Sonnet 5 launch, low expansion | 100M × 1.00 | $200 | $100 | $300 |
| Sonnet 5 launch, high expansion | 100M × 1.35 | $270 | $100 | $370 |
| Sonnet 5 standard, low expansion | 100M × 1.00 | $300 | $150 | $450 |
| Sonnet 5 standard, high expansion | 100M × 1.35 | $405 | $150 | $555 |
| Opus 4.8 list-price reference | 100M × 1.00 assumed | $500 | $250 | $750 |

Source: Anthropic's [June 30 pricing and tokenizer footnote](https://www.anthropic.com/news/claude-sonnet-5). This is arithmetic, not a forecast: Sonnet 5 may change output and reasoning length, Opus tokenization is not held equivalent, caching is omitted, and the input replay must use actual text. The $300-to-$555 spread shows why neither launch sticker price nor the top of a tokenizer range is an adequate budget.

The most important confound is effort. Terminal-Bench compares Sonnet 5 at extra-high effort with Sonnet 4.6 at high effort. That is useful for maximum-result planning but insufficient to estimate the model-only increment. A fair production canary needs at least three cells: equal fixed effort, equal token/wall-time budget, and each model's selected production policy.

The second confound is harness. The system card uses mini-SWE-agent for Terminal-Bench because its timeout behavior is more stable than Terminus-2 at extra-high effort. [OSWorld](https://os-world.github.io/) includes a computer-use environment, while BrowseComp depends on search, compaction, and programmatic tool calling. A provider's complete system score can be operationally relevant without being portable to your agent.

## Engineering decision: measure cost per verified success

Create a frozen replay set from real tasks, not synthetic prompts selected after seeing failures. Stratify by task type, repository or document collection, expected human duration, risk, and tool path. Include successful, failed, timeout, and policy-refused incumbent cases. Remove secrets but preserve token-length and tool-graph distributions.

Run at least 100 tasks per high-volume stratum when feasible and pair tasks across models. For stochastic agents, use three or more attempts for the smaller confirmatory set and report task-clustered uncertainty rather than pretending attempts are independent tasks. Separate exploratory routing work from the final untouched evaluation period.

Predeclare two decisions. The first is quality noninferiority at equal effort and equal ceilings. The second is an economic promotion at the actual production policies, priced after August 31. A treatment can pass the first and fail the second if extra-high effort, longer outputs, or tokenizer expansion consumes the nominal discount. Keeping the decisions separate prevents a promotional-price win from being presented as durable model superiority.

Record input, cache-write, cache-read, output, and reasoning tokens; tool calls; wall time; model effort; retries; terminal state; verifier result; and human-review minutes. Compute:

`cost per verified success = total model + tool + review cost / verified successes`.

Price each trace twice: at the introductory $2/$10 schedule and at the post-August $3/$15 schedule. Also replay the exact prompt text through the new tokenizer. If the token ratio is 1.25× on a repository's governance and code context, put 1.25 into the forecast rather than the provider's broad 1.0–1.35× range.

Use deterministic verifiers wherever possible: tests, type checks, policy assertions, citation resolution, spreadsheet reconciliation, or state-diff approval. Blind human reviewers to model identity for qualitative tasks. Success without verification is completion theater.

## Effort routing and production implications

A bounded router can recover the release's main economic promise. Start routine, reversible tasks at low or medium effort. Escalate only on observable conditions: verifier failure, insufficient evidence coverage, high task-risk class, tool loop without progress, or an explicit complexity classifier validated on held-out data.

Do not let the model choose unlimited effort without an external ceiling. Set maximum input, output, reasoning, tool-call, and wall-clock budgets. Make budget exhaustion a typed terminal state rather than an invisible retry. An extra-high run that eventually succeeds may still lose to an incumbent on cost per success and user latency.

Cache economics need their own row. Repeated repository context and stable system instructions may produce high cache reuse, but the tokenizer change affects cache keys and token accounting. Warm-cache comparisons must use equal cache state. Measure cold, partial-hit, and warm conditions separately.

For cloud portability, define a provider-neutral envelope around model ID, effort, token limits, tool schema, timeout, safety-policy version, and usage telemetry. Preserve provider request IDs. A route that cannot report reasoning or usage fields consistently should not share one cost dashboard without a missing-data flag.

## Comparison limitations and missing information

The system card is provider-authored. It is unusually detailed, but many results still use Anthropic-selected harnesses, graders, and effort policies. Independent production evidence for Sonnet 5 is necessarily young on July 18.

The corrected BrowseComp chart is a healthy disclosure and a warning. The June 30 changelog says the original chart used a simpler methodology that did not match Anthropic's standard approach; the replacement uses a 10M-token budget, compaction, and programmatic tool calling. Small harness changes can move the apparent frontier.

Benchmark scores are not directly comparable across rows. HLE with tools and without tools answer different questions. OSWorld includes a computer-use scaffold. SWE-bench variants contain different task sets. Terminal-Bench's 80.4% is an average across five attempts for each of 89 tasks, not the probability that an arbitrary production task succeeds once.

Latency distributions, rate-limit behavior, region-by-region availability, cache-hit economics, long-context accuracy, and error rates for the reader's workload are not reported. Unknown values should stay unknown until a canary measures them.

## Adoption boundary: when not to switch

Do not switch a safety-critical or destructive agent solely because Sonnet 5's aggregate behavioral audit improved over Sonnet 4.6. The release says the model still shows a higher rate of misaligned behavior than Opus 4.8 on that audit, and model behavior is not an authorization boundary.

Do not replace Opus 4.8 on rare, high-value tasks where a small quality loss costs more than token savings. Use the same verifier and compare cost per accepted outcome, not list price.

Do not adopt extra-high effort by default. It changes latency, token use, timeout exposure, and tool-call count. Reserve it for a validated escalation slice.

Do not forecast September economics from the promotional price. A system that is viable only at $2/$10 has a known expiration date.

Do not hot-swap a live multi-turn agent without testing history, cache, tokenizer, and tool-schema behavior. Start new sessions on the canary route unless state compatibility is proven.

## Production readiness, failure modes, and rollback

Canary 5% of eligible new tasks with a randomized incumbent control during the same period. Keep task allocation sticky by repository, customer, or workflow so cross-session state does not leak between routes. Promote only when the lower bound on verified-success change is within the agreed noninferiority margin and steady-state cost per success improves.

Failure modes include reasoning-budget exhaustion, more tokens from the new tokenizer, tool loops, provider throttling, changed refusal behavior, cache misses, prompt-injection susceptibility, and verifier gaming. Log each separately; “agent failed” is not a diagnostic class.

Illustrative rollback triggers are verified success more than 2 percentage points below the incumbent, p95 wall time more than 20% higher, cost per verified success more than 10% above the steady-state forecast, tool-schema violations above 0.5%, or any destructive-action policy escape. Tune thresholds to risk and sample size.

Rollback routes new tasks to the pinned incumbent and lets safe in-flight work finish or terminate at checkpoints. Preserve all Sonnet 5 traces for error analysis. Do not compensate for a bad canary by silently raising effort; that creates a new treatment and requires a new decision.

## Source ledger

- 2026-06-30 — Anthropic, [Sonnet 5 release, pricing, tokenizer range, benchmark notes, and changelog](https://www.anthropic.com/news/claude-sonnet-5).
- 2026-06-30 — Anthropic, [Claude Sonnet 5 System Card](https://www-cdn.anthropic.com/d9bb04416ffe1352af84721476c1fa9994c07fde/Claude%20Sonnet%205%20System%20Card.pdf).
- 2026-06-30 — AWS, [Sonnet 5 on Amazon Bedrock and Claude Platform on AWS](https://aws.amazon.com/blogs/machine-learning/introducing-claude-sonnet-5-on-aws-anthropics-most-capable-sonnet-model/).
- Current July 2026 — AWS, [Sonnet 5 model identifiers and launch metadata](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-5.html).
- 2026-06-30 — Microsoft, [Sonnet 5 general availability in Foundry](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/claude-sonnet-5-is-now-generally-available-in-microsoft-foundry/4530737).
- 2026 system-card methodology — Terminal-Bench authors, [Terminal-Bench 2.1 paper](https://arxiv.org/abs/2601.11868).
- Benchmark methodology — SWE-bench authors, [SWE-bench paper](https://arxiv.org/abs/2310.06770).
- Current benchmark documentation — XLang Lab, [OSWorld environment and evaluation](https://os-world.github.io/).
- 2026 methodology context — Cognition, [FrontierCode introduction](https://cognition.ai/blog/frontier-code).

The actionable conclusion is deliberately narrower than the launch message: Sonnet 5 deserves a fast canary, but effort, tokenization, harness, and price phase belong in the treatment definition. If they are not fixed or logged, the canary cannot tell you what won.
