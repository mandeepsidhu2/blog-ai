---
title: Measure Token-Budget Routing for LLM Inference
description: Build a compact routing harness that scores LLM serving policies on cost, latency, quality risk, cache reuse, and SLA misses.
topic: LLM Operations
level: Advanced
date: 2026-06-29
readingTime: 32
tags: llm-operations, inference, model-routing, cost-optimization, evals, observability
image: /content/v1/assets/measure-token-budget-routing.svg
imageAlt: Bar chart comparing token-budget routing policies by pass rate, normalized cost, and SLA or quality misses
evidenceMode: experiment
---

LLM applications need routing tests before they need another model selector. A selector answers "which model should this call use?" A routing test answers a harder production question: "which policy gives acceptable quality, latency, and cost for the whole workload?"

This tutorial builds a small deterministic harness for that question. It compares three policies across twelve LLM application tasks: a frontier-only policy, a cheapest-first policy, and a token-budget gate. Each task records risk, token budget, context reuse, latency SLO, citation requirements, and whether deeper reasoning is needed. The harness estimates route cost and latency, checks quality constraints, and reports SLA misses.

The result is intentionally imperfect. Frontier-only keeps quality high but misses three latency targets and costs the most. Cheapest-first is cheap and fast but fails five quality-risk checks. The budget gate cuts cost by roughly one third versus frontier-only and matches the expected route on 91.7% of tasks, but still misses two tight latency SLOs. That is the useful result: routing is not solved by always choosing a stronger model or always choosing a cheaper one. It needs a measured gate with failure analysis.

## Research Question

The question is: can a simple token-budget gate beat both naive baselines on route quality, cost, and latency?

The frontier-only baseline sends nearly everything to the most capable route unless the job is clearly offline. It is easy to reason about and often safe on quality, but it can overpay for small tasks and still miss latency targets when prompts are long.

The cheapest-first baseline sends delayed work to batch, tiny low-risk work to a small realtime route, and everything else to a balanced route. It reduces spend, but it ignores task risk and reasoning requirements. That makes it a useful negative control.

The budget gate adds policy: high-risk or reasoning-heavy tasks go to the stronger route, delayed jobs go to batch, tiny low-risk tasks go to a small route, and the middle goes to a balanced route. The goal is not universal optimality. The goal is to create a repeatable measurement surface for routing decisions.

## Dataset Design

The dataset has twelve task traces. Each trace is deliberately small enough to inspect by hand but broad enough to cover common production classes: summarization, legal review, retrieval maintenance, incident triage, content transformation, code generation, documentation, structured extraction, architecture planning, classification, schema repair, and RAG answers.

```json
{
  "id": "incident-triage",
  "taskType": "operations",
  "risk": "high",
  "inputTokens": 5200,
  "outputTokens": 650,
  "contextReuse": 0.58,
  "latencySlaMs": 7000,
  "requiresReasoning": true,
  "requiresCitation": true,
  "expectedTier": "priority-frontier"
}
```

The fields are the minimum information a routing policy needs. `inputTokens` and `outputTokens` estimate the budget. `contextReuse` approximates how much prompt prefix or KV-cache reuse is plausible. `latencySlaMs` records the service target. `risk`, `requiresReasoning`, and `requiresCitation` encode quality constraints. `expectedTier` is the hand-labeled route used for policy-match scoring.

In a production system, this dataset should come from traces, eval cases, support workflows, and incident reviews. The important property is not that twelve cases are enough. The important property is that the routing policy is tested against named cases instead of hidden intuition.

## Serving Tiers

The harness uses four abstract serving tiers. The prices and throughputs are illustrative, but the structure mirrors real deployment choices: small realtime, small batch, balanced flex, and priority frontier.

```javascript
const tiers = {
  "small-realtime": {
    inputPerMTok: 0.18,
    outputPerMTok: 0.72,
    baseLatencyMs: 650,
    throughputTokensPerSecond: 1550,
    quality: 0.76,
    supportsReasoning: false,
  },
  "batch-small": {
    inputPerMTok: 0.09,
    outputPerMTok: 0.36,
    baseLatencyMs: 5000,
    throughputTokensPerSecond: 900,
    quality: 0.74,
    supportsReasoning: false,
  },
  "flex-balanced": {
    inputPerMTok: 0.55,
    outputPerMTok: 2.2,
    baseLatencyMs: 1400,
    throughputTokensPerSecond: 980,
    quality: 0.84,
    supportsReasoning: false,
  },
  "priority-frontier": {
    inputPerMTok: 2.5,
    outputPerMTok: 10,
    baseLatencyMs: 900,
    throughputTokensPerSecond: 720,
    quality: 0.94,
    supportsReasoning: true,
  },
};
```

