# Latest AI Article Production Run: Agent Trace Contracts

Run time: 2026-07-02 09:30 EDT

## Summary

Produced and promoted two publication-quality AI agent articles focused on
trace contracts for coding-agent release gates. The measured trace-completeness
project gave one strong implementation-backed tutorial and one paired
operating-model tutorial, so the run did not force weaker additional topics.

No local model inference was used. No torch work was used, so the MPS-only
torch rule was not triggered. No AWS, Terraform, OpenTofu, or cloud-mutating
commands were run.

## Source Signals Reviewed

Primary and high-signal sources:

- OpenAI harness engineering:
  https://openai.com/index/harness-engineering/
- OpenAI Codex CLI documentation:
  https://developers.openai.com/codex/cli/
- OpenAI Agents SDK tracing:
  https://openai.github.io/openai-agents-python/tracing/
- OpenAI Agents SDK guardrails:
  https://openai.github.io/openai-agents-python/guardrails/
- Anthropic Claude Code security documentation:
  https://docs.anthropic.com/en/docs/claude-code/security
- GitHub Copilot coding agent documentation:
  https://docs.github.com/en/copilot/concepts/coding-agent/coding-agent
- MCP security best practices:
  https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices
- From Tool Connection to Execution Control:
  https://arxiv.org/abs/2606.29073
- Tool Use Enables Undetectable Steganography in Multi-Agent LLM Systems:
  https://arxiv.org/abs/2606.28425
- Codex and agentic AI in software engineering:
  https://arxiv.org/abs/2606.30560

Public community and social discovery inputs:

- Hacker News searches around Codex, Claude Code, approvals, sandboxing, and
  MCP security.
- Reddit searches around Claude Code permissions, hooks, MCP, and coding-agent
  workflow friction.
- GitHub issue searches around OpenAI Codex approvals/sandboxing/network access
  and Claude Code permissions/hooks/security.

Community signals were used only to identify recurring concerns. Article claims
were grounded in official documentation, protocol guidance, and recent papers.

## Candidate Batch

Temporary batch:

`/tmp/blog-ai-article-run-20260702-agent-trace/`

Promoted candidates:

- `agent-trace-contracts-2026`
  - Title: `Design Trace Contracts for Coding Agent Release Gates`
  - Source: `content/articles/agent-trace-contracts-2026.md`
  - Asset: `content/assets/agent-trace-contracts-2026.svg`
  - Gate result: passed after replacing an internal example path with a
    customer-safe generic path.
- `measure-agent-trace-completeness-gates`
  - Title: `Measure Agent Trace Completeness Gates for Coding Workflows`
  - Source: `content/articles/measure-agent-trace-completeness-gates.md`
  - Asset: `content/assets/measure-agent-trace-completeness-gates.svg`
  - Gate result: passed.

Additional candidates were not forced. The run selected a focused two-article
batch because the source and measurement evidence supported those two strongly.

## Experiment Artifacts

Created internal evidence project:

`operator/diy-project-blogs/projects/agent-trace-completeness-gates/`

Artifacts:

- `README.md`
- `dataset.json`
- `run-experiment.mjs`
- `output.txt`
- `results.json`
- `chart.svg`

Measured output:

```text
dataset_cases=16
dataset_sha256=8434b1e99435cc04cd011e144357b731027ac4e65c4539c45233ee3118a4375b
gate=finalSummaryGate accuracy=0.188 block_recall=0.000 false_negatives=6 review_load=0
gate=commandLogGate accuracy=0.375 block_recall=0.167 false_negatives=5 review_load=7
gate=traceContractGate accuracy=0.938 block_recall=1.000 false_negatives=0 review_load=6
```

## Gates And Review

Candidate gate:

- Initial candidate gate failed for `agent-trace-contracts-2026.md` because an
  example schema included an internal project path.
- Fixed the public copy and reran the candidate gate.
- Final candidate gate passed for 2 articles.

Committed-source gates:

- `node operator/scripts/check-public-content.mjs`: passed for 15 articles.
- `SITE_URL=https://learn.toolsite.com node app-scripts/build-site.mjs`: passed,
  built 15 tutorials.
- `node app-scripts/check-site.mjs`: passed.
- Blocked internal-label/local-diagnostic scan of `dist/`: passed.
- Generated HTML and JSON spot-check: passed for both new article slugs.
- Browser review: passed for home spotlight plus both article hero images.
  Images were complete, visible, and rendered with `object-fit: contain`.
- Browser console review: no warnings or errors reported during the checked
  pages.

Outside-sandbox execution:

- The preview server failed inside the sandbox with `listen EPERM` on
  `127.0.0.1:4173`.
- Outside-sandbox execution was used only to run
  `node app-scripts/serve-dist.mjs` for required local browser visual review.

## Intervention Needed

No intervention is needed. The normal GitHub pipeline path is ready after commit
and push.

## GitHub Pipeline Handoff

- Article-production commit: `db7301c` (`Add agent trace contract articles`).
- Push result: `git push origin main` succeeded after outside-sandbox execution
  was required because sandboxed DNS resolution for `github.com` failed.
- Remote update: `cc8d769..db7301c  main -> main`.
