# Agent App Manifest Risk Gates

This project supports the July 3, 2026 article-production run. It evaluates
manifest and consent controls for agent-facing apps, MCP servers, and A2A-style
agent cards.

The experiment is deterministic and uses a static JSON dataset. It does not use
model inference, API keys, cloud services, or torch.

Run:

```sh
node run-experiment.mjs
```

Artifacts:

- `dataset.json`: fourteen app, MCP server, and agent-card release records.
- `run-experiment.mjs`: policy evaluator and SVG chart renderer.
- `output.txt`: concise measurement output.
- `results.json`: policy metrics and case-level decisions.
- `chart.svg`: article visual for the measured candidate.
