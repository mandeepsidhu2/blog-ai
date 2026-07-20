---
title: Measure Copilot Adoption Without Calling Activity Productivity
description: Use GitHub's July 2026 repository metrics to build a causal, quality-aware coding-agent measurement system.
topic: AI Engineering Analytics
level: Advanced
date: 2026-07-20
readingTime: 18
tags: github-copilot, developer-productivity, coding-agents, engineering-metrics, experimentation
image: /content/v1/assets/copilot-metrics-decision-surface.svg
imageAlt: Decision surface separating Copilot activity telemetry, delivery outcomes, quality guardrails, and causal attribution
evidenceMode: strategy
qualityTier: timely-analysis
---

GitHub added repository-level Copilot usage reports and Copilot app activity to its metrics API on July 17, 2026. The new fields can answer where coding-agent pull requests, code review suggestions, desktop sessions, prompts, requests, and tokens occur. They cannot answer whether software improved.

That distinction is now operationally important. Repository attribution makes it easy to build executive scorecards that divide merged agent pull requests by licenses and call the result productivity. The denominator is available; the causal claim is not. Repository activity depends on team size, repository type, release phase, policy, task mix, and whether engineers move work between the IDE, app, coding agent, and review surfaces.

Use the new API as an instrumentation layer. Join it to delivery, reliability, security, maintainability, review, and developer-experience evidence at the repository-day level. For attribution, use randomized encouragement, staggered rollout, or a credible matched design. Never rank individual developers by prompts, tokens, accepted suggestions, or agent pull requests.

## Finding and decision summary

- On July 17, GitHub released two one-day endpoints for enterprise and organization repository reports.
- Repository rows include pull requests created and merged by Copilot coding agent plus Copilot code-review activity and suggestion counts by comment type.
- The same date added `daily_active_copilot_app_users`, session count, request count, prompt count, prompt and output token sums, and average tokens per request to one-day and 28-day reports.
- App activity remains separate from generic feature, model, language, and lines-of-code totals; organizations with no activity receive `null`, not zero-filled usage.
- Access requires an enabled metrics policy plus owner, billing-manager, or custom `View Copilot Metrics` permission.
- Activity metrics measure exposure and use. They do not include task difficulty, counterfactual delivery time, escaped defects, incident severity, maintainability, or user value.
- Repository-level aggregation reduces some individual-surveillance risk but can still identify small teams and sensitive projects.
- A rollout decision needs a joined panel, explicit guardrails, and a causal design; an adoption dashboard alone is insufficient.

The released surface contains 2 repository endpoints, 1-day repository reports, 1-day and 28-day app windows, 2 active-user and app-total fields, and at least 7 app measures across sessions, requests, prompts, prompt tokens, output tokens, average tokens, and users. A proposed validation should retain 30 days of shadow data, require under 0.1% missing terminal joins, report 95% intervals, and suppress cohorts below 10 people. Release facts and local validation thresholds are labeled separately.

Translate that into an auditable pilot: collect every 24 hours for 720 hours, require at least 12 team clusters, cap join loss at 0.1%, sample 100 requests for raw-payload reconciliation, audit 100 merged requests, estimate 95% intervals, flag token shifts above 25%, and block any security-review regression above 1%. These are local validation settings, not product performance claims.

The immediate decision is to ingest the fields into a quarantined analytics table with versioned semantics, not to publish a productivity leaderboard.

## What the July 17 API changes expose

