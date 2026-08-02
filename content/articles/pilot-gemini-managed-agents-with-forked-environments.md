---
title: Pilot Gemini Managed Agents as Forked Environments, Not Saved Bots
description: Turn Google's public-preview agent runtime into a costed, versioned, least-privilege canary with explicit state and rollback boundaries.
topic: Agent Platforms
level: Advanced
date: 2026-08-01
readingTime: 20
tags: gemini-api, managed-agents, sandboxing, agent-security, cost-control, rollout
image: /content/v1/assets/gemini-managed-agent-control-matrix.svg
imageAlt: Control matrix mapping managed agent preview properties to network, credential, state, cost, provenance, and rollback gates
evidenceMode: strategy
qualityTier: timely-analysis
---

Google's Gemini API now exposes Managed Agents in public preview: one call can start a hosted Linux environment where an agent reasons, browses, executes code, and manages files. The convenience is real. So is the change in operational unit. You are no longer buying one model response; you are invoking a mutable execution environment, a reasoning loop, network access, tools, credentials, files, and retained state.

The default should therefore be a forked, disposable job—not a durable bot identity that accumulates authority. Google's current documentation says one interaction commonly consumes 100,000 to 3 million tokens, environments have 4 CPU cores and 16 GB of memory, inactive environments expire after seven days, and new provisioning can take up to roughly five seconds. Network egress is unrestricted by default unless configured. Saved agents have no native versioning or rollback, and only one preview base agent is supported.

Those facts define the pilot. Version the external definition yourself, deny network destinations by default, inject short-lived credentials at the egress boundary, cap completed-task cost, and require a clean fork for every mutating job. Promote only workloads whose evidence survives replay outside the hosted environment.

## What Changed

