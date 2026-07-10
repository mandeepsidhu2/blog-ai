---
title: Build a Control Plane for AI Science Workbenches
description: Compare Claude Science, GPT-Rosalind, FutureHouse, and AI co-scientist systems, then define the provenance, evaluation, compute, and review controls a lab needs.
topic: AI for Science
level: Advanced
date: 2026-07-10
readingTime: 19
tags: ai-for-science, scientific-agents, reproducibility, research-infrastructure, provenance, evaluation
image: /content/v1/assets/ai-science-workbench-control-plane.svg
imageAlt: Scientific agent evidence chart comparing workbench scale signals with human and agent benchmark completion gaps
evidenceMode: strategy
qualityTier: timely-analysis
---

Scientific AI is moving from question answering to an executable workbench. The new systems can search literature, write analysis code, create environments, submit compute, render domain artifacts, and preserve a trace. That is a more consequential shift than another model-score increase because it moves the model inside the chain of custody for scientific evidence.

The shift also raises the standard for adoption. A fluent answer can be reviewed and discarded. An agent that selects a cohort, runs a statistical test, changes an axis, or submits a cluster job can produce a polished artifact whose error survives into a manuscript. Labs therefore need a control plane around the agent: immutable inputs, environment capture, resource approvals, typed artifacts, independent review, and claim-level provenance.

Claude Science, released in beta on `2026-06-30`, makes this architecture visible in a general workbench. GPT-Rosalind targets life-science reasoning and executed workflows. FutureHouse exposes specialized scientific agents. Google's AI co-scientist emphasizes iterative multi-agent hypothesis generation. These systems are not directly comparable products: access, domains, models, tools, and evaluations differ. Their common direction, however, is clear enough to design infrastructure around now.

## Finding and Decision Summary

Adopt scientific agents first as auditable workflow accelerators, not autonomous principal investigators.

- Start with bounded tasks whose outputs have machine-checkable or expert-checkable acceptance criteria: literature tables, dataset quality reports, analysis reruns, figure regeneration, and protocol consistency checks.
- Require every figure and quantitative claim to resolve to code, environment, data snapshot, and execution record. A conversational transcript alone is not provenance.
- Separate the actor from the reviewer. Claude Science advertises a reviewer agent; a lab should also use deterministic checks and a human domain owner because an agent reviewer can share the actor's blind spots.
- Put resource and data-boundary approvals outside the model. An agent may propose a cluster job, but policy code should decide whether it can read a dataset, request `100` GPUs, or write into a regulated workspace.
- Evaluate complete workflows. AstaBench reports roughly `53%` for its earlier top aggregate agent but only `3%` perfect completion on its hard end-to-end task; component success does not imply a defensible finished study.

The strongest near-term use is a reproducible research assistant operating inside an existing scientific method. The weakest is open-ended novelty generation without a stable evaluator. Current benchmark evidence says agents are better at well-specified analysis than self-directed exploration and robust solutions to ambiguous research questions.

## What Changed in the Current Release Cycle

