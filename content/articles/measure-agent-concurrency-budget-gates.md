---
title: Measure Agent Concurrency Budget Gates
description: Build a reproducible harness that scores AI agent concurrency policies by pass rate, token load, review pressure, and quality misses.
topic: AI Agents
level: Advanced
date: 2026-07-01
readingTime: 34
tags: ai-agents, evals, observability, agent-workflows, software-engineering, guardrails
image: /content/v1/assets/measure-agent-concurrency-budget-gates.svg
imageAlt: Bar chart comparing pass rate, normalized token load, and review or quality misses for AI agent concurrency policies
evidenceMode: experiment
---

Parallel AI agents need a measurement harness before they need a bigger subagent limit. Fanout can shorten a read-heavy investigation, but it can also multiply tokens, duplicate searches, flood approval review, and scatter risk across several contexts. The right question is not "can this task run in parallel?" The right question is "which concurrency policy preserves quality and reviewability for this workload?"

This tutorial builds a small Node harness for that question. It evaluates three policies across twelve agent-work traces: a parallel-default policy, a write-aware policy, and a budgeted gate. Each trace records risk, subagent count, estimated task duration, prompt tokens, approval requests, write operations, and the expected lane. The harness estimates elapsed time and token load, checks review pressure, and reports quality misses.

The measured result is intentionally uncomfortable. The parallel-default policy is fastest, but it fails half the tasks because it treats high-risk and write-heavy work like ordinary exploration. The write-aware policy catches some write risk but still misses high-risk approval-heavy tasks. The budgeted gate passes every case and reduces token load, but it takes longer because sensitive work is serialized. That is a useful production result: safe concurrency is not maximum concurrency.

## Research Question

The research question is: can a simple budgeted gate outperform naive concurrency policies on reviewability and quality without increasing token load?

The parallel-default baseline sends any multi-agent task to a read-parallel lane. It represents the tempting default: if several agents are available, use them. That policy should be fast, but it should fail when risk or writes require coordination.

The write-aware baseline sends any task with writes to a bounded-write lane and leaves read-only work in parallel. It represents a better default, because it separates read work from patch ownership. It still ignores approval load and high-risk task classes.

The budgeted gate serializes high-risk work when there are writes or several approval requests, sends other write work to a bounded-write lane, and keeps read-only work in parallel. It is not globally optimal. It is a compact policy that can be inspected, falsified, and extended.

## Dataset Design

The dataset has twelve traces. They cover repository security review, documentation sweeps, migration planning, test-log triage, feature implementation, dependency upgrades, retrieval preparation, customer data export fixes, UI copy edits, incident analysis, auth refactors, and release-note drafting.

```json
{
  "id": "parallel-security-review",
  "workType": "repository-review",
  "risk": "high",
  "subagents": 3,
  "estimatedMinutes": 42,
  "promptTokens": 6800,
  "approvalRequests": 4,
  "writeOperations": 1,
  "expectedLane": "serial-reviewed"
}
```

These fields are deliberately plain. `risk` captures the consequence of a wrong or poorly reviewed result. `subagents` is the intended fanout. `estimatedMinutes` is a rough single-task effort estimate. `promptTokens` approximates context load before multiplying it across agents. `approvalRequests` and `writeOperations` capture review pressure and side effects. `expectedLane` is the hand-labeled answer used for route-match scoring.

In a real system, this dataset should come from task metadata, agent traces, pull request history, approval logs, and incident review. Twelve traces are not enough for a company-wide benchmark, but they are enough to demonstrate the failure modes and prove that the harness catches them.

## Lane Model

The harness uses three lanes: `parallel-read`, `bounded-write`, and `serial-reviewed`. Each lane has a subagent cap, a wall-clock multiplier, a token multiplier, and penalties for approval and write load.

```javascript
const lanes = {
  "parallel-read": {
    maxSubagents: 5,
    concurrencyMultiplier: 0.48,
    tokenMultiplier: 1.08,
    approvalPenalty: 0,
    writeRiskPenalty: 0,
  },
  "bounded-write": {
    maxSubagents: 2,
    concurrencyMultiplier: 0.72,
    tokenMultiplier: 1.18,
    approvalPenalty: 0.08,
    writeRiskPenalty: 0.14,
  },
  "serial-reviewed": {
    maxSubagents: 1,
    concurrencyMultiplier: 1.12,
    tokenMultiplier: 1.02,
    approvalPenalty: 0.2,
    writeRiskPenalty: 0.08,
  },
};
```

