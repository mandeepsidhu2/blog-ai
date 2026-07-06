# Agentic Commerce Payment Gates

This internal evidence project measures policy gates for AI agents that can
initiate purchases. It uses a deterministic JavaScript harness with a static
task set, so it does not require local model inference, torch, CUDA, CPU ML
training, or MPS.

## Files

- `data/tasks.json`: sixteen commerce tasks covering quotes, low-value
  merchant tokens, confirmed purchases, human-review purchases, and blocked
  payment attempts.
- `run-experiment.mjs`: route definitions, three policy implementations,
  scoring logic, and artifact generation.
- `artifacts/output.txt`: console output from the latest run.
- `artifacts/results.json`: per-policy metrics and per-case traces.
- `artifacts/payment-gate-results.svg`: chart used by the measured article.

## Latest Results

The latest run compares `savedCardDelegation`, `merchantScopedToken`, and
`mandatePaymentGate`:

- `savedCardDelegation`: broad saved-card authority; high convenience but
  unsafe execution on blocked or confirmation-required tasks.
- `merchantScopedToken`: narrower merchant and amount controls; better than
  broad delegation but still misses manual-review and blocked-category cases.
- `mandatePaymentGate`: checks amount, merchant status, category risk,
  confirmation, and human-review requirements before allowing a charge.

Run:

```sh
/Users/mandeepsidhu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node operator/diy-project-blogs/projects/agentic-commerce-payment-gates/run-experiment.mjs
```

No local model was loaded. No local model service was queried. No torch work was
performed.
