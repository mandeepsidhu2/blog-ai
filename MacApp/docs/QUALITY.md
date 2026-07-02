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
- the localhost Qwen model is present first in the default model list:
  `http://127.0.0.1:1234/v1` and `qwen/qwen3.6-35b-a3b`.
- embedding model configs are optional, workspace-wide, and disabled by default
  so no embedding endpoint is called unless an operator enables one.
- workspace tools start with Reddit, Twitter/X, and AWS Read-Only.
- starter tool code passes Python tool validation, and invalid tool code is
  rejected.
- legacy workspace JSON decodes with default LLM model configs and no implicit
  embedding config.
- all built-in static sample agents validate and run without network calls.
- the sample graph stays within the first-open canvas footprint.
- starter workspace tools and harness skills exist.
- graph editing supports duplicate-node, connector delete, and editable-node
  delete model operations.
- cron validation accepts and rejects expected expressions.
- manual runs create numbered Jenkins-style run records.
- new run records include the graph snapshot that executed.
- source rendering, graph validation, execution ordering, and run-history
  workloads stay inside the responsiveness budget.
- invalid graphs fail before execution.
- generated Python source includes LangGraph wiring, conditional routing, custom
  node code, selected tool code, and does not emit saved API keys.
- generated Python source gives AI nodes portable file tools while keeping
  Swift harness internals out of exported code.
- AI coding nodes infer local workspaces from natural prompt paths, persist
  optional folder access overrides and validation commands, and exported Python
  does not leak those app-only runtime fields.
- conditional routing follows the preferred branch.
- coding-harness context packing includes query-relevant source while staying
  under a bounded token budget.
- live coding-harness mode does not edit files unless an AI node prompt
  resolves to a local workspace, has a saved folder access override, or uses an
  older saved repo/cwd directive.
- repo and validation directives parse from AI-node prompts.
- generic source symbol extraction, reference expansion, test/source pairing,
  and planner-forced paths improve context selection without requiring a model
  call, embedding model, or local language runtime.

Set `MAC_AGENT_FLOW_LIVE_HARNESS_CHECK=1` when a localhost OpenAI-compatible
model is available to run the opt-in live check. The live check creates a
temporary Python repo, asks the local model to edit it, applies the edit, and
validates the file with `/usr/bin/python3 -m py_compile`. If
`MAC_AGENT_FLOW_LIVE_EMBEDDING_MODEL` is set, it also verifies that the
explicitly configured local embedding endpoint is used for semantic reranking.

## UI Review

For UI changes, inspect the app manually after build:

- agent sidebar creation and selection.
- clicking an agent row opens the Console editing page for that agent; clicking
  the selected agent's Runs submenu opens historical runs.
- right-clicking an agent row exposes Edit Agent, View Runs, and Delete Agent;
  Delete Agent asks for confirmation and then updates the active selection.
- top-left sidebar navigation shows Console, Tools, and Models, with the active
  page highlighted. The selected agent expands with Edit and Runs submenu
  items.
- Console, Tools, Models, and model/tool row clicks respond immediately; the
  full visible row is clickable, not only the label text.
- left sidebar and right inspector can be resized by dragging their split-view
  dividers, while preserving usable minimum widths for the canvas and panels.
- global arrow controls collapse and restore the full left sidebar and the
  active right panel. Runs should not show both the main sidebar and a run list;
  it should show one run-list column plus a top-left Agents back button.
- agent rename field.
- first launch opens with the Start node selected in the inspector, not an
  expanded historical run.
- Models page for adding, editing, viewing, and deleting LLM configs.
- Models page Test action reaches the configured OpenAI-compatible chat
  endpoint and reports connection failures with the endpoint response.
- Models page exposes a separate Embedding models section. Embedding profiles
  are shared across all agents, clearly marked optional, can be tested against
  `/embeddings`, and are unused when none is enabled.
- Model inspector section shows model nicknames, with selected model details
  collapsed by default.
- Model inspector section does not show graph-count summary pills.
- Selected Node is the full inspector content when a node is selected.
- Selected Node owns node-local Details and Tools modes; attaching tools there
  updates that node rather than looking like a workspace-wide action.
- inspector mode labels remain readable: Code, Model, and Schedule.
- Code opens generated Python for the active graph and remains scrollable.
- Code updates when the canvas topology, node prompts, Python code, branch
  labels, model selection, or selected-node tool assignments change.
- Navigating away from Code or opening Console should not feel blocked by
  generated-source rendering or syntax coloring.
- Generated Code should show portable AI-node file tools and selected
  workspace tools, not the full app-only coding harness.
- Python node code and generated Code use syntax coloring for keywords,
  functions, strings, comments, and numbers.
- Tools page can add tools, edit starter tools, paste Python code, validate
  code, save valid tools, delete tools, and focus the Python code editor.
- Selected Node > Tools only attaches/removes tools and exposes edit shortcuts
  into the Tools page; it does not show full tool source code in the console.
- AI Selected Node details show prompt-based workspace detection and an
  optional validation command. The folder picker is only for granting macOS
  access or overriding ambiguous paths; when a prompt path resolves
  automatically, no Choose Folder button should be shown.
- Command-C and Command-V copy/paste selected nodes only when the canvas is the
  active editing surface; focused text fields, prompts, and code editors keep
  normal text copy/paste behavior.
- Runs opens as a dedicated selected-agent page from the left sidebar, not from
  the inspector. It hides the main app sidebar while history is open, and the
  top-left Agents back button returns to the editor and main agent menu.
  Selecting a historical run shows a static graph snapshot, highlights the
  traversed nodes and connectors, and lets node clicks filter the run logs.
- Runs supports Split, Graph, and Logs focus modes. Logs mode makes log lines
  the primary surface; Split mode keeps graph and logs visible together.
- Historical run snapshots default to arranged positions that keep the executed
  path readable, with a toggle back to original saved positions.
- The toolbar Run Agent button is visually primary/green. For manual runs with
  AI nodes, it checks the selected model connection before adding a run record
  and reports missing or unreachable model configs without polluting history.
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
- Runs page opens as a snapshot-plus-log view and highlights the traversed
  canvas path.
- Runs page focus controls, arranged/original snapshot toggle, all-logs clear
  action, one left run-list column, and right log-panel collapse rail.
- sample agents: Release Readiness, Static Data Pipeline, and Support Triage.
- schedule creation and cron validation.

Hard failures:

- app does not build with SwiftPM.
- first launch is empty or confusing.
- Trigger Run does not create history after passing manual model preflight.
- schedule editor accepts obviously invalid cron silently.
- app depends on the root website runtime.
