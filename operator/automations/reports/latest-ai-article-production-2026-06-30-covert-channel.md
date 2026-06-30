# Latest AI Article Production Run: Covert-Channel Agent Traces

Run time: 2026-06-30 11:47:05 EDT

## Sources Reviewed

Primary and high-signal sources used for candidate selection and article
grounding:

- https://arxiv.org/abs/2606.28425
- https://arxiv.org/abs/2606.29073
- https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices
- https://openai.github.io/openai-agents-python/guardrails/
- https://openai.github.io/openai-agents-python/tracing/
- https://code.claude.com/docs/en/security
- https://genai.owasp.org/llm-top-10/

Public community/social searches were used only for discovery around MCP risk,
agent prompt injection, tool metadata, and multi-agent hidden-channel claims.
No community-only claim was treated as authoritative without primary-source or
security-research support.

## Candidates

Passing candidates promoted into committed source:

- `covert-channel-agent-gates-2026`: Build Covert-Channel Release Gates for
  Tool-Using Agents (`evidenceMode: strategy`)
- `measure-covert-channel-agent-traces`: Measure Covert-Channel Risk in Agent
  Tool Traces (`evidenceMode: experiment`)

No additional candidates were promoted. Quality and daily cap constraints
favored one source-led article and one measured companion tutorial.

## Experiment Artifacts

Created internal evidence project:

- `operator/diy-project-blogs/projects/covert-channel-agent-traces/`

Artifacts:

- `dataset.json`: twelve inspectable tool-event traces.
- `run-experiment.mjs`: deterministic comparison of content-only,
  tool-boundary, and trace-budget policies.
- `output.txt`: measured terminal output.
- `results.json`: detailed policy and per-case results.
- `chart.svg`: chart used as the measured article asset.

Measured output:

```output
Covert-channel trace gate experiment
events=12
contentOnly: accuracy=0.25 mean_score=0.417 blocked=0 reviewed=4 allowed=8 false_negatives=4 false_positives=0
toolBoundary: accuracy=0.917 mean_score=0.958 blocked=3 reviewed=6 allowed=3 false_negatives=1 false_positives=0
traceBudget: accuracy=1 mean_score=1 blocked=4 reviewed=5 allowed=3 false_negatives=0 false_positives=0
```

No local model service was used. No torch work was used, so MPS availability
checks were not triggered.

## Gates And Review

Candidate batch:

- Passed `operator/scripts/check-public-content.mjs --articles-dir
  /tmp/blog-ai-article-run-20260630-covert-channel/articles --assets-dir
  /tmp/blog-ai-article-run-20260630-covert-channel/assets --source-label
  latest-ai-article-production`.

Committed source:

- Passed `operator/scripts/check-public-content.mjs` for 9 articles.
- Passed `SITE_URL=https://learn.toolsite.com node app-scripts/build-site.mjs`
  with 9 tutorials built into `dist`.
- Passed `app-scripts/check-site.mjs`.
- Generated-output scan found no blocked internal labels, local diagnostics,
  private paths, local model endpoint references, or AWS profile references.
- Browser review passed for the home spotlight and both article pages:
  article images loaded, rendered at useful sizes, TOCs were present, and
  browser console error count was zero.

The local preview server required outside-sandbox execution because the
sandboxed bind to `127.0.0.1:4173` failed with `EPERM`.

## Intervention Needed

None for content production. The repository had unrelated pre-existing
working-tree changes before this run; they were intentionally excluded from the
article-production commit.
