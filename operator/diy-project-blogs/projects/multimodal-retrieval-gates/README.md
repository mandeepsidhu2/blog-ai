# Multimodal Retrieval Gates

This internal evidence project measures retrieval policy behavior across mixed
text, image, table, audio, video, and code assets. It compares three policies:
text-only indexing, unified untyped retrieval, and modality-routed retrieval.

The run does not use torch, CUDA, CPU ML training, or a local model service. It
is a controlled retrieval harness written in Node so the article can cite
repeatable metrics without requiring model access.

Run:

```sh
node operator/diy-project-blogs/projects/multimodal-retrieval-gates/run-experiment.mjs
```

Artifacts:

- `dataset.json`: assets, query intents, required modalities, and expected
  evidence ids.
- `results.json`: per-policy aggregate and per-query results.
- `output.txt`: concise terminal output used by the article.
- `chart.svg`: visual summary of pass rate, recall, and modality precision.

The public article must not expose this internal workspace path or operator
framing. It should describe the results as a measured retrieval harness.
