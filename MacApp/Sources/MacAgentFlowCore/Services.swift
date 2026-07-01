import Foundation

public struct GraphIssue: Identifiable, Codable, Equatable, Sendable {
    public enum Severity: String, Codable, Equatable, Sendable {
        case warning
        case error
    }

    public var id: UUID
    public var severity: Severity
    public var message: String

    public init(id: UUID = UUID(), severity: Severity, message: String) {
        self.id = id
        self.severity = severity
        self.message = message
    }
}

public enum AgentGraphValidator {
    public static func validate(_ agent: AgentDefinition) -> [GraphIssue] {
        var issues: [GraphIssue] = []
        let nodeIDs = Set(agent.nodes.map(\.id))
        let starts = agent.nodes.filter { $0.kind == .start }
        let ends = agent.nodes.filter { $0.kind == .end }

        if starts.count != 1 {
            issues.append(GraphIssue(severity: .error, message: "Agent must have exactly one Start node."))
        }
        if ends.count != 1 {
            issues.append(GraphIssue(severity: .error, message: "Agent must have exactly one End node."))
        }

        for edge in agent.edges {
            if !nodeIDs.contains(edge.from) || !nodeIDs.contains(edge.to) {
                issues.append(GraphIssue(severity: .error, message: "Connector references a missing node."))
            }
        }

        for node in agent.nodes where node.kind != .start {
            let hasParent = agent.edges.contains { $0.to == node.id }
            if !hasParent {
                issues.append(GraphIssue(severity: .warning, message: "\(node.title) has no parent connector."))
            }
        }

        for node in agent.nodes where node.kind != .end {
            let hasChild = agent.edges.contains { $0.from == node.id }
            if !hasChild {
                issues.append(GraphIssue(severity: .warning, message: "\(node.title) has no child connector."))
            }
        }

        for node in agent.nodes where node.kind == .ai && node.prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            issues.append(GraphIssue(severity: .warning, message: "\(node.title) is AI-enabled but has no prompt."))
        }

        if agent.nodes.contains(where: { $0.kind == .ai || $0.kind == .condition }), agent.llmModelConfigID == nil {
            issues.append(GraphIssue(severity: .warning, message: "\(agent.name) has AI nodes but no LLM model selected."))
        }

        for schedule in agent.schedules where !CronExpression.isValid(schedule.cronExpression) {
            issues.append(GraphIssue(severity: .error, message: "Schedule \(schedule.name) has an invalid cron expression."))
        }

        return issues
    }
}

public enum AgentGraphEditor {
    @discardableResult
    public static func deleteNode(_ nodeID: UUID, in agent: inout AgentDefinition) -> AgentNode? {
        guard let index = agent.nodes.firstIndex(where: { $0.id == nodeID }) else { return nil }
        let node = agent.nodes[index]
        guard ![AgentNodeKind.start, .end].contains(node.kind) else { return nil }
        agent.nodes.remove(at: index)
        agent.edges.removeAll { $0.from == nodeID || $0.to == nodeID }
        return node
    }

    @discardableResult
    public static func deleteEdge(_ edgeID: UUID, in agent: inout AgentDefinition) -> AgentEdge? {
        guard let index = agent.edges.firstIndex(where: { $0.id == edgeID }) else { return nil }
        return agent.edges.remove(at: index)
    }

    @discardableResult
    public static func duplicateNode(
        _ source: AgentNode,
        in agent: inout AgentDefinition,
        offset: CanvasPoint = CanvasPoint(x: 28, y: 28)
    ) -> AgentNode? {
        guard ![AgentNodeKind.start, .end].contains(source.kind) else { return nil }
        var copy = source
        copy.id = UUID()
        copy.title = availableCopyTitle(for: source.title, in: agent.nodes)
        copy.position.x = max(24, source.position.x + offset.x)
        copy.position.y = max(24, source.position.y + offset.y)

        if let endIndex = agent.nodes.firstIndex(where: { $0.kind == .end }) {
            agent.nodes.insert(copy, at: endIndex)
        } else {
            agent.nodes.append(copy)
        }
        return copy
    }

