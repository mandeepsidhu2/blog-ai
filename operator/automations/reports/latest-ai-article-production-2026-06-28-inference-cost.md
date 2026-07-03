# Latest AI Article Production Run Report

Run time: 2026-06-28 07:30 America/New_York

Produced a temporary candidate batch focused on LLM inference economics and
token-budget routing. The candidate batch passed the mandatory public content
gate, but candidates were not promoted into committed public content because
the run followed the former daily publication policy in effect on 2026-06-28.
That policy has since been replaced by a 50-article-per-day maximum.

No AWS, Terraform, OpenTofu, S3, CloudFront, local model inference, or torch
work was used.

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

- Searched Hacker News, Reddit, GitHub issue, and open-source project surfaces
  around vLLM inference cost, prefix caching, KV-cache reuse, OpenAI Batch API,
  OpenAI Flex processing, and long-context latency.
- These signals were used only to identify recurring concerns: cost spikes,
  cache misses, long-context latency, batch eligibility, and self-hosting
  estimation uncertainty.
- No community/social claim was treated as authoritative without primary or
  high-signal confirmation.

## Candidate Batch

Temporary batch directory:

- `/tmp/blog-ai-article-run-20260628-inference-cost/`

Candidate articles:

- `inference-cost-release-gates-2026`
  - Title: `Build LLM Inference Cost Gates Before Scaling AI Features`
  - Mode: `strategy`
  - Asset: `inference-cost-release-gates-2026.svg`
  - Status: passed candidate public-content gate; not promoted under the former
    daily publication policy.
- `measure-token-budget-routing`
  - Title: `Measure Token-Budget Routing for LLM Inference`
  - Mode: `experiment`
  - Asset: `measure-token-budget-routing.svg`
  - Status: passed candidate public-content gate; not promoted under the former
    daily publication policy.

## Experiment Artifacts

Created internal evidence project:

- `operator/diy-project-blogs/projects/token-budget-inference-routing/`

Artifacts:

- `dataset.json`: twelve task traces with token budgets, risk, latency SLOs,
  context reuse, and expected serving tier.
- `run-experiment.mjs`: deterministic routing-policy simulator.
- `results.json`: detailed policy results.
- `output.txt`: concise terminal output.
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

Promotion:

- Not promoted into `content/articles` or `content/assets`.
- Reason: the run followed the former daily publication policy in effect on
  2026-06-28.

Committed-source build/site checks:

- Not run because candidate articles were not promoted into committed source.

## Intervention Needed

No intervention is required for the completed local run. If these candidates
should still be promoted, rerun the full committed-source gate sequence under
the current 50-article-per-day maximum before publishing.
