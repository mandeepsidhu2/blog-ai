# Research log

## Exploratory screen

The initial screen compared Poisson open-loop arrivals with nearly regular
closed-loop arrivals. The no-pause control diverged, exposing arrival shape as a
confound. Those outputs are preserved under `artifacts/exploratory-v0/` and are
not used for confirmatory claims.

## Locked confirmatory run

The rerun replaced Poisson arrivals with an evenly paced schedule while keeping
the 320-repeat design, four scenarios, 100 ms p99 decision threshold, and 5,000
paired bootstrap samples. The preregistered prediction that at least 75% of
bursty-pause repeats would falsely pass under naive closed-loop measurement was
falsified: the observed rate was 57.5% at 80 rps and 58.125% at 100 rps.

The supported claim was narrowed to the repeat-level decision reversal, achieved
load suppression, and approximate recovery by expected-interval correction in
this mechanism. No named inference service, load generator, or universal
correction guarantee is claimed.
