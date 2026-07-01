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
- workspace tools start with Reddit, Twitter/X, and AWS Read-Only.
- starter tool code passes Python tool validation, and invalid tool code is
  rejected.
- legacy workspace JSON decodes with default LLM model configs.
- all built-in static sample agents validate and run without network calls.
- the sample graph stays within the first-open canvas footprint.
- starter workspace tools and harness skills exist.
- graph editing supports duplicate-node, connector delete, and editable-node
  delete model operations.
- cron validation accepts and rejects expected expressions.
- manual runs create numbered Jenkins-style run records.
- invalid graphs fail before execution.
- generated Python source includes LangGraph wiring, conditional routing, custom
  node code, selected tool code, and does not emit saved API keys.
- generated Python source gives AI nodes portable file tools while keeping
  Swift harness internals out of exported code.
- conditional routing follows the preferred branch.
- coding-harness context packing includes query-relevant source while staying
  under a bounded token budget.
- live coding-harness mode does not edit files unless an AI node supplies an
  explicit repo/cwd directive.
- repo and validation directives parse from AI-node prompts.
- symbol extraction and planner-forced paths improve context selection without
  requiring a model call.

Set `MAC_AGENT_FLOW_LIVE_HARNESS_CHECK=1` when a localhost OpenAI-compatible
model is available to run the opt-in live check. The live check creates a
temporary Python repo, asks the local model to edit it, applies the edit, and
validates the file with `/usr/bin/python3 -m py_compile`. It also verifies that
the local embedding endpoint is used for semantic reranking when available.

## UI Review

For UI changes, inspect the app manually after build:

- agent sidebar creation and selection.
- top-left sidebar navigation shows Console, Tools, and Models, with the active
  page highlighted.
- agent rename field.
- first launch opens with the Start node selected and Source visible below the
  selected-item panel, not an expanded historical run.
- Models page for adding, editing, viewing, and deleting LLM configs.
- Agent inspector section shows model nicknames, with selected model details
  collapsed by default.
- Agent inspector section does not show graph-count summary pills.
- Selected Node is visually dominant when a node is selected.
- Selected Node owns node-local Details and Tools modes; attaching tools there
  updates that node rather than looking like a workspace-wide action.
- inspector tab labels remain readable, including Harness.
- Source opens generated Python for the active graph and remains scrollable.
- Source updates when the canvas topology, node prompts, Python code, branch
  labels, model selection, or selected-node tool assignments change.
- Generated Source should show portable AI-node file tools and selected
  workspace tools, not the full app-only coding harness.
- Python node code and generated Source code use syntax coloring for keywords,
  functions, strings, comments, and numbers.
- Tools page can add tools, edit starter tools, paste Python code, validate
  code, save valid tools, delete tools, and focus the Python code editor.
- Selected Node > Tools only attaches/removes tools and exposes edit shortcuts
  into the Tools page; it does not show full tool source code in the console.
- AWS starter tool remains clearly read-only.
- node add menu.
- canvas node selection and dragging.
- connectors and sockets stay attached to a node while it is being dragged, not
  only after drop.
- workspace undo and redo through Command-Z and Command-Shift-Z.
- node deletion from contextual selection actions, context menu, inspector, and
  Delete key.
- node copy/paste from contextual selection actions, context menu, and
  Command-C / Command-V.
- node connector sockets on top, right, bottom, and left.
- connector create, endpoint reconnect, and empty-canvas disconnect gestures.
- connector midpoint selection, endpoint selection, inspector label editing, and
  Delete-key removal.
- selected node detail fields and agent fields.
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
