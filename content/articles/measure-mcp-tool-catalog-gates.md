---
title: Measure MCP Tool Catalog Gates
description: Build a reproducible harness that scores MCP catalog policies by exact tool visibility, unsafe alternatives, latency, and tool-list size.
topic: AI Agents
level: Advanced
date: 2026-07-03
readingTime: 32
tags: ai-agents, mcp, tool-use, evals, security, observability
image: /content/v1/assets/measure-mcp-tool-catalog-gates.svg
imageAlt: Chart comparing selection accuracy, unsafe alternatives, and mean visible tools for MCP tool catalog policies
evidenceMode: experiment
---

MCP tool catalogs need release tests before they become model context. A server can expose a useful read tool, a write tool, an export tool, and an administrative tool through the same integration. If a host lists every available tool, the model has to choose inside a larger and riskier action space than the task requires.

This tutorial builds a deterministic Node harness for catalog policy review. The harness compares three policies over twenty-four MCP-style tools and fourteen representative tasks. The first policy exposes all tools. The second exposes tools from the same namespace as the expected tool. The third applies a capability gate: capability match, side-effect limit, data-class limit, token-audience binding, description quality, schema quality, contract-test pass rate, latency budget, approval availability, and stale-tool status.

The measured result is useful because it separates "the right tool exists" from "the model sees too much." All three policies preserve exact-tool visibility and select the expected tool in this small replay set. But the all-tools policy exposes 235 unsafe alternatives across the fourteen tasks, while namespace-only filtering still exposes 23. The capability gate keeps exact visibility at 14 of 14, reduces unsafe alternatives to zero, and reduces mean visible tools from 24 to 1.

## Research Question

The research question is: can a transparent catalog gate remove risky MCP tools from model context without hiding the exact tool required by the task?

This is the practical failure mode behind many tool-using agent problems. The correct tool may exist, but the visible catalog also contains broader tools with similar names, weak descriptions, excessive side effects, unbound authorization, stale schemas, or latency above the task budget. The model then has to solve a catalog governance problem while solving the user task.

The harness does not benchmark a language model. It evaluates whether the catalog policy would present a small, reviewable tool set before the model is asked to choose. That makes the test fast, reproducible, and easy to run in CI when a new MCP server or tool definition is added.

## Dataset Design

The dataset contains tool records with the metadata a production catalog should maintain: identifier, capability, scope, side-effect level, data class, description quality, schema quality, contract-test pass rate, p95 latency, token-audience binding, approval requirement, and stale status.

```json
{
  "id": "crm.update_account",
  "capability": "crm_write",
  "scope": "account",
  "sideEffect": 2,
  "dataClass": "customer",
  "descriptionQuality": 0.78,
  "schemaQuality": 0.82,
  "testPassRate": 0.92,
  "p95LatencyMs": 1160,
  "audienceBound": true,
  "requiresApproval": true,
  "stale": false
}
```

`sideEffect` uses a simple scale: read-only is `0`, export-like behavior is `1`, ordinary write is `2`, and administrative or destructive action is `3`. `dataClass` is ordered from aggregate data to source, business, personal, and customer data. Those rankings are intentionally conservative. A tool that reads customer records should not appear in a task that only needs aggregate analytics.

Tasks define the expected tool, required capability, maximum side effect, data class, latency budget, and whether approval is available.

```json
{
  "id": "update-customer-owner",
  "requiredTool": "crm.update_account",
  "capability": "crm_write",
  "maxSideEffect": 2,
  "dataClass": "customer",
  "latencyBudgetMs": 2000,
  "approvalAvailable": true
}
```

In production, the tool metadata should come from your MCP registry and contract tests. The task replay set should come from real support requests, engineering tasks, runbook updates, incident workflows, and data-access requests. The synthetic values here make the policy behavior inspectable.

## Policy Implementations

The three policies are deliberately simple.