The [Managed Agents overview](https://ai.google.dev/gemini-api/docs/agents) describes a configurable harness accessed through the Gemini API. The available Antigravity agent can execute code, manage files, search the web, and use Gemini 3.6 Flash by default; model selection can include Gemini 3.5 Flash and Flash-Lite. Deep Research is a separate managed agent for research workflows.

Google's [Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview) became generally available in June 2026 and unifies calls to models and agents. It supports server-side conversation state via a previous interaction identifier, observable execution steps, streaming, and background execution. The original `generateContent` API remains supported but is described as legacy for new projects.

Managed Agents themselves remain Public Preview. The product boundary matters: a GA invocation interface does not make the managed runtime GA. Production controls must be tied to the component with authority, not the most mature label in the stack.

## Current Runtime Comparison Matrix

This locally assembled matrix is sourced from Google's [agent overview](https://ai.google.dev/gemini-api/docs/agents), [environment reference](https://ai.google.dev/gemini-api/docs/agent-environment), [custom-agent guide](https://ai.google.dev/gemini-api/docs/custom-agents), and [Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview). The rows describe different lifecycle units and are not directly comparable as performance benchmarks.

| Runtime unit | Current measured or declared boundary | Operational consequence | Release evidence |
|---|---|---|---|
| Interaction | Typically 100k–3M model tokens; supports streaming and background mode | Request count is a poor cost proxy | Tokens, tool steps, wall time, accepted artifact |
| Environment | 4 CPU cores; 16 GB memory; up to ~5 s new startup | Resource and cold-start limits belong in SLOs | Environment ID, start latency, peak files and memory |
| Offline environment | Deleted after 7 days of inactivity | Retention is temporary, not an archive | Exported artifact digest and external record |
| Source import | 1 MB per inline file; 2 MB total inline; 500 MB Git repository; 2 GB Cloud Storage repository | Large or binary workspaces need another route | Source digest, excluded files, import result |
| Saved managed agent | Up to 1,000 agents; one supported base agent; no native versioning; no nested subagents | Naming is not release management | External version, policy digest, canary and rollback pointer |
| Network policy | Unrestricted outbound access by default; configurable allowlist | Isolation does not imply egress restriction | Effective destinations, denied attempts, credential transforms |

The limits are preview documentation checked on August 1, 2026, not performance guarantees. Environment compute is described as unbilled during preview, while model tokens and tool usage are pay-as-you-go. That is a temporary price boundary, not evidence that sandbox compute will remain free.

## Security and Comparability Limits

An operating-system sandbox reduces host cross-contamination; it does not decide which remote systems the agent may contact or what its credentials may authorize. Google's overview explicitly says outbound network access is unrestricted by default and recommends allowlists. Treat `network` configuration as mandatory for any source containing proprietary code, data, tokens, or customer context.

Credential injection through egress header transformation is better than placing a secret in the filesystem, but it still grants the agent the credential's effective authority whenever it reaches the destination. [RFC 9700](https://www.ietf.org/rfc/rfc9700.html), published January 2025, recommends privilege restriction and sender-constrained access tokens where feasible. Use short-lived, job-scoped tokens with repository, branch, method, amount, or resource restrictions enforced by the target service.

Prompt and tool safety remain separate. [OWASP's Excessive Agency guidance](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) identifies damaging action from hallucination, direct injection, indirect injection, or compromised tools. An allowlisted domain can still serve attacker-controlled issue text, package metadata, or web content. Network policy must be paired with tool arguments, write scopes, approvals, and postconditions.

The comparison is limited because Google does not report a portable success rate, latency distribution, security-evaluation corpus, or completed-task price for your workflow. The 100k–3M token range is not directly comparable across tasks with different tool loops, context, models, or stopping conditions. Measure a frozen task set.

## Engineering Decision: Define the Fork Contract

Use a saved agent only as an immutable recipe pointer. Store the actual release definition in source control with a semantic version and digest. It should contain base-agent identifier, selected model, system instruction, skill digests, source digests, allowed tools, network destinations, credential transformations, time budget, token budget, artifact schema, and required approval points.

Each mutating invocation should fork a clean base environment. The custom-agent documentation says each invocation forks the base environment, while source definitions can be reused. Exploit that property: never rely on a previous task's writable workspace for authorization or correctness. If a workflow genuinely needs continuity, make state explicit in a governed external store and pass a read-only snapshot into the fork.

A pilot record might be:

```json
{
  "release": "issue-resolver@1.3.0",
  "definition_sha256": "...",
  "base_agent": "antigravity-preview-05-2026",
  "model": "gemini-3.6-flash",
  "network_allowlist": ["api.github.com", "pypi.org"],
  "credential_ttl_seconds": 900,
  "max_model_tokens": 450000,
  "max_wall_seconds": 300,
  "write_scope": "one branch in one repository",
  "approval": "required before pull-request creation"
}
```

The values are a pilot example, not provider defaults. The important property is enforcement outside the prompt. A token proxy should reject a 901-second-old token even if the agent asks persuasively. A branch policy should reject writes outside the job branch. A budget service should cancel loops that cross 450,000 tokens.

Google already supplies important primitives: environment isolation, allowlists, credential transforms, clean forks, and observable steps. The recommendation is not to rebuild those facilities. It is to make their effective configuration testable and to place organization-specific authority at systems the agent cannot rewrite. On every canary, probe a denied destination, an expired token, an out-of-scope repository, and a budget overrun. Capture the enforcement decision beside the agent trace.

Do not infer kernel, hypervisor, tenant-isolation, deletion, or forensic guarantees beyond the published documentation and contract. Teams with those requirements need provider assurance artifacts and their own security review; a successful functional pilot cannot establish them.

## Cost and Quality Evaluation

Price completed work, not interactions. Select at least 100 representative tasks spanning repository size, dependency installation, tool errors, ambiguous instructions, and malicious retrieved content. Freeze source snapshots and expected outcomes. Randomize between the current workflow and the managed candidate.

Measure joint task success, accepted-patch rate, test pass rate, unauthorized-action count, human review minutes, p50 and p95 completion latency, model input and output tokens, tool calls, cold starts, environment failures, and dollar cost per accepted result. Attribute retries and abandoned runs to the candidate that created them.

The NIST January 12, 2026 [agent-security request for information](https://www.nist.gov/news-events/news/2026/01/caisi-issues-request-information-about-securing-ai-agent-systems) highlights constraining and monitoring agent access in deployment environments. Convert that principle into a negative test set: poisoned issue text, a repository instruction requesting secret exfiltration, a dependency package with a misleading name, an expired credential, a denied network domain, and a tool returning forged approval text.

Set gates before results. For example: no unauthorized writes or credential disclosure; at least 95% policy-event capture; accepted-task success no worse than the baseline by more than two percentage points; p95 completion below the product budget; and p95 completed-task cost below the declared ceiling. Use confidence intervals and investigate all policy violations rather than averaging them away.

## Production Readiness and Rollout

Begin with read-only analysis. Phase two may generate patches into a disposable branch. Phase three may open a draft pull request after human approval. Keep merges, releases, package publication, production data mutation, payments, and infrastructure changes outside the preview agent's direct authority.

Export artifacts and traces after every job: effective definition, source digests, interaction identifiers, environment identifier, model usage, tool steps, network decisions, denied requests, test output, patch digest, approvals, and final disposition. The environment's seven-day inactivity retention is not a compliance archive.

Pin dependencies and verify outputs. [SLSA's provenance specification](https://slsa.dev/spec/v1.1/provenance) provides a model for linking artifacts to build inputs and process identity; it does not attest that an agent's reasoning was correct, but the same provenance discipline helps identify which recipe and source produced a patch.

Roll back by disabling the external release pointer, revoking its token audience, and routing tasks to the prior harness. Native agent deletion is not enough because the custom-agent guide says deleting a definition does not affect existing environments and interactions created by it. Track and terminate active jobs separately.

## Failure Modes

The first failure is default egress. A team hears “isolated sandbox” and assumes no network. Test a denied canary domain before attaching any credential or private source.

The second is saved-agent drift. Because native versioning and rollback are not reported, editing a named agent can silently change future invocations. Make definitions append-only externally and include their digest in every job.

The third is override drift. Invocation-time options can replace system instructions, tools, or network configuration. A production wrapper should allow only signed, schema-validated overrides and should reject a replacement network policy broader than the release.

The fourth is state ambiguity. Server-side conversation state and environment files have different lifecycles. A previous interaction identifier is not proof that the expected filesystem snapshot is loaded. Assert source and workspace digests at job start.

The fifth is budget surprise. One interaction may cause multiple reasoning loops and 100k–3M tokens. Request quotas cannot control that variance. Enforce token, tool-call, wall-clock, and dollar budgets per task and per tenant.

The sixth is sandbox implementation risk. A July 20, 2026 [NVD entry for CVE-2026-58481](https://nvd.nist.gov/vuln/detail/CVE-2026-58481) documents a path-containment error in a separate agent runtime. It says nothing specific about Google's sandbox, but it demonstrates why “sandboxed” is a control claim to test, patch, and monitor—not a permanent proof.

## Adoption Boundary: When to Wait

Wait if the workload needs regulated data residency not covered by a signed agreement, stable native versioning, nested subagent delegation, binary-file analysis beyond the documented text/image support, repositories above 500 MB, Cloud Storage sources above 2 GB, more than seven days of inactive environment retention, or deterministic offline execution.

Do not use the preview runtime as the authority for production merges, secrets rotation, financial transactions, destructive data changes, or infrastructure deployment. Do not assume a provider-hosted sandbox satisfies an organization's network, evidence-retention, or incident-response requirements. And do not compare token counts across different tasks, models, prompts, or stopping rules as if they were equivalent efficiency scores.

## Source Ledger and Dates

- **June 2026:** Google's [Interactions API overview](https://ai.google.dev/gemini-api/docs/interactions-overview) marks the interface GA and recommends it for new projects; checked August 1, 2026.
- **July 2026 documentation, checked August 1:** the [Managed Agents overview](https://ai.google.dev/gemini-api/docs/agents) records preview status, typical 100k–3M token use, 1,000-agent limit, default egress, and supported agents.
- **Last updated July 2026, checked August 1:** the [environment reference](https://ai.google.dev/gemini-api/docs/agent-environment) records 4 cores, 16 GB, up to ~5-second startup, seven-day expiry, and source limits.
- **July 8, 2026 update:** the [custom-agent guide](https://ai.google.dev/gemini-api/docs/custom-agents) records the single base agent, invocation forks, configuration overrides, deletion semantics, and missing native versioning or nested subagents.
- **January 2025:** [IETF RFC 9700](https://www.ietf.org/rfc/rfc9700.html) supplies current OAuth privilege-restriction and token-replay guidance.
- **December 9, 2025:** OWASP announced its [Agentic AI Top 10](https://genai.owasp.org/2025/12/09/owasp-genai-security-project-releases-top-10-risks-and-mitigations-for-agentic-ai-security/); the excessive-agency entry informs negative tests.
- **January 12, 2026:** [NIST CAISI's agent-security RFI](https://www.nist.gov/news-events/news/2026/01/caisi-issues-request-information-about-securing-ai-agent-systems) emphasizes deployment access constraints and monitoring.
- **July 20–21, 2026:** [NVD CVE-2026-58481](https://nvd.nist.gov/vuln/detail/CVE-2026-58481) provides a recent, separate-runtime sandbox-boundary caution, not evidence about Gemini.
- **SLSA v1.1, checked August 1, 2026:** [provenance guidance](https://slsa.dev/spec/v1.1/provenance) informs artifact-to-input linkage.

## Decision Summary

Managed Agents remove infrastructure work, but they do not remove the need to define authority, cost, state, evidence, and rollback. Treat every mutating task as a clean fork of a versioned external recipe. Deny egress by default, constrain credentials outside the prompt, measure completed-task economics, export durable evidence, and keep irreversible authority out of the preview. The product becomes adoptable when those controls are demonstrated—not when the first impressive task completes.
