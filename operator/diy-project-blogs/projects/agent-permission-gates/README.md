# Agent Permission Gates

This internal project measures release-gate policies for delegated AI agents.
It uses a deterministic dataset rather than local model inference. The run does
not require torch, CUDA, CPU ML execution, LM Studio, or a local model catalog.

## Method

- Encode twelve representative delegated-agent tasks.
- Compare three permission policies: open delegation, approval-only, and a
  capability gate.
- Score each policy against expected decisions using unsafe grant count,
  over-block count, pass rate, and weighted risk cost.

## Run

```sh
/Applications/Codex.app/Contents/Resources/cua_node/bin/node run-experiment.mjs
```

## Artifacts

- `dataset.json`: task fixtures.
- `results.json`: policy-level and task-level measurements.
- `output.txt`: console output copied into candidate article text.
- `chart.svg`: chart derived from the same results.
