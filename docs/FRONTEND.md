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
- proof points near the hero that explain why the library is trustworthy,
  using real generated counts or concrete implementation signals rather than
  generic claims.
- topic chips visible in the first viewport.
- a bounded editorial front door: one spotlight article, a small set of
  recommended articles, topic hubs, tag-triggered search, and a capped latest
  list.
- no raw all-article card dump. The home page must remain useful if the
  library grows to hundreds or thousands of articles.
- article-specific spotlight images use non-cropping containment so charts and
  diagrams keep their labels, axes, and text visible.
- featured and recommended article cards expose practical selection signals
  such as level, reading time, update date, code availability, measured outputs,
  source signals, and production gates when those are present in the article.

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
- home search and tag buttons that seed the shared search dialog.
- copy buttons for code blocks.
- active table-of-contents highlighting.
- external link hardening.

CSS lives in `site/assets/styles.css`.

Agent workflow tools, including the former browser-local console, live in the
sibling `../agent-flow-studio` project. Blog AI should remain an editorial
tutorial site.

## Visual Review

When editing layout or interaction, preview locally:

```sh
node app-scripts/serve-dist.mjs
```

Inspect at least:

- desktop home.
- desktop home discovery sections.
- mobile home.
- one article page.
- search dialog.
- code and output blocks.
- article hero images and home spotlight images; diagrams must not be cropped,
  stretched, or visually broken.

Hard failures:

- horizontal overflow.
- text overlapping other UI.
- missing hero image.
- first viewport hides all evidence of the next home section.
- article text available only after JavaScript.
