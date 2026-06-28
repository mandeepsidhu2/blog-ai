# Agent Delegation Release Gates

This internal project measures how three release-gate profiles behave on a
small set of delegated coding-agent task traces.

The goal is to evaluate the operating policy around an agent, not a model. Each
case declares tools, data class, write scope, verification, approvals, and
risk signals. The script compares an optimistic policy, a review-oriented
policy, and a production policy against the expected allow/block disposition.

Run:

```sh
/Applications/Codex.app/Contents/Resources/cua_node/bin/node run-experiment.mjs
```

Artifacts:

- `dataset.json`: task traces and expected dispositions.
- `results.json`: per-profile decisions, reasons, and confusion matrices.
- `output.txt`: aggregate metrics used by the article.
- `chart.svg`: article-supporting chart for the measured result.

This project does not use local model inference or Torch.
