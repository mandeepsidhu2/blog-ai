# Latest AI Article Production Run: Agent Memory Compaction

Run time: 2026-07-02 12:06 EDT

## Summary

Produced a current-source candidate batch on governed memory compaction for
long-running AI agents and created one measured local evidence project. The
candidate batch passed the public-content gate, but it was not promoted into
committed public content because the repository had already promoted two
articles earlier on 2026-07-02, meeting the repo's daily public-article cap.

No local model inference was used. No torch work was used, so the MPS-only torch
rule was not triggered. No AWS, Terraform, OpenTofu, or cloud-mutating commands
were run.

## Source Signals Reviewed

Primary and high-signal sources:

- OpenAI harness engineering:
  https://openai.com/index/harness-engineering/
- OpenAI Codex CLI and Codex docs navigation for memories, compaction,
  sandboxing, approvals, hooks, `AGENTS.md`, MCP, automation, and governance:
  https://developers.openai.com/codex/cli/
- OpenAI Agents SDK tracing:
  https://openai.github.io/openai-agents-python/tracing/
- GitHub Copilot cloud agent documentation:
  https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent
- GitHub Copilot billing/request documentation and docs navigation around
  memory, hooks, context management, usage limits, budgets, and sandboxes:
  https://docs.github.com/en/copilot/reference/copilot-billing/request-based-billing-legacy/copilot-requests
- MCP security best practices:
  https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices
- The Shift to Agentic AI: Evidence from Codex:
  https://arxiv.org/abs/2606.26959
- Measuring the Permission Gate: A Stress-Test Evaluation of Claude Code's Auto
  Mode:
  https://arxiv.org/abs/2604.04978

Public community and social discovery inputs:

- GitHub issue and documentation searches around Codex memory, compaction,
  `AGENTS.md`, MCP, hooks, and approvals.
- Hacker News and Reddit searches around agent memory, Claude Code permissions,
  approval friction, and usage-cost concerns.

Community signals were used only as discovery inputs. Candidate claims were
grounded in official documentation, protocol guidance, and papers.

## Candidate Batch

Temporary batch:

`/private/tmp/blog-ai-article-run-20260702-memory-compaction/`

Passing candidates deferred by daily cap:

- `agent-memory-compaction-gates-2026`
  - Title: `Design Memory Compaction Gates for Long-Running AI Agents`
  - Topic/tags: `AI Agents`; `ai-agents`, `memory`,
    `context-engineering`, `evals`, `guardrails`, `observability`
  - Asset:
    `/private/tmp/blog-ai-article-run-20260702-memory-compaction/assets/agent-memory-compaction-gates-2026.svg`
  - Gate result: passed.
- `measure-agent-memory-pack-gates`
  - Title: `Measure Memory Pack Gates for Long-Running AI Agents`
  - Topic/tags: `AI Agents`; `ai-agents`, `memory`,
    `context-engineering`, `evals`, `guardrails`, `observability`
  - Asset:
    `/private/tmp/blog-ai-article-run-20260702-memory-compaction/assets/measure-agent-memory-pack-gates.svg`
  - Gate result: initially failed because the article was thin and included an
    internal workspace path in a reproducibility command; fixed in the temporary
    batch and reran successfully.

Additional candidates were not forced. The run produced a focused two-candidate
batch because the source evidence and measured harness supported this topic
strongly, while the daily promotion cap blocked another public-content commit.

## Experiment Artifacts

Created internal evidence project:

`operator/diy-project-blogs/projects/agent-memory-pack-gates/`

Artifacts:

- `README.md`
- `dataset.json`
- `run-experiment.mjs`
- `output.txt`
- `results.json`
- `chart.svg`

Measured output:

```text
Agent memory pack gate experiment
cases=8
dataset_sha256=0dccc5889e8f6de198ca3002a8faf058e1db20aa974e829ca6fdf74dcb731628
packer=newestFirst required_recall=1 perfect_case_rate=0.25 forbidden_hits=6 sensitive_hits=2 unsupported_hits=7 mean_pack_tokens=72.4
packer=relevanceOnly required_recall=1 perfect_case_rate=0.25 forbidden_hits=6 sensitive_hits=2 unsupported_hits=7 mean_pack_tokens=72.4
packer=governedMemoryPack required_recall=1 perfect_case_rate=1 forbidden_hits=0 sensitive_hits=0 unsupported_hits=0 mean_pack_tokens=47.5
```

## Gates And Review

Runtime note:

- Local `node` was not on `PATH`.
- Used the bundled Codex runtime:
  `/Applications/Codex.app/Contents/Resources/cua_node/bin/node`.

Candidate gate:

- Initial candidate gate failed for `measure-agent-memory-pack-gates.md`:
  article depth below the public-content threshold and internal workspace path
  in public copy.
- Fixed the temporary candidate article and reran the candidate gate.
- Final candidate gate passed for 2 articles:
  `Public content gate passed for 2 articles in latest-ai-article-production-memory-compaction.`

Committed-source gates:

- `node operator/scripts/check-public-content.mjs`: passed for 15 existing
  public articles.
- Site build and generated-site checks were not rerun because no candidate was
  promoted into `content/articles` or `content/assets` in this run.

## Promotion Decision

No candidates were promoted. The earlier 2026-07-02 automation run already
promoted two articles, and the repository rule is to publish at most one or two
articles per day. The memory-compaction candidates are gate-clean but deferred
for a future run if still current.

## Intervention Needed

No intervention is needed. The normal article pipeline should wait for the next
publication window before promoting another public article.
