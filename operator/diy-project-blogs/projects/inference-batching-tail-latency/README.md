# Inference Batching Tail-Latency Audit

This non-Torch discrete-event study isolates the relationship between dynamic
batch formation, arrival burstiness, throughput, queue expiry, and tail latency.
It uses 60 independent arrival traces per cell, matched Poisson and bursty
traffic at the same offered rates, seven batching policies, a no-efficiency
negative control, and three offered-load levels.

Run:

```sh
node run-experiment.mjs
node render-figure.mjs
```

The initial hypothesis expected additional batch-formation delay to worsen
bursty p95 latency. It was falsified: synchronized bursts let the longer window
form efficient batches sooner than repeated small batches could drain the
queue. Under Poisson traffic, the same 10 ms window remained a latency tax.

The service-time curve is a declared model, not a measured accelerator. The
results support choosing what to measure and how to design a production replay;
they do not prescribe a universal batch size or queue delay.
