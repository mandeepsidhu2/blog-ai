# Source Provenance

- Source study: `dropout-decay`, completed before this article run.
- Frozen input: `paper-results-summary.json` copied from the study's
  `paper/paper_results_summary.json`.
- Statistical quantities: paired per-seed gains and stored 95% bootstrap
  confidence intervals from the paper summary.
- Negative control: the earliest matched stage for each 8M-token trajectory,
  where positive loss delta means the decay schedule was worse than the best
  static baseline at that prefix.
- Processing: `analyze-results.mjs` validates and normalizes the frozen values;
  it does not synthesize or estimate missing training measurements.

The source study used MPS-backed training runs. This article-production step
does not execute Torch or modify the completed study.
