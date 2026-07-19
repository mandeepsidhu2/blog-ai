---
title: Trace-Test Agent Tool Migrations Before Trusting Final Scores
description: Turn GitHub's Copilot code-review regression into a controlled rollout method for changing agent tools, descriptions, and context-return behavior.
topic: AI Code Review
level: Advanced
date: 2026-07-18
readingTime: 18
tags: code-review-agents, tool-use, agent-traces, context-engineering, evaluation
image: /content/v1/assets/agent-tool-migration-trace-scorecard.svg
imageAlt: Trace scorecard comparing broad repository browsing with diff-anchored search and focused evidence reads for code-review agents
evidenceMode: strategy
qualityTier: timely-analysis
---

An agent tool migration can preserve every nominal capability and still make the product worse. The model sees more than function names and JSON schemas: descriptions suggest a workflow, return shapes determine how much context persists, and error messages influence recovery. “Equivalent tools” are not equivalent treatments.

GitHub published a useful production example on July 10, 2026. Copilot code review moved from custom repository-exploration functions to the shared `grep`, `glob`, and `view` tools used by Copilot CLI. Offline benchmarks initially showed higher average cost and fewer useful comments. The tools worked; the review agent used them like a broad coding assistant, repeatedly widening its search and carrying unrelated context forward.

GitHub then rewrote the instructions around a review-specific workflow: start from the diff, form a narrow question, batch cheap discovery, read exact ranges only after locating evidence, and recover from search errors without guessing paths. In production, the tuned treatment reported roughly 20% lower average review cost than control without a blocking quality signal. Applying the same focused posture to the general CLI did not produce the same win.

The consequential lesson is not “use grep.” It is that tool descriptions, context-return policy, and task posture form one versioned agent interface. Migrate them with task-level randomization and trace-level diagnostics. A final-score A/B test can show that performance moved; only the trace can tell whether the agent narrowed toward evidence, looped after errors, or filled its context with irrelevant files.

## Finding and decision summary

- GitHub replaced several custom review tools with three shared Unix-style tools: `grep`, `glob`, and `view`.
- The first offline treatment increased cost and reduced useful comments despite a better-maintained shared implementation.
- The corrected review workflow has five explicit stages: start from the diff, narrow with search, batch discovery, read focused ranges, and decide.
- GitHub reports roughly 20% lower average production review cost versus control after instruction tuning, with no blocking quality signal.
- The number of tool calls stayed similar; the distribution shifted toward relevant evidence. Call count alone would have missed the mechanism.
- The same focused instructions did not deliver the same benefit in Copilot CLI. Product transfer was a negative result.
- GitHub's broader June 25 harness methodology uses 89 TerminalBench tasks, at least five independent runs per agent-model configuration, a two-hour timeout, and normalized medium reasoning for its controlled comparison.
- For benchmarks below 100 instances, that methodology reports the best of five runs, a choice that can be optimistic and should not be copied into a production noninferiority test.

The engineering decision is to version and evaluate the complete tool contract. Do not approve a migration because old and new functions have the same apparent purpose.

## What changed in the Copilot review workflow

