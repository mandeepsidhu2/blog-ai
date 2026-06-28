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
- Automations may request outside-sandbox execution only when their prompt
  explicitly allows it and the step is required for the run. Record the reason
  in the run report.
- Do not publish weak, incomplete, failing, local-diagnostic, or hype-driven
  content. A run that publishes nothing is acceptable if the evidence is not
  strong enough.
- Do not run `terraform`, `tofu`, or unrelated cloud-mutating commands unless
  the user explicitly changes the automation prompt to allow that work.
- AWS CLI commands are allowed only for automations whose prompt explicitly
  authorizes them, and only for the exact publishing or verification workflow
  described by that prompt.
- Do not commit or push automatically unless the automation prompt requires that
  behavior. `latest-ai-article-production.md` is allowed to `git add`,
  `git commit`, and `git push origin main` only after passing article
  candidates have been promoted into committed content and all mandatory gates
  pass.