The numbers are not universal economics. They are controlled assumptions for policy comparison. Parallel read work gets a large wall-clock improvement, but it multiplies token work across active agents. Bounded write work is slower because it caps active writers and pays coordination cost. Serial review is slowest because it prioritizes inspection over speed.

That structure mirrors production reality. A team should replace the constants with its own traces: observed token load by task class, approval queue time, retry count, merge conflict rate, test duration, and reviewer latency.

## Policy Implementations

The three policies are short enough to audit.

```javascript
const policies = {
  parallelDefault(task) {
    return task.subagents > 1 ? "parallel-read" : "bounded-write";
  },
  writeAware(task) {
    if (task.writeOperations > 0) return "bounded-write";
    return "parallel-read";
  },
  budgetedGate(task) {
    if (task.risk === "high" && (task.writeOperations > 0 || task.approvalRequests >= 3)) {
      return "serial-reviewed";
    }
    if (task.writeOperations > 0) return "bounded-write";
    return "parallel-read";
  },
};
```

The important engineering point is not the exact branching. It is the presence of two naive baselines. A new concurrency policy has not earned trust until it beats a speed-biased baseline and a side-effect-aware baseline. Otherwise, it may only encode preferences that look reasonable in prose.

The budgeted gate also keeps risk at the parent-workflow level. A high-risk task with one write is not made safe by splitting the work into small subtasks. The final outcome still changes sensitive behavior, so it belongs in the reviewed lane.

## Scoring Functions

The harness scores quality, review load, elapsed time, and token load. The quality check rejects high-risk work outside the reviewed lane, rejects heavy writes in the read-parallel lane, and rejects approval-heavy work outside the reviewed lane.

```javascript
function qualityPass(task, laneName) {
  if (task.risk === "high" && laneName !== "serial-reviewed") return false;
  if (task.writeOperations > 3 && laneName === "parallel-read") return false;
  if (task.approvalRequests >= 4 && laneName !== "serial-reviewed") return false;
  return true;
}

function estimate(task, laneName) {
  const lane = lanes[laneName];
  const activeSubagents = Math.min(task.subagents, lane.maxSubagents);
  const minutes = Math.round(
    task.estimatedMinutes *
      lane.concurrencyMultiplier *
      Math.max(1, task.subagents / activeSubagents) *
      (1 + lane.approvalPenalty * task.approvalRequests + lane.writeRiskPenalty * Math.min(task.writeOperations, 4)),
  );
  const tokenUnits = Math.round(
    task.promptTokens *
      lane.tokenMultiplier *
      activeSubagents *
      (1 + 0.04 * task.approvalRequests + 0.03 * task.writeOperations),
  );
  return { minutes, tokenUnits, activeSubagents };
}
```

The model intentionally separates wall-clock speed from token load. Parallelism can reduce elapsed time while increasing total model work. It also separates quality from review load. A task can produce an acceptable output but still overload the approval path, which is a production failure when the workflow must run repeatedly.

## Results

The run produced this output:

```output
Agent concurrency budget experiment
tasks=12
parallelDefault: pass_rate=0.5 expected_match=0.5 total_minutes=254 token_units=328337 quality_misses=6 review_misses=6
writeAware: pass_rate=0.583 expected_match=0.5 total_minutes=597 token_units=303144 quality_misses=5 review_misses=1
budgetedGate: pass_rate=1 expected_match=0.917 total_minutes=1710 token_units=237438 quality_misses=0 review_misses=0
```

The parallel-default policy completes the workload in the fewest estimated minutes, but it produces six quality misses and six review misses. It is fast because it ignores the cases where speed should not be the objective.

The write-aware policy improves token load and catches some side-effect risk, but it still fails five high-risk cases. It routes `parallel-security-review`, `schema-migration-plan`, and `customer-data-export-fix` incorrectly because it considers writes but not the combination of high risk and approval pressure.

The budgeted gate is slower, but it is the only policy with zero quality misses and zero review misses. Its token load is also the lowest because high-risk work is no longer multiplied across several active agents. That is the core finding: a policy can spend more wall-clock time and less total model work when it avoids unnecessary fanout.

## Error Analysis

