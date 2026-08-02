# Conformal Slice Coverage Audit

This dependency-free controlled simulation tests when a nominal 90% split-conformal interval protects only the aggregate population rather than a decision-critical slice. It uses matched random draws across five policies, four scenarios, 800 repeats, and paired bootstrap intervals.

The confirmatory comparison is pooled versus slice-calibrated coverage in the exchangeable rare/high-noise cell and the shifted-critical-share cell. The equal-noise scenario is the negative control. The balanced cell separates heteroscedasticity from rarity; max-slice and oracle-normalized policies expose width and information boundaries.

Run:

```sh
node operator/diy-project-blogs/projects/conformal-slice-coverage-audit/run-experiment.mjs
node operator/diy-project-blogs/projects/conformal-slice-coverage-audit/render-figure.mjs
```

No Torch, model service, customer data, or provider benchmark is used. The claim is limited to the declared synthetic residual process and does not promise distribution-free conditional coverage.
