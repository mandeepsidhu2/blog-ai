# Token-work admission control audit

This dependency-free discrete-event study asks whether a fixed concurrent-request
limit protects an LLM serving system when completion lengths are heavy-tailed.
It compares request-count admission with class-estimated token budgets,
calibration ablations, and an oracle-token positive control. A fixed-length
workload is the negative control, and a shortest-estimate-first queue ablation
tests whether any short-request regression comes from FIFO head-of-line blocking.

The simulator uses processor sharing at 4,000 generated tokens per second,
Poisson arrivals, a ten-second queue timeout, three offered request rates, and
80 independently seeded traces per cell. It reports request-level latency,
queueing, drops, SLO attainment, active-work oversubscription, and short/long
class tails. This is a mechanism study, not a GPU benchmark.

Reproduce with the bundled Node runtime:

```sh
node run-experiment.mjs
node render-figure.mjs
```

Artifacts are written to `artifacts/`. The public claim must remain bounded to
the declared simulation and class-level estimates; production adoption requires
replay with real arrival traces, generated-token distributions, cancellation,
prefill/decode interference, and hardware service curves.
