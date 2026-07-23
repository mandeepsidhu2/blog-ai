# Pairwise judge swap audit

This dependency-free controlled Monte Carlo study asks whether swapping answer
order is sufficient to make a pairwise AI judge safe for release decisions.
It separates position overrides from a candidate-correlated style preference,
uses matched latent truths across policies, repeats the full 500-pair release
sample 800 times, and saves repeat-level results plus bootstrap summaries.

Run from the repository root:

```sh
node operator/diy-project-blogs/projects/pairwise-judge-swap-audit/run-experiment.mjs
```

No model inference, Torch, cloud service, or external dependency is used. The
simulation parameters are transparent stress conditions, not measurements of a
named provider model. Public claims must stay within that boundary.
