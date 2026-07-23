# Agent fan-out cancellation experiment

This dependency-free discrete-event study tests whether propagating a parent
request's deadline into its queued and running child tasks reclaims capacity
and improves completion under six-way fan-out. It compares no cancellation,
queued-only cancellation, and cooperative cancellation after 1,000 ms or 250
ms across steady, bursty, and no-timeout-control scenarios.

Reproduce with the bundled Node runtime:

```sh
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node run-experiment.mjs
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node render-figure.mjs
```

The generator is a mechanism study, not a fitted trace. Service times are
lognormal; arrivals are Poisson with a periodic burst treatment; all policies
within a repeat receive identical arrivals and task durations. The saved
repeat-level rows support paired bootstrap intervals.
