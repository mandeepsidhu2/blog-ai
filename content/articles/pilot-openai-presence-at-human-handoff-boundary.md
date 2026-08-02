---
title: Pilot OpenAI Presence at the Human Handoff Boundary
description: Evaluate enterprise service agents by state transfer, authority continuity, recovery, and queue outcomes—not autonomous resolution alone.
topic: Enterprise Agent Operations
level: Advanced
date: 2026-08-01
readingTime: 19
tags: enterprise-agents, contact-centers, human-handoff, voice-ai, agent-operations, evaluation
image: /content/v1/assets/presence-handoff-decision-surface.svg
imageAlt: Decision matrix showing the state, authority, routing, and recovery evidence needed across an enterprise AI agent handoff
evidenceMode: strategy
qualityTier: timely-analysis
---

OpenAI Presence arrives with a strong operational signal: OpenAI says its own English-language phone-support deployment resolves 75% of inbound issues without human assistance, and that a Codex-powered improvement loop reduced handoffs by 15 percentage points in ten days. Those numbers are useful evidence that the product can operate a real support channel. They are not yet a portable forecast for another enterprise.

The missing denominator is the handoff. An agent can lower transfer rate by resolving more valid cases, by frustrating callers into abandonment, by taking actions that humans would have reviewed, or by misclassifying requests as complete. The adoption decision therefore needs a handoff contract that preserves customer state, action authority, routing reason, and recovery behavior across AI and human operators.

Presence was announced on July 22, 2026 for real-time voice and chat. It is available through a limited general-availability program for eligible enterprise customers, led by OpenAI forward-deployed engineers and selected systems integrators; it is not self-service. That delivery model makes a controlled workflow pilot appropriate. It does not justify a platform-wide replacement decision.

## Finding and Decision Summary

Pilot Presence on one bounded job where correctness can be verified from system state—billing adjustments below a fixed amount, a narrow IT-service request, or a claims-status lookup. Keep an incumbent human path and a shadow evaluator. Measure resolution only when the requested state is correct, durable, authorized, and not reopened within the declared window.

The core acceptance metric should be **successful resolution without recovery debt**, not containment rate. Recovery debt includes repeat contact, reopened tickets, reversed actions, missing transcript context, queue misrouting, privacy incidents, and extra human handle time after an attempted automation.

