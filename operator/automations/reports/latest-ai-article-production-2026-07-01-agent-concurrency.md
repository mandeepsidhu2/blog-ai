# Latest AI Article Production Run: Agent Concurrency Gates

Run time: 2026-07-01 15:01:00 EDT

## Sources Reviewed

Primary and high-signal sources used for candidate selection and article
grounding:

- https://developers.openai.com/codex/concepts/subagents
- https://developers.openai.com/codex/agent-approvals-security
- https://developers.openai.com/codex/concepts/sandboxing/auto-review
- https://openai.github.io/openai-agents-python/tracing/
- https://developers.openai.com/api/docs/guides/agent-evals
- https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent
- https://code.claude.com/docs/en/security
- https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
- https://arxiv.org/abs/2606.10484
- https://arxiv.org/abs/2606.26959

Public community and news searches around Codex subagents, usage limits,
approval friction, MCP authorization, and agent fanout were used only as
discovery inputs. No community-only claim was treated as authoritative without
official documentation or research support.

## Candidates

Passing candidates promoted into committed source:

- `agent-concurrency-release-gates-2026`: Build Release Gates for Concurrent AI
  Agent Work (`evidenceMode: strategy`)
- `measure-agent-concurrency-budget-gates`: Measure Agent Concurrency Budget
  Gates (`evidenceMode: experiment`)

No additional candidates were promoted. The run favored one source-grounded
operating-model article and one measured companion tutorial to stay within the
daily quality cap.

## Experiment Artifacts

Created internal evidence project:

- `operator/diy-project-blogs/projects/agent-concurrency-budget-gates/`

Artifacts:

- `dataset.json`: twelve inspectable agent-work traces.
- `run-experiment.mjs`: deterministic comparison of parallel-default,
  write-aware, and budgeted-gate concurrency policies.
- `output.txt`: measured terminal output.
- `results.json`: detailed policy and per-case results.
- `chart.svg`: chart used as the measured article asset.

Measured output:

```output
Agent concurrency budget experiment
tasks=12
parallelDefault: pass_rate=0.5 expected_match=0.5 total_minutes=254 token_units=328337 quality_misses=6 review_misses=6
writeAware: pass_rate=0.583 expected_match=0.5 total_minutes=597 token_units=303144 quality_misses=5 review_misses=1
budgetedGate: pass_rate=1 expected_match=0.917 total_minutes=1710 token_units=237438 quality_misses=0 review_misses=0
```

No local model service was used. No torch work was used, so MPS availability
checks were not triggered.

## Gates And Review

Candidate batch:

- Passed `operator/scripts/check-public-content.mjs --articles-dir
  /tmp/blog-ai-article-run-20260701-agent-concurrency/articles --assets-dir
  /tmp/blog-ai-article-run-20260701-agent-concurrency/assets --source-label
  latest-ai-article-production`.

Committed source:

- Passed `operator/scripts/check-public-content.mjs` for 11 articles.
- Passed `SITE_URL=https://learn.toolsite.com
  /Applications/Codex.app/Contents/Resources/cua_node/bin/node
  app-scripts/build-site.mjs` with 11 tutorials built into `dist`.
- Passed `app-scripts/check-site.mjs`.
- Generated-output scan found no blocked internal labels, local diagnostics,
  private paths, local model endpoint references, or AWS profile references.
- Browser review passed for home plus both new article pages: article images
  loaded at useful dimensions, TOCs were present, generated pages included the
  new slugs, and browser console error count was zero.

The local preview server required outside-sandbox execution because the
sandboxed bind to `127.0.0.1:4173` failed with `EPERM`.

## Intervention Needed

None for content production. The normal GitHub pipeline path should publish the
committed articles after push.
