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
- a bounded editorial front door: one spotlight article, a small set of
  recommended articles, topic hubs, tag-triggered search, and a capped latest
  list.
- no raw all-article card dump. The home page must remain useful if the
  library grows to hundreds or thousands of articles.
- article-specific spotlight images use non-cropping containment so charts and
  diagrams keep their labels, axes, and text visible.

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

Agent-console behavior lives in `site/agent-console/console.js`, with styling
in `site/agent-console/console.css`. Keep its graph state, code generation,
dragging, tool list, and download behavior isolated from tutorial search and
article interactions.

The built-in console tool library is static JSON. Provider-level metadata lives
in `site/agent-console/tools/catalog.json`, and command packs live in
`site/agent-console/tools/packs/*.json`. The browser loads the catalog from
`/agent-console/tools/catalog.json`, fetches same-origin command packs only
when a pack is selected or present in a loaded sample, supports search and
category filtering, and emits selected provider packs into the downloaded
LangGraph Python as subprocess-backed tool boundaries with explicit approval
checks for mutating operations. The pack files are static assets hosted with
the S3-backed app origin. API-only provider packs, such as Reddit and
Twitter/X, use `curl` command templates with bearer-token placeholders rather
than assuming a local provider-specific CLI.

Every editable console node has an execution mode. AI-enabled nodes show a
prompt editor and may attach provider packs. Python-code nodes hide provider
packs, show a Python block editor, and run the browser-local embeddable-block
check before export. The palette exposes one generic node button; the node's
mode is selected in the inspector. Nodes can be resized from the inspector or
with the card resize handle. The left sidebar separates the selected
node/connector inspector from workspace-library actions such as samples,
provider packs, custom tools, and graph checks with distinct collapsible
top-level groups whose headers stay visible while oversized group bodies scroll
internally; samples remain behind a nested disclosure so they do not read as
part of node editing. Python-code editors use the same local syntax highlighter
as generated Python previews.

Connector drags from output ports accept the full destination node card, not
only the small input port. The draft edge snaps to the hovered node edge and
highlights the target card before release. Existing connectors expose a small
arrow-end handle that can be dragged to another node to retarget that edge
without deleting and recreating it. Connection edits keep the relevant node
inspector active when possible so the Parents and Children summary updates
from the same effective edge list as the canvas, including the connector being
dragged or retargeted. The parent and child selects reflect the active
connection values and can replace or clear those node-level connections.

Generated LangGraph code wraps Python-code node bodies so their return values
are merged into state and recorded under `artifacts["node_outputs"]`. Dict
returns update declared state keys, custom keys are also copied into `data`,
and conditional nodes may return either a branch string or a dict containing
`route`.

When an editable console node has incoming connectors, the inspector shows
upstream value accessors for those parent nodes. Python-code nodes can insert
the generated `state.get(...)` lines directly into their editor; inferred
key-level accessors come from simple upstream returns such as
`{"data": {"name": value}}`, with a whole-output fallback under
`artifacts["node_outputs"]`.

Provider-pack chips include a code view action that opens a separate browser
tab with generated LangChain-compatible `@tool` functions for every command in
that pack. Mutating command functions require an explicit approval argument.

The canvas keeps a live generated LangGraph Python preview visible while graph
edits are made. The graph library and inspector can collapse from the canvas
toolbar so larger graphs and the code preview have more room.

Custom console tools are browser-local stubs for AI-enabled nodes: users
provide a name and description, and the Python export includes an empty function
for later implementation. Console graph state, custom tools, filters, zoom, and
selected sample flow persist in browser local storage across refreshes.

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
- desktop home discovery sections.
- mobile home.
- desktop `/agent-console/`.
- mobile `/agent-console/`.
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
