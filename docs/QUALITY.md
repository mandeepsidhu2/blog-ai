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
- topic groups exist.
- home page has SEO metadata and visual asset.
- sitemap exists and covers articles.
- each article has canonical URL, `h1`, TOC, article-specific visual asset,
  generated JSON, and sitemap coverage.
- experiment-mode source articles render code blocks and output blocks.
- internal evidence metadata does not appear in generated public HTML or JSON.
- pipeline artifact contains app and content outputs.

`operator/scripts/check-public-content.mjs` currently verifies:

- required SEO metadata, including `image` and `imageAlt`.
- article-specific assets exist under `/content/v1/assets/*`.
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
4. Spot-check the generated article HTML and JSON.

For visual or interaction changes:

1. Build.
2. Check.
3. Preview.
4. Browser-review desktop and mobile.

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