```javascript
const policies = {
  allTools(task, tools) {
    return tools;
  },
  namespaceOnly(task, tools) {
    const namespace = task.requiredTool.split(".")[0];
    return tools.filter((tool) => tool.id.startsWith(`${namespace}.`));
  },
  capabilityGate(task, tools) {
    return tools.filter((tool) => {
      if (tool.capability !== task.capability) return false;
      if (tool.sideEffect > task.maxSideEffect) return false;
      if (dataRank.get(tool.dataClass) > dataRank.get(task.dataClass)) return false;
      if (!tool.audienceBound) return false;
      if (tool.descriptionQuality < 0.72 || tool.schemaQuality < 0.76) return false;
      if (tool.testPassRate < 0.9) return false;
      if (tool.p95LatencyMs > task.latencyBudgetMs) return false;
      if (tool.requiresApproval && !task.approvalAvailable) return false;
      if (tool.stale) return false;
      return true;
    });
  },
};
```

The all-tools policy is the negative control. It proves what the catalog would look like if the host gave the model every connected tool. The namespace-only policy is a common intermediate step: use the right server, but still expose all capabilities inside that server. The capability gate is stricter because it starts from the task and checks authority, quality, and runtime budget.

This policy is not a black-box classifier. Every threshold can be reviewed by platform, security, and product owners. If a tool has a 0.89 contract-test pass rate and is still business-critical, the better response is to fix or isolate the tool, not silently put it into the model context.

## Unsafe Alternative Scoring

The harness marks a visible tool as an unsafe alternative when it violates any task boundary: excessive side effect, broader data class, missing audience binding, weak contract-test pass rate, latency above budget, approval required but unavailable, or stale status.

```javascript
function isUnsafeAlternative(tool, task) {
  return (
    tool.sideEffect > task.maxSideEffect ||
    dataRank.get(tool.dataClass) > dataRank.get(task.dataClass) ||
    !tool.audienceBound ||
    tool.testPassRate < 0.9 ||
    tool.p95LatencyMs > task.latencyBudgetMs ||
    (tool.requiresApproval && !task.approvalAvailable) ||
    tool.stale
  );
}
```

This score is not saying the tool is bad globally. It is saying the tool is inappropriate for the current task. A CRM export may be legitimate in an approved data migration, but it should not appear when the task is to look up one account. A calendar write tool may be legitimate when scheduling a review, but it should not appear when the task is only to find available slots.

The selected-tool simulation is intentionally weak compared with a real model. It scores capability match, description quality, schema quality, test pass rate, side-effect penalty, data penalty, authorization penalty, stale penalty, and latency penalty. The main release metric is the visible catalog, not the simulated model. If unsafe alternatives are absent, the model has less room to choose a tool that the policy should have hidden.

## Results

The run produced this output:

```output
MCP tool catalog gate experiment
tools=24 tasks=14
allTools: exact_visible=14/14 exact_visible_rate=1 selection_accuracy=1 unsafe_selections=0 unsafe_alternatives=235 mean_visible_tools=24 p95_latency_ms=1740
namespaceOnly: exact_visible=14/14 exact_visible_rate=1 selection_accuracy=1 unsafe_selections=0 unsafe_alternatives=23 mean_visible_tools=3.07 p95_latency_ms=1740
capabilityGate: exact_visible=14/14 exact_visible_rate=1 selection_accuracy=1 unsafe_selections=0 unsafe_alternatives=0 mean_visible_tools=1 p95_latency_ms=1740
```

The all-tools policy passes the shallow availability test because every expected tool is visible. That result is misleading. It also exposes 235 unsafe alternatives across fourteen tasks and gives the model all twenty-four tools every time. The model context includes write, export, stale, unbound, and administrative tools even for read-only tasks.

Namespace-only filtering is much better. Mean visible tools falls from 24 to 3.07, and unsafe alternatives fall from 235 to 23. But the remaining unsafe alternatives are exactly the kind that matter: broad exports next to reads, destructive or bulk writes next to ordinary writes, stale search tools next to current search tools, and tools whose audience binding is not safe for the task.

The capability gate keeps the result small. It preserves exact-tool visibility for all fourteen tasks while exposing one tool per task on average and zero unsafe alternatives. That is the desired release shape. The model still receives the tool it needs, but it does not receive adjacent tools with broader data, stronger side effects, weaker tests, or missing authorization binding.

## Error Analysis

The all-tools policy fails because it treats installation as exposure. A tool can be installed for legitimate reasons and still be inappropriate for most tasks. In this dataset, every task sees organization-wide search, raw export, administrative delete, and stale tools because the policy has no task boundary.

