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

Local model catalog endpoint, when available:

```sh
curl -s http://localhost:1234/api/v1/models
```

Record endpoint availability in `results.json` so later readers know whether a
project used live local model metadata or a deterministic fallback.

