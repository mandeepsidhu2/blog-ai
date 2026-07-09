# Computer-Use Agent Action Gates

This internal evidence project measures route-level release gates for
computer-use agents that operate browser, desktop, and SaaS workflows. It uses
a deterministic JavaScript harness rather than live model inference so the
results are reproducible without local model services, torch, CUDA, or CPU ML
training.

Run:

```sh
node run-experiment.mjs
```

Inputs:

- `tasks.json`: 18 representative computer-use workflow tasks inspired by
  current OSWorld 2.0, SaaS-Bench, GUI-agent, AI-browser, and computer-use tool
  signals.

Outputs:

- `output.txt`: console summary used in the public tutorial.
- `results.json`: full per-policy and per-case scoring details.
- `computer-use-agent-action-gates.svg`: chart copied into article assets when
  the article batch passes gates.

No LM Studio/local model inference was used. No torch work was introduced, so
the MPS-only rule was not triggered.
