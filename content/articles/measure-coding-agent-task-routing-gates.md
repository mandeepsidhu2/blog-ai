---
title: Measure Coding-Agent Task Routing Gates
description: Build a compact evaluation harness that compares coding-agent delegation policies by route match, pass rate, review hours, risk, and compute budget.
topic: AI Agents
level: Advanced
date: 2026-07-03
readingTime: 31
tags: ai-agents, coding-agents, evals, software-engineering, developer-tools, governance
image: /content/v1/assets/measure-coding-agent-task-routing-gates.svg
imageAlt: Bar chart comparing coding-agent task routing policies by pass rate, route match, compute credits, and review hours
evidenceMode: experiment
---

Coding-agent rollout decisions should be tested before they become company policy. A blanket "delegate more work" program can raise pull-request volume while increasing review burden, spending credits on retries, or assigning high-risk changes to a route that was only validated on documentation tasks. A blanket "humans review everything" policy can be safer but so slow that it hides useful automation.

This tutorial builds a compact routing harness for that decision. It compares three policies across sixteen engineering tasks: delegate nearly everything, review conservatively, or use a task-aware gate. Each task records risk, task type, expected file span, diff size, CI requirement, security sensitivity, product-judgment need, expected effort, token budget, and the route a human rollout policy would expect.

The result is intentionally not perfect. The task-aware gate has the best pass rate and route-match rate, but it still delegates one high-risk task and leaves three low-confidence cases. That is a useful outcome. A real release gate should expose where the policy still needs human boundaries, not only where it beats naive baselines.

## Research Question

The question is: can a small task-routing gate outperform both naive baselines on route quality, review cost, and budget control?

The first baseline, `delegateAll`, assigns most work to an agent-reviewed route and uses a faster route only for short tasks. This resembles a rollout that starts from enthusiasm: give the agent a lot of issues and let review sort out the damage.

The second baseline, `humanReviewOnly`, pushes high-risk and security-sensitive tasks to human pairing while routing much of the remaining work through review or decomposition. This resembles a cautious rollout that prioritizes safety but can consume too many senior review hours.

The proposed policy, `taskGate`, routes by risk, CI requirement, security sensitivity, product judgment, file span, and token budget. It does not assume that agents are unsafe. It assumes that engineering tasks differ enough that routing should be explicit.

## Dataset Design

The dataset contains sixteen task records. Each one is small enough to inspect by hand but broad enough to represent a real rollout: documentation drift, unit-test gaps, dependency security alerts, flaky CI, authentication refactors, billing behavior, migration planning, schema cleanup, accessibility fixes, checkout concurrency, release notes, observability traces, secret handling, localization, API bugs, and ambiguous product work.

```json
{
  "id": "dependency-security-alert",
  "taskType": "security",
  "risk": "medium",
  "filesTouched": 5,
  "expectedDiffLines": 210,
  "ciRequired": true,
  "securitySensitive": true,
  "needsProductJudgment": false,
  "expectedMinutes": 80,
  "tokenBudget": 49000,
  "expectedRoute": "agent-reviewed"
}
```

The `expectedRoute` field is not a label from a model. It is the route a human rollout policy would choose after looking at the task. That makes route-match rate a useful policy metric. If the automated gate sends high-risk work to a fast route or sends easy work to expensive review, the mismatch is visible.

In a production system, the dataset should come from historical issues, pull requests, incident reviews, support tickets, and platform traces. The first version does not need hundreds of cases. It needs named cases that reviewers can argue about.

## Route Model

The harness uses four abstract routes. They are not tied to a specific provider. They represent the operational choices an engineering team makes when it assigns a task.

```javascript
const routeSpec = {
  "agent-fast": {
    reviewHours: 0.25,
    computeCredits: 1.0,
    expectedPass: 0.74,
    maxRisk: "low",
    maxFiles: 5,
    maxTokens: 65000,
  },
  "agent-reviewed": {
    reviewHours: 0.75,
    computeCredits: 1.7,
    expectedPass: 0.83,
    maxRisk: "medium",
    maxFiles: 8,
    maxTokens: 100000,
  },
  "human-paired": {
    reviewHours: 2.25,
    computeCredits: 1.2,
    expectedPass: 0.91,
    maxRisk: "high",
    maxFiles: 10,
    maxTokens: 140000,
  },
  "decompose-first": {
    reviewHours: 1.25,
    computeCredits: 0.9,
    expectedPass: 0.88,
    maxRisk: "medium",
    maxFiles: 6,
    maxTokens: 85000,
  },
};
```

