# Latest AI Article Production Run Report

Run time: 2026-06-29 07:31 America/New_York

Produced and promoted a two-article batch focused on LLM inference economics,
token-budget routing, cache reuse, batch/flex serving lanes, and route-level
release gates. The batch reused the prior deterministic evidence project after
rerunning the script and refreshing candidate dates for this scheduled run.

No AWS, Terraform, OpenTofu, S3, CloudFront, local model inference, or torch
work was used. Torch/MPS rules were not triggered. Local model hygiene rules
were not triggered because the promoted experiment uses a deterministic Node
simulator rather than LM Studio or another local model service.

## Sources Reviewed

Primary and high-signal sources:

- OpenAI Batch API: https://platform.openai.com/docs/guides/batch
- OpenAI Flex processing: https://platform.openai.com/docs/guides/flex-processing
- Anthropic batch processing: https://docs.anthropic.com/en/docs/build-with-claude/batch-processing
- Google Gemini Batch API: https://ai.google.dev/gemini-api/docs/batch-mode
- vLLM automatic prefix caching: https://docs.vllm.ai/en/latest/features/automatic_prefix_caching.html
- LMCache project: https://github.com/LMCache/LMCache
- LLM Serving Needs Mathematical Optimization: https://arxiv.org/abs/2605.01280
- Beyond Per-Token Pricing: https://arxiv.org/abs/2606.11690

Public community/social discovery inputs:

- Searched public developer discussion surfaces around LLM inference cost,
  batch APIs, vLLM prefix caching, KV-cache reuse, cache-hit observability, and
  long-context latency.
- Community/social signals were used only to identify repeated concerns:
  cost spikes, cache misses, batch eligibility, long-context latency, and
  uncertainty in self-hosted serving estimates.
- No community/social claim was treated as authoritative without provider docs,
  project docs, repository evidence, or systems-research confirmation.

## Candidate Batch

Temporary batch directory:

- `/tmp/blog-ai-article-run-20260629-inference-cost/`

Candidate articles:

- `inference-cost-release-gates-2026`
  - Title: `Build LLM Inference Cost Gates Before Scaling AI Features`
  - Mode: `strategy`
  - Asset: `inference-cost-release-gates-2026.svg`
  - Status: passed candidate gate and promoted.
- `measure-token-budget-routing`
  - Title: `Measure Token-Budget Routing for LLM Inference`
  - Mode: `experiment`
  - Asset: `measure-token-budget-routing.svg`
  - Status: passed candidate gate and promoted.

Promotion targets:

- `content/articles/inference-cost-release-gates-2026.md`
- `content/articles/measure-token-budget-routing.md`
- `content/assets/inference-cost-release-gates-2026.svg`
- `content/assets/measure-token-budget-routing.svg`

## Experiment Artifacts

Internal evidence project:

- `operator/diy-project-blogs/projects/token-budget-inference-routing/`

Artifacts:

- `dataset.json`: twelve task traces with token budgets, SLA targets, context
  reuse, risk, citation requirements, reasoning requirements, and expected
  serving tier.
- `run-experiment.mjs`: deterministic routing-policy simulator.
- `results.json`: detailed policy results from the rerun.
- `output.txt`: concise terminal output used in article drafting.
- `chart.svg`: generated scorecard visual.

Measured output:

```output
Token-budget routing experiment
tasks=12
frontierOnly: pass_rate=0.75 expected_match=0.5 total_cost=$0.19235 mean_latency_ms=9012 sla_misses=3 quality_misses=0
cheapestFirst: pass_rate=0.583 expected_match=0.5 total_cost=$0.03753 mean_latency_ms=7794 sla_misses=0 quality_misses=5
budgetGate: pass_rate=0.833 expected_match=0.917 total_cost=$0.12843 mean_latency_ms=8749 sla_misses=2 quality_misses=0
```

## Gates And Checks

Candidate public-content gate:

```output
Public content gate passed for 2 articles in latest-ai-article-production.
```

Committed-source public-content gate:

```output
Public content gate passed for 7 articles in public content.
```

Build:

```output
Built 7 tutorials into dist
```

Generated-site check:

```output
Site checks passed.
```

Generated-output scan:

- No matches for blocked internal labels, local diagnostics, private
  filesystem paths, local model endpoint references, AWS profile references, or
  generic hype/filler patterns in `dist/`.

Browser review:

- `http://127.0.0.1:4173/tutorials/inference-cost-release-gates-2026/`
  rendered the expected H1, 11 TOC links, complete local SVG image
  `920x520`, and no blocked rendered labels.
- `http://127.0.0.1:4173/tutorials/measure-token-budget-routing/` rendered
  the expected H1, 13 TOC links, six code/output blocks, complete local SVG
  image `920x520`, and no blocked rendered labels.
- Home page indexed both promoted articles and the home spotlight loaded
  `inference-cost-release-gates-2026.svg` as a complete local image.

Outside-sandbox execution:

- The preview server failed inside the sandbox with `EPERM` while binding
  `127.0.0.1:4173`; it was rerun outside the sandbox only to complete the
  required local browser review.

## Notes

- A pre-existing untracked article,
  `content/articles/budgeted-guardrails-mlp-channel-interventions.md`, was
  present before this run. It passed the mechanical public-content gate and was
  therefore included in current working-tree build/check counts, but it was not
  produced by this run.
- Commit hash and push result are recorded in the final automation response
  after `git commit` and `git push origin main` complete.

## Intervention Needed

No intervention is needed for the promoted two-article inference-cost batch.
