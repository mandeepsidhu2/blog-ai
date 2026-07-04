# Latest AI Article Production Run: Coding-Agent Task Routing

Run time: 2026-07-03 08:41 EDT

## Summary

Produced and promoted two customer-facing AI agent articles focused on
coding-agent task routing gates. The run stayed within the daily publication
maximum: 10 existing source articles were dated 2026-07-03 before promotion, and
this run added 2 more for a total of 12, below the 50-article limit.

No local model inference was used. No torch work was used, so the MPS-only rule
was not triggered. No AWS, Terraform, OpenTofu, or cloud-mutating commands were
run.

## Sources And Signals Reviewed

- OpenAI Codex Remote engineering workflow:
  https://developers.openai.com/blog/mastering-codex-remote-for-engineering
- OpenAI Codex sandboxing, approvals/security, and subagent documentation:
  https://developers.openai.com/codex/concepts/sandboxing
  https://developers.openai.com/codex/administration/agent-approvals-security
  https://developers.openai.com/codex/concepts/subagents
- GitHub Copilot cloud-agent and risk-mitigation documentation:
  https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent
  https://docs.github.com/en/copilot/concepts/agents/cloud-agent/risks-and-mitigations
- Microsoft July 2026 rollout study of Claude Code and GitHub Copilot CLI:
  https://arxiv.org/abs/2607.01418
- 2026 agentic pull-request outcome and PR-description studies:
  https://arxiv.org/abs/2601.15195
  https://arxiv.org/abs/2602.17084
- Public/community discovery signals around Codex usage-limit regressions and
  developer cost anxiety:
  https://www.businessinsider.com/openai-codex-usage-limit-warroom-fix-issue-2026-6

Community and social reports were used only as discovery inputs and operational
signals. Article claims were grounded in official docs, empirical papers, and
high-signal reporting.

## Candidates

Promoted:

- `coding-agent-task-routing-gates-2026`
  - Title: `Roll Out Coding Agents With Task, Cost, And Review Gates`
  - Source: `/tmp/blog-ai-article-run-20260703-coding-agent-rollout/articles/coding-agent-task-routing-gates-2026.md`
  - Destination: `content/articles/coding-agent-task-routing-gates-2026.md`
  - Asset: `content/assets/coding-agent-task-routing-gates-2026.svg`
  - Internal mode: `strategy`
- `measure-coding-agent-task-routing-gates`
  - Title: `Measure Coding-Agent Task Routing Gates`
  - Source: `/tmp/blog-ai-article-run-20260703-coding-agent-rollout/articles/measure-coding-agent-task-routing-gates.md`
  - Destination: `content/articles/measure-coding-agent-task-routing-gates.md`
  - Asset: `content/assets/measure-coding-agent-task-routing-gates.svg`
  - Internal mode: `experiment`

Temporary same-run draft files that pre-existed in the batch directory were
removed from the candidate batch before validation so the gate covered exactly
the two intended candidates.

## Experiment Artifacts

Created:

- `operator/diy-project-blogs/projects/coding-agent-task-routing-gates/tasks.json`
- `operator/diy-project-blogs/projects/coding-agent-task-routing-gates/run-experiment.mjs`
- `operator/diy-project-blogs/projects/coding-agent-task-routing-gates/output.txt`
- `operator/diy-project-blogs/projects/coding-agent-task-routing-gates/results.json`
- `operator/diy-project-blogs/projects/coding-agent-task-routing-gates/routing-gate-results.svg`
- `operator/diy-project-blogs/projects/coding-agent-task-routing-gates/README.md`

Measured output:

```text
Coding-agent task routing gate experiment
tasks=16
delegateAll: pass_rate=0.438 route_match=0.438 low_confidence=7 high_risk_delegated=5 review_hours=18.21 compute_credits=42.88
humanReviewOnly: pass_rate=0.563 route_match=0.625 low_confidence=2 high_risk_delegated=0 review_hours=29.21 compute_credits=33.67
taskGate: pass_rate=0.688 route_match=0.75 low_confidence=3 high_risk_delegated=1 review_hours=25.21 compute_credits=34.45
```

The public experiment article preserves the limitation that the task gate is
better than the baselines but still not clean enough to promote without
case-level review.

## Gates And Checks

Passed:

- Candidate batch gate:
  `/Applications/Codex.app/Contents/Resources/cua_node/bin/node operator/scripts/check-public-content.mjs --articles-dir /tmp/blog-ai-article-run-20260703-coding-agent-rollout/articles --assets-dir /tmp/blog-ai-article-run-20260703-coding-agent-rollout/assets --source-label latest-ai-article-production`
  - Result: `Public content gate passed for 2 articles in latest-ai-article-production.`
- Committed-source public gate:
  `/Applications/Codex.app/Contents/Resources/cua_node/bin/node operator/scripts/check-public-content.mjs`
  - Result: `Public content gate passed for 27 articles in public content.`
- Site build:
  `SITE_URL=https://learn.toolsite.com /Applications/Codex.app/Contents/Resources/cua_node/bin/node app-scripts/build-site.mjs`
  - Result: `Built 27 tutorials into dist`
- Generated-site check:
  `/Applications/Codex.app/Contents/Resources/cua_node/bin/node app-scripts/check-site.mjs`
  - Result: `Site checks passed.`
- Generated-output blocked-label/local-diagnostic scan:
  - Result: no matches.
- Generated manifest/search/HTML spot checks:
  - Result: both new slugs, article pages, assets, and content JSON payloads are present.
- `git diff --check`
  - Result: passed.

Visual review:

- Full localhost preview could not be completed because sandboxed bind to
  `127.0.0.1:4173` failed with `EPERM`.
- The outside-sandbox preview request was rejected by the approval reviewer due
  to the current Codex usage limit.
- The in-app browser rejected a `data:` visual-review page under browser URL
  policy, so no further browser workaround was attempted.
- Fallback source-level visual checks passed: both promoted SVGs expose
  `<title>`, `<desc>`, 960x540 `viewBox` metadata, no remote linked assets, and
  generated HTML references the expected article assets with containment-ready
  dimensions.

## Intervention Needed

Content is committed locally, but remote push needs intervention.

- Local article commit: `cd36c56` (`Add coding agent task routing articles`)
- Sandboxed `git push origin main` failed because `github.com` DNS resolution
  is blocked in the sandbox.
- Outside-sandbox `git push origin main` was rejected by the approval reviewer
  because the branch is seven commits ahead of `origin/main`; pushing would
  export six earlier local commits in addition to this run's commit.

A full browser preview remains unavailable in this run because of sandbox and
approval-review limits, but mechanical gates and source-level visual checks
passed.