    private static func availableCopyTitle(for title: String, in nodes: [AgentNode]) -> String {
        let existing = Set(nodes.map(\.title))
        let first = "\(title) Copy"
        guard existing.contains(first) else { return first }

        var index = 2
        while existing.contains("\(first) \(index)") {
            index += 1
        }
        return "\(first) \(index)"
    }
}

public enum CronExpression {
    public static func isValid(_ expression: String) -> Bool {
        let fields = expression.split(separator: " ", omittingEmptySubsequences: true)
        guard fields.count == 5 else { return false }
        let ranges = [0...59, 0...23, 1...31, 1...12, 0...7]
        return zip(fields, ranges).allSatisfy { field, range in
            validateField(String(field), range: range)
        }
    }

    public static func summary(_ expression: String) -> String {
        guard isValid(expression) else { return "Invalid cron expression" }
        let fields = expression.split(separator: " ").map(String.init)
        return "Minute \(fields[0]), hour \(fields[1]), day \(fields[2]), month \(fields[3]), weekday \(fields[4])"
    }

    private static func validateField(_ field: String, range: ClosedRange<Int>) -> Bool {
        if field == "*" { return true }
        return field.split(separator: ",").allSatisfy { segment in
            validateSegment(String(segment), range: range)
        }
    }

    private static func validateSegment(_ segment: String, range: ClosedRange<Int>) -> Bool {
        let stepped = segment.split(separator: "/", omittingEmptySubsequences: false)
        guard stepped.count <= 2 else { return false }
        if stepped.count == 2 {
            guard let step = Int(stepped[1]), step > 0 else { return false }
        }

        let value = String(stepped[0])
        if value == "*" { return true }
        let bounds = value.split(separator: "-", omittingEmptySubsequences: false)
        if bounds.count == 1, let number = Int(bounds[0]) {
            return range.contains(number)
        }
        if bounds.count == 2, let lower = Int(bounds[0]), let upper = Int(bounds[1]) {
            return range.contains(lower) && range.contains(upper) && lower <= upper
        }
        return false
    }
}

public enum AgentExecutionMode: Equatable, Sendable {
    case simulated
    case liveCodingHarness
}

public struct AgentRuntimeOptions: Equatable, Sendable {
    public var mode: AgentExecutionMode
    public var repositoryURL: URL?
    public var testCommand: String?
    public var maxContextTokens: Int
    public var maxHarnessIterations: Int
    public var allowInternetResearch: Bool

    public init(
        mode: AgentExecutionMode = .simulated,
        repositoryURL: URL? = nil,
        testCommand: String? = nil,
        maxContextTokens: Int = 180_000,
        maxHarnessIterations: Int = 2,
        allowInternetResearch: Bool = true
    ) {
        self.mode = mode
        self.repositoryURL = repositoryURL
        self.testCommand = testCommand
        self.maxContextTokens = maxContextTokens
        self.maxHarnessIterations = max(1, maxHarnessIterations)
        self.allowInternetResearch = allowInternetResearch
    }

    public static let simulated = AgentRuntimeOptions(mode: .simulated)
    public static let liveCodingHarness = AgentRuntimeOptions(mode: .liveCodingHarness)
}

public enum AgentRunEngine {
    public static func trigger(agent: AgentDefinition, trigger: AgentRunTrigger, now: Date = Date()) -> AgentRun {
        Self.trigger(
            agent: agent,
            trigger: trigger,
            model: Optional<LLMModelConfig>.none,
            tools: [],
            runtime: AgentRuntimeOptions.simulated,
            now: now
        )
    }

    public static func trigger(
        agent: AgentDefinition,
        trigger: AgentRunTrigger,
        model: LLMModelConfig?,
        tools: [ToolDefinition],
        runtime: AgentRuntimeOptions,
        now: Date = Date()
    ) -> AgentRun {
        let issues = AgentGraphValidator.validate(agent)
        if issues.contains(where: { $0.severity == .error }) {
            return AgentRun(
                number: agent.nextRunNumber,
                status: .failed,
                trigger: trigger,
                startedAt: now,
                finishedAt: now,
                logLines: issues.map { "Validation \($0.severity.rawValue): \($0.message)" },
                stateSummary: "Run blocked by graph validation."
            )
        }

        if runtime.mode == .liveCodingHarness {
            return triggerLiveCodingHarness(
                agent: agent,
                trigger: trigger,
                model: model,
                tools: tools,
                runtime: runtime,
                now: now
            )
        }

        return triggerSimulated(agent: agent, trigger: trigger, now: now)
    }