Do not treat these constants as universal economics. They are a controlled fixture for measuring policy behavior. Replace them with provider prices, measured latency curves, cache metrics, and quality scores from your own stack before using the harness for a real release gate.

## Policy Implementations

The three policies are short by design. Short policies are easier to review, easier to test, and easier to falsify.

```javascript
const policies = {
  frontierOnly(task) {
    return task.inputTokens > 10000 && task.latencySlaMs > 60000
      ? "batch-small"
      : "priority-frontier";
  },
  cheapestFirst(task) {
    if (task.latencySlaMs > 30000) return "batch-small";
    if (task.inputTokens < 1200 && task.risk === "low") return "small-realtime";
    return "flex-balanced";
  },
  budgetGate(task) {
    if (task.requiresReasoning || task.risk === "high") return "priority-frontier";
    if (task.latencySlaMs > 30000 || task.taskType === "retrieval-maintenance") return "batch-small";
    if (task.inputTokens < 1200 && task.risk === "low") return "small-realtime";
    return "flex-balanced";
  },
};
```

The frontier-only policy is not absurd. Many teams start there because it lowers quality risk during prototyping. The cheapest-first policy is also not absurd. Many teams move there after the first bill surprise. The measured question is which policy fails in which way.

The budget gate is deliberately conservative. It sends high-risk tasks and reasoning-heavy tasks to the stronger route even when the balanced route would be cheaper. That is the right default when false confidence is more expensive than latency or spend.

## Metrics

The harness computes cost, latency, quality pass, latency pass, expected-route match, and overall pass for each task.

```javascript
function estimateCost(task, tier) {
  const spec = tiers[tier];
  const effectiveInput = task.inputTokens * (1 - task.contextReuse * 0.55);
  return (effectiveInput / 1_000_000) * spec.inputPerMTok
    + (task.outputTokens / 1_000_000) * spec.outputPerMTok;
}

function estimateLatencyMs(task, tier) {
  const spec = tiers[tier];
  const effectiveTokens = task.inputTokens * (1 - task.contextReuse * 0.35) + task.outputTokens;
  const generationMs = (effectiveTokens / spec.throughputTokensPerSecond) * 1000;
  const cacheBonusMs = Math.min(1800, task.contextReuse * 1600);
  return Math.round(spec.baseLatencyMs + generationMs - cacheBonusMs);
}

function qualityPass(task, tier) {
  const spec = tiers[tier];
  if (task.requiresReasoning && !spec.supportsReasoning) return false;
  if (task.risk === "high" && spec.quality < 0.9) return false;
  if (task.requiresCitation && spec.quality < 0.8 && task.contextReuse < 0.7) return false;
  return true;
}
```

The cost model reduces effective input tokens when context reuse is high. The latency model also rewards context reuse, but less aggressively. That reflects the reality that cache reuse can improve prefill behavior while output generation still costs time. The quality gate is simple but useful: tasks that require reasoning should not run on a route that does not support the expected reasoning behavior, and high-risk tasks need a higher quality floor.

## Results

The deterministic run produced this output:

```output
Token-budget routing experiment
tasks=12
frontierOnly: pass_rate=0.75 expected_match=0.5 total_cost=$0.19235 mean_latency_ms=9012 sla_misses=3 quality_misses=0
cheapestFirst: pass_rate=0.583 expected_match=0.5 total_cost=$0.03753 mean_latency_ms=7794 sla_misses=0 quality_misses=5
budgetGate: pass_rate=0.833 expected_match=0.917 total_cost=$0.12843 mean_latency_ms=8749 sla_misses=2 quality_misses=0
```

The budget gate is the best policy on this dataset, but it is not perfect. Its total estimated cost is about 33% lower than frontier-only. It also has a much higher expected-route match rate than either baseline. However, it still misses two latency SLOs: `migration-plan` and `policy-answer`. Both require the priority route for quality, but their token budgets are large enough that the configured SLO is too tight.

That failure is exactly what a release gate should expose. The answer is not to route those tasks to a cheaper model. The answer is to change the product contract: narrow the context, split the task into stages, loosen the SLO, precompute evidence, move part of the work to batch, or add a human-in-the-loop review boundary for delayed completion.

## Error Analysis

Frontier-only missed three latency targets. The surprising one is the small spam classifier. It was routed to a strong model even though the task had fewer than 1,000 input tokens and a 2-second SLO. The route was overpowered and slower than necessary. This is the classic prototype failure: a high-quality default becomes an accidental latency and cost tax.

