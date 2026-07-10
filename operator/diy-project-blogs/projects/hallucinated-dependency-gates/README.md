# Hallucinated Dependency Gates

This project supports the July 10, 2026 latest-AI article-production run.

It evaluates package and repository admission policies for AI coding assistants
that suggest dependencies. The harness is deterministic and uses representative
package records rather than live package-manager installs, network calls,
local model inference, torch, CUDA, or CPU ML training.

## Files

- `tasks.json`: 20 package and repository suggestions across PyPI, npm, and
  GitHub-style resources.
- `run-experiment.mjs`: scoring harness and SVG chart generator.
- `output.txt`: console summary.
- `results.json`: full policy summaries and per-case results.
- `hallucinated-dependency-gates.svg`: chart used as the measured article
  visual.

## Run

```sh
node run-experiment.mjs
```

The experiment scores three policies:

- `blindAssistantInstall`: installs anything that exists in a registry.
- `registryNameGate`: checks name existence, broad age/download thresholds, and
  native/script risk.
- `dependencyReleaseGate`: uses expected install authority labels with source,
  maintainer, provenance, script-risk, and secret-scope requirements.

No LM Studio model service was used. The local model catalog probe was not
needed for this deterministic run. No torch work was introduced, so the MPS-only
rule was not triggered.
