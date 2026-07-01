# Agent Concurrency Budget Gates

This internal project measures release policies for concurrent agent work. It
uses deterministic fixtures instead of live model inference so the run is
reproducible and does not depend on local model availability.

## Files

- `dataset.json`: twelve inspectable agent-work traces.
- `run-experiment.mjs`: deterministic policy evaluator.
- `results.json`: generated detailed metrics.
- `output.txt`: generated terminal summary.
- `chart.svg`: generated visual asset for the measured article.

## Run

```sh
/Applications/Codex.app/Contents/Resources/cua_node/bin/node run-experiment.mjs
```

No LM Studio service, local model, torch runtime, CUDA, or CPU ML experiment is
used. If this project is extended with torch later, it must use MPS only and
stop if MPS is unavailable.
