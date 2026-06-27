# DIY Project Blogs

Use this space for small, reproducible projects that can become AI tutorial
articles. Good projects include:

- embedding and retrieval scorecards.
- local model catalog snapshots.
- prompt-cache cost and latency simulations.
- agent safety harnesses.
- screenshots or SVG charts for article assets.
- fun AI build ideas that can be explained with code and outputs.

Project outputs should be explicit enough to support an article:

```text
projects/<project-slug>/
  README.md
  output.txt
  results.json
  chart.svg
```

Generated article Markdown should still be staged through a temporary publishing
source directory and uploaded with `operator/scripts/publish-generated-content.mjs`.
Do not copy generated article batches into `content/articles` unless they are
intended to become permanent seed content in the repo.

Public article batches must be customer-facing. They must not include our
localhost health checks, local model catalog failures, private filesystem paths,
AWS profiles, Terraform state details, or other operator diagnostics. Mark
internal-only projects with `publish: false`; the generator can still save their
project outputs under `projects/` while excluding them from the publish source.

Publishable project articles must pass
`operator/scripts/check-public-content.mjs`. Treat a failure as a stop signal:
do not upload the batch, and report the failing article and reason. A publishable
article needs a real asset, code, output, enough explanation, an empirical or
operational signal, production-readiness criteria, and failure-mode coverage.

Local model catalog endpoint, when available:

```sh
curl -s http://localhost:1234/api/v1/models
```

Record endpoint availability in `results.json` so later readers know whether a
project used live local model metadata or a deterministic fallback.
