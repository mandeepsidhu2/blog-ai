# Frontend

The frontend is a static, editorial tutorial interface.

## Design Goals

- fast first load.
- readable long-form technical content.
- a modern editorial AI-systems identity: dark technical mastheads, warm-white
  reading surfaces, crisp data accents, and restrained motion.
- quiet, professional UI after the first-view identity moment; visual interest
  should come from real system information, diagrams, and hierarchy rather than
  decorative gradient blobs.
- visible topic navigation.
- code and output blocks that are easy to scan.
- semantic comparison tables with clear units and horizontal scrolling on
  compact screens.
- no dependency on client-side rendering for SEO article text.

## Layout

Home page:

- header with brand, topic links, and search.
- hero with a real raster visual presented as a specific systems console, not a
  generic stock illustration.
- compact layouts prioritize the proof grid and topic rail in the first
  viewport; the detailed systems console is hidden below `680px` because its
  labels are not inspectable at that size.
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
- article figures use the dark publication visual system so evidence charts and
  architecture diagrams feel native to the site instead of embedded slides.

Article page:

- left-side table of contents on desktop.
- article content in a constrained reading column.
- sticky reading-progress signal in the global header.
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
