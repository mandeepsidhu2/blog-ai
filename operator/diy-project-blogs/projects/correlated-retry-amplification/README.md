# Correlated Retry Amplification

This dependency-free simulation tests whether client retry policies that are
helpful for independent transient errors become harmful when failures are
temporally correlated and provider capacity is finite.

The design uses matched arrival and fault traces within each repeat, two offered
loads, independent and Markov-bursty fault shapes, five retry policies, 200
repeats per main cell, and an 80-repeat no-fault negative control. It does not
use Torch, a language model, a network service, or production traces.

Reproduce with:

```sh
python3 run_experiment.py
python3 render_figure.py
```

The simulation is mechanism evidence, not a capacity prescription. Production
confirmation requires the real provider's retryable-status taxonomy,
`Retry-After` behavior, service quotas, request-cost distribution, timeouts,
and incident traces.