The [repository metrics announcement](https://github.blog/changelog/2026-07-17-repository-level-github-copilot-usage-metrics-generally-available/) names two one-day repository-report endpoints: `repos-1-day` under the enterprise scope and the same report under the organization scope. Both accept an explicit `day` query value.

The [Copilot app metrics announcement](https://github.blog/changelog/2026-07-17-github-copilot-app-now-available-in-the-usage-metrics-api/) adds distinct active app users and totals for sessions, requests, prompts, prompt tokens, output tokens, and average tokens per request. These fields are exposure evidence: they tell an analyst that a surface was used and at what volume.

The [REST API documentation](https://docs.github.com/en/rest/copilot/copilot-usage-metrics) is the contract to pin. Store response schema version, collection timestamp, report day, organization time zone, repository identity, and raw payload. APIs evolve; derived trends become irreproducible if a field silently changes meaning.

## Comparison table: signal, denominator, and valid decision

This locally constructed table separates the new GitHub signals from the outcomes they are often asked to prove. It is sourced from the [July 17 repository release](https://github.blog/changelog/2026-07-17-repository-level-github-copilot-usage-metrics-generally-available/) and [July 17 app release](https://github.blog/changelog/2026-07-17-github-copilot-app-now-available-in-the-usage-metrics-api/). The valid-decision column is an inference boundary, not GitHub product guidance.

| Signal | Native denominator or unit | Valid operational use | Invalid inference without joined evidence |
|---|---|---|---|
| coding-agent PRs created | repository-day count | locate agent workflow exposure | developer productivity increased |
| coding-agent PRs merged | repository-day count | measure progression through review | merged code was valuable or correct |
| code-review suggestions | count by comment type | audit review workload and response paths | more suggestions mean better review |
| daily active app users | distinct users per day | adoption reach and support planning | active users saved time |
| app session/request/prompt count | event count | detect workflow shape and telemetry breaks | higher volume means higher output |
| prompt/output token sums | tokens per report window | cost and capacity accounting | token efficiency implies task success |
| average tokens per request | arithmetic average | detect abrupt usage-shape changes | lower is universally better |
| null app totals | no reported app activity | preserve missing/not-applicable semantics | safe to coerce into a zero trend |

The rows are not directly comparable measures of productivity: they have different denominators and missing-data semantics, and the API does not report task difficulty, quality, or a counterfactual.

Counts are not rates until a denominator is chosen. Per licensed user, per active contributor, per repository, per work item, and per engineering hour answer different questions. “PRs merged per active Copilot user” is still confounded by task allocation and team composition.

## Build a four-layer measurement system

### Layer 1: exposure and adoption

Use GitHub's native fields for reach, frequency, surface mix, and cost. Report medians and distributions across repositories, not only enterprise totals. Keep app, IDE, coding-agent, and code-review activity separate because they support different work.

Define eligible repositories before analysis. Exclude archived, generated-code, training, vendor mirrors, and policy-blocked repositories or show them as explicit strata. Record when a repository enters or leaves eligibility.

### Layer 2: delivery flow

Join repository-day activity to work-item cycle time, pull-request review time, change failure rate, deployment frequency, rollback, and incident recovery. The [DORA metrics guidance](https://dora.dev/guides/dora-metrics-four-keys/) frames delivery performance as a balance of throughput and stability, not output volume alone.

Do not treat DORA metrics as individual performance scores. Release cadence and failure rates belong to a sociotechnical system. Repository comparisons need service criticality, deployment model, team size, and change type.

### Layer 3: quality and risk

Track escaped defects, severity-weighted security findings, rollback-causing changes, flaky-test changes, review rework, dependency policy violations, and maintainability signals. Normalize by appropriate opportunity counts such as deployed changes or reviewed pull requests.

A coding agent can shorten time to first patch while increasing review burden. Measure human review minutes, revision rounds, rejected suggestions, and post-merge remediation. A merged agent PR is an intermediate event.

### Layer 4: developer experience

Use privacy-preserving surveys and interviews to measure cognitive load, flow, trust, learning, autonomy, and frustration. The [SPACE framework paper](https://queue.acm.org/detail.cfm?id=3454124) explicitly rejects one-dimensional productivity measurement and organizes evidence across satisfaction, performance, activity, communication, and efficiency.

Keep survey participation voluntary and reporting aggregated. Link responses to telemetry only under a reviewed protocol with minimum cohort sizes and clear retention limits.

## Attribution: what would change the decision

The strongest design is randomized encouragement. Randomize teams or repositories to receive enablement, templates, office hours, and workflow nudges while access remains available to all. Compare intention-to-treat outcomes, record actual exposure, and preregister primary outcomes and guardrails.

If randomization is impossible, use a staggered rollout with event-study diagnostics, matched repositories, and pre-trend checks. Avoid a simple before/after chart: product launches, staffing, release freezes, and repository migrations can move both adoption and outcomes.

Select the unit of assignment to limit spillover. Randomizing individuals inside one tightly collaborating team can contaminate the control group because code, prompts, and review practices are shared. Repository assignment may fail when teams work across repositories. Team-level assignment is often more interpretable but needs more clusters.

Report uncertainty at the assignment level. Thousands of pull requests do not create thousands of independent treatment units when policy changed for twelve teams. This is the same dependency error that makes repository-clustered evaluation differ from item-level resampling.

## An engineering decision matrix

The experimental designs below combine the [SPACE framework](https://queue.acm.org/detail.cfm?id=3454124) and [DORA guidance](https://dora.dev/guides/dora-metrics-four-keys/) with the July telemetry contract.

| Question | Minimum design | Primary outcome | Guardrail and stop rule |
|---|---|---|---|
| should we expand coding-agent access? | team-cluster randomized encouragement | median work-item cycle time on eligible task classes | no increase in severity-weighted defects or review burden |
| should code review run by default? | repository crossover with stable reviewer policy | actionable findings confirmed by humans | false-positive load and review latency remain within margin |
| should we fund enablement? | staggered enablement with pre-trend audit | successful adoption plus developer-experience change | no small-cohort surveillance or forced prompt targets |
| should we change the default model? | paired task canary with frozen routing | task success, cost, latency, and rework | rollback on any critical-quality slice |

The table deliberately avoids a universal threshold. A regulated service and an internal prototype should not share the same defect or review-load budget.

## Privacy, governance, and Goodhart risk

Metrics alter behavior. If prompt count becomes a target, engineers will produce prompts. If merged agent PRs become a performance score, work will be split into smaller pull requests and unattributed use will move elsewhere. The [original Goodhart formulation](https://www.bankofengland.co.uk/-/media/boe/files/paper/1984/problems-of-monetary-management-the-uk-experience.pdf) predates coding agents, but its measurement warning applies: a control target stops behaving like an informative measure.

Restrict raw access. Repository names can reveal acquisitions, security incidents, or unreleased products. Small-team repository metrics can approximate individual behavior. Enforce minimum cohort sizes, suppress sparse cells, aggregate over time, and prohibit employment decisions from activity telemetry.

Document purpose, owners, retention, allowed joins, and deletion. The [NIST Privacy Framework](https://www.nist.gov/privacy-framework) provides a risk-management structure; it does not authorize collecting every available field.

## Failure modes and comparability limits

Repository metrics can move because code was transferred, a monorepo was split, permissions changed, the Copilot metrics policy was disabled, or a surface began reporting fields that were previously absent. App `null` values need explicit missingness handling. Do not interpolate them as known zeros.

Pull-request counts mix bug fixes, generated updates, refactors, experiments, and product features. Merge standards differ by repository. Review suggestions differ by comment type and may be duplicated, dismissed, or superseded. Token counts differ by model, context construction, caching, and tool protocol.

The July fields do not publish an experimental effect. GitHub's earlier controlled research found benefits in bounded tasks, including a [2023 randomized study of a coding task](https://github.blog/news-insights/research/research-quantifying-github-copilots-impact-on-developer-productivity-and-happiness/), but that setting cannot be transported automatically to long-running agents, repository review, or a specific organization. Treat older studies as hypotheses and design references.

## Production Readiness, rollout, and rollback

Begin with schema validation and a 30-day shadow dashboard visible only to the measurement team. Reconcile raw counts with known activity, permission changes, repository transfers, and `null` semantics. Freeze derived metric definitions in code review.

Next, run an A/A test: randomly label comparable units without changing access. Any “effect” exposes imbalance, pipeline leakage, seasonality, or incorrect uncertainty. Only then start an encouragement or rollout study.

Rollback the measurement program—not only the agent—if sparse cells reveal individuals, metrics are used for performance management, schema changes break comparability, or the joined quality data cannot be audited. Roll back agent expansion if primary delivery gains fail, review burden crosses its margin, or a critical defect/security stratum worsens.

Keep the activity dashboard after rollback only if its purpose remains support, cost, and capacity planning. Remove incentive targets tied to prompts, tokens, sessions, suggestions, or PR counts.

## When not to use these metrics

Do not use the API to rank developers, determine compensation, infer hours worked, or compare unrelated repositories. Do not claim ROI from token counts without cost, outcome, and counterfactual evidence. Do not compare a 28-day active-user report with a one-day repository event count as though they share a denominator.

Small organizations without enough assignment units may learn more from structured task audits, blinded artifact review, and qualitative workflow studies than from a noisy causal panel. Security-sensitive repositories may reasonably remain excluded from centralized analytics.

## Strongest counterargument and weakest claim

The strongest counterargument is that waiting for causal evidence delays obvious enablement while teams already report value. The response is not paralysis. Use adoption data for support and cost immediately, expand low-risk access with guardrails, and reserve causal language for designs that can support it.

The weakest claim is that repository-level metrics create a foundation for AI-readiness reporting. GitHub uses that framing, but “readiness” has no metric definition in the announcement. The article therefore treats the endpoints as necessary observability, not a validated readiness score.

The largest adoption barrier is the join: repository identity, work items, deployments, incidents, quality findings, surveys, eligibility, team assignment, and policy changes rarely share clean keys or retention rules. A credible measurement system is a data-governance project, not a dashboard query.

## Source ledger

- [GitHub repository-level metrics release](https://github.blog/changelog/2026-07-17-repository-level-github-copilot-usage-metrics-generally-available/), July 17, 2026.
- [GitHub Copilot app metrics release](https://github.blog/changelog/2026-07-17-github-copilot-app-now-available-in-the-usage-metrics-api/), July 17, 2026.
- [GitHub Copilot usage metrics REST API](https://docs.github.com/en/rest/copilot/copilot-usage-metrics), accessed July 20, 2026.
- [DORA Four Keys guide](https://dora.dev/guides/dora-metrics-four-keys/), accessed July 20, 2026.
- [SPACE framework, ACM Queue](https://queue.acm.org/detail.cfm?id=3454124), March 2021.
- [GitHub randomized Copilot task study](https://github.blog/news-insights/research/research-quantifying-github-copilots-impact-on-developer-productivity-and-happiness/), July 12, 2023.
- [NIST Privacy Framework](https://www.nist.gov/privacy-framework), maintained framework, accessed July 20, 2026.
- [Goodhart, monetary-management paper](https://www.bankofengland.co.uk/-/media/boe/files/paper/1984/problems-of-monetary-management-the-uk-experience.pdf), 1984; included for the measurement-control principle, not AI-specific evidence.
- [Microsoft Research, developer productivity with generative AI](https://www.microsoft.com/en-us/research/publication/the-impact-of-ai-on-developer-productivity-evidence-from-github-copilot/), accessed July 20, 2026: prior causal-study context and transport limits.

Only the first three sources define the July API. Older research and frameworks matter because the release supplies activity telemetry but not a productivity estimand, experimental design, privacy policy, or balanced outcome model.