Cheapest-first missed no latency targets, but it failed five quality-risk checks. It sent legal review, incident triage, SQL generation, migration planning, and policy answers to the balanced route even though they required reasoning or high-risk handling. This is the classic cost-cutting failure: the graph looks efficient until someone inspects the cases that matter.

The budget gate missed two latency targets while preserving quality. This is the most useful failure class because it identifies product work instead of policy confusion. For `migration-plan`, the task likely needs decomposition: generate a short plan first, retrieve only relevant sections, then run focused substeps. For `policy-answer`, the retrieval width or citation requirement may need tuning. If neither can meet the SLO, the product should not promise realtime behavior.

## Production Readiness

To use this harness in production, replace every illustrative constant with measured data. Prices should come from provider contracts or internal cost meters. Latency should come from traces grouped by route, prompt length, output length, cache hit, and concurrency level. Quality should come from eval sets that include supported, unsupported, long-context, high-risk, and citation-heavy cases.

The dataset should be versioned with the application. Prompt changes, retrieval changes, route changes, schema changes, and fallback changes should run the same routing test. A release should fail when a cheaper policy reduces critical-case quality, when an expensive policy exceeds cost thresholds, or when route drift violates the approved manifest.

The harness should also emit observability fields into production traces: task class, route, token budget, cache-hit expectation, latency, retry count, fallback route, quality score, and final disposition. Without those fields, the team cannot tell whether cost changed because traffic grew, prompts grew, cache reuse regressed, or the route mix shifted.

## Reproducibility

The project uses a deterministic Node script and a static JSON dataset. It does not require a local model service, GPU, torch, CUDA, or CPU ML runtime. The script writes `results.json`, `output.txt`, and an SVG chart from the same dataset.

Run it with:

```sh
node projects/token-budget-inference-routing/run-experiment.mjs
```

If local `node` is unavailable, use the bundled Node runtime provided by the environment. The expected output should match the results block above unless you change the dataset or tier constants.

For a real deployment, add at least three extensions. First, replace deterministic quality checks with eval scores for each route. Second, replace the latency formula with measured p50, p95, and p99 curves under realistic concurrency. Third, add a workload generator that samples production traffic proportions rather than treating each task trace equally.

## Guardrails And Rollback Criteria

A routing policy should roll back when any critical task class loses quality, even if aggregate pass rate improves. It should also roll back when p95 cost per successful task exceeds the release threshold, when fallback amplification rises, or when cache hit rate drops below the approved baseline.

The gate should block route changes that remove reasoning support from high-risk tasks. It should block changes that move citation-heavy RAG answers to routes that fail unsupported-question tests. It should block changes that push batch-eligible work into realtime serving without an explicit product reason.

The policy also needs an exception path. A human reviewer should be able to approve an expensive route for a task class when quality or risk requires it. The exception should record the reason, expected volume, budget owner, and review date.

## Implementation Plan

Start with the traces you already have. Group requests by feature and task class. For each group, measure input tokens, output tokens, cache reuse, latency, retry count, route, and success criteria. Then select ten to twenty representative cases and encode them as a dataset like the one above.

Next, define two naive baselines. One should be quality-biased. One should be cost-biased. A new route policy has not earned trust until it beats both baselines on the metrics that matter.

Then run the policy in shadow mode. Do not change production routing immediately. Record what the policy would have chosen, compare it with the current route, and inspect disagreements. The most valuable cases are not average wins. They are disagreements where the policy would save money, where it would increase risk, or where it would expose an impossible SLO.

Finally, connect the harness to release review. A model upgrade, prompt expansion, retrieval-width change, schema-repair change, or fallback-policy change should rerun the routing test. Inference cost is not a monthly finance surprise. It is a release property.

## Limitations

This harness is a policy simulator, not a provider benchmark. The tier constants are intentionally simple. They do not capture queueing, concurrency, accelerator type, quantization, provider capacity, multi-tenant effects, output-length uncertainty, or real cache implementation details.

The quality gate is also a proxy. Real quality should come from task-specific evals, human review for high-risk domains, adversarial cases, and live monitoring. A task can pass this harness and still fail because the model gives an unsupported answer, drops a citation, misuses a tool, or produces an invalid schema.

The dataset is small. That is useful for explanation, but it is not enough for production confidence. Scale it with real traces, keep hard cases, and report confidence intervals when the dataset becomes large enough for statistical comparison.

## What To Watch Next

Serving economics are becoming an application-level discipline. Provider batch and flex surfaces make delayed and variable-latency routes explicit. Serving systems are making cache reuse and scheduling more visible. Cost research is showing why utilization and concurrency matter.

The team that benefits is the team that turns those signals into tests. Every AI feature should know which route it is allowed to use, what evidence justifies that route, and what metric will stop the rollout when the economics stop matching the plan.
