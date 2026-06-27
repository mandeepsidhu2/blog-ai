# Operator Automations

This folder contains repo-visible Codex automation prompts. The Codex app owns
the actual schedule, but the operating instructions live here so they can be
reviewed, versioned, and improved with the same rigor as source code.

Automations are operator-only. They are not imported by the app runtime, the
static generator, or the CodeBuild pipeline.

## Active Automations

- `latest-ai-article-production.md`: every 12 hours, research current AI market
  signals and produce article candidates using the public content contract.

## Rules

- Read `AGENTS.md`, `docs/CONTENT.md`, `docs/QUALITY.md`, and the automation
  prompt before running.
- Treat `evidenceMode` as internal only. Topic and tags remain customer-facing
  domain metadata and may overlap across evidence modes.
- Do not publish weak, incomplete, failing, local-diagnostic, or hype-driven
  content. A run that publishes nothing is acceptable if the evidence is not
  strong enough.
- Do not run `aws`, `terraform`, `tofu`, or cloud-mutating commands unless the
  user explicitly changes the automation prompt to allow deployment.
- Do not commit or push automatically unless the automation prompt is updated to
  require that behavior.
