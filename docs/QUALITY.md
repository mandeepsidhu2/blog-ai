# Quality

Quality is enforced through generated-site checks and targeted visual review.

## Commands

Build:

```sh
SITE_URL=https://learn.toolsite.com node app-scripts/build-site.mjs
```

Check:

```sh
node app-scripts/check-site.mjs
```

Preview:

```sh
node app-scripts/serve-dist.mjs
```

Use the bundled Codex Node runtime if local `node` is unavailable.

## Mechanical Checks

`app-scripts/check-site.mjs` currently verifies:

- exactly five tutorial articles.
- search index count matches manifest count.
- topic groups exist.
- home page has SEO metadata and visual asset.
- sitemap exists and covers articles.
- each article has canonical URL, `h1`, TOC, code blocks, output blocks,
  generated JSON, and sitemap coverage.
- pipeline artifact contains app and content outputs.

## Review Loop

For content changes:

1. Build.
2. Check.
3. Spot-check the generated article HTML and JSON.

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
