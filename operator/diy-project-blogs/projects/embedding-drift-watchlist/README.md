# Embedding Drift Watchlist

The watchlist flagged week 3 because the retrieval score dropped below the release threshold.

## Purpose

Embedding upgrades, corpus refreshes, and chunking changes can quietly shift retrieval behavior. This project creates a small watchlist that compares weekly retrieval scores against a baseline before a RAG release goes live.

## Findings

- The latest score fell below the review threshold, so the release should not ship without investigation.
- A single score is not enough for root cause analysis, but it is enough to stop a silent regression.
- The same watchlist can track embedding model changes, chunking changes, and corpus refreshes.

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
