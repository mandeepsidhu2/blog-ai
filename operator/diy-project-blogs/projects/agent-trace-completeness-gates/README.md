# Agent Trace Completeness Gates

This internal evidence project measures whether a release gate that inspects
structured agent traces catches risky coding-agent behavior better than gates
that inspect only final summaries or command logs.

The dataset contains sixteen labeled scenarios covering missing checks,
out-of-scope writes, cloud-mutating commands, visual changes without browser
evidence, failing site checks, secret-like values, missing rollback plans,
missing artifact digests, budget overruns, and incomplete handoff notes.

Run:

```sh
/Applications/Codex.app/Contents/Resources/cua_node/bin/node run-experiment.mjs
```

Outputs:

- `results.json`: per-gate predictions and aggregate metrics.
- `output.txt`: concise reproducibility summary.
- `chart.svg`: article-ready chart of accuracy, block recall, and
  false-negative rate.

No local model inference, AWS, Terraform, OpenTofu, CUDA, CPU torch, or MPS
torch work is used by this project.
