# MCP Tool Catalog Gates

This internal project supports the July 3, 2026 article-production run. It
compares three MCP tool-catalog policies over a small deterministic fixture:
unfiltered tools, namespace-only filtering, and a capability gate.

The harness does not call a local model service, external API, torch, CUDA, or
CPU ML inference. It is a transparent policy simulation that makes catalog
trade-offs inspectable before an agent is allowed to see a large tool surface.

Run:

```sh
/Applications/Codex.app/Contents/Resources/cua_node/bin/node run-experiment.mjs
```

Artifacts:

- `dataset.json`: tool and task fixture.
- `run-experiment.mjs`: deterministic scorer.
- `output.txt`: terminal-style output for the public article.
- `results.json`: structured policy metrics and per-task details.
- `chart.svg`: chart used as the article visual source.
