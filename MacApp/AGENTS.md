# Mac Agent Flow Map

This folder is an independent macOS app project. Treat it separately from the
static tutorial site in the repository root.

## Execution Rules

- Do not run AWS, Terraform, OpenTofu, or cloud-mutating commands from this
  app. Tool definitions in the UI describe approved operation boundaries for
  this local app; execution remains inside the deterministic run engine.
- Keep the app buildable with SwiftPM.
- Keep product behavior covered by `MacAgentFlowChecks`.
- Keep docs short and current. Add a mechanical check when a rule can be
  verified by code.
- Generated Python must remain portable. Do not embed the Swift coding harness,
  repo indexer, semantic reranker, or app-only run loop in exported source; AI
  nodes should export only small built-in file tools plus selected workspace
  tools.

## Start Here

- `docs/INDEX.md`: documentation map.
- `docs/PRODUCT.md`: product shape and user workflows.
- `docs/ARCHITECTURE.md`: target layout, model boundaries, persistence, and run
  engine.
- `docs/QUALITY.md`: build, check, and review loop.

## Project Areas

- `Sources/MacAgentFlowCore/`: serializable agent model, cron validation, graph
  validation, and deterministic run engine.
- `Sources/MacAgentFlowApp/`: SwiftUI macOS app shell, canvas, inspector, run
  history, schedules, and persistence store.
- `Sources/MacAgentFlowChecks/`: framework-free product checks.
- `Scripts/check-macapp.sh`: local build and check harness.

## Agent Operating Loop

1. Read `docs/INDEX.md`.
2. Inspect the relevant source before editing.
3. Keep changes scoped to `MacApp/` unless explicitly asked otherwise.
4. Run `Scripts/check-macapp.sh`.
5. If a repeated review issue is objective, add or update a check.