    private static func triggerSimulated(agent: AgentDefinition, trigger: AgentRunTrigger, now: Date) -> AgentRun {
        let orderedNodes = executionOrder(for: agent)
        var logs: [String] = []
        var state: [String: String] = [:]

        for node in orderedNodes {
            switch node.kind {
            case .start:
                logs.append("Start: initialized run state")
                state["started"] = "true"
            case .tool:
                logs.append("\(node.title): prepared tools \(node.selectedToolIDs.joined(separator: ", "))")
                state[node.title] = "tools-ready"
            case .ai:
                logs.append("\(node.title): rendered prompt with selected LLM model and produced JSON state update")
                state[node.title] = "ai-output"
            case .code:
                logs.append("\(node.title): executed local Python block")
                state[node.title] = "code-output"
            case .condition:
                let route = node.branches.first ?? "next"
                logs.append("\(node.title): selected route \(route)")
                state["route"] = route
            case .end:
                logs.append("End: finalized agent state")
                state["finished"] = "true"
            }
        }

        return AgentRun(
            number: agent.nextRunNumber,
            status: .succeeded,
            trigger: trigger,
            startedAt: now,
            finishedAt: now.addingTimeInterval(Double(max(orderedNodes.count, 1))),
            logLines: logs,
            stateSummary: state.keys.sorted().map { "\($0)=\(state[$0] ?? "")" }.joined(separator: ", ")
        )
    }

    private static func triggerLiveCodingHarness(
        agent: AgentDefinition,
        trigger: AgentRunTrigger,
        model: LLMModelConfig?,
        tools: [ToolDefinition],
        runtime: AgentRuntimeOptions,
        now: Date
    ) -> AgentRun {
        let orderedNodes = executionOrder(for: agent)
        var logs: [String] = []
        var state: [String: String] = [:]

        for node in orderedNodes {
            switch node.kind {
            case .start:
                logs.append("Start: initialized run state")
                state["started"] = "true"
            case .tool:
                logs.append("\(node.title): prepared tools \(node.selectedToolIDs.joined(separator: ", "))")
                for toolID in node.selectedToolIDs {
                    if let tool = tools.first(where: { $0.id == toolID }) {
                        state[tool.name] = tool.isMutating ? "tool-available-mutating" : "tool-available-read-only"
                    }
                }
            case .ai:
                let promptRepository = CodingHarnessPromptDirectives.repositoryURL(from: node.prompt)
                guard let repositoryURL = promptRepository ?? runtime.repositoryURL else {
                    logs.append("\(node.title): no repo/cwd directive found; kept deterministic AI state update")
                    state[node.title] = "ai-output"
                    continue
                }
                guard let model else {
                    logs.append("\(node.title): no LLM model selected for coding harness")
                    return AgentRun(
                        number: agent.nextRunNumber,
                        status: .failed,
                        trigger: trigger,
                        startedAt: now,
                        finishedAt: Date(),
                        logLines: logs,
                        stateSummary: "Run failed: missing LLM model."
                    )
                }
                let stateLines = state.keys.sorted().map { "\($0)=\(state[$0] ?? "")" }.joined(separator: "\n")
                let harnessPrompt = """
                \(node.prompt)

                Current graph state:
                \(stateLines)
                """
                let harness = CodingHarnessEngine.run(CodingHarnessRequest(
                    prompt: harnessPrompt,
                    repositoryURL: repositoryURL,
                    model: model,
                    testCommand: runtime.testCommand ?? CodingHarnessPromptDirectives.testCommand(from: node.prompt),
                    maxContextTokens: runtime.maxContextTokens,
                    maxIterations: runtime.maxHarnessIterations,
                    allowInternetResearch: runtime.allowInternetResearch
                ))
                logs.append("\(node.title): coding harness \(harness.status.rawValue)")
                logs.append(contentsOf: harness.logLines)
                state[node.title] = harness.changedFiles.isEmpty ? "coding-harness-no-edits" : "changed \(harness.changedFiles.joined(separator: "|"))"
                if harness.status != .succeeded {
                    return AgentRun(
                        number: agent.nextRunNumber,
                        status: harness.status,
                        trigger: trigger,
                        startedAt: now,
                        finishedAt: Date(),
                        logLines: logs,
                        stateSummary: "Run failed at \(node.title): \(harness.summary)"
                    )
                }
            case .code:
                logs.append("\(node.title): executed local Python block")
                state[node.title] = "code-output"
            case .condition:
                let route = node.branches.first ?? "next"
                logs.append("\(node.title): selected route \(route)")
                state["route"] = route
            case .end:
                logs.append("End: finalized agent state")
                state["finished"] = "true"
            }
        }

        return AgentRun(
            number: agent.nextRunNumber,
            status: .succeeded,
            trigger: trigger,
            startedAt: now,
            finishedAt: Date(),
            logLines: logs,
            stateSummary: state.keys.sorted().map { "\($0)=\(state[$0] ?? "")" }.joined(separator: ", ")
        )
    }

