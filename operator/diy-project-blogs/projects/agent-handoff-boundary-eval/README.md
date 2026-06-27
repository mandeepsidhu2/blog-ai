# Agent Handoff Boundary Evaluation

This project measures how much task support, citation coverage, private data exposure, unsafe-action blocking, and token use change when an agent hands work to another agent.

The experiment compares three patterns:

- `shared-transcript`: the next agent receives the full working context.
- `compact-brief`: the next agent receives a short free-form summary.
- `contract-brief`: the next agent receives typed fields, citations, allowed actions, and boundary notes.

Run it with:

```sh
node operator/diy-project-blogs/projects/agent-handoff-boundary-eval/run-experiment.mjs
```

The script writes `dataset.json`, `results.json`, `output.txt`, and `chart.svg`.
