# Cybersecurity Agent Release Gates

This project supports the July 3, 2026 article-production run for cybersecurity
agent release gates. It uses a deterministic JavaScript harness and a static
JSON dataset to compare three release policies for dual-use cybersecurity agent
workflows.

The dataset covers smart-contract exploit replay, live exploit guidance,
CI credential exfiltration, malware triage with adversarial text, production
patch authority, and safe hardening workflows. Labels are release decisions:
`allow`, `review`, or `block`.

Run:

```sh
/Applications/Codex.app/Contents/Resources/cua_node/bin/node run-experiment.mjs
```

Artifacts:

- `dataset.json`: labeled scenarios.
- `run-experiment.mjs`: deterministic policy and scoring harness.
- `output.txt`: terminal output used in the article.
- `results.json`: full per-case decisions and summary metrics.
- `chart.svg`: article visual basis.

No local model inference, torch, CUDA, CPU ML training, or MPS execution is
used. The harness is deterministic and runs locally with the bundled Node
runtime.