    public static func executionOrder(for agent: AgentDefinition) -> [AgentNode] {
        guard let start = agent.nodes.first(where: { $0.kind == .start }) else {
            return []
        }

        let nodesByID = Dictionary(uniqueKeysWithValues: agent.nodes.map { ($0.id, $0) })
        let outgoing = Dictionary(grouping: agent.edges, by: \.from)
        var visited: Set<UUID> = []
        var queue: [UUID] = [start.id]
        var order: [AgentNode] = []

        while let nodeID = queue.first {
            queue.removeFirst()
            guard !visited.contains(nodeID), let node = nodesByID[nodeID] else { continue }
            visited.insert(nodeID)
            order.append(node)

            let edges = outgoing[nodeID] ?? []
            if node.kind == .condition {
                let preferred = node.branches.first ?? "next"
                if let branch = edges.first(where: { $0.label == preferred }) ?? edges.first {
                    queue.append(branch.to)
                }
            } else {
                queue.append(contentsOf: edges.map(\.to))
            }
        }

        return order
    }
}

public enum AgentPythonSourceRenderer {
    private struct PythonName {
        var key: String
        var function: String
    }

    public static func render(agent: AgentDefinition, model: LLMModelConfig? = nil, tools: [ToolDefinition] = []) -> String {
        let names = pythonNames(for: agent.nodes)
        let nodesByID = Dictionary(uniqueKeysWithValues: agent.nodes.map { ($0.id, $0) })
        let conditionNodeIDs = Set(agent.nodes.filter { $0.kind == .condition }.map(\.id))
        let outgoingBySource = Dictionary(grouping: agent.edges, by: \.from)
        let selectedToolIDs = Set(agent.nodes.flatMap(\.selectedToolIDs))
        let selectedTools = tools.filter { selectedToolIDs.contains($0.id) }

        var lines: [String] = [
            "from __future__ import annotations",
            "",
            "import json",
            "import os",
            "from typing import Any, TypedDict",
            "",
            "from langgraph.graph import END, START, StateGraph",
            "",
            "try:",
            "    from openai import OpenAI",
            "except ImportError:",
            "    OpenAI = None",
            "",
            "",
            "class AgentState(TypedDict, total=False):",
            "    data: dict[str, Any]",
            "    artifacts: dict[str, Any]",
            "",
            "",
            "LLM_MODEL = \(modelLiteral(model))",
            "TOOL_SOURCES = \(toolSourcesLiteral(selectedTools))",
            "AGENT_WORKSPACE_ROOT = os.path.abspath(os.environ.get(\"AGENT_WORKSPACE_ROOT\", \".\"))",
            "PORTABLE_FILE_TOOLS = {",
            "    \"list_files\": \"List text files below AGENT_WORKSPACE_ROOT.\",",
            "    \"read_file\": \"Read a UTF-8 text file below AGENT_WORKSPACE_ROOT.\",",
            "    \"write_file\": \"Create or replace a UTF-8 text file below AGENT_WORKSPACE_ROOT.\",",
            "    \"replace_in_file\": \"Replace text inside a UTF-8 file below AGENT_WORKSPACE_ROOT.\",",
            "}",
            "",
            "",
            "def _run_tool(tool_id: str, state: AgentState, **kwargs: Any) -> dict[str, Any]:",
            "    source = TOOL_SOURCES.get(tool_id)",
            "    if source is None:",
            "        return {\"artifacts\": {tool_id: {\"error\": \"tool is not defined in this export\"}}}",
            "    namespace: dict[str, Any] = {\"Any\": Any}",
            "    exec(source, namespace)",
            "    runner = namespace.get(\"run\")",
            "    if not callable(runner):",
            "        return {\"artifacts\": {tool_id: {\"error\": \"tool code must define run(state, **kwargs)\"}}}",
            "    result = runner(state, **kwargs)",
            "    return result if isinstance(result, dict) else {\"data\": {tool_id: result}}",
            "",
            "",
            "def _run_selected_tools(tool_ids: list[str], state: AgentState) -> dict[str, Any]:",
            "    results: dict[str, Any] = {}",
            "    for tool_id in tool_ids:",
            "        results[tool_id] = _run_tool(tool_id, state)",
            "    return results",
            "",
            "",
            "def _ai_tool_names(selected_tool_ids: list[str]) -> list[str]:",
            "    names: list[str] = []",
            "    for name in selected_tool_ids + list(PORTABLE_FILE_TOOLS.keys()):",
            "        if name not in names:",
            "            names.append(name)",
            "    return names",
            "",
            "",
            "def _safe_file_tool_path(path: str) -> str:",
            "    base = os.path.abspath(AGENT_WORKSPACE_ROOT)",
            "    target = os.path.abspath(os.path.join(base, path))",
            "    if target != base and not target.startswith(base + os.sep):",
            "        raise ValueError(f\"file tool path escapes AGENT_WORKSPACE_ROOT: {path}\")",
            "    return target",
            "",
            "",
            "def _list_files(path: str = \".\", max_files: int = 200) -> list[str]:",
            "    base = _safe_file_tool_path(path)",
            "    ignored = {\".git\", \".build\", \"build\", \"dist\", \"node_modules\", \".venv\", \"venv\", \"__pycache__\"}",
            "    results: list[str] = []",
            "    for current, dirs, files in os.walk(base):",
            "        dirs[:] = [name for name in dirs if name not in ignored and not name.startswith(\".\")]",
            "        for filename in files:",
            "            full_path = os.path.join(current, filename)",
            "            rel_path = os.path.relpath(full_path, os.path.abspath(AGENT_WORKSPACE_ROOT))",
            "            results.append(rel_path)",
            "            if len(results) >= max_files:",
            "                return sorted(results)",
            "    return sorted(results)",
            "",
            "",
            "def _read_file(path: str, max_chars: int = 20000) -> str:",
            "    with open(_safe_file_tool_path(path), \"r\", encoding=\"utf-8\") as handle:",
            "        return handle.read(max_chars)",
            "",
            "",
            "def _write_file(path: str, content: str) -> dict[str, Any]:",
            "    target = _safe_file_tool_path(path)",
            "    os.makedirs(os.path.dirname(target), exist_ok=True)",
            "    with open(target, \"w\", encoding=\"utf-8\") as handle:",
            "        handle.write(content)",
            "    return {\"path\": path, \"bytes\": len(content.encode(\"utf-8\"))}",
            "",
            "",
            "def _replace_in_file(path: str, old: str, new: str, count: int = -1) -> dict[str, Any]:",
            "    target = _safe_file_tool_path(path)",
            "    with open(target, \"r\", encoding=\"utf-8\") as handle:",
            "        previous = handle.read()",
            "    if old not in previous:",
            "        return {\"path\": path, \"replacements\": 0, \"changed\": False}",
            "    updated = previous.replace(old, new, count if count >= 0 else previous.count(old))",
            "    with open(target, \"w\", encoding=\"utf-8\") as handle:",
            "        handle.write(updated)",
            "    return {\"path\": path, \"replacements\": previous.count(old) if count < 0 else min(previous.count(old), count), \"changed\": updated != previous}",
            "",
            "",
            "def _run_portable_file_tool(tool_name: str, args: dict[str, Any]) -> dict[str, Any]:",
            "    try:",
            "        if tool_name == \"list_files\":",
            "            return {\"result\": _list_files(**args)}",
            "        if tool_name == \"read_file\":",
            "            return {\"result\": _read_file(**args)}",
            "        if tool_name == \"write_file\":",
            "            return {\"result\": _write_file(**args)}",
            "        if tool_name == \"replace_in_file\":",
            "            return {\"result\": _replace_in_file(**args)}",
            "        return {\"error\": f\"unknown portable file tool: {tool_name}\"}",
            "    except Exception as exc:",
            "        return {\"error\": str(exc)}",
            "",
            "",
            "def _apply_portable_file_tool_calls(output: dict[str, Any]) -> dict[str, Any]:",
            "    calls = output.get(\"tool_calls\") or output.get(\"file_operations\") or []",
            "    if not isinstance(calls, list):",
            "        return output",
            "    results: list[dict[str, Any]] = []",
            "    for index, call in enumerate(calls):",
            "        if not isinstance(call, dict):",
            "            continue",
            "        tool_name = call.get(\"tool\") or call.get(\"name\") or call.get(\"operation\")",
            "        if tool_name not in PORTABLE_FILE_TOOLS:",
            "            continue",
            "        args = call.get(\"args\") if isinstance(call.get(\"args\"), dict) else {}",
            "        results.append({\"index\": index, \"tool\": tool_name, **_run_portable_file_tool(tool_name, args)})",
            "    if results:",
            "        artifacts = dict(output.get(\"artifacts\") or {})",
            "        artifacts[\"portable_file_tools\"] = results",
            "        output = dict(output)",
            "        output[\"artifacts\"] = artifacts",
            "    return output",
            "",
            "",
            "def _call_llm_json(prompt: str, state: AgentState, tools: list[str]) -> dict[str, Any]:",
            "    if OpenAI is None:",
            "        return {\"artifacts\": {\"llm_error\": \"openai package is not installed\"}}",
            "    client = OpenAI(",
            "        base_url=LLM_MODEL[\"base_url\"],",
            "        api_key=os.environ.get(LLM_MODEL[\"api_key_env\"], \"\"),",
            "    )",
            "    response = client.responses.create(",
            "        model=LLM_MODEL[\"model\"],",
            "        input=[",
            "            {\"role\": \"system\", \"content\": \"Return only a JSON object containing state updates. In this portable export, AI nodes can request file work by returning tool_calls like [{\\\"tool\\\": \\\"read_file\\\", \\\"args\\\": {\\\"path\\\": \\\"src/app.py\\\"}}].\"},",
            "            {\"role\": \"user\", \"content\": json.dumps({\"prompt\": prompt, \"state\": state, \"tools\": tools, \"portable_file_tools\": PORTABLE_FILE_TOOLS})},",
            "        ],",
            "    )",
            "    text = getattr(response, \"output_text\", \"\")",
            "    try:",
            "        parsed = json.loads(text)",
            "    except json.JSONDecodeError:",
            "        return {\"artifacts\": {\"llm_text\": text}}",
            "    if isinstance(parsed, dict):",
            "        parsed = _apply_portable_file_tool_calls(parsed)",
            "    return parsed if isinstance(parsed, dict) else {\"artifacts\": {\"llm_output\": parsed}}",
            "",
            "",
            "def _merge_update(state: AgentState, node_name: str, output: Any) -> dict[str, Any]:",
            "    if output is None:",
            "        output = {}",
            "    if not isinstance(output, dict):",
            "        output = {\"data\": {node_name: output}}",
            "    update = dict(output)",
            "",
            "    artifacts = dict(state.get(\"artifacts\") or {})",
            "    if isinstance(update.get(\"artifacts\"), dict):",
            "        artifacts.update(update[\"artifacts\"])",
            "    node_outputs = dict(artifacts.get(\"node_outputs\") or {})",
            "    node_outputs[node_name] = output",
            "    artifacts[\"node_outputs\"] = node_outputs",
            "    update[\"artifacts\"] = artifacts",
            "",
            "    data = dict(state.get(\"data\") or {})",
            "    custom_values = {key: value for key, value in update.items() if key not in {\"data\", \"artifacts\"}}",
            "    if custom_values:",
            "        data[node_name] = custom_values",
            "    if isinstance(update.get(\"data\"), dict):",
            "        data.update(update[\"data\"])",
            "    update[\"data\"] = data",
            "    return update"
        ]

        for node in agent.nodes {
            lines.append("")
            lines.append("")
            lines.append(contentsOf: nodeSource(for: node, name: names[node.id] ?? PythonName(key: "node", function: "node")))
        }

        lines.append("")
        lines.append("")
        lines.append("builder = StateGraph(AgentState)")
        for node in agent.nodes {
            guard let name = names[node.id] else { continue }
            lines.append("builder.add_node(\(quoted(name.key)), \(name.function))")
        }

        for start in agent.nodes where start.kind == .start {
            guard let name = names[start.id] else { continue }
            lines.append("builder.add_edge(START, \(quoted(name.key)))")
        }

        for edge in agent.edges {
            guard let source = nodesByID[edge.from],
                  !conditionNodeIDs.contains(edge.from),
                  let sourceName = names[edge.from],
                  let targetName = names[edge.to]
            else {
                continue
            }
            if source.kind == .end { continue }
            lines.append("builder.add_edge(\(quoted(sourceName.key)), \(quoted(targetName.key)))")
        }

        for node in agent.nodes where node.kind == .condition {
            guard let sourceName = names[node.id] else { continue }
            let routes = (outgoingBySource[node.id] ?? []).compactMap { edge -> (String, String)? in
                guard let targetName = names[edge.to] else { return nil }
                return (edge.label, quoted(targetName.key))
            }
            if !routes.isEmpty {
                lines.append("builder.add_conditional_edges(\(quoted(sourceName.key)), \(sourceName.function)_route, \(dictLiteral(routes)))")
            }
        }

        for end in agent.nodes where end.kind == .end {
            guard let name = names[end.id] else { continue }
            lines.append("builder.add_edge(\(quoted(name.key)), END)")
        }

        lines.append("graph = builder.compile()")
        return lines.joined(separator: "\n") + "\n"
    }

