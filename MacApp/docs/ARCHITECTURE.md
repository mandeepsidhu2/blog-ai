# Architecture

Mac Agent Flow is a standalone SwiftPM project.

## Targets

- `MacAgentFlowCore`: serializable model and deterministic product logic.
- `MacAgentFlowApp`: SwiftUI macOS app.
- `MacAgentFlowChecks`: framework-free behavior checks.

## Core Model

Source: `Sources/MacAgentFlowCore/Models.swift`

The core model is Codable and Sendable:

- `AgentWorkspace`
- `AgentDefinition`
- `AgentNode`
- `AgentEdge`
- `AgentRun`
- `AgentSchedule`
- `LLMModelConfig`
- `ToolDefinition`
- `PythonToolValidator`
- `HarnessSkill`

The model is intentionally independent from SwiftUI so agents can test product
logic without launching the app.

## Run Engine

Source: `Sources/MacAgentFlowCore/Services.swift`

The default run engine remains deterministic for sample flows and product
checks. It validates the graph, walks from Start to End, follows the first
matching conditional branch, and emits a Jenkins-style `AgentRun` with logs and
a state summary.

Manual app runs use the live coding-harness runtime. AI nodes stay
deterministic unless their prompt contains an explicit repository directive
such as `repo: /path/to/project`, `cwd: /path/to/project`, or
`repository: /path/to/project`. When a repo is supplied, the AI node indexes the
codebase, packs a bounded context window, calls the selected
OpenAI-compatible model, applies returned file edits, and optionally runs the
`test:` command from the node prompt.

## Coding Harness

Source:

- `Sources/MacAgentFlowCore/CodingHarness.swift`
- `Sources/MacAgentFlowCore/CodingHarnessRepositoryIndex.swift`
- `Sources/MacAgentFlowCore/CodingHarnessSupport.swift`

The coding harness is backend-only. It does not add editor controls. It gives
AI nodes a Codex-style code-editing loop:

- repository indexing with common generated/dependency folders ignored.
- cheap token estimation and context packing for repositories larger than the
  active model window.
- high-signal file ranking from repo maps, manifests, docs, paths, query terms,
  and local symbol hits.
- syntax-pattern symbol extraction for Python, Swift, JavaScript, and
  TypeScript source files.
- optional local semantic reranking through an OpenAI-compatible localhost
  `/embeddings` endpoint. The harness discovers an embedding model from the
  local `/models` list and falls back to lexical/symbol retrieval if embeddings
  are unavailable.
- multi-pass retrieval through the selected chat model. The planner can request
  additional repository paths and search terms before the edit prompt is built.
- optional internet snippets from explicit URLs or lightweight search-oriented
  prompts.
- OpenAI-compatible `/chat/completions` calls, including local model servers.
- complete-file edit application with path safety checks.
- validation iteration through a local test command.

The semantic reranker is local-only by default. Remote embedding calls are not
made implicitly.

The harness blocks cloud-mutating command names in validation commands
(`aws`, `terraform`, `tofu`, `kubectl`, and `helm`) to honor this repo's
execution rules.

## Python Source

Source: `Sources/MacAgentFlowCore/Services.swift`

`AgentPythonSourceRenderer` converts the active agent graph into LangGraph-style
Python. It emits node functions, an OpenAI-compatible LLM call boundary,
conditional routers, custom Python node bodies, selected tools, and `StateGraph`
wiring. Runtime API keys are read from environment variables in the generated
code rather than copied from saved app credentials.

Generated Python deliberately does not embed the Swift coding harness,
repository indexer, semantic reranker, or multi-pass retrieval loop. The active
agent graph remains the source of truth, and Python source is a clean export.
When an AI node is exported, it receives a small portable file-tool contract by
default:

- `list_files`
- `read_file`
- `write_file`
- `replace_in_file`

Those tools are rooted at `AGENT_WORKSPACE_ROOT`, which defaults to the current
working directory. An exported AI node can request them by returning JSON
`tool_calls`; results are stored under `artifacts["portable_file_tools"]`.
Inside the Mac app, the same AI node may use the stronger Swift coding harness
when its prompt contains an explicit repo/cwd directive.

Selected tool definitions are exported in `TOOL_SOURCES`, and tool nodes call
them through `_run_selected_tools`. Each tool source must define
`run(state, **kwargs)`.

## Workspace Tools

Source: `Sources/MacAgentFlowCore/Models.swift`

`ToolDefinition` is a workspace-level Python tool object. It stores the stable
tool ID, name, category, summary, approval flag, and Python source code. The
starter catalog is Reddit, Twitter/X, and AWS Read-Only. The AWS starter tool is
non-mutating and only describes read-only inventory calls.

`PythonToolValidator` performs the local non-executing save gate for pasted
tool code. When `/usr/bin/python3` is available, it parses the source with
Python's AST parser without executing it. The code must be non-empty, syntactic
Python, and must define a `run(state, **kwargs)` entrypoint. If Python is not
available, the app falls back to a lightweight delimiter/string check.

## LLM Models

Source: `Sources/MacAgentFlowCore/Models.swift`

LLM model configs live at the workspace level and agents reference them by ID.
The stored fields are nickname, backend, base URL, API key, and model name.
`AgentWorkspace` and `AgentDefinition` decode older workspace JSON by filling
default model config values when those fields are missing.

## Schedules

Cron validation supports five-field cron expressions with:

- `*`
- comma lists
- ranges
- step values

Scheduling is modeled, validated, persisted, and editable in the app. Manual
Run uses the deterministic local run engine.

## Persistence

Source: `Sources/MacAgentFlowApp/WorkspaceStore.swift`

The app persists workspace JSON under Application Support:

`~/Library/Application Support/MacAgentFlow/workspace.json`

The sample workspace is used when no saved workspace exists.

## UI Shape

Source: `Sources/MacAgentFlowApp/`

- `ContentView.swift`: app toolbar, persistent top-left page navigation,
  console shell, and top-level page routing.
- `AgentCanvasView.swift`: grid, four-port connectors, connector selection, and
  selectable draggable nodes.
- `InspectorView.swift`: selected node/connector editing, selected-node tool
  attachment, generated source, agent settings, runs, schedules, and harness.
- `ManagementPages.swift`: full-window Tools and Models pages for reusable
  Python tool source, model credentials, and model detail editing.
- `PythonCodeView.swift`: syntax-colored Python editor and read-only source
  viewer backed by `NSTextView`.
- `WorkspaceStore.swift`: app state and mutations.
- `MacAgentFlowCore/Services.swift`: graph validation, deterministic and live
  run modes, and testable graph edit operations for delete and duplicate
  behavior.
- `MacAgentFlowCore/CodingHarness.swift`: public AI-node coding harness request,
  result, and run loop.
- `MacAgentFlowCore/CodingHarnessRepositoryIndex.swift`: local repo scan,
  symbol extraction, semantic rerank, and multi-pass context selection.
- `MacAgentFlowCore/CodingHarnessSupport.swift`: OpenAI-compatible calls, JSON
  edit plans, file edit application, internet snippets, and validation command
  execution.
