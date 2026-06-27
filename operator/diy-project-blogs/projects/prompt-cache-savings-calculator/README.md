# Prompt Cache Savings Calculator

The simulated stable prefix reduced relative prompt cost by 58 percent at a 74 percent hit rate.

## Purpose

Prompt caching is only useful when a large prefix stays stable across many requests. This project estimates savings before changing prompt layout in a production app.

## Findings

- Stable prompt prefixes are the main lever; short prompts produce limited cache value.
- A 74 percent hit rate was enough to cut relative prompt cost by more than half in this fixture.
- Prompt versioning is required so cached instructions do not silently go stale.

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
