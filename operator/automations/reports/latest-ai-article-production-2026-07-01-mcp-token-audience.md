# Latest AI Article Production Report - 2026-07-01 MCP Token Audience

Run time: 2026-07-01 14:52-16:10 EDT

## Summary

Produced two passing MCP authorization candidates from current agent-security
signals around MCP authorization, OAuth resource indicators, protected resource
metadata, token audience validation, and token passthrough risks.

The candidates passed the temporary public-content gate but were not promoted
into committed public content because the automation memory showed an earlier
2026-07-01 run had already promoted two articles, meeting the daily publication
cap. Public source was returned to the existing 11-article state before final
checks and commit.

No local model inference was used. No torch work was used, so the MPS-only torch
rule was not triggered. No AWS, Terraform, OpenTofu, S3 sync, or CloudFront
commands were run.

## Sources Reviewed

- MCP authorization specification:
  https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
- MCP security best practices:
  https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices
- RFC 8707, Resource Indicators for OAuth 2.0:
  https://www.rfc-editor.org/rfc/rfc8707.html
- RFC 9728, OAuth 2.0 Protected Resource Metadata:
  https://www.rfc-editor.org/rfc/rfc9728.html
- RFC 8414, OAuth 2.0 Authorization Server Metadata:
  https://www.rfc-editor.org/rfc/rfc8414.html
- From Tool Connection to Execution Control:
  https://arxiv.org/abs/2606.29073
- Tool Use Enables Undetectable Steganography in Multi-Agent LLM Systems:
  https://arxiv.org/abs/2606.28425
- OWASP GenAI Security Project:
  https://genai.owasp.org/llm-top-10/
- OpenAI Agents SDK guardrails and tracing:
  https://openai.github.io/openai-agents-python/guardrails/
  https://openai.github.io/openai-agents-python/tracing/
- Anthropic Claude Code security controls:
  https://code.claude.com/docs/en/security

Public Hacker News, Reddit, and GitHub searches around MCP authorization,
token audience, token passthrough, prompt injection, and connector trust were
used as discovery inputs only. Public claims were not treated as authoritative
without primary-source support.

## Candidates

- `mcp-resource-authorization-gates-2026`
  - Title: Build Resource-Bound Authorization Gates for MCP Agents
  - Internal source mode: strategy
  - Status: passed candidate gate; not promoted because the 2026-07-01 daily
    article cap was already met by an earlier run.
  - Temporary files:
    - `/tmp/blog-ai-article-run-20260701-mcp-token-audience/articles/mcp-resource-authorization-gates-2026.md`
    - `/tmp/blog-ai-article-run-20260701-mcp-token-audience/assets/mcp-resource-authorization-gates-2026.svg`

- `measure-mcp-token-audience-gates`
  - Title: Measure MCP Token Audience Gates for Agent Tools
  - Internal source mode: experiment
  - Status: passed candidate gate; not promoted because the 2026-07-01 daily
    article cap was already met by an earlier run.
  - Temporary files:
    - `/tmp/blog-ai-article-run-20260701-mcp-token-audience/articles/measure-mcp-token-audience-gates.md`
    - `/tmp/blog-ai-article-run-20260701-mcp-token-audience/assets/measure-mcp-token-audience-gates.svg`

No second strategy or second measured candidate was promoted. The verified
source cluster for this run was concentrated around MCP authorization, and the
workflow quality bar favors one or two strong articles over forcing weaker
topic coverage.

## Experiment Artifacts

Created `operator/diy-project-blogs/projects/mcp-token-audience-gates/` with:

- `dataset.json`
- `run-experiment.mjs`
- `results.json`
- `output.txt`
- `chart.svg`
- `README.md`

Measured output:

```output
MCP token audience gate experiment
cases=14
scopeOnly: accuracy=0.5 mean_score=0.75 blocked=1 reviewed=12 allowed=1 false_negatives=7 false_positives=0
audienceOnly: accuracy=0.571 mean_score=0.571 blocked=2 reviewed=5 allowed=7 false_negatives=6 false_positives=0
resourceBound: accuracy=1 mean_score=1 blocked=8 reviewed=5 allowed=1 false_negatives=0 false_positives=0
```

## Gates And Review

- Candidate public-content gate:
  - Initially failed because the measured candidate included an internal project
    path in public copy.
  - Fixed and reran successfully for 2 articles in
    `latest-ai-article-production`.
- Promotion decision:
  - The two passing candidates were briefly copied into `content/articles` and
    `content/assets` for committed-source validation.
  - After rereading automation memory, the public files were removed because an
    earlier 2026-07-01 run had already promoted two articles.
- Committed public-content gate after cap correction:
  - Passed for 11 articles.
- Site build after cap correction:
  - `SITE_URL=https://learn.toolsite.com node app-scripts/build-site.mjs`
  - Passed; built 11 tutorials into `dist`.
- Generated-site check after cap correction:
  - `node app-scripts/check-site.mjs`
  - Passed.
- Generated output blocked-label/local-diagnostic scan:
  - No internal evidence-mode labels, private paths, local model endpoint
    references, AWS profile references, or local fetch failures were found.
- Browser/visual review:
  - Local preview server required outside-sandbox execution because sandboxed
    bind to `127.0.0.1:4173` failed with `EPERM`.
  - Home spotlight image loaded with complete status and nonzero dimensions.
  - While the candidates were temporarily promoted, both new article hero images
    loaded with complete status, nonzero rendered dimensions, descriptive alt
    text, and article TOCs.
  - A focused screenshot capture attempt timed out once in the browser control
    layer; DOM image checks and generated-site image checks passed.

## Notes

- Replaced an unsupported Markdown table in the temporary
  `mcp-resource-authorization-gates-2026` candidate with bullet thresholds after
  generated HTML spot-check showed the local renderer emits table pipes as
  plain text.
- A broader generated-output scan showed the same pre-existing table-rendering
  limitation in older article pages. Those older pages were not changed in this
  run.
- Unrelated pre-existing MacApp working-tree changes were present and were not
  staged for this article-production commit.

## Intervention Needed

No intervention is needed for this run. The MCP candidates are gated and ready
to revisit in a future run when the daily article cap permits promotion.
