# Latest AI Article Production Run: Agent Permission Gates

Run time: 2026-06-29 14:22 EDT

## Summary

Ran the scheduled article-production workflow after reading the required repo
instructions and automation docs. The run produced a temporary candidate batch
focused on delegated-agent permission boundaries and a durable internal
evidence project. The candidate public-content gate passed for two articles,
but the candidates were not promoted because the repo already contains two
public articles dated 2026-06-29, which reaches the project daily publication
cap.

No local model inference, LM Studio workflow, torch run, CUDA run, or CPU ML
experiment was used. The MPS-only rule was therefore not triggered. No AWS,
Terraform, OpenTofu, S3, or CloudFront command was run.

## Sources Reviewed

Primary and high-signal sources:

- OpenAI Codex developer documentation: https://developers.openai.com/codex/
- GitHub Copilot coding agent documentation:
  https://docs.github.com/en/copilot/concepts/coding-agent/coding-agent
- GitHub Copilot cloud agent risks and mitigations documentation:
  https://docs.github.com/en/copilot/concepts/agents/cloud-agent/risks-and-mitigations
- Anthropic Claude Code security documentation:
  https://docs.anthropic.com/en/docs/claude-code/security
- Model Context Protocol authorization specification:
  https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
- Model Context Protocol security best practices:
  https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices
- Agent2Agent protocol specification:
  https://a2a-protocol.org/latest/specification/

Public community/social discovery inputs:

- Hacker News and Reddit searches around MCP permissions, prompt injection,
  coding-agent repository writes, and tool-server trust.
- GitHub issue/discussion searches around MCP authorization, tool poisoning,
  consent, and agent audit traces.

Community/social signals were used only for discovery. The candidate claims and
recommendations were grounded in official documentation and protocol material.

## Candidate Batch

Temporary batch directory:

`/tmp/blog-ai-article-run-20260629-agent-permissions/`

Candidate articles:

- `agent-permission-release-gates-2026`: "Release Gates for Agent Permission
  Boundaries in AI Systems"
- `measure-agent-permission-gates`: "Measure Agent Permission Gates for
  Delegated AI Work"

Temporary assets:

- `/tmp/blog-ai-article-run-20260629-agent-permissions/assets/agent-permission-release-gates-2026.svg`
- `/tmp/blog-ai-article-run-20260629-agent-permissions/assets/measure-agent-permission-gates.svg`

Promotion decision: not promoted. The project memory and current content show
two 2026-06-29 articles already promoted today:

- `inference-cost-release-gates-2026`
- `measure-token-budget-routing`

The new candidates are retained only as temporary batch artifacts for this run.

## Experiment Artifacts

Created internal evidence project:

- `operator/diy-project-blogs/projects/agent-permission-gates/README.md`
- `operator/diy-project-blogs/projects/agent-permission-gates/dataset.json`
- `operator/diy-project-blogs/projects/agent-permission-gates/run-experiment.mjs`
- `operator/diy-project-blogs/projects/agent-permission-gates/results.json`
- `operator/diy-project-blogs/projects/agent-permission-gates/output.txt`
- `operator/diy-project-blogs/projects/agent-permission-gates/chart.svg`

Experiment output:

```output
Agent permission gate experiment
tasks=12
openDelegation: pass_rate=0.833 unsafe_under_grants=2 over_blocks=0 total_risk_cost=28
approvalOnly: pass_rate=0.75 unsafe_under_grants=3 over_blocks=0 total_risk_cost=42
capabilityGate: pass_rate=0.917 unsafe_under_grants=0 over_blocks=1 total_risk_cost=2
```

The experiment used the Codex-bundled Node runtime because `node` is not on
PATH in this shell:

`/Applications/Codex.app/Contents/Resources/cua_node/bin/node`

## Gates And Checks

Candidate public-content gate:

```output
Public content gate passed for 2 articles in latest-ai-article-production.
```

Committed-source public-content gate:

```output
Public content gate passed for 7 articles in public content.
```

Build and generated-site checks were not run because no candidates were
promoted into committed public content during this run.

## Intervention Needed

No intervention is needed. The next run can revisit the temporary candidate
batch if the daily article cap is clear and the topic still remains current.
