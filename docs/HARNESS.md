# Harness Engineering

Blog AI should be easy for an agent to inspect, change, validate, and recover
as a focused article/tutorial site. This doc adapts OpenAI's
harness-engineering guidance to this repo.

Reference: https://openai.com/index/harness-engineering/

## Principles

1. `AGENTS.md` is a map, not the knowledge base.
2. `docs/` is the system of record for durable project knowledge.
3. Scripts are part of the harness. Prefer executable checks over prose-only
   requirements.
4. Source files should be legible to agents: simple structure, explicit data
   shapes, and predictable paths.
5. Human feedback should become either documentation or a mechanical check.

## Current Harness

- Context map: `AGENTS.md`
- Knowledge base: `docs/`
- Source of tutorial truth: `content/articles/*.md`
- Build harness: `app-scripts/build-site.mjs`
- Quality harness: `app-scripts/check-site.mjs`
- Preview harness: `app-scripts/serve-dist.mjs`
- Deployment harness: `pipeline/*.yml` plus `../infrastructure/blog-ai-frontend`
- Agent workflow tooling: sibling `../agent-flow-studio`

## Feedback Loop

For every non-trivial change:

1. Reproduce or inspect the current state.
2. Edit the smallest relevant source surface.
3. Build the generated app and content outputs.
4. Run generated-site checks.
5. Visually inspect when layout, reading experience, or interaction changes.
6. Promote repeated review comments into `docs/` or
   `app-scripts/check-site.mjs`.

## Split Boundary

Blog AI no longer owns the Mac workflow app, the browser-local agent console,
provider command packs, generated LangGraph/Python console code, or console
data-flow tests. Those moved to `../agent-flow-studio`.

Keep this repo focused on:

- public AI tutorial articles.
- SEO-visible tutorial HTML.
- selectively loadable content JSON.
- article search, topic pages, and reading experience.
- operator-only article-production evidence and publishing gates.

If future work needs graph editing, agent workflow design, provider command
packs, model profile UI, Mac app behavior, or browser-console generated code,
make that change in Agent Flow Studio instead of reintroducing it here.

## What To Encode

Encode a rule in docs when it guides judgment:

- article quality bar.
- visual tone.
- infrastructure ownership.
- SEO constraints.
- boundary with Agent Flow Studio.

Encode a rule in scripts when it is objective:

- article count.
- required metadata.
- required generated files.
- canonical links.
- sitemap coverage.
- code/output block presence.
- horizontal overflow checks, when browser automation is available.

## Entropy Control

Agents copy existing patterns. Keep the patterns worth copying:

- delete obsolete generated config instead of leaving it nearby.
- keep tutorial metadata consistent.
- avoid duplicate deployment paths.
- keep docs short enough to stay maintained.
- keep removed workflow-app and browser-console concepts out of Blog AI.
- prefer explicit app-specific infrastructure over clever shared abstractions
  unless there is proven repeated complexity.