    private static func nodeSource(for node: AgentNode, name: PythonName) -> [String] {
        switch node.kind {
        case .start:
            return [
                "def \(name.function)(state: AgentState) -> dict[str, Any]:",
                "    output = {\"data\": {\"started\": True}}",
                "    return _merge_update(state, \(quoted(name.key)), output)"
            ]
        case .end:
            return [
                "def \(name.function)(state: AgentState) -> dict[str, Any]:",
                "    output = {\"data\": {\"finished\": True}}",
                "    return _merge_update(state, \(quoted(name.key)), output)"
            ]
        case .tool:
            return [
                "def \(name.function)(state: AgentState) -> dict[str, Any]:",
                "    tool_ids = \(listLiteral(node.selectedToolIDs))",
                "    output = {\"artifacts\": {\"tools\": _run_selected_tools(tool_ids, state)}}",
                "    return _merge_update(state, \(quoted(name.key)), output)"
            ]
        case .ai:
            return [
                "def \(name.function)(state: AgentState) -> dict[str, Any]:",
                "    prompt = \(quoted(node.prompt))",
                "    tools = _ai_tool_names(\(listLiteral(node.selectedToolIDs)))",
                "    output = _call_llm_json(prompt, state, tools)",
                "    return _merge_update(state, \(quoted(name.key)), output)"
            ]
        case .condition:
            let branches = node.branches.isEmpty ? ["next"] : node.branches
            let fallback = branches.first ?? "next"
            return [
                "def \(name.function)(state: AgentState) -> dict[str, Any]:",
                "    prompt = \(quoted(node.prompt))",
                "    output = _call_llm_json(prompt, state, [])",
                "    if not isinstance(output.get(\"data\"), dict) or \"route\" not in output[\"data\"]:",
                "        output = {\"data\": {\"route\": \(quoted(fallback))}, \"artifacts\": {\"router_output\": output}}",
                "    return _merge_update(state, \(quoted(name.key)), output)",
                "",
                "",
                "def \(name.function)_route(state: AgentState) -> str:",
                "    allowed = set(\(listLiteral(branches)))",
                "    route = str((state.get(\"data\") or {}).get(\"route\", \(quoted(fallback))))",
                "    return route if route in allowed else \(quoted(fallback))"
            ]
        case .code:
            let body = node.pythonCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "return {}" : node.pythonCode
            return [
                "def _\(name.function)_impl(state: AgentState) -> Any:",
                indented(body),
                "",
                "",
                "def \(name.function)(state: AgentState) -> dict[str, Any]:",
                "    output = _\(name.function)_impl(state)",
                "    return _merge_update(state, \(quoted(name.key)), output)"
            ]
        }
    }

