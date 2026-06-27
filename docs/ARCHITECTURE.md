# Architecture

Blog AI is a static tutorial site with an SEO-first HTML surface and
selectively loaded content payloads.

## Source And Output

Source:

```text
content/articles/*.md
site/assets/*
app-scripts/*.mjs
pipeline/*.yml
```

Generated output:

```text
dist/app/
dist/content/
dist/pipeline-artifact/
```

`dist/app` contains the app shell:

- home page.
- topic pages.
- CSS and browser JavaScript.
- hero/OG visual asset.
- favicon, manifest, robots, sitemap.

`dist/content` contains the content origin:

- SEO article HTML under `/tutorials/<slug>/`.
- content JSON under `/content/v1/articles/<slug>/index.json`.
- manifest, topics, and search index under `/content/v1/`.

`dist/pipeline-artifact` contains `app/` and `content/` folders so CodePipeline
can deploy both S3 origins from one build artifact.

## Runtime Shape

The browser first loads static shell assets, then fetches selective content
objects when needed:

```text
/assets/app.js
/assets/styles.css
/content/v1/manifest.json
/content/v1/search-index.json
/content/v1/articles/<slug>/index.json
```

SEO does not depend on client-side article rendering. Every tutorial has a
crawler-visible HTML page under `/tutorials/*`.

## Generator Responsibilities

`app-scripts/build-site.mjs`:

- parses article front matter.
- converts Markdown blocks to safe HTML.
- generates article table of contents from `h2` and `h3`.
- emits SEO article pages.
- emits content JSON payloads.
- emits topic pages, sitemap, robots, manifest, and pipeline artifact.

The generator intentionally has no external package dependencies.

## Boundaries

- Edit article source in `content/articles`, not `dist/content`.
- Edit UI behavior in `site/assets`, not `dist/app/assets`.
- Edit generation behavior in `app-scripts/build-site.mjs`.
- Edit validation in `app-scripts/check-site.mjs`.
- Edit cloud resource definitions in `../infrastructure/blog-ai-frontend`.

Do not add a backend unless the product requirement cannot be met with static
files and browser-local behavior.
