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
- `HarnessSkill`

The model is intentionally independent from SwiftUI so agents can test product
logic without launching the app.

## Run Engine

Source: `Sources/MacAgentFlowCore/Services.swift`

The current run engine is deterministic. It validates the graph, walks from
Start to End, follows the first matching conditional branch, and emits a
Jenkins-style `AgentRun` with logs and a state summary.

This gives the app an end-to-end operator loop before real provider execution
is connected.

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

- `ContentView.swift`: three-pane shell and toolbar.
- `AgentCanvasView.swift`: grid, four-port connectors, connector selection, and
  selectable draggable nodes.
- `InspectorView.swift`: configuration, model config editing, selected
  node/connector editing, tools, runs, schedules, and harness.
- `WorkspaceStore.swift`: app state and mutations.
- `MacAgentFlowCore/Services.swift`: graph validation, run simulation, and
  testable graph edit operations for delete and duplicate behavior.
