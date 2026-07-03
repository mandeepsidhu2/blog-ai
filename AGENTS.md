# Blog AI Agent Map

Use this file as a map, not an encyclopedia. Start here, then open only the
docs needed for the task.

This repo follows the harness-engineering pattern described by OpenAI:
repository-local knowledge is the system of record, agents should have a small
entry point, and validation should be mechanical wherever possible.

Reference:

- OpenAI, "Harness engineering: leveraging Codex in an agent-first world":
  https://openai.com/index/harness-engineering/

## Execution Rules

- Do not run `aws`, `terraform`, `tofu`, or any command that creates or alters
  cloud resources unless the user explicitly asks for publishing, deployment,
  import, apply, or other cloud work in the current task.
- Torch experiments are not part of this app. If a future task introduces
  torch, use MPS only and stop if MPS is unavailable.
- Generated build output under `dist/` is disposable. Edit source files instead.
- Keep documentation updates in the same change as source behavior changes.
- Local model catalog, when available: `curl -s http://localhost:1234/api/v1/models`.
  If it is unavailable, record that in operator project outputs instead of
  blocking unrelated publishing work.
- Customer-facing articles must not expose operator failures, localhost service
  health, private filesystem paths, AWS profiles, Terraform state details, or
  other internal run diagnostics. Keep those details in `operator/` outputs and
  set generated projects to `publish: false` when they are only useful to us.
- Never publish incomplete, failing, placeholder, or merely exploratory content.
  Public tutorials must be production-grade, customer-facing, current for the
  topic, and supported by an article-specific visual asset, empirical or
  operational signals, and production-readiness guidance. Measured
  implementation articles must also include runnable code and outputs.
- Internally, articles can be strategy/trend pieces or experiment-supported
  technical pieces. Publicly, the distinction is invisible: customers see one
  article library. Do not label public content as DIY, operator-generated,
  research-backed, experiment-backed, strategy, experiment, or trend content.
  Topic, domain, tags, and SEO intent are independent of `evidenceMode`; an
  embedding-model trend article and an embedding-model measured tutorial should
  share the same customer-facing domain language when appropriate.
- Quality beats quantity. Publish no more than 50 articles per day, and only
  when each article is deep enough for real engineers and research-minded
  readers to lean on. Lightweight demos, filler prose, deterministic-fixture
  writeups, and articles with a generic `Production extension` section must not
  be published.

## Start Here

- `docs/INDEX.md`: documentation map and maintenance rules.
- `docs/HARNESS.md`: harness-engineering principles for this repo.
- `docs/ARCHITECTURE.md`: app shell, content output, SEO pages, and deploy shape.
- `docs/CONTENT.md`: article authoring contract and metadata rules.
- `docs/FRONTEND.md`: UI, reading experience, and interaction standards.
- `docs/QUALITY.md`: validation commands and review checklist.
- `docs/INFRASTRUCTURE.md`: app-specific Terraform boundary and deployment paths.

## Project Areas

- `content/articles/`: Markdown tutorial source of truth.
- `site/assets/`: browser JS, CSS, and project-owned visual assets.
- `app-scripts/build-site.mjs`: static generator for app shell, SEO pages, content
  JSON, manifest, sitemap, and pipeline artifact.
- `app-scripts/check-site.mjs`: mechanical generated-site checks.
- `app-scripts/serve-dist.mjs`: local preview server for app and content outputs.
- `operator/scripts/`: operator-only helpers used by us, not by the app runtime
  or pipeline.
- `operator/automations/`: repo-visible Codex automation prompts. The Codex app
  owns the live schedule, but the automation instructions must be reviewed here.
- `operator/diy-project-blogs/`: internal evidence workspaces for article
  experiments, findings, charts, screenshots, local model catalog snapshots, and
  reproducible code runs. Customers should never see this folder name or the DIY
  framing in article copy.
- `pipeline/`: CodeBuild buildspecs consumed by the app-specific Terraform
  stack in `../infrastructure/blog-ai-frontend`.

## Build And Validation

Use the bundled Node runtime if local `node` is unavailable:

```sh
SITE_URL=https://learn.toolsite.com node app-scripts/build-site.mjs
node operator/scripts/check-public-content.mjs
node app-scripts/check-site.mjs
```

For visual review:

```sh
node app-scripts/serve-dist.mjs
```

Then inspect:

- Home: `http://127.0.0.1:4173/`
- Article: `http://127.0.0.1:4173/tutorials/llm-context-boundary-evaluation/`
- Content JSON: `http://127.0.0.1:4173/content/v1/manifest.json`

## Agent Operating Loop

1. Read `docs/INDEX.md`, then the smallest relevant doc.
2. Inspect the source files before editing.
3. Make scoped changes.
4. Run the smallest mechanical validation that proves the change.
5. If a failure reveals a missing rule, update the relevant doc or script.

## Critical Product Constraints

- SEO article pages under `/tutorials/*` must be crawler-visible HTML.
- Content payloads under `/content/v1/*` must stay selectively loadable.
- Code and output snippets must remain readable on mobile and desktop.
- The left-side article table of contents is generated from `h2` and `h3`.
- Do not introduce client-side-only article rendering as the only SEO surface.
- Public content is for customers learning AI systems. It should teach a useful
  technique and help readers stay ahead in AI, not describe our local publishing
  failures or workstation state.
- Public article pages must not expose our internal source distinction. Strategy
  articles and evidence-backed coding articles both render as normal tutorials.
- Agent workflow tools, including the Mac app and browser-local agent console,
  live in the sibling `../agent-flow-studio` project, not in this blog repo.
- Publishing is allowed only after `operator/scripts/check-public-content.mjs`,
  `app-scripts/build-site.mjs`, and `app-scripts/check-site.mjs` pass. If any
  article fails, do not publish the batch; report the failing article and reason.
