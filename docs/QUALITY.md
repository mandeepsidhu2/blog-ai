# Quality

Quality is enforced through generated-site checks and targeted visual review.

## Commands

Build:

```sh
SITE_URL=https://learn.toolsite.com node app-scripts/build-site.mjs
```

Check:

```sh
node operator/scripts/check-public-content.mjs --self-test
node operator/scripts/check-public-content.mjs
node app-scripts/check-site.mjs
node operator/scripts/upgrade-svg-library.mjs --check
```

Preview:

```sh
node app-scripts/serve-dist.mjs
```

Operator-generated article batches can be validated without uploading:

```sh
node operator/scripts/upgrade-svg-library.mjs \
  --assets-dir /tmp/generated-ai-content/assets

node operator/scripts/check-public-content.mjs \
  --articles-dir /tmp/generated-ai-content/articles \
  --assets-dir /tmp/generated-ai-content/assets \
  --source-label generated-ai-content \
  --quality-profile automation \
  --editorial-review /tmp/generated-ai-content/editorial-review.json

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
- SVG article assets use the publication visual-system marker, avoid generic
  Arial/Helvetica slide styling and oversized card radii, contain enough
  graphical marks to be a useful figure, and pass bounded-label repair so
  captions do not run outside their canvas or panel.
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
- with `--quality-profile automation`, the batch has exactly one
  `deep-research` article and two `timely-analysis` articles across three
  distinct topics. Tier-specific evidence density, unique source/domain
  diversity, substantive code and outputs, locally sourced comparison tables,
  reproducibility manifests, measured signals, comparison limits,
  decision-guidance, and adoption-boundary requirements are enforced.
- automation candidates are checked for reused slugs, near-duplicate prose,
  copied long paragraphs, and title similarity against the committed library.
- `--editorial-review` is mandatory for automation batches. Its structured JSON
  records seven rubric scores, the strongest counterargument, the weakest claim,
  the main reproduction barrier, and at least two substantive revisions for
  each article.

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
3. Preview.
4. Browser-review desktop and mobile.

For infrastructure changes:

1. Inspect Terraform text.
2. Do not run Terraform/OpenTofu/AWS commands from this repo.
3. Verify docs still point to `../infrastructure/blog-ai-frontend`.
4. Keep Agent Flow Studio deployment checks in the sibling repo and
   `../infrastructure/agent-flow-studio-frontend`.

## Documentation Checks

When behavior changes, update docs in the same patch:

- generation or output shape: `ARCHITECTURE.md`.
- article format: `CONTENT.md`.
- visual behavior: `FRONTEND.md`.
- validation commands/checks: `QUALITY.md`.
- deployment or Terraform boundary: `INFRASTRUCTURE.md`.
- agent workflow: `HARNESS.md` or `AGENTS.md`.
- Agent Flow Studio website, console, and Mac app behavior:
  `../agent-flow-studio/docs/` or `../agent-flow-studio/MacApp/docs/`.
