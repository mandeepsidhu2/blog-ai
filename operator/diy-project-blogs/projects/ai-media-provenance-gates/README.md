# AI Media Provenance Gates

This internal evidence project measures release gates for AI media provenance
pipelines. It uses deterministic JavaScript scoring rather than live model
inference, so results are reproducible without local model services, torch,
CUDA, or CPU ML training.

Run:

```sh
node run-experiment.mjs
```

Inputs:

- `cases.json`: 20 representative media handoff cases covering valid content
  credentials, missing metadata, AI watermarks, visible disclosures, registry
  hits, high-risk publishing contexts, and conflicting provenance signals.

Outputs:

- `output.txt`: console summary used in the public tutorial.
- `results.json`: full per-policy and per-case scoring details.
- `ai-media-provenance-gates.svg`: chart copied into article assets when the
  article batch passes gates.

No LM Studio/local model inference was used. The local model catalog probe
returned curl exit 7 on this run and was not required. No torch work was
introduced, so the MPS-only rule was not triggered.
