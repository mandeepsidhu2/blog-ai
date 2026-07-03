# Coding Agent Rollout Gates

This project measures simple policies for rolling out command-line and cloud
coding agents across engineering teams. It uses deterministic team-level
metadata instead of live model inference.

## Files

- `dataset.json`: team metadata for activity, peer exposure, task fit,
  governance readiness, baseline pull request throughput, and token budget.
- `run-experiment.mjs`: evaluates broad, activity-only, and peer-visible rollout
  policies.
- `output.txt`: terminal output from the latest run.
- `results.json`: structured metrics and per-team decisions.
- `chart.svg`: visual summary used as an inspectable artifact.

## Reproduce

Run:

```sh
/Applications/Codex.app/Contents/Resources/cua_node/bin/node operator/diy-project-blogs/projects/coding-agent-rollout-gates/run-experiment.mjs
```

No local model service, API key, torch, CUDA, or CPU ML inference is used.
