# Coding-Agent Task Routing Gates

This internal project supports the July 3, 2026 article-production run. It
measures three coding-agent rollout policies against a small task-routing
dataset:

- `delegateAll`: quick delegation except very small tasks.
- `humanReviewOnly`: conservative review for high-risk or security-sensitive
  work, with broad review elsewhere.
- `taskGate`: route by risk, CI requirement, security sensitivity, product
  judgment, file span, and token budget.

Run:

```sh
/Applications/Codex.app/Contents/Resources/cua_node/bin/node run-experiment.mjs
```

Outputs:

- `output.txt`: console summary used in the public article.
- `results.json`: per-policy and per-task results.
- `routing-gate-results.svg`: chart copied into the candidate asset batch.

No local model service, torch runtime, CUDA, CPU ML experiment, or MPS check is
required. The evidence is a deterministic routing harness.
