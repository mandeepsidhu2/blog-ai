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
- `AgentRunSnapshot`
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
a state summary. New run records also include an `AgentRunSnapshot` containing
the node and connector topology that executed, so historical run views do not
drift when the editable agent graph changes later.

Manual toolbar runs are preflighted in `WorkspaceStore`: if the selected agent
contains AI nodes, the app requires the agent's selected model profile and calls
`LLMModelConnectionTester` before creating a run record. Scheduled runs do not
perform this interactive preflight; they enter the normal run engine and record
any failure in history.

Manual app runs use the live coding-harness runtime. AI nodes stay
deterministic unless the node prompt mentions a resolvable local folder, the
node has a saved access override, or an older saved prompt still contains an
explicit repository directive such as `repo`, `cwd`, or `repository`. Prompt
paths are checked before saved folder overrides, so stale manual selections do
not silently redirect a coding run. Paths can be absolute, home-relative, or
common user paths such as `Desktop/code/...`; the resolver also performs a
bounded fuzzy lookup under the mentioned parent folder for approximate folder
names and promotes matched package folders to a nearby project root when a
marker such as `.git`, `pyproject.toml`, `package.json`, or `Package.swift` is
found. When a workspace is
resolved, the AI node indexes the codebase, packs a bounded context window,
calls the selected OpenAI-compatible model, applies returned file edits, and
optionally runs the node's validation command. Legacy `test` prompt directives
remain supported only for backward compatibility.

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
- app-owned generic source scanning that extracts likely symbols and dependency
  references from source-like text files without invoking a language runtime.
- related-file expansion for local references, reverse references, and common
  test/source filename pairs.
- optional semantic reranking through an explicitly enabled workspace embedding
  profile. If no embedding profile is enabled, the harness does not call
  `/embeddings` and falls back to lexical/symbol retrieval.
- multi-pass retrieval through the selected chat model. The planner can request
  additional repository paths and search terms before the edit prompt is built.
- optional internet snippets from explicit URLs or lightweight search-oriented
  prompts.
- OpenAI-compatible `/chat/completions` calls, including local model servers.
- exact text-edit application for localized changes and complete-file
  replacement for new files or broad rewrites, both with path safety checks.
- validation iteration through a local test command.

The semantic reranker is opt-in. Remote or local embedding calls are not made
unless the operator enables an embedding profile in Models.

The repository index is intentionally in-memory and per run. There is no
SQLite, FAISS, LanceDB, background indexer, or persistent cache.

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
when the prompt resolves to a local workspace or the app-only node
configuration stores a folder access override. Repository paths and validation
commands are not emitted into exported Python.

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
tool code. This validation exists because workspace tools are currently authored
as Python source. It is separate from repository indexing: the coding harness
does not depend on local Python to read or rank a repo. Tool code must be
non-empty, syntactic Python when a parser is available, and must define a
`run(state, **kwargs)` entrypoint. If Python is not available, the app falls
back to a lightweight delimiter/string check.

## LLM Models

Source: `Sources/MacAgentFlowCore/Models.swift`

LLM model configs live at the workspace level and agents reference them by ID.
The stored fields are nickname, backend, base URL, API key, and model name.
`AgentWorkspace` and `AgentDefinition` decode older workspace JSON by filling
default model config values when those fields are missing.

Embedding model configs also live at the workspace level, but they are shared
across all agents instead of being attached to individual agents. At most one
embedding model is active for coding-harness retrieval, and a missing active
embedding model means embeddings are disabled.

The default config list starts with the local OpenAI-compatible Qwen model:
`http://127.0.0.1:1234/v1` and `qwen/qwen3.6-35b-a3b`. `WorkspaceStore`
normalization inserts that config into older saved workspaces when missing and
migrates agents that still point at the built-in OpenAI default to the local
model. The Models page Test action uses the same `/chat/completions` path as
the coding harness, with enough completion budget for reasoning models that
emit final content only after internal reasoning.

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

Workspace saves are dispatched to a serial utility queue after the in-memory
state is updated. UI actions should not wait for JSON encoding or disk writes.

## UI Shape

Source: `Sources/MacAgentFlowApp/`

- `ContentView.swift`: app toolbar, persistent top-left page navigation,
  console shell, top-level page routing, and global left/right collapse rails.
- `AgentCanvasView.swift`: grid, four-port connectors, connector selection, and
  selectable draggable nodes.
- `InspectorView.swift`: right-side inspector modes for selected
  node/connector editing, selected-node tool attachment, cached generated code,
  model selection, and schedules.
- `RunHistoryPage.swift`: focused selected-agent run history page with a single
  run-list column, static historical graph snapshot, arranged/original snapshot
  views, Split/Graph/Logs focus modes, traversed-path highlighting, and
  node-filtered logs.
- `ManagementPages.swift`: full-window Tools and Models pages for reusable
  Python tool source, model credentials, and model detail editing.
- `PythonCodeView.swift`: syntax-colored Python editor and read-only source
  viewer backed by `NSTextView`. Highlighting is scheduled after text updates so
  large generated source views do not block page-navigation clicks.
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