    private static func modelLiteral(_ model: LLMModelConfig?) -> String {
        dictLiteral([
            ("nickname", quoted(model?.displayName ?? "Default Model")),
            ("backend", quoted(model?.backend.rawValue ?? LLMBackend.openAI.rawValue)),
            ("base_url", quoted(model?.baseURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? model!.baseURL : LLMBackend.openAI.defaultBaseURL)),
            ("model", quoted(model?.modelName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? model!.modelName : "gpt-4.1")),
            ("api_key_env", quoted("OPENAI_API_KEY"))
        ])
    }

    private static func toolSourcesLiteral(_ tools: [ToolDefinition]) -> String {
        dictLiteral(tools.map { ($0.id, quoted($0.pythonCode)) })
    }

    private static func pythonNames(for nodes: [AgentNode]) -> [UUID: PythonName] {
        var counts: [String: Int] = [:]
        var result: [UUID: PythonName] = [:]
        for node in nodes {
            let base = sanitizedIdentifier(node.title)
            let count = (counts[base] ?? 0) + 1
            counts[base] = count
            let unique = count == 1 ? base : "\(base)_\(count)"
            result[node.id] = PythonName(key: unique, function: unique)
        }
        return result
    }

    private static func sanitizedIdentifier(_ value: String) -> String {
        var result = ""
        var previousWasUnderscore = false
        for scalar in value.lowercased().unicodeScalars {
            let ascii = scalar.value
            let isLetter = (97...122).contains(ascii)
            let isNumber = (48...57).contains(ascii)
            if isLetter || isNumber {
                result.unicodeScalars.append(scalar)
                previousWasUnderscore = false
            } else if !previousWasUnderscore {
                result.append("_")
                previousWasUnderscore = true
            }
        }

        result = result.trimmingCharacters(in: CharacterSet(charactersIn: "_"))
        if result.isEmpty {
            result = "node"
        }
        if let first = result.unicodeScalars.first, (48...57).contains(first.value) {
            result = "node_\(result)"
        }
        return result
    }

    private static func quoted(_ value: String) -> String {
        guard let data = try? JSONEncoder().encode(value),
              let string = String(data: data, encoding: .utf8) else {
            return "\"\""
        }
        return string
    }

    private static func listLiteral(_ values: [String]) -> String {
        "[" + values.map(quoted).joined(separator: ", ") + "]"
    }

    private static func dictLiteral(_ pairs: [(String, String)]) -> String {
        "{" + pairs.map { "\(quoted($0.0)): \($0.1)" }.joined(separator: ", ") + "}"
    }

    private static func indented(_ block: String) -> String {
        let normalized = block.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        return normalized.map { line in
            line.isEmpty ? "    " : "    \(line)"
        }.joined(separator: "\n")
    }
}
