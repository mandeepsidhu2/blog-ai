# Mac Agent Flow

Mac Agent Flow is a standalone SwiftUI macOS app for designing and operating
agent workflows.

The app supports:

- multiple named agents in a sidebar.
- a flowchart canvas for each agent.
- workspace-level LLM model configs with nicknames, backend URLs, API keys, and
  model names on a dedicated Models page.
- per-agent LLM model selection by nickname.
- editable selected-node details, prompts, code blocks, branch labels, and
  tool assignments.
- workspace-level Python tools with Reddit, Twitter/X, and AWS Read-Only
  starters on a dedicated Tools page.
- editable tool code with a large syntax-colored Python editor and
  non-executing validation before saving.
- generated LangGraph-style Python source for the current graph.
- portable AI-node file tools in generated Python (`list_files`, `read_file`,
  `write_file`, and `replace_in_file`) without embedding the app-only coding
  harness.
- syntax-colored Python editing and source viewing.
- four-port connector mounting with selectable, reconnectable, deletable
  connectors.
- node rearrange, delete, copy, and paste workflows, including Command-C and
  Command-V for editable nodes.
- Jenkins-style run history with numbered runs, status, trigger type, state
  summary chips, and a highlighted step timeline.
- cron-style schedules per agent.
- static sample flows for release readiness, data repair, and support triage.
- built-in harness skills that document how agents should maintain the project.

## Commands

```sh
swift build --package-path .
swift run --package-path . MacAgentFlowChecks
```

Preferred local check:

```sh
Scripts/check-macapp.sh
```

## Structure

- `Sources/MacAgentFlowCore/`: testable model, source generation, and run logic.
- `Sources/MacAgentFlowApp/`: SwiftUI UI and local persistence.
- `Sources/MacAgentFlowChecks/`: framework-free checks that run on toolchains
  without XCTest.
- `docs/`: product, architecture, and quality notes.
