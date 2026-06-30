# Quality

Quality is enforced through generated-site checks and targeted visual review.

## Commands

Build:

```sh
SITE_URL=https://learn.toolsite.com node app-scripts/build-site.mjs
```

Check:

```sh
node operator/scripts/check-public-content.mjs
node app-scripts/check-site.mjs
```

Agent-console data-flow tests:

```sh
npm run test:agent-console
```

Preview:

```sh
node app-scripts/serve-dist.mjs
```

Operator-generated article batches can be validated without uploading:

```sh
node operator/scripts/check-public-content.mjs \
  --articles-dir /tmp/generated-ai-content/articles \
  --assets-dir /tmp/generated-ai-content/assets \
  --source-label generated-ai-content

node operator/scripts/publish-generated-content.mjs \
  --source-dir /tmp/generated-ai-content \
  --content-bucket blog-ai-content-349188916794 \
  --dry-run
```

Committed content can be published only through the same mandatory gates:

```sh
node operator/scripts/publish-current-site.mjs \
  --site-url https://learn.toolsite.com \
  --app-bucket blog-ai-static-349188916794 \
  --content-bucket blog-ai-content-349188916794 \
  --distribution-id E17JFCAQXSGYZW \
  --delete
```

Use the bundled Codex Node runtime if local `node` is unavailable.

## Mechanical Checks

`app-scripts/check-site.mjs` currently verifies:

- at least one approved tutorial article.
- search index count matches manifest count.
- isolated agent console route exists under `/agent-console/`, uses its own
  console assets, and does not load tutorial app CSS or JavaScript.
- agent console static provider catalog is copied under
  `/agent-console/tools/catalog.json`, local command packs are copied under
  `/agent-console/tools/packs/*.json`, and the combined pack commands cover Git,
  GitHub, GitLab, AWS, Terraform, Tofu, NPM, Docker, Kubernetes, Python, and
  Make with at least 120 static command entries.
- agent console search must find matching tools globally even when a category
  filter is selected. AI-enabled nodes must expose prompts and provider packs;
  generated Python for AI-enabled nodes must include OpenAI-compatible
  Responses API placeholders and LLM response state merging; Python-code nodes
  must expose the embeddable-block check and hide packs. Custom tools must
  export as fill-in Python stubs, and browser-local graph state should survive
  refresh.
- topic groups exist.
- home page has SEO metadata, a visual asset, curated discovery modules, topic
  and tag discovery, and a bounded number of article links.
- home and article image CSS preserves full diagrams with non-cropping image
  fit.
- every generated `<img>` reference in app and content HTML resolves to a local
  built file.
- sitemap exists and covers articles.
- each article has canonical URL, `h1`, TOC, article-specific visual asset,
  generated JSON, sitemap coverage, and a valid image asset with readable
  dimensions.
- experiment-mode source articles render code blocks and output blocks.
- internal evidence metadata does not appear in generated public HTML or JSON.
- pipeline artifact contains app and content outputs.

`operator/scripts/check-public-content.mjs` currently verifies:

- required SEO metadata, including `image` and `imageAlt`.
- article-specific assets exist under `/content/v1/assets/*` and image assets
  are SVG, PNG, or JPEG files with readable dimensions, useful minimum size, a
  landscape aspect ratio, and no remote SVG dependencies.
- SVG article assets include `<title>` and `<desc>` accessibility metadata.
- title and description are strong enough for customer-facing SEO pages.
- article depth, TOC section count, at least three code blocks, and output
  blocks for `evidenceMode: experiment`.
- at least five current sources and a source/signal/research section for
  `evidenceMode: strategy`.
- `topic` and `tags` remain customer-facing domain metadata; `evidenceMode` is
  checked only as an internal production contract and is not emitted publicly.
  Exact topic/tag values such as `strategy`, `experiment`, `trend`,
  `research-backed`, and `experiment-backed` are blocked.
- production-readiness section, empirical or operational signals, and failure
  mode or guardrail coverage.
- absence of placeholders, local failures, private paths, AWS profiles, and
  operator-only diagnostics. Public copy that exposes evidence-mode labels such
  as strategy article, experiment article, research-backed article, or trend
  article is blocked. Lightweight `Production extension` sections,
  deterministic-fixture articles, and generic hype filler are blocked.

## Review Loop

For content changes:

1. Build.
2. Run the public content gate.
3. Run the generated-site check.
4. Browser-review the generated article image and home spotlight image for
   broken placeholders, clipped labels, hidden axes, or unreadable text.
5. Spot-check the generated article HTML and JSON.

For visual or interaction changes:

1. Build.
2. Check.
3. Run `npm run test:agent-console` when generated LangGraph state handling,
   connector rewiring, node return semantics, or upstream accessors change.
4. Preview.
5. Browser-review desktop and mobile. For `/agent-console/`, verify connector
   drag creation, arrow-start and arrow-end retargeting through the padded
   transparent terminal hit zones, absence of idle endpoint blobs,
   selected-node Parents/Children summaries, and parent/child select values stay
   synchronized.

For infrastructure changes:

1. Inspect Terraform text.
2. Do not run Terraform/OpenTofu/AWS commands from this repo.
3. Verify docs still point to `../infrastructure/blog-ai-frontend`.

## Documentation Checks

When behavior changes, update docs in the same patch:

- generation or output shape: `ARCHITECTURE.md`.
- article format: `CONTENT.md`.
- visual behavior: `FRONTEND.md`.
- validation commands/checks: `QUALITY.md`.
- deployment or Terraform boundary: `INFRASTRUCTURE.md`.
- agent workflow: `HARNESS.md` or `AGENTS.md`.
