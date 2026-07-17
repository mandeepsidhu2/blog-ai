# Sequential evaluation peeking audit

This non-Torch Monte Carlo study measures the operating characteristics of
fixed-horizon testing, uncorrected repeated significance checks, and a simple
Bonferroni sequential control for paired binary LLM-evaluation outcomes.

The confirmatory focal design uses 400 maximum paired tasks, reviews every 25
tasks, and runs 20,000 independent seeded repetitions for null, small, and
moderate log-odds effects. Ablations vary maximum task count and review cadence.

Run:

```sh
node run-experiment.mjs
node render-figure.mjs
```

The simulation does not establish the behavior of a particular benchmark,
model, judge, or real task distribution. It estimates error and stopping
properties only under the declared paired Bernoulli data-generating process.
