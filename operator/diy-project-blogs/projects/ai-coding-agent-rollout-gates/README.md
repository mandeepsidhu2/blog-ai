# AI Coding Agent Rollout Gates

This project supports the July 3, 2026 article-production run. It evaluates
deterministic rollout gates for enterprise coding-agent adoption using a small
labeled dataset of pilot segments.

The harness compares three policies:

- `seatRolloutGate`: expands when active use crosses a seat-adoption threshold.
- `adoptionOnlyGate`: adds retention, peer-neighbor, and merged-PR lift checks.
- `adoptionCostQualityGate`: adds cost, review quality, security, trace
  coverage, logging, sample-size, and value thresholds.

Run:

```sh
node operator/diy-project-blogs/projects/ai-coding-agent-rollout-gates/run-experiment.mjs
```

Artifacts:

- `dataset.json`: labeled rollout scenarios.
- `output.txt`: concise reproducible metrics.
- `results.json`: predictions and aggregate metrics.
- `chart.svg`: chart used as the measured article visual.

No local model inference, torch, CUDA, CPU ML training, or cloud services are
used.
