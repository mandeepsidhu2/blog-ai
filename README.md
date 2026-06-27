# Blog AI

Static AI tutorial site with SEO-first article snapshots and S3-backed content objects.

Repository: `git@github.com:mandeepsidhu2/blog-ai.git`

For agent navigation and project rules, start with `AGENTS.md`, then use
`docs/INDEX.md`.

## Architecture

- `dist/app` contains the lightweight website shell: home page, styles, browser JavaScript, robots, sitemap, and favicon.
- `dist/content` contains tutorial SEO pages under `/tutorials/*` and selective content payloads under `/content/v1/*`.
- CloudFront should route `/tutorials/*` and `/content/*` to the content bucket, and all other paths to the app bucket.

The content source of truth is Markdown in `content/articles`. Build output is generated and should be deployed, not edited by hand.

## Operator Workspace

- `app-scripts/` is app-owned build, validation, and preview tooling.
- `operator/scripts/` is operator-only tooling used by us for manual publishing workflows.
- `operator/diy-project-blogs/` is a workspace for small AI project experiments that can produce
  findings, charts, screenshots, and generated article batches for S3 publishing. It may use the
  local model catalog endpoint at `curl -s http://localhost:1234/api/v1/models` when that endpoint
  is running.
- Operator diagnostics are not customer content. Do not publish localhost health,
  private paths, local run failures, AWS profiles, Terraform state details, or
  workstation-specific output as articles.

## Commands

```sh
npm run build
npm run check
npm run preview
```

`SITE_URL` controls canonical URLs and sitemap entries:

```sh
SITE_URL=https://learn.toolsite.com npm run build
```

## Content

Each article uses YAML-like front matter followed by Markdown:

```md
---
title: Build a Tiny RAG Pipeline in Python
description: Implement retrieval, prompt assembly, and generation boundaries.
topic: RAG
level: Intermediate
date: 2026-06-27
readingTime: 22
tags: rag, retrieval, embeddings
image: /content/v1/assets/tiny-rag-pipeline.svg
imageAlt: RAG pipeline architecture diagram with retrieval and generation stages
---
```

Code fences become formatted code blocks with copy buttons. Fences with `output` become terminal output blocks. `h2` and `h3` headings generate the left-side table of contents for article pages.

Every tutorial should be practical, customer-facing, and SEO-readable. The site
is meant to make readers feel why staying ahead in AI matters now, then give
them enough code and evidence to act on that urgency.

Publishing requires the public content gate:

```sh
npm run check:content
```

Do not publish a generated batch if the gate reports incomplete content,
operator-only diagnostics, missing assets, weak metadata, lightweight demo
language, or missing production readiness guidance. Quality beats quantity; one
or two deep articles per day is the target.

## Documentation

- `AGENTS.md`: short agent map.
- `docs/HARNESS.md`: harness-engineering operating model.
- `docs/ARCHITECTURE.md`: source and generated output shape.
- `docs/CONTENT.md`: tutorial authoring rules.
- `docs/FRONTEND.md`: UI and reading experience rules.
- `docs/QUALITY.md`: validation workflow.
- `docs/INFRASTRUCTURE.md`: CloudFront/S3 and Terraform boundary.
