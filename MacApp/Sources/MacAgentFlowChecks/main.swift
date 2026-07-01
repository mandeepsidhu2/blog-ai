import Darwin
import Foundation
import MacAgentFlowCore

struct CheckFailure: Error, CustomStringConvertible {
    let description: String
}

func expect(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    if !condition() {
        throw CheckFailure(description: message)
    }
}

func require<T>(_ value: T?, _ message: String) throws -> T {
    guard let value else {
        throw CheckFailure(description: message)
    }
    return value
}

let checks: [(String, () throws -> Void)] = [
    ("sample workspace covers end-to-end product loop", {
        let workspace = AgentWorkspace.sample
        try expect(workspace.agents.count >= 3, "sample should create several selected test agents")
        try expect(!workspace.llmModels.isEmpty, "sample should include at least one LLM model config")
        try expect(workspace.toolCatalog.count == 3, "starter tool catalog should include exactly three tools")
        try expect(Set(workspace.toolCatalog.map(\.id)) == Set(["reddit", "twitter", "aws"]), "starter tools should be Reddit, Twitter/X, and AWS")
        try expect(workspace.harnessSkills.count >= 6, "harness skills should be present")

        let agent = try require(workspace.selectedAgent, "sample should select an agent")
        try expect(agent.nodes.count >= 5, "sample agent should include a multi-step flow")
        try expect(!agent.edges.isEmpty, "sample agent should include connectors")
        try expect(agent.runs.first?.status == .succeeded, "sample agent should include a successful run")
        try expect(agent.schedules.first?.cronExpression == "0 9 * * 1-5", "sample agent should include a cron schedule")
    }),
    ("LLM model configs are workspace-level and agent-selectable", {
        let workspace = AgentWorkspace.sample
        let modelIDs = Set(workspace.llmModels.map(\.id))
        try expect(workspace.llmModels.allSatisfy { !$0.nickname.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }, "models should have nicknames")
        try expect(workspace.llmModels.allSatisfy { !$0.modelName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }, "models should have model names")
        try expect(workspace.agents.allSatisfy { agent in
            guard agent.nodes.contains(where: { $0.kind == .ai || $0.kind == .condition }) else { return true }
            return agent.llmModelConfigID.map { modelIDs.contains($0) } ?? false
        }, "agents with AI behavior should reference a known model config")
    }),
    ("workspace tools are editable Python tool definitions", {
        let workspace = AgentWorkspace.sample
        let aws = try require(workspace.toolCatalog.first { $0.id == "aws" }, "AWS starter tool should exist")
        try expect(!aws.isMutating, "AWS starter tool should be read-only")
        try expect(aws.summary.localizedCaseInsensitiveContains("read-only"), "AWS summary should state read-only behavior")
        for tool in workspace.toolCatalog {
            let validation = PythonToolValidator.validate(tool.pythonCode)
            try expect(validation.isValid, "\(tool.name) starter code should pass validation: \(validation.message)")
            try expect(tool.pythonCode.contains("def run("), "\(tool.name) should expose run(state, **kwargs)")
        }
        let invalid = PythonToolValidator.validate("print('missing run')")
        try expect(!invalid.isValid, "tool validation should reject code without run")
    }),
    ("legacy workspace JSON decodes with default LLM configs", {
        let data = try JSONEncoder().encode(AgentWorkspace.sample)
        guard var object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw CheckFailure(description: "sample workspace should encode to a JSON object")
        }
        object.removeValue(forKey: "llmModels")
        if var agents = object["agents"] as? [[String: Any]] {
            for index in agents.indices {
                agents[index].removeValue(forKey: "llmModelConfigID")
            }
            object["agents"] = agents
        }
        let legacyData = try JSONSerialization.data(withJSONObject: object)
        let decoded = try JSONDecoder().decode(AgentWorkspace.self, from: legacyData)
        let modelIDs = Set(decoded.llmModels.map(\.id))
        try expect(!decoded.llmModels.isEmpty, "legacy workspace should gain default model configs")
        try expect(decoded.agents.allSatisfy { $0.llmModelConfigID.map { modelIDs.contains($0) } ?? false }, "legacy agents should gain a valid model selection")
    }),
    ("all built-in sample agents run without network dependencies", {
        let workspace = AgentWorkspace.sample
        for agent in workspace.agents {
            let issues = AgentGraphValidator.validate(agent).filter { $0.severity == .error }
            try expect(issues.isEmpty, "\(agent.name) should have no graph errors")

            let order = AgentRunEngine.executionOrder(for: agent)
            try expect(order.first?.kind == .start, "\(agent.name) should start with Start")
            try expect(order.last?.kind == .end, "\(agent.name) should end with End")

            let run = AgentRunEngine.trigger(agent: agent, trigger: .manual, now: Date(timeIntervalSince1970: 200))
            try expect(run.status == .succeeded, "\(agent.name) should run successfully")
            try expect(run.logLines.count == order.count, "\(agent.name) should log every traversed step")

            let codeNodes = agent.nodes.filter { $0.kind == .code }
            for node in codeNodes {
                try expect(!node.pythonCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, "\(node.title) should include static Python")
                try expect(!node.pythonCode.localizedCaseInsensitiveContains("http"), "\(node.title) should not call the internet")
            }
        }
    }),
    ("sample graph has a compact first-open footprint", {
        let agent = AgentDefinition.sample(number: 1, name: "Release")
        let maxX = agent.nodes.map { $0.position.x + $0.width }.max() ?? 0
        let maxY = agent.nodes.map { $0.position.y + $0.height }.max() ?? 0
        try expect(maxX <= 680, "sample graph should fit the first canvas viewport horizontally")
        try expect(maxY <= 540, "sample graph should fit the first canvas viewport vertically")
        try expect(agent.nodes.allSatisfy { $0.width <= 220 && $0.height <= 110 }, "sample cards should stay compact")
    }),
    ("blank agent template is vertically aligned", {
        let agent = AgentDefinition.blank(number: 2)
        let maxX = agent.nodes.map { $0.position.x + $0.width }.max() ?? 0
        let minX = agent.nodes.map(\.position.x).min() ?? 0
        let sortedY = agent.nodes.map(\.position.y).sorted()
        try expect(maxX - minX <= 220, "blank agent nodes should share one vertical lane")
        try expect(sortedY == [64, 220, 376], "blank agent should use a predictable vertical stack")
        try expect(agent.nodes.allSatisfy { $0.width <= 200 && $0.height <= 100 }, "blank agent cards should stay compact")
    }),
    ("default connectors carry explicit mount ports", {
        var agents = AgentWorkspace.sample.agents
        agents.append(AgentDefinition.blank(number: 99))
        for agent in agents {
            for edge in agent.edges {
                try expect(edge.fromPort != nil, "\(agent.name) edge should include a source port")
                try expect(edge.toPort != nil, "\(agent.name) edge should include a target port")
            }
        }
    }),
    ("graph editor supports copy, connector delete, and node delete", {
        var agent = AgentDefinition.blank(number: 7)
        let editable = try require(agent.nodes.first { ![AgentNodeKind.start, .end].contains($0.kind) }, "blank agent should include editable node")
        let originalNodeCount = agent.nodes.count

        let copy = try require(AgentGraphEditor.duplicateNode(editable, in: &agent), "editable node should duplicate")
        try expect(copy.id != editable.id, "copy should receive a new identity")
        try expect(copy.title.contains("Copy"), "copy title should be distinguishable")
        try expect(agent.nodes.count == originalNodeCount + 1, "duplicate should add exactly one node")
        try expect(!agent.edges.contains { $0.from == copy.id || $0.to == copy.id }, "duplicate should not inherit stale connectors")

        let start = try require(agent.nodes.first { $0.kind == .start }, "blank agent should include Start")
        let end = try require(agent.nodes.first { $0.kind == .end }, "blank agent should include End")
        let removableEdge = AgentEdge(from: start.id, to: copy.id, fromPort: .right, toPort: .left, label: "next")
        agent.edges.append(removableEdge)
        try expect(AgentGraphEditor.deleteEdge(removableEdge.id, in: &agent) != nil, "connector delete should remove an existing edge")
        try expect(!agent.edges.contains { $0.id == removableEdge.id }, "deleted connector should leave the graph")

        agent.edges.append(AgentEdge(from: start.id, to: copy.id, fromPort: .right, toPort: .left, label: "next"))
        agent.edges.append(AgentEdge(from: copy.id, to: end.id, fromPort: .bottom, toPort: .top, label: "next"))
        try expect(AgentGraphEditor.deleteNode(copy.id, in: &agent) != nil, "editable node should delete")
        try expect(!agent.nodes.contains { $0.id == copy.id }, "deleted node should leave the graph")
        try expect(!agent.edges.contains { $0.from == copy.id || $0.to == copy.id }, "deleting a node should remove incident connectors")
        try expect(AgentGraphEditor.deleteNode(start.id, in: &agent) == nil, "Start should be protected from deletion")
        try expect(AgentGraphEditor.deleteNode(end.id, in: &agent) == nil, "End should be protected from deletion")
    }),
    ("cron validation accepts common schedules", {
        try expect(CronExpression.isValid("0 9 * * 1-5"), "weekday schedule should be valid")
        try expect(CronExpression.isValid("*/15 * * * *"), "step schedule should be valid")
        try expect(CronExpression.isValid("30 22 1,15 * 1"), "list schedule should be valid")
        try expect(!CronExpression.isValid("0 25 * * *"), "invalid hour should fail")
        try expect(!CronExpression.isValid("0 9 *"), "short cron should fail")
        try expect(!CronExpression.isValid("a b c d e"), "non-numeric cron should fail")
    }),
    ("run engine creates Jenkins-style run record", {
        let agent = AgentDefinition.sample(number: 1, name: "Release")
        let run = AgentRunEngine.trigger(agent: agent, trigger: .manual, now: Date(timeIntervalSince1970: 100))
        try expect(run.number == 2, "run number should follow existing history")
        try expect(run.status == .succeeded, "valid graph should succeed")
        try expect(run.trigger == .manual, "manual trigger should be recorded")
        try expect(!run.logLines.isEmpty, "run should include logs")
        try expect(run.logLines.contains { $0.contains("Start") }, "run logs should include start")
        try expect(run.stateSummary.contains("finished=true"), "state summary should include finished flag")
    }),
    ("invalid graph fails before execution", {
        var agent = AgentDefinition.blank(number: 1)
        agent.nodes.removeAll { $0.kind == .end }
        let issues = AgentGraphValidator.validate(agent)
        try expect(issues.contains { $0.severity == .error }, "missing End should produce an error")

        let run = AgentRunEngine.trigger(agent: agent, trigger: .manual)
        try expect(run.status == .failed, "invalid graph should fail run")
        try expect(run.stateSummary.contains("blocked"), "failed run should explain validation block")
    }),
    ("generated Python source includes graph wiring and node code", {
        let workspace = AgentWorkspace.sample
        let agent = AgentDefinition.sample(number: 1, name: "Release")
        let source = AgentPythonSourceRenderer.render(agent: agent, model: workspace.llmModels.first, tools: workspace.toolCatalog)
        try expect(source.contains("StateGraph(AgentState)"), "source should build a LangGraph state graph")
        try expect(source.contains("builder.add_node(\"package\", package)"), "source should add Python code node")
        try expect(source.contains("builder.add_conditional_edges(\"risk_gate\""), "source should render conditional routing")
        try expect(source.contains("return {\"data\": {\"package\": \"release-candidate\"}}"), "source should preserve custom Python code")
        try expect(source.contains("TOOL_SOURCES"), "source should include selected workspace tool code")
        try expect(source.contains("_run_selected_tools(tool_ids, state)"), "source should call selected tools from tool nodes")
        try expect(source.contains("aws_read_only"), "source should include the AWS read-only starter tool")
        try expect(source.contains("graph = builder.compile()"), "source should compile the graph")
        try expect(!source.contains("sk-"), "source should not emit saved API keys")
    }),
    ("generated Python source keeps AI coding export portable", {
        let workspace = AgentWorkspace.sample
        var agent = AgentDefinition.blank(number: 12)
        guard let aiIndex = agent.nodes.firstIndex(where: { $0.kind == .ai }) else {
            throw CheckFailure(description: "blank agent should include an AI node")
        }
        agent.nodes[aiIndex].prompt = "repo: ./example\nInspect code and update state."

        let source = AgentPythonSourceRenderer.render(agent: agent, model: workspace.llmModels.first, tools: workspace.toolCatalog)
        try expect(source.contains("PORTABLE_FILE_TOOLS"), "source should declare portable AI-node file tools")
        try expect(source.contains("\"list_files\""), "source should expose list_files")
        try expect(source.contains("\"read_file\""), "source should expose read_file")
        try expect(source.contains("\"write_file\""), "source should expose write_file")
        try expect(source.contains("\"replace_in_file\""), "source should expose replace_in_file")
        try expect(source.contains("tool_calls"), "source should document the portable tool call contract")
        try expect(source.contains("tools = _ai_tool_names("), "AI nodes should receive selected tools plus portable file tools")
        try expect(source.contains("AGENT_WORKSPACE_ROOT"), "portable file tools should stay rooted to an explicit workspace root")
        try expect(!source.contains("CodingHarnessEngine"), "source should not embed the Swift coding harness")
        try expect(!source.contains("RepositoryIndexer"), "source should not embed repo indexing internals")
        try expect(!source.contains("SemanticFileRanker"), "source should not embed semantic retrieval internals")
    }),
    ("generated Python source tracks selected-node tool assignments", {
        let workspace = AgentWorkspace.sample
        var agent = AgentDefinition.sample(number: 1, name: "Release")
        for index in agent.nodes.indices {
            agent.nodes[index].selectedToolIDs = []
        }

        let withoutTools = AgentPythonSourceRenderer.render(agent: agent, model: workspace.llmModels.first, tools: workspace.toolCatalog)
        try expect(!withoutTools.contains("aws_read_only"), "source should not embed unassigned tool code")

        let editableIndex = try require(agent.nodes.firstIndex { ![AgentNodeKind.start, .end].contains($0.kind) }, "sample should include an editable node")
        agent.nodes[editableIndex].selectedToolIDs = ["aws"]

        let withTools = AgentPythonSourceRenderer.render(agent: agent, model: workspace.llmModels.first, tools: workspace.toolCatalog)
        try expect(withTools.contains("aws_read_only"), "source should embed code for tools assigned to a selected node")
        try expect(withTools.contains("tool_ids = [\"aws\"]"), "source should render the selected node's tool IDs")
    }),
    ("condition routes only preferred branch in sample", {
        let agent = AgentDefinition.sample(number: 1, name: "Release")
        let order = AgentRunEngine.executionOrder(for: agent).map(\.title)
        try expect(order.contains("Package"), "preferred branch should include Package")
        try expect(!order.contains("Request Review"), "inactive branch should be skipped")
        try expect(order.first == "Start", "execution should begin at Start")
        try expect(order.last == "End", "execution should end at End")
    }),
    ("coding harness builds bounded repo context", {
        let root = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("macagentflow-context-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root.appendingPathComponent("Sources/App"), withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: root.appendingPathComponent("node_modules/pkg"), withIntermediateDirectories: true)
        try "# Test Repo\n".write(to: root.appendingPathComponent("README.md"), atomically: true, encoding: .utf8)
        try "Use this local map.\n".write(to: root.appendingPathComponent("AGENTS.md"), atomically: true, encoding: .utf8)
        try "func targetHarnessBug() { print(\"old\") }\n".write(
            to: root.appendingPathComponent("Sources").appendingPathComponent("App").appendingPathComponent("TargetHarnessBug.swift"),
            atomically: true,
            encoding: .utf8
        )
        try "ignored".write(to: root.appendingPathComponent("node_modules/pkg/index.js"), atomically: true, encoding: .utf8)

        let context = RepositoryIndexer.context(rootURL: root, query: "fix targetHarnessBug", maxContextTokens: 600)
        try expect(context.estimatedTokens <= 700, "context should stay near the requested token budget")
        try expect(context.selectedFiles.contains("AGENTS.md"), "context should prioritize AGENTS.md")
        try expect(
            context.selectedFiles.contains("Sources/App/TargetHarnessBug.swift"),
            "context should include query-relevant source; selected \(context.selectedFiles)"
        )
        try expect(!context.selectedFiles.contains { $0.contains("node_modules") }, "context should skip dependency folders")
    }),
    ("live coding harness mode requires an explicit repo before AI nodes edit", {
        let agent = AgentDefinition.blank(number: 4)
        let run = AgentRunEngine.trigger(
            agent: agent,
            trigger: .manual,
            model: nil,
            tools: [],
            runtime: .liveCodingHarness,
            now: Date(timeIntervalSince1970: 500)
        )
        try expect(run.status == .succeeded, "live mode without repo directive should preserve deterministic AI behavior")
        try expect(run.stateSummary.contains("ai-output"), "AI node should be recorded without invoking the coding harness")
    }),
    ("coding harness directives read repo and validation lines", {
        let prompt = """
        repo: /tmp/example-repo
        test: swift test
        Update the parser.
        """
        try expect(CodingHarnessPromptDirectives.repositoryURL(from: prompt)?.path == "/tmp/example-repo", "repo directive should parse")
        try expect(CodingHarnessPromptDirectives.testCommand(from: prompt) == "swift test", "test directive should parse")
    }),
    ("coding harness symbol index and forced paths improve context selection", {
        let root = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("macagentflow-symbol-context-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root.appendingPathComponent("lib"), withIntermediateDirectories: true)
        try """
        def calculate_invoice_total(items):
            return sum(items)
        """.write(to: root.appendingPathComponent("lib").appendingPathComponent("billing.py"), atomically: true, encoding: .utf8)
        try """
        def hidden_edge_case():
            return "forced"
        """.write(to: root.appendingPathComponent("lib").appendingPathComponent("edge_case.py"), atomically: true, encoding: .utf8)

        let symbolContext = RepositoryIndexer.context(
            rootURL: root,
            query: "fix calculate_invoice_total rounding behavior",
            maxContextTokens: 800,
            options: RepositoryRetrievalOptions(includeSymbols: true)
        )
        try expect(symbolContext.text.contains("Repository Symbol Index"), "context should include a symbol index")
        try expect(symbolContext.text.contains("calculate_invoice_total"), "symbol index should expose matching Python functions")
        try expect(symbolContext.selectedFiles.contains("lib/billing.py"), "symbol match should select the relevant source file")

        let forcedContext = RepositoryIndexer.context(
            rootURL: root,
            query: "unrelated task wording",
            maxContextTokens: 800,
            options: RepositoryRetrievalOptions(forcedPaths: ["lib/edge_case.py"], includeSymbols: true)
        )
        try expect(forcedContext.selectedFiles.contains("lib/edge_case.py"), "planner-forced paths should enter context even when lexical score is low")
    })
]

let liveHarnessChecks: [(String, () throws -> Void)] = [
    ("local model coding harness edits a tiny repo", {
        let root = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("macagentflow-live-harness-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        try """
        def greet():
            return "old"
        """.write(to: root.appendingPathComponent("hello.py"), atomically: true, encoding: .utf8)

        let model = LLMModelConfig(
            nickname: "Local Qwen",
            backend: .localOpenAICompatible,
            baseURL: "http://127.0.0.1:1234/v1",
            apiKey: "local",
            modelName: "qwen/qwen3.6-35b-a3b"
        )
        let result = CodingHarnessEngine.run(CodingHarnessRequest(
            prompt: """
            repo: \(root.path)
            test: /usr/bin/python3 -m py_compile hello.py
            Update hello.py so greet() returns exactly "hello, harness".
            """,
            repositoryURL: root,
            model: model,
            testCommand: "/usr/bin/python3 -m py_compile hello.py",
            maxContextTokens: 4_000,
            maxIterations: 2,
            allowInternetResearch: false
        ))
        let updated = try String(contentsOf: root.appendingPathComponent("hello.py"), encoding: .utf8)
        try expect(result.status == .succeeded, "live harness should pass validation: \(result.logLines.joined(separator: "\n"))")
        try expect(updated.contains("hello, harness"), "live harness should make the requested file edit")
    }),
    ("AI node coding harness fixes a Python function through AgentRunEngine", {
        let root = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("macagentflow-agent-runtime-python-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        try """
        def double(value):
            return value + 2
        """.write(to: root.appendingPathComponent("math_utils.py"), atomically: true, encoding: .utf8)

        var agent = AgentDefinition.blank(number: 101)
        guard let aiIndex = agent.nodes.firstIndex(where: { $0.kind == .ai }) else {
            throw CheckFailure(description: "blank agent should contain an AI node")
        }
        agent.nodes[aiIndex].title = "Fix Math Utils"
        agent.nodes[aiIndex].prompt = """
        repo: \(root.path)
        test: /usr/bin/python3 -c "import math_utils; assert math_utils.double(4) == 8; assert math_utils.double(-3) == -6"
        Fix math_utils.double so it returns exactly value * 2 for any numeric input.
        Only edit math_utils.py.
        """

        let run = AgentRunEngine.trigger(
            agent: agent,
            trigger: .manual,
            model: localQwenModelConfig(),
            tools: [],
            runtime: .liveCodingHarness,
            now: Date(timeIntervalSince1970: 700)
        )
        let updated = try String(contentsOf: root.appendingPathComponent("math_utils.py"), encoding: .utf8)
        try expect(run.status == .succeeded, "AI-node harness run should succeed: \(run.logLines.joined(separator: "\n"))")
        try expect(updated.contains("value * 2") || updated.contains("2 * value"), "AI-node harness should repair double(): \(updated)")
    }),
    ("AI node coding harness updates a multi-file package flow", {
        let root = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("macagentflow-agent-runtime-package-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: root) }
        let package = root.appendingPathComponent("src").appendingPathComponent("formatter")
        try FileManager.default.createDirectory(at: package, withIntermediateDirectories: true)
        try """
        from .slug import slugify
        """.write(to: package.appendingPathComponent("__init__.py"), atomically: true, encoding: .utf8)
        try """
        def slugify(value):
            return value.lower()
        """.write(to: package.appendingPathComponent("slug.py"), atomically: true, encoding: .utf8)
        try """
        import sys
        sys.path.insert(0, "src")
        from formatter import slugify

        assert slugify("Hello Harness!") == "hello-harness"
        assert slugify("  A  B  ") == "a-b"
        assert slugify("Already--Clean") == "already-clean"
        """.write(to: root.appendingPathComponent("test_formatter.py"), atomically: true, encoding: .utf8)

        var agent = AgentDefinition.blank(number: 102)
        guard let aiIndex = agent.nodes.firstIndex(where: { $0.kind == .ai }) else {
            throw CheckFailure(description: "blank agent should contain an AI node")
        }
        agent.nodes[aiIndex].title = "Fix Slug Formatter"
        agent.nodes[aiIndex].prompt = """
        repo: \(root.path)
        test: /usr/bin/python3 test_formatter.py
        Make the formatter.slugify implementation pass the local tests.
        It should trim whitespace, lowercase text, replace any run of non-alphanumeric characters with one hyphen, and strip leading/trailing hyphens.
        Prefer editing src/formatter/slug.py only.
        """

        let run = AgentRunEngine.trigger(
            agent: agent,
            trigger: .manual,
            model: localQwenModelConfig(),
            tools: [],
            runtime: .liveCodingHarness,
            now: Date(timeIntervalSince1970: 800)
        )
        let updated = try String(contentsOf: package.appendingPathComponent("slug.py"), encoding: .utf8)
        try expect(run.status == .succeeded, "multi-file AI-node harness run should succeed: \(run.logLines.joined(separator: "\n"))")
        try expect(updated.contains("re") || updated.contains("isalnum"), "slugify implementation should contain real normalization logic: \(updated)")
    }),
    ("local semantic index is used when localhost embeddings are available", {
        let root = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("macagentflow-semantic-context-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root.appendingPathComponent("src"), withIntermediateDirectories: true)
        try """
        def normalize_display_name(value):
            return value.strip().title()
        """.write(to: root.appendingPathComponent("src").appendingPathComponent("names.py"), atomically: true, encoding: .utf8)
        try """
        def calculate_tax(amount):
            return amount * 0.08
        """.write(to: root.appendingPathComponent("src").appendingPathComponent("tax.py"), atomically: true, encoding: .utf8)

        let context = RepositoryIndexer.context(
            rootURL: root,
            query: "make customer names canonical before showing them",
            maxContextTokens: 1_200,
            options: RepositoryRetrievalOptions(semanticModel: localQwenModelConfig(), includeSymbols: true)
        )
        try expect(context.retrievalNotes.contains { $0.contains("semantic rerank used") }, "local embedding rerank should be used: \(context.retrievalNotes)")
        try expect(context.selectedFiles.contains("src/names.py"), "semantic/symbol retrieval should keep the names implementation in context")
    })
]

func localQwenModelConfig() -> LLMModelConfig {
    LLMModelConfig(
        nickname: "Local Qwen",
        backend: .localOpenAICompatible,
        baseURL: "http://127.0.0.1:1234/v1",
        apiKey: "local",
        modelName: "qwen/qwen3.6-35b-a3b"
    )
}

var failures: [String] = []
let activeChecks = ProcessInfo.processInfo.environment["MAC_AGENT_FLOW_LIVE_HARNESS_CHECK"] == "1"
    ? checks + liveHarnessChecks
    : checks

for (name, check) in activeChecks {
    do {
        try check()
        print("PASS \(name)")
    } catch {
        let message = "FAIL \(name): \(error)"
        failures.append(message)
        print(message)
    }
}

print("\n\(activeChecks.count - failures.count)/\(activeChecks.count) MacAgentFlow checks passed")
if !failures.isEmpty {
    exit(1)
}
