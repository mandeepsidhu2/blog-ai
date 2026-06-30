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

public enum AgentRunEngine {
    public static func trigger(agent: AgentDefinition, trigger: AgentRunTrigger, now: Date = Date()) -> AgentRun {
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
