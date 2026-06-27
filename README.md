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
---
```

Code fences become formatted code blocks with copy buttons. Fences with `output` become terminal output blocks. `h2` and `h3` headings generate the left-side table of contents for article pages.

## Documentation

- `AGENTS.md`: short agent map.
- `docs/HARNESS.md`: harness-engineering operating model.
- `docs/ARCHITECTURE.md`: source and generated output shape.
- `docs/CONTENT.md`: tutorial authoring rules.
- `docs/FRONTEND.md`: UI and reading experience rules.
- `docs/QUALITY.md`: validation workflow.
- `docs/INFRASTRUCTURE.md`: CloudFront/S3 and Terraform boundary.