The [July 10 GitHub account](https://github.blog/ai-and-ml/github-copilot/better-tools-made-copilot-code-review-worse-heres-how-we-actually-improved-it/) maps custom operations to shared tools: directory listing becomes `glob`, file and directory search become `grep`, and code reads become `view`. That sounds mechanical. It was not.

The older review functions could return requested lines plus surrounding context. Earlier models made fewer tool calls and benefited from extra nearby code. The shared tools were narrower and their generic descriptions were written for broader coding work. The migrated agent searched widely, guessed paths, read large areas, found more reasons to search, and accumulated output in its working context.

The corrected instructions made the pull-request diff the anchor. `grep` and `glob` identify candidate evidence; `view` reads only the relevant range. Independent discovery calls are batched. A failed regex gets one simpler escaped retry. A wrong path triggers `glob`, not speculative reads of neighboring files.

That workflow is task-specific. A coding assistant asked to understand or modify an unfamiliar repository may need broad exploration. A reviewer starts with a proposed change and asks whether it introduced a defect. GitHub's failed CLI transfer is therefore as important as the code-review win: the same tools and wording can have different value under a different job topology.

## Comparison scorecard for a tool migration

Sources: GitHub's [code-review migration report](https://github.blog/ai-and-ml/github-copilot/better-tools-made-copilot-code-review-worse-heres-how-we-actually-improved-it/), its [June 25 harness methodology](https://github.blog/ai-and-ml/github-copilot/evaluating-performance-and-efficiency-of-the-github-copilot-agentic-harness-across-models-and-tasks/), the [SWE-agent interface paper](https://arxiv.org/abs/2405.15793), and the newer [SWE-Explore benchmark](https://arxiv.org/abs/2606.07297).

| Treatment | Observable trace pattern | Product result | Required interpretation |
|---|---|---|---|
| Custom review tools | fewer, context-rich reads | historical control | tailored to older model behavior; not a universal optimum |
| Shared tools with generic coding posture | broad search → guessed paths → broad reads | higher cost, fewer useful comments offline | capability parity did not preserve workflow parity |
| Shared tools with review-shaped instructions | diff question → batched grep/glob → focused view | ~20% lower production cost, quality not blocked | combined tool-plus-instruction treatment |
| Focused posture transferred to Copilot CLI | narrow exploration on broader interactive tasks | same win not observed | negative transfer; task has no stable diff anchor |

The comparison is limited because GitHub does not publish the absolute token cost, comment-quality denominator, sample size, confidence interval, model revision, or exact instruction text for the production A/B. The 20% result is a provider-reported product signal, not a portable effect size. It justifies the migration method, not a promise of 20% savings elsewhere.

SWE-agent provides older but necessary interface context. Its central contribution was an agent-computer interface designed around software-engineering actions rather than assuming a shell alone was sufficient. [OpenHands](https://arxiv.org/abs/2407.16741) takes a broader platform approach, and the current [OpenHands file-based agent documentation](https://docs.openhands.dev/sdk/guides/agent-file-based) includes a read-only code-explorer role. These systems reinforce the same boundary: tools encode task assumptions. Their benchmark numbers are not directly comparable to GitHub's internal code-review experiment because models, tasks, scaffolds, and verifiers differ.

## Engineering decision: version the entire agent interface

Give every migration an interface revision that covers:

- tool name and description;
- input schema, defaults, and examples;
- output fields, ordering, truncation, and maximum bytes;
- error classes and recovery hints;
- parallel-call behavior;
- permission and confirmation semantics;
- system instructions governing when and why to call the tool;
- context retention, compaction, and cache behavior.

The current [MCP tool specification](https://modelcontextprotocol.io/specification/draft/server/tools) treats name, description, input schema, output schema, and annotations as part of the exposed tool definition. It also calls for deterministic tool ordering to help caching. That is an interoperability contract, not proof of behavioral equivalence. Two MCP servers can validate against the same schema while returning radically different context volume or nudging different search strategies.

Anthropic's [tool-writing guidance](https://www.anthropic.com/engineering/writing-tools-for-agents) similarly treats names, descriptions, boundaries, and evaluation as behavioral design. Its example of a web-search description causing the model to append a year shows that small wording can systematically bias calls. The later [advanced tool-use report](https://www.anthropic.com/engineering/advanced-tool-use) describes tool catalogs consuming 134,000 tokens before optimization, a useful upper-bound signal that definitions themselves can dominate context.

Store rendered tool definitions alongside eval traces. If a description changes without a revision bump, a later regression becomes impossible to attribute. Hash the full prompt-visible interface, not just implementation code.

## Build a paired trace evaluation

Start with a frozen task set sampled before the migration is tuned. For code review, stratify by language, repository, diff size, generated-file presence, test coverage, security relevance, and whether the defect requires out-of-diff context. Keep repositories clustered during train/validation/test splits so near-duplicate conventions do not leak.

Pair old and new interface runs on the same task, model snapshot, reasoning setting, token ceiling, timeout, permissions, and tool availability. Randomize execution order to reduce service-time and cache confounds. Use at least three stochastic repeats for a smaller confirmatory set or enough production traffic for a task-clustered interval.

Use a 2×2 attribution screen before collapsing to a two-arm production test:

| Tool implementation | Generic/ported instructions | Task-shaped instructions | What the contrast identifies |
|---|---|---|---|
| Old | historical baseline | old tools with new posture | instruction effect without implementation change |
| New/shared | naive migration | intended candidate | implementation effect and interaction |
| Cross-cell comparison | old/generic vs new/generic | old/shaped vs new/shaped | whether shared code itself helps or hurts |

Source for the motivating interaction: GitHub's [July 10 migration trace](https://github.blog/ai-and-ml/github-copilot/better-tools-made-copilot-code-review-worse-heres-how-we-actually-improved-it/). The screen does not require equal production traffic in all four cells: run it offline on the frozen set, then canary the best justified candidate against the historical contract.

Measure product outcomes: accepted-comment precision, defect recall on seeded or adjudicated issues, false-positive burden, review latency, reviewer dismissal, and cost per accepted finding. Then measure trace mechanisms:

- searches, reads, and total tool calls;
- unique files and lines viewed;
- bytes and tokens returned by each tool;
- fraction of reads touching changed files or verified call sites;
- search-to-read alternations;
- repeated or relaxed queries;
- invalid paths and tool errors;
- context growth by step;
- time and tokens between first sufficient evidence and final answer.

The last metric exposes over-exploration. If the agent had enough evidence at step six but continued browsing until step sixteen, final quality may remain flat while cost and distraction rise.

Estimate that point with blinded trace annotation. Give reviewers the diff, the agent's stated question, and cumulative evidence after each tool result; ask for the earliest step at which the eventual comment is supported or should be rejected. Compare remaining calls, tokens, and wall time after sufficiency. Automated proxies such as first successful test or first resolved call site are cheaper, but they should be calibrated against this annotation because an agent can find a plausible caller before it finds the decisive one.

Use trace categories rather than one scalar efficiency score. “Narrowing” means candidate scope decreases before an expensive read. “Widening” means files, directories, or query breadth grow without a new hypothesis. “Recovery” means a failed call leads to a bounded correction. “Loop” means semantically repeated calls add no evidence.

## Benchmark limitations and missing data

GitHub's broader harness report provides useful experimental discipline but also illustrates reporting choices to audit. It compares more than 20 supported models, normalizes context, prompt limits, reasoning effort, tool selection, and MCP availability, and runs TerminalBench configurations at least five times. All runs use a two-hour timeout and 89 tasks.

However, for benchmarks with fewer than 100 instances, it reports the best of five runs. That reduces the effect of an unlucky run but biases the displayed estimate upward relative to deploying one run. The report also reruns infrastructure failures while retaining model-generated errors, a defensible distinction that requires explicit failure taxonomy.

Its chart notes Copilot CLI was 7% and 4% worse on SWE-bench Verified for GPT-5.4 and GPT-5.5 while being better in other configurations. GitHub interprets many differences as within stochastic variance. That is a reminder not to claim harness superiority from one benchmark cell.

The July 10 code-review report says quality did not produce a blocking signal; it does not publish a noninferiority interval. “No block” can mean the experiment was sufficiently powered, or merely that no monitored metric crossed a threshold. A local adoption decision should predeclare the quality margin and minimum sample size.

Repository-exploration research is still separating localization from end-to-end task success. SWE-Explore, released in June 2026, exists because binary resolution scores hide whether an agent understood the repository, retrieved context, localized the bug, or diagnosed it. The GitHub trace lesson is directionally consistent, but benchmark settings, hardware, models, datasets, prompts, and graders are different.

## Failure modes during tool migrations

The first failure is context amplification. A new tool may return less per call but provoke more calls and more persistent output. Track total retained context, not only response size.

The second is error-driven exploration. New escaping, path, pagination, or range conventions can turn a single invalid call into a speculative loop. Make errors typed and include the smallest safe corrective hint.

The third is permission drift. A read-only tool can become a shell wrapper with broader authority, or annotations may incorrectly imply idempotence. Keep authorization outside model judgment and compare effective permissions during rollout.

The fourth is silent truncation. A view tool that cuts long lines or a grep tool that caps matches can omit decisive evidence. Return truncation metadata and continuation handles. Include adversarial tests where the relevant call site appears just beyond a boundary.

The fifth is task-posture leakage. Review-shaped instructions can damage open-ended coding; broad exploration can damage focused review. Route by job and keep separate prompt-visible tool guidance even if implementation is shared.

The sixth is evaluation contamination. Iterating repeatedly on one internal benchmark can teach the prompt its quirks. Preserve an untouched repository holdout and a later time split.

## Adoption boundary: when not to consolidate tools

Do not consolidate solely to reduce maintenance duplication if the shared interface cannot express the product's evidence needs. Shared implementation can coexist with task-specific descriptions, wrappers, and output policies.

Do not deploy a final-score-neutral migration when cost, latency, context growth, or false-positive burden worsens. Neutral quality is not neutral product value.

Do not transfer a successful instruction set across coding, review, incident response, research, and data analysis without a separate test. GitHub's CLI counterexample is direct evidence against that shortcut.

Do not expose destructive shell capabilities to reproduce a read-only review interface. Capability expansion requires its own security review, approvals, and adversarial tests.

Do not use tool-call count as the primary optimization metric. GitHub observed a similar number of calls after the fix; relevance of evidence changed.

## Production readiness and rollback

Roll out with four arms when traffic permits: old tools/old instructions, new tools/ported instructions, new tools/task-shaped instructions, and old tools/task-shaped instructions. This factorial design separates implementation effects from instruction effects. If traffic is limited, run the four arms offline and canary only the best justified pair.

Randomize by pull request while clustering repeat updates to the same pull request in one arm. Blind human quality adjudicators to treatment. Predeclare noninferiority for useful-comment precision and recall, then optimize cost only among treatments that pass.

Ship trace dashboards before the migration. Roll back if accepted-finding rate falls more than 2 percentage points, false positives rise more than 10%, p95 cost rises more than 15%, invalid tool calls exceed 1%, or median retained context grows more than 20% without a quality gain. These are illustrative operating thresholds, not values established by GitHub.

Rollback changes the interface revision and routes new reviews to the prior tool contract. Preserve in-flight trace compatibility or terminate at a safe checkpoint. Keep the failed treatment and hashes for analysis; do not overwrite the evidence by editing descriptions in place.

## Source ledger

- 2026-07-10 — GitHub, [Copilot code-review tool migration, regression, trace diagnosis, and ~20% production cost result](https://github.blog/ai-and-ml/github-copilot/better-tools-made-copilot-code-review-worse-heres-how-we-actually-improved-it/).
- 2026-06-25 — GitHub, [agentic harness benchmarks, 89-task protocol, five-run design, two-hour timeout, and limitations](https://github.blog/ai-and-ml/github-copilot/evaluating-performance-and-efficiency-of-the-github-copilot-agentic-harness-across-models-and-tasks/).
- 2026-06 — SWE-Explore authors, [repository-exploration benchmark](https://arxiv.org/abs/2606.07297).
- 2024-05 — Princeton NLP, [SWE-agent interface paper](https://arxiv.org/abs/2405.15793), older but necessary origin context for task-shaped agent-computer interfaces.
- 2024-07 — OpenHands authors, [generalist software-agent platform paper](https://arxiv.org/abs/2407.16741).
- Current 2026 — OpenHands, [file-based agent and code-explorer documentation](https://docs.openhands.dev/sdk/guides/agent-file-based).
- Current draft — Model Context Protocol, [tool definition and deterministic-order contract](https://modelcontextprotocol.io/specification/draft/server/tools).
- 2025-09 — Anthropic, [writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents), older but directly relevant tool-description methodology.
- 2025-11 — Anthropic, [advanced tool use and the 134K-token catalog example](https://www.anthropic.com/engineering/advanced-tool-use).
- Current 2026 — Anthropic, [tool-use loop and schema documentation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works).

The July signal is unusually actionable because it includes a failed migration, a trace-level mechanism, a production result, and a negative transfer. Treat tool contracts as prompts with operational consequences. If the rollout cannot explain what changed inside the trace, it is not ready to explain a final-score change either.
