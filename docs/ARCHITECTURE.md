# Architecture

Blog AI is a static tutorial site with an SEO-first HTML surface and
selectively loaded content payloads.

## Source And Output

Source:

```text
content/articles/*.md
site/assets/*
site/agent-console/*
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

- home page.
- topic pages.
- isolated LangGraph agent console under `/agent-console/`.
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
/agent-console/console.js
/agent-console/console.css
/agent-console/tools/catalog.json
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
- emits the isolated `/agent-console/` app route and copies its separate assets,
  including the static DevOps tool catalog consumed by the console.

The generator intentionally has no external package dependencies.

## Boundaries

- Edit article source in `content/articles`, not `dist/content`.
- Edit UI behavior in `site/assets`, not `dist/app/assets`.
- Edit the LangGraph agent console in `site/agent-console`, not `dist/app`.
  Its browser logic must stay separate from tutorial search, article rendering,
  and content payload logic.
- Edit the console's built-in tool library in
  `site/agent-console/tools/catalog.json`. The static generator copies it as an
  app asset; it is not article content and must stay out of content JSON.
- Edit generation behavior in `app-scripts/build-site.mjs`.
- Edit validation in `app-scripts/check-site.mjs`.
- Put operator-only publishing tools in `operator/scripts`.
- Put internal article evidence workspaces, charts, screenshots, and local model
  catalog probes in `operator/diy-project-blogs`. This internal source
  distinction must not appear in the customer-facing website.
- Edit cloud resource definitions in `../infrastructure/blog-ai-frontend`.

Do not add a backend unless the product requirement cannot be met with static
files and browser-local behavior.
