# Cascade case-mix audit

This dependency-free controlled simulation tests whether an LLM cascade can
pass a global quality-and-cost rule while harming a small high-stakes workload.
It compares strong-only, one global confidence threshold, a preregistered
stratum-aware threshold, and an oracle router across 600 paired repeats.

Run from the repository root:

```sh
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node operator/diy-project-blogs/projects/cascade-case-mix-audit/run-experiment.mjs
```

The experiment is synthetic mechanism evidence. It does not estimate any
provider model's accuracy, calibration, price, or production prevalence.
