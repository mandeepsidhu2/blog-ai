# Risk-weighted canary sampling

This dependency-free Monte Carlo study separates two jobs that are often
collapsed in AI release canaries: detecting a rare high-consequence regression
and estimating its population-average prevalence. It compares population-
proportional, risk-weighted, and balanced sampling at the same 400-case budget.

The confirmatory heterogeneous scenario assigns 92% of traffic to routine
tasks, 7% to important tasks, and 1% to critical tasks. Each of 4,000 repeats
uses matched binary outcomes and an exact one-sided sign test for the critical
stratum. Inverse-probability weights recover the population delta. Homogeneous,
misranked-risk, and no-effect scenarios are controls.

Reproduce with:

```sh
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node run-experiment.mjs
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node render-figure.mjs
```

The simulation is mechanism evidence, not a production prevalence estimate.
Teams must define strata before examining a candidate and validate their risk
scores on held-out incidents.
