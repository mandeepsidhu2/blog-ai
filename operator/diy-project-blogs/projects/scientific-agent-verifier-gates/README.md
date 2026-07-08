# Scientific Agent Verifier Gates

This internal evidence project measures release gates for scientific AI-agent
claims. It compares a confidence-only baseline, a metric-only baseline, and a
verifier-first gate over sixteen scientific workflow cases.

The project intentionally uses a static JSON task set and a Node scorer. It
does not call a local model service, does not use torch, and does not require
CUDA, CPU ML execution, or MPS.

## Run

```sh
node run-experiment.mjs
```

The script writes:

- `artifacts/results.json`
- `artifacts/output.txt`
- `artifacts/scientific-agent-verifier-gates.svg`

## Summary

The verifier-first gate is designed to require executable verifiers,
independent replication, clean-room traces when leakage risk matters, and expert
review for high-impact or external-safety-sensitive claims. The measured output
is used only as support for the public tutorial; local paths and operator notes
must stay out of customer-facing article copy.
