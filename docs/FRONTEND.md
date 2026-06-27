# Frontend

The frontend is a static, editorial tutorial interface.

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

## Visual Review

When editing layout or interaction, preview locally:

```sh
node app-scripts/serve-dist.mjs
```

Inspect at least:

- desktop home.
- mobile home.
- one article page.
- search dialog.
- code and output blocks.

Hard failures:

- horizontal overflow.
- text overlapping other UI.
- missing hero image.
- first viewport hides all evidence of the next home section.
- article text available only after JavaScript.
