# Prefix-Affinity Cache Routing Audit

## Question

Can prefix-affinity routing improve worker-local KV-prefix reuse without turning a popular prefix into a hot shard?

## Confirmatory design

The simulation replays the same generated request trace, prefix identity, and service-time draw through four routing policies. It uses eight serial workers, 64-entry worker-local LRU caches, a 35 ms prefill saving on a hit, and a 250 ms p99 SLO. Two hot-prefix scenarios are compared with uniform-prefix and cache-disabled controls. Each scenario-policy cell has 200 matched repeats. Paired bootstrap intervals use 5,000 resamples.

The preregistered directional prediction is encoded in `evidence-manifest.json`. The confirmatory run is the first run of this locked configuration; no exploratory result was used to tune its 25 ms bounded-affinity threshold.

## Boundaries

This is a queueing and cache-locality study, not a GPU benchmark. It omits continuous batching, KV block eviction by token volume, replica autoscaling, request cancellation, preemption, network transfer, and model-specific kernels. Those omissions keep the causal contrast legible and limit the public claim.

## Confirmatory outcome

The first locked run completed on 2026-08-03. The directional hypothesis was supported in the moderate-hot cell: strict affinity gained cache hits but failed the SLO in all 200 repeats, while bounded affinity retained most of the reuse gain and passed all repeats. The cache-disabled control showed a negative result for bounded affinity, which added 7.43 ms mean paired p99 without any hit-rate benefit. Exact results and claim boundaries are recorded in `run-summary.md` and the generated artifacts.
