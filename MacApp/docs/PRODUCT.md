# Product

Mac Agent Flow is an operations console for agent workflows.

## Primary Workflow

1. Create or select an agent from the left sidebar.
2. Edit the agent on the canvas.
3. Add or edit LLM model configs with nicknames, backend URLs, API keys, and
   model names.
4. Select the agent's LLM model by nickname in Config.
5. Select nodes to edit prompts, Python code blocks, branch labels, and tool
   assignments.
6. Trigger a run manually.
7. Inspect numbered run history, status, trigger type, state summary, and a
   step-by-step timeline of the traversed path.
8. Add cron-style schedules for future runs.

## UI Principles

- Keep the interface plain, quiet, and utility-first.
- Use a three-pane layout: agent list, canvas, inspector.
- Keep the primary app bar above the panes and out of the macOS titlebar
  region, so traffic-light controls never cover agent rows or toolbar actions.
- Make the first open useful by loading realistic static sample agents.
- Fit the sample graph into the first canvas viewport as much as practical;
  scrolling should support larger graphs, not hide the default workflow.
- When a run is selected, highlight the nodes and connectors that actually ran.
  The history panel and canvas should tell the same story.
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
- Open agents with existing run history on the Runs tab; selecting a node moves
  the inspector back to Config.
- Avoid marketing-style cards or hero layouts. This is an operator tool.
- Keep controls where operators expect them: add/trigger/schedule in the
  toolbar, detailed editing in the inspector, history in the Runs section.
- Keep LLM model configuration distinct from agent graph editing: Models owns
  credentials and backend details, Config owns the per-agent model selection.

## Agent Model

Each agent has:

- nodes: Start, AI, Python, Tool, Conditional, and End.
- edges with labels, source ports, and target ports, including branch labels for
  conditional nodes.
- schedules with cron expressions.
- runs with monotonically increasing run numbers.
- tool assignments on editable nodes.
- an optional `llmModelConfigID` that points to a workspace-level model config.

## LLM Model Configs

The workspace owns reusable model configs. Each config has:

- nickname.
- backend.
- base URL.
- API key.
- model name.

Agents reference configs by ID and display them by nickname. This keeps API
details centralized while allowing each agent to choose a different model.

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
