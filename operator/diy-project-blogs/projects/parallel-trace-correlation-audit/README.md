# Parallel Trace Correlation Audit

This dependency-free matched stochastic experiment tests whether replaying each
parallel tool column independently preserves workflow-level latency and capacity
conclusions. It does not: shared incidents create joint structure that must be
kept at the workflow row or reconstructed with an explicit incident model.

Run:

```sh
node run-experiment.mjs
node render-figure.mjs
```

The confirmatory design uses 400 repeats, 5,000 four-tool workflows per repeat,
three dependence scenarios, and three replay methods. `repeat-results.csv` is
the inferential unit. `aggregate-results.json` and
`statistical-analysis.json` are generated from it. The SVG is generated only
from the aggregate artifact.

No model service, Torch runtime, customer trace, or production system is used.