The parallel-default policy fails in a predictable way. It treats any multi-agent request as read-parallel work. That is acceptable for `read-only-doc-sweep`, `test-log-triage`, `api-reference-indexing`, and `incident-retrospective`, where the expected output is evidence or synthesis. It is wrong for `auth-policy-refactor` and `dependency-upgrade`, where write scope and approvals dominate the risk.

The write-aware policy is better but incomplete. It moves write-heavy tasks into a bounded-write lane, which reduces the worst parallel-write failure. However, it does not serialize high-risk tasks with several approvals. A customer data export fix with four expected approvals should not be treated like ordinary bounded editing just because the patch has a single owner.

The budgeted gate fails no cases in this dataset, but the cost is visible. Serial-reviewed tasks take longer. That is not a bug in the harness. It is the trade-off the release review should expose. If a high-risk workflow cannot tolerate that elapsed time, the product should split the task into a read-only preparation phase and a smaller reviewed write phase rather than pushing all work into parallel execution.

## Production Readiness

To use this harness in production, replace the synthetic constants with measured data. Use actual token counts from traces, approval counts from the review system, elapsed time from agent runs, write-operation counts from diffs, and quality outcomes from accepted or rejected pull requests. Then rerun the policy comparison by task class.

Production traces should include task class, chosen lane, subagent count, active subagents, prompt tokens, output tokens, approvals requested, tools used, files read, files written, elapsed time, conflicts, tests run, and final disposition. Without those fields, the team cannot explain whether a workflow changed because the tasks became harder, the policy changed, or the agents duplicated work.

The gate should also define thresholds before rollout. Examples: no high-risk task outside reviewed lane, zero approval-heavy tasks in read-parallel mode, p95 token load under budget, no repeated multi-agent edits to the same file group, and trace completeness above a fixed threshold.

## Reproducibility

The harness uses a local JSON dataset and a Node script. It does not use a local model service, API keys, torch, CUDA, or CPU ML inference. The script writes a JSON result file, a terminal-output file, and an SVG chart from the same dataset.

Run it with:

```sh
node projects/agent-concurrency-budget-gates/run-experiment.mjs
```

If local `node` is unavailable, use the bundled Node runtime provided by your environment. The output should match the results block unless you change the dataset, lane constants, or policies.

For stronger evidence, extend the dataset in three directions. Add more high-risk write tasks. Add real traces from failed or reverted agent runs. Add reviewer latency and conflict-rate measurements. Those additions will make the pass rate more meaningful and expose where the current policy is too conservative or too permissive.

## Guardrails And Rollback Criteria

Roll back a concurrency policy when any high-risk task leaves the reviewed lane without an approved exception. Roll back when approval queue time exceeds the manifest threshold, when trace fields go missing, when token load per accepted task grows beyond the p95 budget, or when conflict rate rises after fanout expands.

Block policies that let several agents write the same file group without an ownership plan. Block policies that treat approval review as a minor delay rather than part of the risk model. Block policies that evaluate only final output quality and ignore the trajectory that produced it.

The exception path should be explicit. A reviewer can approve parallelism for a high-risk task only when the work is divided into read-only preparation and a single reviewed write step, with trace retention and rollback criteria attached to the task.

## Implementation Plan

Start by instrumenting current agent runs. Capture task type, subagent count, token load, approvals, writes, elapsed time, and outcome. Use those traces to label expected lanes for the first twenty cases. Include accepted work, reverted work, slow work, and work that required human rescue.

Then encode two baselines and one candidate policy. Keep the policies short enough for review. If the candidate policy cannot beat the baselines on quality and review pressure, do not ship it. If it beats the baselines only by serializing everything, inspect whether the task classes are too broad.

Finally, attach the harness to release review. Any change to subagent limits, tool permissions, write scope, approval policy, or trace capture should rerun the evaluation. Concurrency should expand only when the measured workload supports it.

## Limitations

This harness is a small measurement surface, not a universal benchmark. The task labels are hand-authored, the lane constants are illustrative, and the quality checks are rule-based. A production version should incorporate real traces, reviewer outcomes, model costs, and task-specific evals.

The harness also rewards reviewability over speed. That is intentional for high-risk workflows, but it may be too conservative for mature low-risk task classes. The right response is not to remove the gate. It is to add more evidence and loosen thresholds only where the measured failure rate supports it.
