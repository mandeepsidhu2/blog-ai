# Clustered Agent Benchmark Uncertainty

This controlled Monte Carlo study tests confidence-interval coverage when coding-agent benchmark tasks are nested inside repositories. It compares a task-independent normal interval, a task bootstrap, and a repository-cluster bootstrap under matched simulated datasets.

The primary estimand is the paired success-rate difference between two agents. The negative control sets repository-level treatment heterogeneity to zero. Positive treatments increase that heterogeneity while keeping the population-average treatment effect fixed at five percentage points. A cluster-count ablation tests the small-cluster boundary.

Run with:

```sh
node run-experiment.mjs
node render-figure.mjs
```

The script writes per-repeat intervals to `raw-results.json`, aggregate coverage and interval widths to `results.json`, and a compact audit to `output.txt`. It uses no Torch or model service.

The figure renderer reads `results.json` rather than embedding measurements, so
the publication chart stays traceable to the saved aggregate artifact.

Claim boundary: this simulation identifies estimator behavior under the declared hierarchical Bernoulli data-generating process. It does not estimate the correlation or uncertainty of any named public benchmark, and it cannot show that every real coding benchmark needs the same resampling unit.
