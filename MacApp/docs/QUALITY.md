# Quality

## Commands

From `MacApp/`:

```sh
swift build --package-path .
swift run --package-path . MacAgentFlowChecks
```

From the repository root:

```sh
MacApp/Scripts/check-macapp.sh
```

## Mechanical Checks

`MacAgentFlowChecks` verifies:

- the sample workspace opens with a realistic agent.
- workspace-level LLM model configs exist and AI-capable sample agents select a
  known model config.
- legacy workspace JSON decodes with default LLM model configs.
- all built-in static sample agents validate and run without network calls.
- the sample graph stays within the first-open canvas footprint.
- provider tools and harness skills exist.
- graph editing supports duplicate-node, connector delete, and editable-node
  delete model operations.
- cron validation accepts and rejects expected expressions.
- manual runs create numbered Jenkins-style run records.
- invalid graphs fail before execution.
- conditional routing follows the preferred branch.

## UI Review

For UI changes, inspect the app manually after build:

- agent sidebar creation and selection.
- agent rename field.
- Models inspector section for adding, editing, and deleting LLM configs.
- Config model picker shows model nicknames and selected model details.
- node add menu.
- canvas node selection and dragging.
- node deletion from the toolbar, context menu, inspector, and Delete key.
- node copy/paste from the toolbar, context menu, and Command-C / Command-V.
- node connector sockets on top, right, bottom, and left.
- connector create, endpoint reconnect, and empty-canvas disconnect gestures.
- connector midpoint selection, endpoint selection, inspector label editing, and
  Delete-key removal.
- inspector configuration fields.
- tool toggles.
- Trigger Run button and run logs.
- Runs tab opens as a timeline and highlights the traversed canvas path.
- sample agents: Release Readiness, Static Data Pipeline, and Support Triage.
- schedule creation and cron validation.
- harness skills section.

Hard failures:

- app does not build with SwiftPM.
- first launch is empty or confusing.
- Trigger Run does not create history.
- schedule editor accepts obviously invalid cron silently.
- app depends on the root website runtime.
