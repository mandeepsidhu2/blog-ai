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

## Structure

- Use `h2` for main sections.
- Use `h3` for local subsections.
- The article table of contents is generated from `h2` and `h3`.
- Include code fences for implementation-heavy tutorials.
- Use `output` fences for terminal or program output.

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
- honest about toy code versus production extensions.
- readable without requiring hidden context.
- useful as an SEO page and as a structured content payload.

For AI engineering content, prefer controlled examples, evaluation criteria,
and reproducibility notes over trend-only commentary.

## Review Checklist

- Does the title match a concrete search intent?
- Does the description explain the tutorial outcome?
- Are code snippets complete enough to understand?
- Are outputs visually separated from code?
- Are limitations and production extensions clear?
- Does the generated article page include a table of contents?
- Does the article JSON include blocks and metadata?
