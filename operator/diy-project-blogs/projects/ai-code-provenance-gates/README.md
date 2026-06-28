# AI Code Provenance Gates

This project compares a tests-only merge rule with a provenance-aware release
gate for AI-authored code changes. The dataset models pull-request traces with
changed files, test evidence, trace availability, reviewer coverage, sensitive
paths, and patch size.

Run:

```sh
node run-experiment.mjs
```

Artifacts:

- `dataset.json`: pull-request trace cases and expected release decisions.
- `results.json`: per-case gate decisions and aggregate metrics.
- `output.txt`: compact metric output for article use.
- `chart.svg`: article visual summarizing the gate comparison.
