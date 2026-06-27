# Documentation Index

This directory is the repository-local knowledge base for Blog AI.

The goal is progressive disclosure: `AGENTS.md` points here, and these docs
point to the source files that prove or implement each rule. Avoid turning any
single file into a catch-all manual.

## Map

- `HARNESS.md`: how this repo applies OpenAI-style harness engineering.
- `ARCHITECTURE.md`: static generator, app shell, content payloads, SEO pages,
  and deployment shape.
- `CONTENT.md`: article format, metadata, code/output snippets, and review
  rules for tutorials.
- `FRONTEND.md`: visual design, responsive behavior, article reading patterns,
  and browser interactions.
- `QUALITY.md`: build, check, preview, browser review, and documentation review
  checklist.
- `INFRASTRUCTURE.md`: CloudFront/S3 split, pipeline buildspecs, and Terraform
  boundaries.

## Maintenance Rules

- Keep docs close to executable reality. If a script or path changes, update
  the relevant doc in the same change.
- Prefer links to source files over duplicated explanations.
- Add mechanical checks when a rule becomes important enough to enforce.
- Remove stale docs quickly. Stale guidance is worse than missing guidance for
  agent work.
- Record enduring decisions here. Do not rely on chat history, hidden context,
  or memory outside the repository.

## Source References

- OpenAI harness engineering article:
  https://openai.com/index/harness-engineering/
- App generator: `app-scripts/build-site.mjs`
- Generated-site checks: `app-scripts/check-site.mjs`
- App-specific infrastructure: `../infrastructure/blog-ai-frontend`
