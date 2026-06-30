# Mac Agent Flow Docs

This directory is the knowledge base for the standalone Mac app under
`MacApp/`.

## Map

- `PRODUCT.md`: product workflows and UI principles.
- `ARCHITECTURE.md`: SwiftPM targets, model boundaries, LLM model configs, run
  engine, schedules, and persistence.
- `QUALITY.md`: build/check commands and review checklist.

## Maintenance Rules

- Keep this documentation scoped to `MacApp/`.
- Prefer links to source files over duplicated implementation detail.
- Update docs in the same change as product behavior changes.
- Add or update `MacAgentFlowChecks` when an objective behavior should not
  regress.
