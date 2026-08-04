# Confirmatory Run Summary

Run date: 2026-08-03

The locked first confirmatory run completed with 200 matched repeats per scenario, four routing policies, 3,200 repeat-policy rows, and 5,000 paired bootstrap resamples. No Torch runtime, model service, accelerator, or network call was used.

## Preregistered hypothesis result

Supported within the declared simulation. In the 45%-hot, 120-rps cell, strict affinity increased median cache hit rate from 0.5856 to 0.9967 but increased median p99 from 78.97 ms to 4,378.38 ms and failed the 250 ms SLO in every repeat. Bounded affinity retained a 0.9758 hit rate, achieved 54.14 ms median p99, and passed every repeat.

## Claim-hardening controls

- Uniform 80 rps: strict affinity improved p99 by a paired mean 38.91 ms, showing that affinity is not intrinsically harmful.
- Cache disabled at 120 rps: bounded affinity provided zero hit gain and worsened p99 by 7.43 ms, 95% interval [7.17, 7.67].
- Extreme 70%-hot, 180-rps stress: strict affinity was unstable; bounded affinity retained the SLO in all repeats.

## Claim boundary

The evidence identifies a queue-locality trade-off for eight serial workers with worker-local LRU caches. It does not estimate production GPU throughput, continuous batching, KV memory, network transfer, autoscaling, or any named serving runtime. The 25 ms slack is an ablation value, not a universal recommendation.
