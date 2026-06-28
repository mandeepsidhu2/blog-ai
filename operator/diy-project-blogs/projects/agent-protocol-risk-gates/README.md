# Agent Protocol Risk Gates

This project compares a naive name-only tool approval rule with a schema-and-context
gate across eight MCP-style tool calls. The dataset includes read-only tools,
write-capable tools, prompt-injection text in tool descriptions, remote servers,
customer data, and secret-bearing requests.

Run:

```sh
node run-experiment.mjs
```

Artifacts:

- `dataset.json`: tool-call cases and expected decisions.
- `results.json`: per-case gate decisions and aggregate metrics.
- `output.txt`: compact metric output for article use.
- `chart.svg`: article visual summarizing the gate comparison.
