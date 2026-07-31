# Hedged request load audit

This dependency-free matched discrete-event study tests whether fixed-delay
request hedging can improve tail latency at moderate load yet amplify queueing
near capacity. It compares no hedging, 250 ms and 500 ms fixed hedges, and a
250 ms hedge admitted only while the destination queue is below a declared
depth cap.

Each repeat gives all policies the same arrivals, primary service demands,
copy-specific service draws, and shared slowdowns. The confirmatory design uses
four scenarios, including a no-tail negative control and a correlated-tail
stress where a second copy often shares the same slowdown.

An exploratory screen used one arrival rate for every near-capacity cell. It
was rejected before confirmatory interpretation because shared tails changed
mean service demand and made baseline utilization incomparable. The locked
configuration sets scenario-specific arrival rates so each near-capacity
baseline offers approximately seven worker-seconds of service per wall second
to the eight-worker system.

Reproduce with:

```sh
node operator/diy-project-blogs/projects/hedged-request-load-audit/run-experiment.mjs
node operator/diy-project-blogs/projects/hedged-request-load-audit/render-figure.mjs
```

This is a queueing-mechanism study under declared synthetic parameters. It
does not estimate a named inference provider, choose a universal hedge delay,
or model token streaming, provider billing, network partitions, or accelerator
batching.
