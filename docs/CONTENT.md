# Content

Tutorials are static Markdown files in `content/articles`.

## Article Contract

Each article must begin with front matter:

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
evidenceMode: experiment
---
```

Required fields:

- `title`
- `description`
- `topic`
- `level`
- `date`
- `readingTime`
- `tags`
- `image`
- `imageAlt`
- `evidenceMode`

Asset fields:

- `image`: article-specific Open Graph and in-page hero image. Use an absolute
  site path such as `/content/v1/assets/example.svg`. Customer-facing content
  must not rely on the shared site hero image.
- `imageAlt`: descriptive alt text for the article image. Keep it literal and
  specific to the diagram or screenshot.

## Internal Source Modes

There are two internal ways an article can be produced:

- Strategy or trend articles: explain AI practices, adoption patterns, model
  trends, code organization, harness engineering, or operating models. These may
  cite external sources and should still be concrete, current, and actionable.
  Use `evidenceMode: strategy`.
- Evidence-supported technical articles: include code snippets, outputs, and
  results from an internal project under `operator/diy-project-blogs`. Use
  `evidenceMode: experiment`.

This distinction is for us only. The website must present both as ordinary
articles. Do not write public copy that says "DIY project", "operator project",
"experiment-backed article", or "trend article". If an article uses supporting
evidence, integrate it naturally as measurements, results, figures, or
reproducibility notes.

## Structure

- Use `h2` for main sections.
- Use `h3` for local subsections.
- The article table of contents is generated from `h2` and `h3`.
- Include code fences for implementation-heavy tutorials.
- Use `output` fences for terminal or program output.
- Use article images for architecture diagrams, flow charts, or UI outputs that
  help readers understand the implementation. Generated content assets should
  live under `content/assets` only as temporary build input unless the article is
  intentionally committed to the repo.
- Use `operator/diy-project-blogs` internally for experiments that produce
  article findings, charts, screenshots, or local model catalog notes before
  content is staged and published to S3.

## Public Content Boundary

Public articles are for customers. They should teach an AI technique, show code
and outputs that readers can reuse, and reinforce that staying ahead in AI
requires hands-on practice now.

Do not publish anything that is failing, incomplete, placeholder-like, or only
useful as an internal note. A public article must have:

- article-specific image and alt text.
- for experiment articles, at least three runnable code blocks and one output
  block.
- for strategy articles, at least five current primary or high-signal sources
  and a clear source/signal/research section.
- enough explanatory prose to stand alone as a deep technical reference.
- empirical or operational signal such as a metric, benchmark, threshold, trace,
  test, or release gate.
- production-readiness guidance, including failure modes, limitations,
  guardrails, rollback criteria, and reproducibility notes when the article
  depends on a measured run.

Avoid lightweight sections titled `Production extension`. That language is a
smell that the article is a short demo. Use explicit sections such as
`Production Readiness`, `Failure Analysis`, and `Reproducibility` instead.

Do not publish:

- localhost service health or local model catalog failures.
- private filesystem paths.
- AWS profiles, Terraform state details, bucket internals, or deployment logs.
- operator diagnostics whose main value is explaining our environment.
- internal labels such as DIY project, operator project, trend article, or
  experiment-backed article.

Keep those details in `operator/` project outputs. If a generated project is
only useful as an internal diagnostic, set `publish: false` and publish a
customer-safe tutorial instead.

Example:

````md
```python
print("hello")
```

```output
hello
```
````

## Quality Bar

Every tutorial should be:

- practical enough to build from.
- explicit about assumptions.
- honest about limitations, rollout boundaries, and production-readiness gaps.
- readable without requiring hidden context.
- useful as an SEO page and as a structured content payload.
- production-grade enough to represent the product to customers.

For AI engineering content, prefer controlled examples, evaluation criteria,
and reproducibility notes over trend-only commentary.

## Review Checklist

- Does the title match a concrete search intent?
- Does the description explain the tutorial outcome?
- Are code snippets complete enough to understand?
- Are outputs visually separated from code?
- Does the article have a useful image and alt text when the topic benefits from
  a diagram?
- Are limitations, guardrails, and rollout boundaries clear?
- Is the article free of operator-only diagnostics and local environment
  failures?
- Does `operator/scripts/check-public-content.mjs` pass before publishing?
- Does the generated article page include a table of contents?
- Does the article JSON include blocks and metadata?
