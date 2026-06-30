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
        try expect(workspace.toolCatalog.count >= 8, "tool catalog should include provider-level tools")
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
    ("condition routes only preferred branch in sample", {
        let agent = AgentDefinition.sample(number: 1, name: "Release")
        let order = AgentRunEngine.executionOrder(for: agent).map(\.title)
        try expect(order.contains("Package"), "preferred branch should include Package")
        try expect(!order.contains("Request Review"), "inactive branch should be skipped")
        try expect(order.first == "Start", "execution should begin at Start")
        try expect(order.last == "End", "execution should end at End")
    })
]

var failures: [String] = []
for (name, check) in checks {
    do {
        try check()
        print("PASS \(name)")
    } catch {
        let message = "FAIL \(name): \(error)"
        failures.append(message)
        print(message)
    }
}

print("\n\(checks.count - failures.count)/\(checks.count) MacAgentFlow checks passed")
if !failures.isEmpty {
    exit(1)
}
