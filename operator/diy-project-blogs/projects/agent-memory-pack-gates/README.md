# Agent Memory Pack Gates

This internal project measures deterministic policies for building compact
agent memory packs. The goal is to test whether a governed packer can preserve
task-critical facts while excluding stale, unsupported, secret-like, or
cross-tenant context.

Run:

```sh
node operator/diy-project-blogs/projects/agent-memory-pack-gates/run-experiment.mjs
```

Artifacts:

- `dataset.json`: eight labeled memory-pack scenarios.
- `run-experiment.mjs`: deterministic packers and metric calculation.
- `output.txt`: concise measured output.
- `results.json`: full case-level results.
- `chart.svg`: chart for candidate article review.

No local model inference, cloud service, torch workload, or external network
dependency is required.
