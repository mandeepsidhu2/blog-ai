# Latest AI Article Production Run: MCP Tool Catalog Gates

Run time: 2026-07-03 07:28 EDT

## Summary

Produced and promoted two customer-facing AI-agent articles about Model Context
Protocol tool-catalog gates:

- `mcp-tool-catalog-gates-2026`: `Design MCP Tool Catalog Gates for Agents`
- `measure-mcp-tool-catalog-gates`: `Measure MCP Tool Catalog Gates`

Both candidates passed the temporary candidate public-content gate and were
promoted into `content/articles/` and `content/assets/`. The run used no local
model service, no torch workload, no CUDA, no CPU ML experiment, and no cloud
resource commands.

## Source Signals Reviewed

Primary and high-signal sources:

- MCP specification, 2025-06-18:
  `https://modelcontextprotocol.io/specification/2025-06-18`
- MCP authorization:
  `https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization`
- MCP tools:
  `https://modelcontextprotocol.io/specification/2025-06-18/server/tools`
- MCP introduction:
  `https://modelcontextprotocol.io/docs/getting-started/intro`
- OpenAI Agents SDK MCP docs:
  `https://openai.github.io/openai-agents-python/mcp/`
- GitHub Copilot MCP docs:
  `https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp-in-your-ide/extend-copilot-chat-with-mcp`
- MCP-Persona:
  `https://arxiv.org/abs/2606.02470`
- ComplexMCP:
  `https://arxiv.org/abs/2605.10787`
- MCP tool-description benchmark:
  `https://arxiv.org/abs/2602.14878`

Discovery inputs:

- Official MCP specification repository and reference server activity were used
  as public community signals around adoption and tool-catalog surface area.
- Search across public developer/community discussion was used only to identify
  recurring themes: MCP server onboarding, tool poisoning, security boundaries,
  weak tool descriptions, and catalog-size pressure. Public copy is grounded in
  official documentation and benchmark papers, not viral claims.

## Candidate Batch

Temporary batch directory:

- `/tmp/blog-ai-article-run-20260703-mcp-tool-catalog/`

Candidates:

| Slug | Title | Mode | Result |
| --- | --- | --- | --- |
| `mcp-tool-catalog-gates-2026` | `Design MCP Tool Catalog Gates for Agents` | `strategy` | Passed and promoted |
| `measure-mcp-tool-catalog-gates` | `Measure MCP Tool Catalog Gates` | `experiment` | Passed and promoted |

Public topic and tags are customer-facing AI-agent, MCP, tool-use, security,
eval, and observability metadata. Internal production labels are not exposed in
public article copy.

## Experiment Artifacts

Internal evidence project:

- `operator/diy-project-blogs/projects/mcp-tool-catalog-gates/`

Artifacts:

- `dataset.json`: twenty-four MCP-style tools and fourteen task replay cases.
- `run-experiment.mjs`: deterministic policy harness.
- `output.txt`: terminal-style measured output.
- `results.json`: structured policy metrics and per-task details.
- `chart.svg`: visual asset source for the measured article.
- `README.md`: reproduction notes.

Measured result:

```output
MCP tool catalog gate experiment
tools=24 tasks=14
allTools: exact_visible=14/14 exact_visible_rate=1 selection_accuracy=1 unsafe_selections=0 unsafe_alternatives=235 mean_visible_tools=24 p95_latency_ms=1740
namespaceOnly: exact_visible=14/14 exact_visible_rate=1 selection_accuracy=1 unsafe_selections=0 unsafe_alternatives=23 mean_visible_tools=3.07 p95_latency_ms=1740
capabilityGate: exact_visible=14/14 exact_visible_rate=1 selection_accuracy=1 unsafe_selections=0 unsafe_alternatives=0 mean_visible_tools=1 p95_latency_ms=1740
```

No LM Studio or other local model inference was used, so model load/unload
hygiene was not triggered. No torch experiment was used.

## Gates And Review

Candidate gate:

- Passed:
  `/Applications/Codex.app/Contents/Resources/cua_node/bin/node operator/scripts/check-public-content.mjs --articles-dir /tmp/blog-ai-article-run-20260703-mcp-tool-catalog/articles --assets-dir /tmp/blog-ai-article-run-20260703-mcp-tool-catalog/assets --source-label latest-ai-article-production`

Committed-source gates:

- Passed:
  `/Applications/Codex.app/Contents/Resources/cua_node/bin/node operator/scripts/check-public-content.mjs`
- Passed:
  `SITE_URL=https://learn.toolsite.com /Applications/Codex.app/Contents/Resources/cua_node/bin/node app-scripts/build-site.mjs`
- Passed:
  `/Applications/Codex.app/Contents/Resources/cua_node/bin/node app-scripts/check-site.mjs`
- Passed: generated public-output scan for blocked internal labels, private
  paths, local-model diagnostics, and local fetch failures.
- Passed: generated HTML spot check for both new article pages.
- Passed: generated JSON spot check for both new article payloads.
- Passed: `git diff --check`.

Browser review:

- Local preview required outside-sandbox execution because sandboxed bind to
  `127.0.0.1:4173` failed with `EPERM`; ports `4173` and `4174` were already
  in use, so the review server ran on `127.0.0.1:4183`.
- Desktop review passed for both article pages after fixing the measured chart
  spacing.
- Mobile review at 390px passed for both article heroes: images loaded,
  `object-fit: contain` was applied, and there was no horizontal overflow.
- Home page loaded and contained links to both new MCP articles. The visible
  home spotlight in the working tree came from unrelated untracked article
  files already present during validation, so this report does not treat that
  spotlight as this run's evidence.

## Workspace Notes

Pre-existing or unrelated workspace changes were left unstaged and untouched:

- modified `README.md`
- modified `docs/INFRASTRUCTURE.md`
- modified `app-scripts/build-site.mjs`
- modified `site/assets/styles.css`
- unrelated untracked article/evidence batches including agent-app,
  cybersecurity-agent, and smart-contract-agent candidates

This run stages only the MCP tool-catalog articles, assets, evidence project,
and this report.

## Intervention Needed

No content intervention is needed for the MCP candidates. The only operational
note is that the workspace contains unrelated unstaged and untracked changes
that should be reviewed separately before any broad cleanup.
