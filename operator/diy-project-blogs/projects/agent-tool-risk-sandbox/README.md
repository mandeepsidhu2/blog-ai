# Agent Tool Risk Sandbox

The sandbox blocked 5 risky calls and executed 15 approved calls.

## Purpose

Agent tool safety is easier to understand with a sandbox. This project creates a small policy layer that validates arguments, blocks dangerous calls, and keeps retries idempotent.

## Findings

- The sandbox made risky side effects visible before a real API was called.
- Retry behavior should be tested separately from validation behavior.
- Approval gates are easier to review when the exact normalized tool call is logged.

## Files

- `results.json`: structured metrics and model catalog availability.
- `output.txt`: terminal-style output used in the article.
- `chart.svg`: article asset generated from the project result.

## Model Catalog

Checked endpoint:

```sh
curl -s http://localhost:1234/api/v1/models
```

The endpoint status for this run is stored in `results.json`.