OpenAI publishes a product outcome, while competing platform documentation exposes different parts of the transfer protocol. The comparison below is a sourced engineering matrix, not a feature leaderboard. Sources: [OpenAI Presence](https://openai.com/index/introducing-openai-presence/), [Microsoft handoff](https://learn.microsoft.com/en-au/microsoft-copilot-studio/advanced-hand-off), [Google transfers](https://docs.cloud.google.com/contact-center/ccai-platform/docs/virtual-agent-to-human-agent-transfers), and [Salesforce Agentforce APIs](https://developer.salesforce.com/docs/ai/agentforce/guide/get-started-agents.html).

| Surface | State passed at handoff | Routing and fallback evidence | Authority / privacy evidence | Comparability limit |
|---|---|---|---|---|
| OpenAI Presence, announced 2026-07-22 | Policies, evaluations, escalation rules, workflow context are described; exact public payload schema is not published | Company sets approval and takeover rules; 75% inbound resolution and 15 pp handoff reduction reported for OpenAI phone support | Job-scoped knowledge and system access; approved actions | Limited GA and forward-deployed implementation; one English support channel's outcomes are not a normalized benchmark |
| Microsoft Copilot Studio handoff | Full conversation history plus at least nine documented default context fields and user-defined variables | Implicit or explicit escalation; engagement-hub adapter; generic adapter required outside integrated hubs | Sensitive variables can be redacted from transcripts and telemetry but remain in Dataverse | Documentation describes protocol capabilities, not task-success or queue-outcome rates |
| Google CCAI Platform transfer | Human sees conversation history; custom payload includes reason, agent target, fallback menu, and language | Direct agent/extension transfer; first fallback to current queue, second to configured queue, then call ends | CRM/session association and detailed transfer metadata documented | Product topology and metric schema differ from Presence deployment |
| Salesforce Agentforce service handoff | Full conversation context through supported chat surfaces; custom escalation metadata can be stored on the messaging session | Escalation topic and custom action can route with stored reason | Actions and channel integration follow Salesforce object and flow controls | Public docs establish integration behavior, not comparable resolution quality |

Unknown means unknown. Presence's public page does not specify a handoff event schema, transcript export shape, retention policy per field, adapter retry semantics, or a comparable queue-level result table. Those questions belong in the pilot statement of work.

## What Presence Actually Commits To

Presence starts from a specific job. OpenAI says the agent receives only the knowledge and system access required for that job, while the customer defines permitted actions, approval requirements, and takeover rules. The product combines policies and standard operating procedures, guardrails, approved actions, simulations, evaluations, and a Codex-assisted improvement process.

That is an operating system around a model, but the exact deployed unit is customer-specific. Knowledge connectors, tool contracts, policies, channel, language, escalation rules, and integrations all change observed quality. A 75% resolution rate cannot be attributed to the model alone or transported to a new workflow without the same denominator and audit rules.

OpenAI identifies three external design-partner directions: BBVA is exploring voice support for everyday banking in Mexico, SoftBank is testing natural Japanese conversations, and IAG is exploring high-demand insurance support during severe weather. The language is intentionally exploratory. None of those statements supplies a production resolution rate, randomized comparison, queue-cost result, or safety-effect estimate.

Presence currently supports voice and chat for uses including customer support, outbound sales, and high-risk internal workflows. OpenAI's own support example includes caller verification, account context, and approved actions. That sequence is consequential because an error can cross from conversation into system state. It demands action-level evidence, not transcript quality alone.

## Comparison and Comparability Limits

Vendor documents describe different layers. Presence describes an end-to-end deployed product and two aggregate outcomes. Microsoft documents a handoff message and context variables. Google documents routing payloads, fallbacks, and session metadata. Salesforce documents escalation integration with its messaging objects. None provides a common task set, language mix, call distribution, human baseline, severity weighting, cost, or observation window.

Do not turn the table into a winner. Use it to derive questions:

- Can the receiving human see the customer's request, identity-verification state, tool results, attempted and committed actions, policy version, escalation reason, and uncertainty?
- Does the human inherit authority, or must sensitive actions be reauthorized?
- Can a transfer fail safely through a queue, callback, or alternate channel?
- Are sensitive values excluded from transcripts and telemetry while still available for routing?
- Can every AI action be reconciled with source-system state after a dropped call?
- Does the platform expose queue wait, transfer connection, human handle, repeat-contact, and reopen metrics?

Microsoft lists 9 default handoff fields: scope, last topic, topics, last phrases, phrases, conversation ID, agent message, bot ID, and language, plus user-defined variables. Its generic hub path requires a custom adapter and emits a `handoff.initiate` event. Its global-variable guidance uses a 10,000 ms maximum-wait example for Omnichannel values. That is concrete integration evidence, not proof that the receiving human gets the right summary or authority.

Microsoft's July 2026 sensitive-data guidance adds an important boundary: a marked context variable is excluded from transcripts and Application Insights telemetry but remains in runtime memory and is stored in Dataverse. A redacted log is not deleted data. Privacy review must follow every destination.

Google's transfer payload makes fallback explicit. A direct transfer can target an agent extension or ID and carry an escalation reason, fallback menu, and language. If direct transfer fails, the documented sequence has 2 fallback stages: first the current queue, then the specified fallback queue, after which the call ends. The system distinguishes 2 reporting reasons—planned transfer and consumer escalation. That is the level of failure semantics a Presence pilot should require.

## Build a Handoff Evidence Contract

Define a versioned envelope that is independent of the provider. It should include the fields below, derived from [Microsoft's context contract](https://learn.microsoft.com/en-au/microsoft-copilot-studio/advanced-hand-off), [Google's transfer payload](https://docs.cloud.google.com/contact-center/ccai-platform/docs/virtual-agent-to-human-agent-transfers), and [NIST's human-AI oversight outcomes](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/).

| Field group | Required evidence | Acceptance rule |
|---|---|---|
| Identity and consent | customer/session IDs, verified factors, consent state, channel, language | Human can see verification freshness; secrets and raw factors are not copied into summaries |
| Intent and progress | normalized request, collected facts, unresolved questions, cited policy | Human does not repeat already verified questions except under a declared recheck rule |
| Action ledger | ordered tool calls, idempotency keys, proposed/approved/committed status, source-system receipts | No action is represented as complete without a durable receipt |
| Escalation | trigger, confidence, policy rule, urgency, destination skill | Destination and priority match the declared routing oracle |
| Recovery | queue fallback, callback permission, reconnect token, owner, expiry | Dropped transfer cannot orphan a committed action or force silent restart |
| Privacy | field classification, transcript/telemetry inclusion, retention, deletion owner | Sensitive fields are minimized at every downstream store |

Use schema validation at both sides of the transfer. A successful API response is not enough: confirm that the human desktop renders critical fields, that long transcripts are bounded without deleting commitments, and that source-system receipts survive summarization.

Represent authority as state, not prose. An action can be `proposed`, `customer_confirmed`, `policy_approved`, `committed`, `reversed`, or `unknown`. The receiving human must not infer commitment from a natural-language recap. On reconnect, reconcile idempotency keys with the system of record before retrying.

## Experimental Design for a Credible Pilot

Freeze the workflow, eligible intents, channels, languages, policy version, knowledge snapshot, tool schemas, escalation rules, and model configuration. Stratify the evaluation by request complexity and consequence. A password-reset status query and a payment reversal should not share one containment average.

Run four phases:

1. Replay de-identified historical cases against read-only replicas. Score factual state, policy choice, escalation, and proposed action separately.
2. Run simulation with adversarial users, ambiguous identity, stale knowledge, tool timeouts, duplicate callbacks, queue saturation, and dropped transfers.
3. Shadow live traffic without customer-facing output or action authority. Compare the proposed resolution and route with the human outcome.
4. Canary one low-consequence cell with reversible actions, explicit customer disclosure, and an immediate human bypass.

Randomize eligible contacts between incumbent and candidate paths when policy and operations permit. If randomization is inappropriate, use matched time blocks and report drift. Keep human reviewers blind to path identity when grading transcript-level quality.

Measure at least eight outcomes: verified task completion, invalid action rate, escalation precision, escalation recall, transfer connection rate, repeat-contact rate, reopen rate, customer abandonment, human handle time after transfer, queue wait, cost per durable resolution, and time to reverse an incorrect action. Report confidence intervals by intent and language.

The 15-percentage-point handoff reduction over ten days is a process-improvement signal, not a stable causal effect. The agent, policies, evaluators, case mix, and operators could all have changed. Ask for the starting rate, eligible denominator, repeat-contact window, abandonment treatment, and action-correctness audit before using it in a business case.

## Engineering Decision Rules

Predeclare thresholds. For a low-risk billing pilot, for example, require noninferior durable resolution, zero unauthorized monetary actions, no increase in repeat contact within 7 days, at least 99.5% complete action receipts, at least 99% transfer connection when requested, and bounded human handle-time inflation after transfer. A local team might also require the handoff event to reach the queue within 30 seconds and reconciliation to finish within 5 minutes; those are illustrative operating thresholds, not Presence specifications. Numbers should match local risk; these examples are not universal defaults.

Use an independent reconciliation job to compare agent claims with CRM, ticketing, billing, and identity systems. Sample apparent autonomous resolutions for blinded human review. Count a case as unresolved if the customer returns within the declared window for the same issue, even when the first session was marked complete.

Keep the human-bypass button available and measure its use. A falling escalation rate accompanied by rising abandonment or repeated “agent” requests is a regression. Voice paths also need barge-in, silence, accent, packet-loss, and DTMF tests; chat paths need attachment, long-thread, reconnect, and accessibility tests.

## Production Readiness, Failure Modes, and Rollback

The first failure mode is context loss. A transfer connects, but the receiving human lacks verification state, attempted actions, or the actual escalation reason. The customer repeats the story and the business counts a technically successful handoff. Detect it with field-completeness checks and human “missing context” annotations.

The second is authority ambiguity. The AI says a refund was issued when it was only proposed, or the human retries an already committed action. Enforce idempotency and source receipts. Block natural-language-only action state.

The third is unsafe containment. The agent avoids escalation by choosing an answer outside policy or by ending the conversation. Audit false containment against a human-reviewed oracle and downstream reopen data.

The fourth is queue externalization. Better automation metrics can coexist with worse human operations if transferred cases become harder. Compare post-transfer handle time, skill routing, after-call work, and emotional escalation—not only transfer count.

The fifth is improvement-loop contamination. Production sessions reveal gaps, but a proposed policy or prompt change can overfit recent cases or loosen authority. Version every change, replay a locked regression suite, and require approval from the workflow owner and risk owner.

Rollback must restore the whole tuple: agent configuration, model, knowledge snapshot, tools, permissions, policies, handoff schema, routing, and channel adapter. Maintain a kill switch that routes new sessions to the incumbent path while allowing in-flight actions to reconcile. Test that rollback under queue saturation before launch.

## Adoption Boundary

Presence is appropriate for enterprises with a specific high-volume workflow, stable systems of record, a staffed human fallback, measurable completion state, and capacity to work with a forward-deployed implementation team. Voice and chat support are real strengths when both channels share policies and evidence while preserving channel-specific tests.

Do not adopt it merely to reach a containment target, replace human judgment in high-consequence cases, or compensate for fragmented source systems and unclear policies. Do not extrapolate OpenAI's English support result to another language, domain, or action surface. Do not remove the incumbent path until durable resolution and recovery debt improve together.

The right question is not whether the agent can complete a conversation. It is whether the enterprise can prove what happened when the conversation crosses a human, system, or authority boundary.

## Source Ledger

- `2026-07-22` — OpenAI, [Introducing OpenAI Presence](https://openai.com/index/introducing-openai-presence/): availability, voice/chat scope, controls, 75% resolution, and 15 pp handoff reduction.
- Current on `2026-08-01` — OpenAI, [Enterprise privacy](https://openai.com/enterprise-privacy/): organizational data-control boundary to verify for each deployment.
- Current on `2026-08-01` — OpenAI, [Realtime API documentation](https://platform.openai.com/docs/guides/realtime): lower-level voice-session capabilities; not equivalent to Presence's deployed product.
- Updated `2024-11-19` — Microsoft, [Copilot Studio live-agent handoff](https://learn.microsoft.com/en-au/microsoft-copilot-studio/advanced-hand-off): full history and default context-variable contract.
- Updated in `2026` — Microsoft, [generic engagement-hub handoff](https://learn.microsoft.com/en-us/microsoft-copilot-studio/configure-generic-handoff): custom adapter and `handoff.initiate` event boundary.
- Updated `2026-07` — Microsoft, [sensitive context variables](https://learn.microsoft.com/en-us/microsoft-copilot-studio/voice-sensitive-data): transcript, telemetry, runtime, and Dataverse distinctions.
- Updated `2026-07-17` — Google Cloud, [CCAI virtual agents](https://docs.cloud.google.com/contact-center/ccai-platform/docs/virtual-agent): human escalation and same-queue fallback guidance.
- Updated `2026-07` — Google Cloud, [virtual-to-human transfers](https://docs.cloud.google.com/contact-center/ccai-platform/docs/virtual-agent-to-human-agent-transfers): transfer payload, reason codes, and two-stage fallback.
- Updated `2026-07` — Google Cloud, [chat session metadata](https://docs.cloud.google.com/contact-center/ccai-platform/docs/chat-session-metadata): transfer, escalation, participant, and duration evidence.
- Current on `2026-08-01` — Salesforce, [Agentforce APIs and SDKs](https://developer.salesforce.com/docs/ai/agentforce/guide/get-started-agents.html): full-context human escalation claim and action surface.
- Current on `2026-08-01` — Salesforce, [CCaaS escalation metadata](https://developer.salesforce.com/docs/service/messaging-byoc-ccaas/guide/create-agentforce-service-agent.html): escalation reason persistence and routing integration.
- Updated `2026` — NIST, [AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/): human-AI roles and production monitoring outcomes.
