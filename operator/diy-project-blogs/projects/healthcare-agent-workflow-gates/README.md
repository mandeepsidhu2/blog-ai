# Healthcare Agent Workflow Gates

This internal evidence project measures route-level release gates for healthcare
AI agents. It uses a deterministic JavaScript harness rather than live model
inference so the results are reproducible without local model services, torch,
CUDA, or CPU ML training.

Run:

```sh
/Users/mandeepsidhu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node run-experiment.mjs
```

Inputs:

- `tasks.json`: 18 representative health workflow tasks inspired by current
  healthcare-agent benchmark and assurance signals.

Outputs:

- `output.txt`: console summary used in the public tutorial.
- `results.json`: full per-policy and per-case scoring details.
- `healthcare-agent-workflow-gates.svg`: chart copied into article assets when
  the article batch passes gates.

No LM Studio/local model inference was used. No torch work was introduced, so
the MPS-only rule was not triggered.
