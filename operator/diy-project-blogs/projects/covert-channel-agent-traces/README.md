# Covert-Channel Agent Trace Gates

This internal project supports the June 30 article batch on detecting hidden
coordination surfaces in tool-using agent workflows.

The project uses a deterministic Node harness. It does not call a local model
service and does not use torch, CUDA, CPU ML execution, or MPS. The dataset is a
small set of inspectable tool events with expected dispositions.

Run:

```sh
node operator/diy-project-blogs/projects/covert-channel-agent-traces/run-experiment.mjs
```

Artifacts:

- `dataset.json`: twelve synthetic but inspectable tool-event traces.
- `run-experiment.mjs`: compares content-only, tool-boundary, and trace-budget
  policies.
- `output.txt`: terminal output used in the article.
- `results.json`: detailed per-policy and per-case results.
- `chart.svg`: article-support chart.
