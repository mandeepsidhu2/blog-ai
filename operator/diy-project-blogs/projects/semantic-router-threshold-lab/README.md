# Semantic Router Threshold Lab

Best threshold in this sweep was 0.45 with F1 0.83.

## Purpose

A semantic router decides whether a question should go to RAG, SQL, a tool call, or direct response. This project tunes the threshold with deterministic fixture scores before adding a model planner.

## Findings

- A 0.45 threshold gave the best F1 in the deterministic sweep.
- Very high thresholds avoided bad routes but missed too many valid routed questions.
- Low-confidence router decisions should fan out to multiple retrievers instead of forcing one path.

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