The namespace-only policy fails because server namespace is not capability. The CRM namespace contains account lookup, account update, and contact export. The calendar namespace contains slot lookup, event creation, and bulk deletion. The incident namespace contains incident read, incident resolve, and service deletion. Server trust does not remove the need for task-specific filtering.

The capability gate can fail in a different way: it can become too strict and hide the only correct tool. That is why exact-tool visibility is a first-class metric. A gate should not celebrate low exposure if it blocks useful work. In practice, false blocks should become metadata or quality fixes. If a required tool is missing audience binding, has weak tests, or lacks approval plumbing, the right next step is to repair the tool contract before broad exposure.

## Production Readiness

To use this pattern in production, connect the harness to the same registry used by the host or agent runtime. Export tool definitions with capability, scope, side-effect class, data class, authorization audience, approval policy, schema version, contract-test status, owner, and latency.

Then build a replay set. Include safe read tasks, writes with approval, personal data, customer data, exports, administrative tools, stale tools, ambiguous names, missing audience binding, high-latency tools, and tools with weak descriptions. The replay set should be small enough to understand and large enough to catch regressions when a new server appears.

Finally, turn the metrics into a release gate. Block a catalog change when exact-tool visibility falls below threshold, when unsafe alternatives appear for personal or customer data tasks, when mean visible tools rises above the task-class budget, when approval-required tools are exposed without approval, or when p95 latency exceeds the interaction budget.

## Reproducibility

The harness uses a local JSON dataset and a Node script. It does not use a local model service, API keys, torch, CUDA, or CPU ML inference. It writes structured results, terminal-style output, and an SVG chart from the same input data.

Run it with:

```sh
node projects/mcp-tool-catalog-gates/run-experiment.mjs
```

The output should match the results block unless you change the dataset, policy thresholds, or scoring function. For a stronger evaluation, replace the sample tools with exported MCP registry metadata and replace the tasks with real task classes from your agent logs.

## Guardrails And Rollback Criteria

Roll back a catalog policy when a write, export, or administrative tool appears in a read-only task. Roll back when a personal or customer-data task exposes any tool without audience binding. Roll back when a tool starts failing contract tests but remains visible. Roll back when tool-list caching causes stale policy to survive after a tool is disabled.

Require approval state in traces for write, export, and administrative calls. If the trace cannot show who approved the operation, what tool was selected, what target resource was used, and what output was returned, the workflow should not expand.

Treat missing metadata as a block, not a warning. Missing side-effect class, data class, authorization audience, or test status means the gate cannot prove the tool fits the task. The safest default is to keep the tool out of the model-visible catalog until the owner repairs the metadata.

## Implementation Plan

Start with inventory. Export every MCP tool your host can see. Add side-effect class, data class, resource scope, owner, and approval rule. Mark unclassified tools as unavailable for broad tasks.

Next, write one replay case per common task class. A good first suite has ten to twenty cases: read code, write code, read ticket, update ticket, search messages, post a message, read calendar, create event, read customer, update customer, query aggregate data, inspect incident, resolve incident, search runbook, and update runbook.

Then run three policies: all tools, namespace-only, and capability gate. Keep the simple baselines. They are useful because they show whether the stricter gate is actually improving exposure rather than only adding process.

Finally, wire the gate to deployment. A new MCP server, new tool, schema change, approval-policy change, or model-runtime change should rerun the replay suite. The release review should include exact-tool visibility, unsafe alternatives, mean visible tools, p95 latency, and approval coverage.

## Limitations

This harness evaluates catalog exposure, not model intelligence. A model can still misuse the right tool, misunderstand a result, or fail to recover from an error. Production evaluation should add trajectory tests, tool-result validation, human review for high-risk actions, and incident analysis.

The dataset is small and synthetic. It demonstrates the method rather than certifying a real catalog. A real deployment should include organization-specific data classes, tool owners, auth providers, runtime budgets, failure histories, and user consent flows.

The scoring thresholds are also policy choices. Some teams may require stricter description scores, lower latency, or human approval for all writes. Others may allow more tools for expert users in a sandbox. The important part is to make the policy explicit, run it mechanically, and treat failures as release blockers.
