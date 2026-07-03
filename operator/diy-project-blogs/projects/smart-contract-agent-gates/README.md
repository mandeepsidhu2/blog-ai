# Smart Contract Agent Gates

This internal project supports the July 3, 2026 article-production run on AI
agents for smart-contract security work.

It uses a deterministic Node harness over twelve representative audit cases.
The harness compares three review policies:

- `textOnly`: agents can suggest findings from text and source context.
- `forkValidated`: findings require fork-backed exploit validation.
- `humanReviewedPatch`: patch movement requires fork evidence, executable
  oracles, and human review.

Run:

```sh
/Applications/Codex.app/Contents/Resources/cua_node/bin/node run-experiment.mjs
```

Artifacts:

- `dataset.json`: representative case metadata.
- `run-experiment.mjs`: deterministic evaluation harness.
- `output.txt`: terminal output from the latest run.
- `results.json`: full per-case and summary results.
- `chart.svg`: chart derived from the same results.

No local model inference, API calls, torch workload, CUDA, or CPU ML training is
used.
