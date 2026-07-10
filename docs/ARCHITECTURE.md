# Architecture

Blog AI is a static tutorial site with an SEO-first HTML surface and
selectively loaded content payloads.

## Source And Output

Source:

```text
content/articles/*.md
site/assets/*
app-scripts/*.mjs
operator/scripts/*.mjs
operator/diy-project-blogs/
pipeline/*.yml
```

Generated output:

```text
dist/app/
dist/content/
dist/pipeline-artifact/
```

`dist/app` contains the app shell:

- home page with bounded editorial discovery modules.
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
- converts headings, prose, lists, quotes, code, outputs, and Markdown tables to
  safe HTML and structured article JSON blocks.
- generates article table of contents from `h2` and `h3`.
- emits SEO article pages.
- emits content JSON payloads.
- emits a curated home page, topic pages, sitemap, robots, manifest, and
  pipeline artifact.

The generator intentionally has no external package dependencies.

## Boundaries

- Edit article source in `content/articles`, not `dist/content`.
- Edit UI behavior in `site/assets`, not `dist/app/assets`.
- Keep the home page as a front door, not a complete archive. It should show a
  bounded set of top/recent articles plus topic, tag, and search discovery.
  Full article discovery belongs in search, topic pages, the content manifest,
  and generated SEO article pages.
- Agent workflow tools, including the former `/agent-console/` route and the
  Mac app, now live in the sibling `../agent-flow-studio` project. Do not add
  those surfaces back into Blog AI.
- Provider command packs, browser-local graph samples, generated Python console
  behavior, and console data-flow tests also belong to Agent Flow Studio.
- Edit generation behavior in `app-scripts/build-site.mjs`.
- Edit validation in `app-scripts/check-site.mjs`.
- Put operator-only publishing tools in `operator/scripts`.
- Put internal article evidence workspaces, charts, screenshots, and local model
  catalog probes in `operator/diy-project-blogs`. This internal source
  distinction must not appear in the customer-facing website.
- Edit cloud resource definitions in `../infrastructure/blog-ai-frontend`.

Do not add a backend unless the product requirement cannot be met with static
files and browser-local behavior.