These constants are deliberately simple. `agent-fast` has low review overhead but a narrower risk envelope. `agent-reviewed` handles medium-risk implementation with CI and review. `human-paired` is expensive but appropriate for high-risk changes. `decompose-first` is for large or ambiguous work where the first output should be a plan, not a patch.

## Policy Implementations

The three policies are short enough for a release review. That is intentional. A rollout policy should be explainable to reviewers, security, and finance.

```javascript
const policies = {
  delegateAll(task) {
    if (task.expectedMinutes < 45) return "agent-fast";
    return "agent-reviewed";
  },
  humanReviewOnly(task) {
    if (task.risk === "high" || task.securitySensitive) return "human-paired";
    return task.expectedMinutes > 110 ? "decompose-first" : "agent-reviewed";
  },
  taskGate(task) {
    if (task.needsProductJudgment && task.risk === "high") return "human-paired";
    if (task.filesTouched > 9 || task.tokenBudget > 100000 || task.needsProductJudgment) return "decompose-first";
    if (task.securitySensitive || task.ciRequired || task.risk === "medium") return "agent-reviewed";
    return "agent-fast";
  },
};
```

The task gate has one important bias: product judgment and high risk are not the same thing. A medium-risk feature with unclear product ownership may be safer to decompose first than to implement immediately. A high-risk implementation with clear owner involvement may need human pairing rather than a planning-only step.

## Scoring Function

The scorer estimates whether the chosen route fits the task. It penalizes risk above the route envelope, file span above route capacity, token budget above route capacity, product judgment on agent-only routes, security-sensitive work on the fast route, and CI-required work on the fast route.

```javascript
function scoreTask(task, route) {
  const spec = routeSpec[route];
  const complexity = task.filesTouched * 0.045
    + task.expectedDiffLines / 2400
    + task.tokenBudget / 250000;
  const riskPenalty = Math.max(0, riskRank[task.risk] - riskRank[spec.maxRisk]) * 0.18;
  const spanPenalty = Math.max(0, task.filesTouched - spec.maxFiles) * 0.035;
  const budgetPenalty = Math.max(0, task.tokenBudget - spec.maxTokens) / 300000;
  const judgmentPenalty = task.needsProductJudgment && route.startsWith("agent") ? 0.22 : 0;
  const securityPenalty = task.securitySensitive && route === "agent-fast" ? 0.18 : 0;
  const ciPenalty = task.ciRequired && route === "agent-fast" ? 0.07 : 0;
  const predictedPass = Math.max(
    0.05,
    spec.expectedPass - complexity * 0.16 - riskPenalty - spanPenalty - budgetPenalty
      - judgmentPenalty - securityPenalty - ciPenalty,
  );
  const routeMatch = route === task.expectedRoute;
  const pass = predictedPass >= 0.62 && routeMatch;
  return { predictedPass, routeMatch, pass };
}
```

The pass criterion is intentionally strict. A task passes only when the route matches the expected policy and the predicted pass score clears the threshold. That prevents a policy from looking good because it made a cheap but unsafe choice.

## Results

The deterministic run produced this output:

```output
Coding-agent task routing gate experiment
tasks=16
delegateAll: pass_rate=0.438 route_match=0.438 low_confidence=7 high_risk_delegated=5 review_hours=18.21 compute_credits=42.88
humanReviewOnly: pass_rate=0.563 route_match=0.625 low_confidence=2 high_risk_delegated=0 review_hours=29.21 compute_credits=33.67
taskGate: pass_rate=0.688 route_match=0.75 low_confidence=3 high_risk_delegated=1 review_hours=25.21 compute_credits=34.45
```

The task gate is the best policy on pass rate and route-match rate. It reaches a 0.688 pass rate and 0.75 route match, compared with 0.438 for `delegateAll` on both metrics and 0.563 pass rate with 0.625 route match for `humanReviewOnly`.

The conservative policy has the lowest compute credits, but it has the highest review burden at 29.21 hours. That is the expected trade-off: review can reduce dangerous delegation, but it also consumes scarce senior engineering time.

