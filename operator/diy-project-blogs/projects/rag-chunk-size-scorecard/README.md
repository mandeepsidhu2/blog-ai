# RAG Chunk Size Scorecard

Best chunk size in this deterministic fixture was 520 tokens.

## Purpose

Chunk size is one of the fastest ways to change RAG quality. This DIY project creates a deterministic fixture so you can compare chunk sizes before involving a live model.

## Findings

- 520 tokens produced the best combined score in this fixture.
- The largest chunk did not win because extra context increased noise and latency.
- A simple deterministic fixture is useful before running expensive model-based answer evaluation.

## Files

- `results.json`: structured metrics and model catalog availability.
- `output.txt`: terminal-style output used in the article.
- `chart.svg`: article asset generated from the project result.

## Model Catalog

Checked endpoint:

```sh
curl -s http://localhost:1234/api/v1/models
```

The endpoint status for this run is stored in `results.json`.
