# Product

Mac Agent Flow is an operations console for agent workflows.

## Primary Workflow

1. Create or select an agent from the left sidebar.
2. Edit the agent on the canvas.
3. Open Models to add or edit LLM model configs with nicknames, backend URLs,
   API keys, and model names.
4. Select the agent's LLM model by nickname in Agent.
5. Select nodes to edit prompts, Python code blocks, branch labels, and tool
   assignments in the Selected Node panel.
6. Open Tools to add, delete, or edit reusable Python tools in a full-page code
   editor.
7. View generated LangGraph Python source for the current graph in Source.
8. Trigger a run manually.
9. Inspect numbered run history, status, trigger type, state summary, and a
   step-by-step timeline of the traversed path.
10. Add cron-style schedules for future runs.

## UI Principles

- Keep the interface plain, quiet, and utility-first.
- Use a three-pane layout for the console: agent list, canvas, inspector.
- Keep Tools and Models as separate full-window pages because editing tool code
  and credentials needs more space than the console inspector can provide.
- Put primary page navigation at the top-left of the app sidebar, Codex-style:
  Console, Tools, and Models. Do not place those page switches on the right side
  of the toolbar.
- Keep the primary app bar above the panes and out of the macOS titlebar
  region, so traffic-light controls never cover agent rows or toolbar actions.
- Make the first open useful by loading realistic static sample agents.
- Open agents with the Start node selected and Source available below the
  selected-item panel. Run history should be
  visible when the operator chooses Runs, not forced as the first impression.
- Keep the sidebar plain and readable: selected agent rows should be obvious
  without tinting the whole agent list.
- Fit the sample graph into the first canvas viewport as much as practical;
  scrolling should support larger graphs, not hide the default workflow.
- When a run is selected, highlight the nodes and connectors that actually ran.
  The history panel and canvas should tell the same story.
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
  Command-C to copy, Command-V to paste, and Delete to remove. Start and End are
  protected.
- Support standard undo and redo shortcuts for workspace edits: Command-Z and
  Command-Shift-Z.
- Keep disabled selection actions out of the primary toolbar; show copy, paste,
  and delete there only when they apply to the current selection.
- Keep inspector navigation readable at narrow widths; no tab label should be
  clipped.
- Keep selected-item editing separate from agent and workspace navigation.
  Selected Node should be the dominant section once a node is selected.
- Put node-local edits, including prompt, Python code, branches, copy/delete,
  and tool attachments, inside the Selected Node panel.
- Keep Source, Agent, Runs, Schedule, and Harness in the
  Agent & Workspace navigation because those sections are not edits to a single
  selected node.
- Show selected LLM model details only on demand with a collapsed disclosure by
  default.
- Python code must be syntax-colored wherever operators read or edit it,
  including node code blocks and generated graph source.
- Generated graph source belongs in a dedicated Source section. It should render
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
- Keep controls where operators expect them: add/trigger/schedule in the
  toolbar, detailed editing in the inspector, history in the Runs section.
- Keep LLM model configuration distinct from agent graph editing: the Models
  page owns credentials and backend details, Agent owns the per-agent model
  selection.

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
When an AI node prompt includes `repo: /path/to/project`, `cwd:
/path/to/project`, or `repository: /path/to/project`, a manual run treats that
node as a local coding task. The prompt can also include `test: <command>` to
tell the harness how to validate edits. Without a repo directive, AI nodes keep
the normal graph-state behavior and do not edit local files.

For large repositories, the harness does not paste the entire codebase into the
model. It builds a repo map, ignores generated/dependency folders, scores files
from the task text, and packs only the highest-signal docs, manifests, source
files, symbols, and snippets into the model context. When a localhost embedding
model is available, it also reranks likely files semantically. Before editing,
the selected chat model can make one focused retrieval pass that asks for
additional paths or search terms; the harness then repacks context around those
signals.

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