The task gate uses 34.45 compute credits and 25.21 review hours. It is not the cheapest policy and not the lowest-review policy. Its advantage is that it routes the work more appropriately while keeping review and compute inside a plausible rollout budget.

## Error Analysis

The `delegateAll` baseline fails in the way many aggressive rollouts fail. It delegates five high-risk tasks and creates seven low-confidence cases. It also has the highest compute usage because broad delegation spends agent budget on work that should have been paired or decomposed.

The `humanReviewOnly` baseline avoids high-risk delegation, but it spends the most review time. That cost matters. If every medium-risk task requires heavy human review, the organization may conclude that agents are not useful even when the real problem is an overly cautious route map.

The `taskGate` result is the most useful because it is better but still flawed. It leaves three low-confidence cases and delegates one high-risk task. The gate should not be promoted without inspecting those cases. A production rollout would either tighten the high-risk rule, add a security-sensitive exception, or split ambiguous high-risk work into a planning step before implementation.

## Production Readiness

To use this pattern in production, replace the illustrative route constants with measured data. Review hours should come from pull-request review logs. Compute credits should come from provider usage or internal cost telemetry. Pass scores should come from real outcomes: CI pass, reviewer acceptance, rejection reason, merge result, incident follow-up, and support impact.

The dataset should be versioned alongside the rollout policy. When a team changes allowed tools, model route, prompt templates, repository instructions, CI requirements, or security policy, it should rerun the routing evaluation. A rollout should not expand because the aggregate adoption graph looks healthy. It should expand because the task classes pass their route gates.

The dashboard should report pass rate, route-match rate, low-confidence tasks, high-risk delegations, review hours, compute budget, and rejection reasons by task class. Aggregate agent usage is not enough.

## Reproducibility

The project uses a deterministic Node script and a static JSON dataset. It does not require model inference, GPU availability, torch, CUDA, or a remote service. The script writes `results.json`, `output.txt`, and an SVG chart from the same task records.

Run it with:

```sh
node projects/coding-agent-task-routing-gates/run-experiment.mjs
```

The expected output should match the results block above unless you change the dataset, route constants, policy functions, or score threshold. For a real rollout, add more task records, replace the score function with measured outcome probabilities, and track p50 and p95 review latency rather than only total review hours.

## Guardrails And Rollback Criteria

Roll back a route expansion when high-risk delegation exceeds the approved threshold, when low-confidence tasks increase after a prompt or tool change, or when review hours per accepted task rise above the pilot baseline.

Block route changes that move security-sensitive tasks to a fast route without a compensating control. Block changes that skip CI for implementation work. Block changes that allow ambiguous product tasks to produce large patches before an owner accepts a plan.

The gate also needs an exception path. A reviewer can approve an expensive route or human-paired route for a task class when risk justifies it. That exception should record owner, reason, expected volume, budget, and review date.

## Implementation Plan

Start by sampling ten to twenty tasks from the teams that will use coding agents first. Include easy work, medium-risk implementation, high-risk changes, ambiguous product work, and security-sensitive tasks. Ask reviewers to assign expected routes before running the policy.

Next, encode the tasks with the same fields used here: risk, files touched, expected diff size, CI requirement, security sensitivity, product judgment, expected effort, and token budget. Add fields for your own environment, such as required approvals, data classification, or release train.

Then compare at least two naive baselines with the proposed gate. A policy has not earned rollout trust until it beats both a delegation-heavy baseline and a review-heavy baseline on the metrics your organization actually values.

Finally, run the gate in shadow mode. Let engineers continue their current workflow while recording what the gate would have chosen. Inspect disagreements before changing production behavior. The disagreements are where the policy improves or where it needs stricter controls.

## Limitations

This harness is a release-control model, not a universal benchmark. The task records are small, the score formula is simplified, and the route constants are illustrative. It cannot prove that one provider or model is better than another.

It also treats the expected route as a human policy target. If the human policy is wrong, the route-match metric will reward the wrong behavior. Review the expected labels periodically and compare them with real outcomes.

The point is not to freeze routing into one formula. The point is to create a repeatable measurement surface. When coding-agent adoption grows, the team needs to know which task classes are succeeding, which ones are expensive, and which ones should stop before they become production failures.
