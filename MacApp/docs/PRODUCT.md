# Product

Mac Agent Flow is an operations console for agent workflows.

## Primary Workflow

1. Create or select an agent from the left sidebar; the agent row opens the
   editing console.
2. Edit the agent on the canvas.
3. Open Models to add or edit LLM model configs with nicknames, backend URLs,
   API keys, and model names.
4. Select the agent's LLM model by nickname in Model.
5. Select nodes to edit prompts, Python code blocks, branch labels, and tool
   assignments in the Selected Node panel.
6. Open Tools to add, delete, or edit reusable Python tools in a full-page code
   editor.
7. View generated LangGraph Python source for the current graph in Code.
8. Trigger a run manually. If the agent contains AI nodes, the app checks the
   selected model profile before creating a run record.
9. Open the selected agent's Runs submenu to inspect numbered run history,
   status, trigger type, state summary, and a static graph snapshot with
   node-level logs.
10. Add cron-style schedules for future runs.

## UI Principles

- Keep the interface plain, quiet, and utility-first.
- Use a three-pane layout for the console: agent list, canvas, inspector.
- Make the agent/sidebar pane and the inspector pane resizable with native
  split-view dividers. Operators should be able to give most of the window to
  the canvas or code inspector without fixed-width sidebars blocking them.
- Add arrow controls to collapse the entire left sidebar and the active
  right-side panel. A collapsed panel must leave a narrow rail with an obvious
  arrow to restore it. Runs is the exception: it is a focused history page with
  one left run-list column and a top-left back button to return to agents.
- Keep Tools and Models as separate full-window pages because editing tool code
  and credentials needs more space than the console inspector can provide.
- Keep historical runs as a selected-agent page from the left sidebar, not as
  an inspector tab. Clicking an agent row opens editing; the selected agent
  expands with separate Edit and Runs submenu items. Once Runs is open, hide the
  main workspace sidebar so the left side contains only the run list.
- Put primary page navigation at the top-left of the app sidebar, Codex-style:
  Console, Tools, and Models. Do not place those page switches on the right side
  of the toolbar.
- Keep the primary app bar above the panes and out of the macOS titlebar
  region, so traffic-light controls never cover agent rows or toolbar actions.
- Make the first open useful by loading realistic static sample agents.
- Open agents with the Start node selected and the right inspector focused on
  selected-node details. Creating or clicking an agent should go to the editing
  console. Run history should be visible only when the operator opens the
  selected agent's Runs submenu, not forced as the first impression.
- Keep the sidebar plain and readable: selected agent rows should be obvious
  without tinting the whole agent list.
- Agent rows should support a right-click menu with direct Edit, View Runs, and
  Delete Agent actions. Deleting an agent must confirm first because it removes
  the graph, schedules, and run history.
- Fit the sample graph into the first canvas viewport as much as practical;
  scrolling should support larger graphs, not hide the default workflow.
- When a run is selected, show a static snapshot of the graph that ran, highlight
  the traversed nodes and connectors, and let operators click nodes in the
  snapshot to filter logs for that node.
- Run history must support Split, Graph, and Logs focus modes. Logs mode gives
  the log viewer the full detail page; Graph mode gives the snapshot the full
  detail page; Split mode shows both. The app bar must show a clear back arrow
  to return to the agent editor and main agent menu.
- Historical run snapshots should default to an arranged view that keeps the
  traversed path readable. Operators can toggle back to original node positions
  when they need to inspect the exact saved layout.
- Keep connectors visually attached while a node is being dragged; graph edges
  and sockets should render from the same in-flight node position as the card.
- Show four connector sockets on every node: top, right, bottom, and left.
  Connectors should remember the exact source and target sockets.
- Let operators drag from a node socket to create a connector, drag an existing
  endpoint socket to reconnect it, and drop an endpoint on empty canvas to
  disconnect it.
- Treat connectors as first-class selections: the curve midpoint and each
  endpoint can be selected, the inspector shows its label and mounted ports, and
  Delete removes the selected connector.
- Support common editing muscle memory for editable nodes: drag to rearrange,
  Command-C to copy, Command-V to paste, and Delete to remove when the canvas is
  active. When a text field or code editor is focused, Command-C and Command-V
  must behave as normal text editing commands. Start and End are protected.
- Support standard undo and redo shortcuts for workspace edits: Command-Z and
  Command-Shift-Z.
- Keep disabled selection actions out of the primary toolbar; show copy, paste,
  and delete there only when they apply to the current selection.
- Keep inspector navigation readable at narrow widths; no tab label should be
  clipped.
- Keep selected-item editing separate from workspace-level inspector modes.
  The right inspector has Code, Model, and Schedule buttons at the top. Clicking
  a canvas node or connector switches the entire inspector back to selected
  item details.
- Put node-local edits, including prompt, Python code, branches, copy/delete,
  and tool attachments, inside the Selected Node mode.
- AI coding nodes should infer a local workspace from normal prompt text when a
  user mentions a folder path. The folder picker is a fallback for macOS access
  grants or ambiguity, not the expected way to tell the node where to work.
  Prompt-detected folders take priority over older saved folder overrides.
- Keep Code, Model, and Schedule as the only workspace-level modes in the right
  inspector. Runs belongs to the selected-agent submenu in the left sidebar.
- Show selected LLM model details only on demand with a collapsed disclosure by
  default.
- Python code must be syntax-colored wherever operators read or edit it,
  including node code blocks and generated graph source.
- Page switches, model selection, and tool selection must feel immediate. Large
  generated Python source and workspace saves should not block the click that
  triggered navigation or selection.
- Core workloads used during navigation, run history, and source viewing should
  stay inside the responsiveness budget enforced by `MacAgentFlowChecks`.