[Anthropic's Claude Science announcement](https://www.anthropic.com/news/claude-science-ai-workbench) describes a beta for Pro, Max, Team, and Enterprise users on macOS and Linux, including remote access through SSH or an HPC login node. It exposes more than `60` curated scientific skills and connectors, a coordinating agent, user-created specialist agents, and a reviewer agent. Generated figures include the exact code and environment, a plain-language creation record, and the full message history.

The system also crosses an important execution boundary. It can use a laptop, a lab cluster, or on-demand compute, scaling from `1` GPU to hundreds. The announcement says it asks before reaching new resources and lets users revoke a decision before job submission. Sensitive datasets can remain on lab infrastructure while only context needed for a step is sent to the model. Those are promising product controls, but a lab still needs to verify how identity, network egress, secrets, retention, and approval logs behave in its environment.

On `2026-06-03`, [OpenAI expanded GPT-Rosalind](https://openai.com/index/introducing-new-capabilities-to-gpt-rosalind/) as a research preview for eligible organizations. Its LifeSciBench framing covers `6` workflow areas: evidence handling, analysis, design and optimization, reasoning, validation and operations, and scientific communication. The [initial GPT-Rosalind release](https://openai.com/index/introducing-gpt-rosalind/) described connections to more than `50` scientific tools and data sources. That is a domain model and tool ecosystem, not the same deployment surface as a desktop/HPC workbench.

[FutureHouse's agent platform](https://www.futurehouse.org/news/launching-futurehouse-platform-ai-agents), launched on `2025-05-01`, exposed `4` named agents for literature search, synthesis, and chemistry workflows through web and API interfaces. Its own description warned that the Phoenix agent was less benchmarked and more prone to mistakes. [Google's AI co-scientist](https://research.google/blog/accelerating-scientific-breakthroughs-with-an-ai-co-scientist/), announced on `2025-02-19`, used generation, reflection, ranking, evolution, and other specialized agents to propose and refine hypotheses with scientists.

The recent change is therefore integration depth. The agent is no longer only returning an answer or hypothesis. It is becoming the coordinator of files, tools, compute, visualizations, and review state.

## Systems Comparison

The product pages above document different scopes and should not be treated as a single benchmark. This table normalizes only observable workflow properties, not overall scientific capability.

Sources: [Claude Science](https://www.anthropic.com/news/claude-science-ai-workbench), [GPT-Rosalind](https://openai.com/index/introducing-new-capabilities-to-gpt-rosalind/), [FutureHouse](https://www.futurehouse.org/news/launching-futurehouse-platform-ai-agents), and [Google AI co-scientist](https://research.google/blog/accelerating-scientific-breakthroughs-with-an-ai-co-scientist/).

| System | Publicly described scale | Execution surface | Provenance or review signal | Access boundary |
|---|---|---|---|---|
| Claude Science beta | 60+ curated skills/connectors | Local macOS/Linux, SSH/HPC, on-demand GPUs | Exact figure code/environment/history; reviewer agent | Pro, Max, Team, Enterprise beta |
| GPT-Rosalind update | 6 LifeSciBench workflow areas; 50+ tools/data sources described at launch | Life-science model with research and NGS plugins | Expert-judged workflow evaluation; trusted-access structure | Eligible organizations, research preview |
| FutureHouse platform | 4 specialized agents at launch | Web and API, literature and chemistry tools | Agent-specific benchmarks and explicit Phoenix limitation | Public platform/API terms |
| Google AI co-scientist | Multi-agent generation, reflection, ranking, evolution | Research system paired with scientist goals and tools | Ranked hypotheses plus selected experimental validation | Trusted-tester access at announcement |

“Available” means different things across rows. A subscription beta, an enterprise research preview, a public API, and a trusted-tester program have different security reviews, support expectations, and reproducibility surfaces. The table should help a lab choose what to investigate, not declare a winner.

## Benchmark Reality: The Workflow Gap

Independent and academic benchmarks make the adoption boundary clearer. [AstaBench's April 30, 2026 update](https://allenai.org/blog/astabench-update-spring-2026) reports results on more than `2,400` scientific problems. Claude Opus 4.7 reached `58.0%` overall at an average `$3.54` per problem, GPT-5.5 reached `52.9%` at `$1.61`, and Gemini 3.1 Pro Preview reached `49.6%`. The older Asta v0 aggregate was about `53%`, yet its best agent completed only `3%` of E2E-Bench-Hard tasks perfectly. The report says partial completion was often around `60%-70%` of required steps.

The measurements below remain within their named benchmark slice. Sources: [PaperArena](https://paperarena-ai.github.io/) and the [AstaBench April 2026 update](https://allenai.org/blog/astabench-update-spring-2026).

| Evidence slice | Leading measured result | Comparison result | Observed difference |
|---|---:|---:|---:|
| PaperArena cross-paper reasoning | Best listed agent: 38.78% | Ph.D. experts: 83.50% | 44.72 percentage points |
| AstaBench current aggregate | Claude Opus 4.7: 58.0% | GPT-5.5: 52.9% | 5.1 percentage points |
| AstaBench E2E-Bench-Hard | Perfect completion: 3% | Typical partial progress: 60%-70% | Completion remains the bottleneck |

[PaperArena](https://paperarena-ai.github.io/) tests tool-augmented reasoning across scientific papers. Its listed Ph.D. expert baseline is `83.50`, while the strongest shown multi-agent configuration scores `38.78` with an average `8.58` steps. The single-agent counterpart scores `36.10`; multi-agent orchestration improves the result, but it does not close the `44.72`-point human gap. The paper also reports inefficient tool usage.

[SciAgentArena](https://arxiv.org/abs/2606.12736), submitted on `2026-06-10`, adds approximately `200` interactive tasks across real scientific settings. Its authors find that agents contribute effectively to well-specified data-analysis workflows but struggle with novel insight, sustained self-directed exploration, and robust open-ended solutions. [AstaBench's paper](https://arxiv.org/abs/2510.21652) similarly evaluates `57` agents across `22` agent classes and emphasizes control of tool and cost confounders.

These scores are not directly comparable. AstaBench, PaperArena, and SciAgentArena use different tasks, tools, models, graders, and definitions of completion. Provider product examples are case studies, not benchmark samples. The common signal is qualitative and operational: scientific agents are useful on components, while complete autonomous workflows remain brittle.

No cited benchmark directly evaluates the released Claude Science workbench or the current GPT-Rosalind product configuration. Transferring a backbone-model score to a product that adds tools, memory, reviewers, and compute orchestration would be a category error. The benchmark results justify strict workflow evaluation; they do not rank these products.

The implication for a lab is measurable. Evaluate artifact chains, not only final prose. A system can retrieve the right papers and still choose the wrong denominator, silently discard samples, execute stale code, or produce a figure from a different table than the caption describes.

## Control-Plane Architecture

A defensible workbench needs six services around the model.

**Identity and policy.** Resolve the human principal, agent role, data classification, and allowed actions before tool execution. Use short-lived credentials scoped to a project and resource. The model should never receive a reusable cluster key or unrestricted database token.

**Artifact registry.** Assign every input, intermediate dataset, notebook, script, environment lockfile, model response, table, and figure a content hash. Preserve parent-child edges so a figure can be traced backward without relying on chat history.

**Execution broker.** Convert an agent plan into a declarative job request. Validate container image, package lock, CPU/GPU/memory limits, network policy, data mounts, timeout, and expected outputs. The broker, not the LLM, submits to local or HPC compute.

**Evidence ledger.** Store each public or manuscript claim with supporting artifact ids, extraction locations, units, transformations, and reviewer status. A claim is publishable only when every quantitative value resolves to a measured output.

**Review separation.** Run deterministic checks first: schema validation, unit checks, sample counts, test statistics, figure-data equality, and citation resolution. Then use a second model with a different prompt or model family to challenge assumptions. Finish with the responsible scientist.

**Release controller.** Promote only immutable, reviewed artifacts into a manuscript or report. A later conversational edit must create a new version and repeat affected checks.

A compact job contract could look like this:

```yaml
run_id: scRNA-qc-2026-07-10-0042
principal: lab-user-184
input_snapshot: sha256:7d9c...
environment_lock: sha256:8b20...
container: registry.example/science/scrna@sha256:92af...
resources:
  gpu: 0
  cpu: 16
  memory_gb: 64
  timeout_minutes: 90
network:
  egress: deny
outputs:
  - qc_metrics.parquet
  - sample_exclusions.json
  - figure_2.svg
approvals:
  data_owner: approved
  compute_owner: approved
```

The value is not the YAML syntax. It is that resource use, inputs, environment, and outputs become reviewable before execution. The conversation can explain the plan, but the contract controls it.

## Engineering Decision Framework

Choose a first workflow by scoring four dimensions from `0` to `3`: ground-truth availability, reversibility, data sensitivity, and open-endedness. A good pilot has high ground-truth availability and reversibility, with low sensitivity and low open-endedness. Figure regeneration from a frozen table might score `3/3/1/0`. Novel target nomination from proprietary omics could score `0/1/3/3` and should remain human-led.

For each candidate, define the unit of success. Literature review success might require citation precision, evidence-table recall, contradiction detection, and expert acceptance. Analysis success might require exact sample count, deterministic rerun, unit-test pass rate, statistical-method agreement, and figure hash equality. Wet-lab planning needs protocol feasibility and safety review; an elegant narrative is not an acceptance metric.

Then decide where the agent may act:

- **Suggest:** draft a query, plan, code patch, or job contract.
- **Execute in sandbox:** run against copied or synthetic data with no egress.
- **Execute on controlled data:** use approved snapshots and fixed resources.
- **Promote:** create a candidate artifact for independent review.
- **Publish or trigger experiments:** reserved for authorized humans and existing institutional controls.

Most labs should start at the second level. Moving upward should require measured evidence, not familiarity with the interface.

Before connecting real data, verify five controls outside the product demo: egress denial with a network test, credential expiry with a forced timeout, immutable input snapshots with hash comparison, compute ceilings with an intentionally oversized request, and reviewer quarantine with a seeded figure-data mismatch. Treat undocumented retention, model-version pinning, connector updates, and incident export as unknowns rather than assuming a favorable default.

## Evaluation Protocol for a Lab Pilot

Build a `30`-task acceptance set from completed internal work. Include `10` routine tasks, `10` edge cases, and `10` known failures. Freeze inputs and the expected artifact graph. Run the current human/tool process as the baseline, then the workbench with the same data and time boundary.

Measure at least these `8` signals: task acceptance, claim precision, source recall, code execution success, environment reproduction success, figure-data consistency, human correction minutes, and compute cost. Add severe-error counts for privacy, invalid statistics, unsupported claims, and unauthorized resource requests. Report confidence intervals across tasks; do not hide a dangerous failure in an average score.

Use two negative controls. First, remove one required source or metadata field and verify that the system abstains or flags incompleteness. Second, seed a plausible but inconsistent table and caption to test whether review catches the mismatch. A reviewer that only checks prose quality will miss both.

The pilot passes only if no severe policy violation occurs, at least `90%` of deterministic checks pass without human repair, accepted-task rate exceeds the existing process's lower confidence bound, and median correction time falls by a pre-registered amount. The exact thresholds should match the lab's risk; these are starting criteria, not universal standards.

## Failure Modes and Limitations

The most dangerous failure is provenance theater: a workbench displays code and citations, but the final figure is not generated from that code or one cited number came from an earlier branch. Verify hashes and dependency edges mechanically.

Reviewer agents can create correlated confidence. If actor and critic share a model, context, tools, and retrieval corpus, both may accept the same false premise. Use different evidence views and deterministic validators. Escalate disagreements instead of letting one agent silently overwrite another.

Long-lived sessions create state risk. An in-memory dataset loaded once is efficient, but later steps may unknowingly use a mutated object. Snapshot before material transformations and log row counts, schema, missingness, and summary statistics after each step.

Tool and environment drift can make a historical trace non-reproducible. Pin container digests, package locks, database versions, model identifiers, prompts, and connector revisions. Remote APIs can still change; preserve raw responses where licenses and privacy rules allow.

No current public evidence establishes autonomous scientific reliability across disciplines. Claude Science's customer examples include a reported `10x` analysis-speed improvement and a review workflow with about `20` custom skills, `10` reviews, and documents longer than `100` pages. Those are valuable case studies, but they are selected reports without a common control group. They should motivate a pilot, not substitute for one.

## Production Readiness and Rollback

Production readiness means the lab can reconstruct an artifact after the original session is gone. Test restoration on a clean runner. Require exact data snapshot resolution, environment creation, code execution, output hashes, and reviewer state. If a result depends on an unavailable proprietary model response, preserve the response and mark the replay boundary explicitly.

Deploy with route-level kill switches: disable external search, compute submission, write tools, or a specific connector independently. Set daily compute and token budgets. Quarantine output when a citation fails, a data hash changes, a job exceeds its resource contract, or deterministic review disagrees with the displayed artifact.

Rollback is artifact-oriented. Revoke the agent's tool grants, stop queued jobs, invalidate unreviewed descendants of the suspect artifact, and restore the last approved evidence graph. Do not delete the failed trace; preserve it for incident analysis. A conversational “undo” is not sufficient once files, cluster jobs, or manuscript claims have propagated.

## Adoption Boundary

Do not use a scientific workbench as the sole authority for clinical decisions, biosafety-sensitive procedures, irreversible experiments, regulated submissions, or claims whose raw evidence cannot be inspected. Do not grant broad HPC or data access merely because the app can connect over SSH. Do not infer scientific novelty from fluent synthesis.

Use it where the scientific method already supplies constraints: frozen datasets, explicit hypotheses, validated tools, reviewable code, known units, and accountable domain experts. The workbench can then reduce coordination cost while the lab retains epistemic control.

The near-term competitive advantage is not “autonomous science.” It is faster, more legible iteration with a stronger audit trail than ad hoc notebooks and disconnected chat sessions. That advantage is real only when the trace is mechanically tied to the artifact.

## Source Ledger

- `2026-06-30`: [Claude Science beta architecture, availability, skills, compute, and provenance](https://www.anthropic.com/news/claude-science-ai-workbench).
- `2026-06-03`: [GPT-Rosalind update and six-area LifeSciBench framing](https://openai.com/index/introducing-new-capabilities-to-gpt-rosalind/).
- `2026-04-16`: [Initial GPT-Rosalind tool and access description](https://openai.com/index/introducing-gpt-rosalind/).
- `2025-05-01`: [FutureHouse platform and four specialized agents](https://www.futurehouse.org/news/launching-futurehouse-platform-ai-agents).
- `2025-02-19`: [Google AI co-scientist architecture and validation examples](https://research.google/blog/accelerating-scientific-breakthroughs-with-an-ai-co-scientist/).
- `2026-04-30`: [AstaBench current model, cost, and end-to-end results](https://allenai.org/blog/astabench-update-spring-2026).
- Current benchmark page: [PaperArena performance and tool-use findings](https://paperarena-ai.github.io/).
- `2026-06-10`: [SciAgentArena's approximately 200 interactive scientific tasks](https://arxiv.org/abs/2606.12736).
- Revised `2026-04-21`: [AstaBench paper and 57-agent evaluation design](https://arxiv.org/abs/2510.21652).

Source dates matter because product access, model versions, and benchmark leaders move quickly. Preserve this ledger with the pilot protocol, then refresh it before procurement or a higher-risk deployment decision.
