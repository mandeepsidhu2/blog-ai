# Frontend

The frontend is a static, editorial tutorial interface.

The LangGraph agent console is a separate static tool at `/agent-console/`.
Its CSS and JavaScript live under `site/agent-console/` and must not depend on
the tutorial app bundle in `site/assets/app.js`.

## Design Goals

- fast first load.
- readable long-form technical content.
- quiet, professional UI.
- visible topic navigation.
- code and output blocks that are easy to scan.
- no dependency on client-side rendering for SEO article text.

## Layout

Home page:

- header with brand, topic links, and search.
- hero with a real raster visual.
- topic chips visible in the first viewport.
- tutorial cards for the article library.

Article page:

- left-side table of contents on desktop.
- article content in a constrained reading column.
- related articles on desktop.
- generated metadata: topic, level, reading time, date, tags.
- mobile layout without horizontal overflow.

## Interaction

Browser behavior lives in `site/assets/app.js`:

- search dialog.
- local search over `/content/v1/search-index.json`.
- copy buttons for code blocks.
- active table-of-contents highlighting.
- external link hardening.

CSS lives in `site/assets/styles.css`.

Agent-console behavior lives in `site/agent-console/console.js`, with styling
in `site/agent-console/console.css`. Keep its graph state, code generation,
dragging, tool list, and download behavior isolated from tutorial search and
article interactions.

The built-in console tool library is static JSON at
`site/agent-console/tools/catalog.json`. The browser loads it from
`/agent-console/tools/catalog.json`, supports search and category filtering, and
emits selected tools into the downloaded LangGraph Python as subprocess-backed
tool boundaries with explicit approval checks for mutating operations.

Custom console tools are browser-local stubs: users provide a name and
description, and the Python export includes an empty function for later
implementation. Console graph state, custom tools, filters, zoom, and selected
sample flow persist in browser local storage across refreshes.

The console also ships loadable sample flows for research, coding, cloud
infrastructure, product feedback, and marketing launch workflows. Keep sample
logic in the isolated console bundle, not in tutorial search or article
rendering code.

## Visual Review

When editing layout or interaction, preview locally:

```sh
node app-scripts/serve-dist.mjs
```

Inspect at least:

- desktop home.
- mobile home.
- desktop `/agent-console/`.
- mobile `/agent-console/`.
- one article page.
- search dialog.
- code and output blocks.

Hard failures:

- horizontal overflow.
- text overlapping other UI.
- missing hero image.
- first viewport hides all evidence of the next home section.
- article text available only after JavaScript.