- Generated graph source belongs in a dedicated Code section. It should render
  the current topology, node functions, conditional routes, selected tools, and
  model metadata without exposing saved API keys.
- The Tools page contains workspace-level Python definitions. The starter
  library contains Reddit, Twitter/X, and AWS Read-Only. AWS starter code must
  stay read-only.
- Users can edit starter tools and create new tools by pasting Python code.
  Saving a tool requires the non-executing Python validation check to pass,
  including a `run(state, **kwargs)` entrypoint.
- The Selected Node > Tools panel should only attach, remove, or jump to edit a
  tool. It should not expose full tool source code.
- Avoid marketing-style cards or hero layouts. This is an operator tool.
- Keep controls where operators expect them: add and schedule in the toolbar,
  the manual Run Agent action as a green primary toolbar button, detailed
  editing in the inspector, and history in the selected-agent Runs page.
- Keep LLM model configuration distinct from agent graph editing: the Models
  page owns credentials and backend details, and the right inspector's Model
  mode owns the per-agent model selection.

## Agent Model

Each agent has:

- nodes: Start, AI, Python, Tool, Conditional, and End.
- edges with labels, source ports, and target ports, including branch labels for
  conditional nodes.
- schedules with cron expressions.
- runs with monotonically increasing run numbers.
- tool assignments on editable nodes.
- an optional `llmModelConfigID` that points to a workspace-level model config.

AI nodes can act as coding-harness nodes without adding a separate node type.
When an AI node prompt mentions a local folder, a manual run tries to resolve
that folder from the prompt and treats the node as a local coding task. If the
app cannot access or confidently resolve the folder, it asks the operator to
grant access with a folder picker. The node can also store an optional
validation command for post-edit checks. Legacy prompt directives remain
supported for older saved agents: `repo`, `cwd`, `repository`, and `test`, but
users should not need to know those keywords. Without a resolvable local folder
or chosen access override, AI nodes keep the normal graph-state behavior and do
not edit local files.

For large repositories, the harness does not paste the entire codebase into the
model. It builds a repo map, ignores generated/dependency folders, extracts
likely symbols and dependency references with app-owned generic source scanning,
expands likely neighbors from references and test/source names, scores files
from the task text, and packs only the highest-signal docs, manifests, source
files, symbols, and snippets into the model context. It does not invoke local
Python or any other language runtime to understand a repository. When an
embedding model is explicitly enabled in Models, it reranks likely files
semantically for better coding-harness retrieval. If no embedding model is
enabled, embeddings are not used. Before editing, the selected chat model can
make one focused retrieval pass that asks for additional paths or search terms;
the harness then repacks context around those signals. For edits, the model is
asked to prefer exact text replacements and use complete-file replacement only
for new files or broad rewrites.

Generated Python is a portable export, not a copy of the Mac app harness. The
agent graph remains the editable source of truth in the app. Exported AI nodes
get a simple built-in file-tool contract by default: `list_files`, `read_file`,
`write_file`, and `replace_in_file`. The exported source can run those tools
when the model returns JSON `tool_calls`, and it stores results under
`artifacts["portable_file_tools"]`. This keeps copied Python readable and
usable while avoiding a large embedded harness implementation.

## Workspace Tools

The workspace owns reusable tool definitions. Each tool has:

- stable ID.
- name, category, and summary.
- approval flag for mutating tools.
- Python code with a `run(state, **kwargs)` entrypoint.

The built-in starter library is:

- Reddit: social workflow calls for search, thread fetch, and draft posts.
- Twitter / X: social workflow calls for search, thread fetch, profile lookup,
  and draft posts.
- AWS Read-Only: inventory calls for STS, S3, EC2, RDS, CloudWatch, and IAM.

Tools are available to every agent through the workspace library. Attaching a
tool happens from Selected Node > Tools, stores the tool ID on that node, and
immediately changes the generated Python source for that graph. Editing a tool
opens the full Tools page, where the Python editor can take most of the window.

## LLM Model Configs

The workspace owns reusable model configs. Each config has:

- nickname.
- backend.
- base URL.
- API key.
- model name.

Agents reference configs by ID and display them by nickname. This keeps API
details centralized on the Models page while allowing each agent to choose a
different model from the console.

Embedding model configs are separate from chat models. They are optional,
workspace-wide, and common across all agents. The Models page lets operators add
embedding profiles, test the `/embeddings` endpoint, and enable or disable the
one active embedding profile used to improve coding-harness retrieval. If no
embedding model is enabled, the app does not call embeddings.

The built-in default model is `Local Qwen 35B`, pointing at
`http://127.0.0.1:1234/v1` with model name `qwen/qwen3.6-35b-a3b`. It is placed
first in the model list so new agents use the local OpenAI-compatible server by
default. `OpenAI Production` remains available as an editable secondary config.
The Models page includes a Test action that calls the configured
OpenAI-compatible chat endpoint and reports whether the selected model responds.

## Built-In Static Flows

The default workspace includes local, deterministic sample agents:

- Release Readiness Agent: tools, AI planning, conditional routing, and Python
  packaging.
- Static Data Pipeline Agent: local Python loading, profiling, repair routing,
  and summary.
- Support Triage Agent: local Python parsing, AI classification, branch routing,
  and outcome recording.

These examples must not call the internet. They exist to test product flows and
operator ergonomics.

## Harness Skills

The app carries local harness skills in
`Sources/MacAgentFlowCore/Models.swift` under `HarnessSkill.recommended`.
They encode the project-maintenance loop:

- repository map.
- progressive docs.
- mechanical checks.
- representative samples.
- explicit state model.
- runbook.
- review loop.
- project isolation.
