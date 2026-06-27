# Local Model Catalog Health Check

Catalog status unavailable; model count 0.

## Purpose

Local AI experiments often assume a model server is running. This small project checks the model catalog endpoint first, records the result, and lets downstream experiments decide whether to use live inference or a deterministic fallback.

## Findings

- The local model catalog status for this run was unavailable.
- Recording endpoint availability prevents silent benchmark drift when a local server is not running.
- A failed model catalog check should not block non-inference projects, but it should be visible in the project output.

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
