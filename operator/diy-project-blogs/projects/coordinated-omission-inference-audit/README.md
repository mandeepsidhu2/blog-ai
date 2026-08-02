# Coordinated Omission Inference Audit

This dependency-free discrete-event study tests how an open-loop arrival
schedule, a fixed-worker closed-loop load generator, and an interval-corrected
closed-loop histogram describe the same single-server mechanism. It uses paired
repeat seeds, no-pause and pause controls, two nominal loads, and a fixed p99
SLO. It does not use Torch or a model service.

Run:

```sh
node run-experiment.mjs
```

The simulator is deliberately narrow. It models one FCFS service lane with a
lognormal base demand and scheduled global pauses. It omits continuous
batching, token-level scheduling, streaming, network effects, autoscaling, and
accelerator-specific behavior. The result tests measurement bias, not the
capacity of any named inference product.

## Exploratory screen

The first screen used Poisson open-loop arrivals and nearly regular closed-loop
arrivals. Its no-pause control diverged, so arrival shape confounded the intended
measurement comparison. Those outputs are preserved under
`artifacts/exploratory-v0/`; they are excluded from confirmatory claims. The
locked rerun uses evenly paced open-loop arrivals and the same nominal pacing
for the closed-loop client population.
