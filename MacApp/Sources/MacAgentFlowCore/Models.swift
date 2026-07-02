import Foundation

public struct AgentWorkspace: Codable, Equatable, Sendable {
    public var agents: [AgentDefinition]
    public var selectedAgentID: UUID?
    public var llmModels: [LLMModelConfig]
    public var embeddingModels: [EmbeddingModelConfig]
    public var activeEmbeddingModelID: UUID?
    public var toolCatalog: [ToolDefinition]
    public var harnessSkills: [HarnessSkill]

    public init(
        agents: [AgentDefinition] = [],
        selectedAgentID: UUID? = nil,
        llmModels: [LLMModelConfig] = LLMModelConfig.defaultConfigs,
        embeddingModels: [EmbeddingModelConfig] = [],
        activeEmbeddingModelID: UUID? = nil,
        toolCatalog: [ToolDefinition] = ToolDefinition.defaultCatalog,
        harnessSkills: [HarnessSkill] = HarnessSkill.recommended
    ) {
        self.agents = agents
        self.selectedAgentID = selectedAgentID ?? agents.first?.id
        self.llmModels = llmModels
        self.embeddingModels = embeddingModels
        self.activeEmbeddingModelID = activeEmbeddingModelID
        self.toolCatalog = toolCatalog
        self.harnessSkills = harnessSkills
    }

    private enum CodingKeys: String, CodingKey {
        case agents
        case selectedAgentID
        case llmModels
        case embeddingModels
        case activeEmbeddingModelID
        case toolCatalog
        case harnessSkills
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        agents = try container.decode([AgentDefinition].self, forKey: .agents)
        selectedAgentID = try container.decodeIfPresent(UUID.self, forKey: .selectedAgentID) ?? agents.first?.id
        let decodedModels = try container.decodeIfPresent([LLMModelConfig].self, forKey: .llmModels)
        llmModels = decodedModels?.isEmpty == false ? decodedModels! : LLMModelConfig.defaultConfigs
        embeddingModels = try container.decodeIfPresent([EmbeddingModelConfig].self, forKey: .embeddingModels) ?? []
        activeEmbeddingModelID = try container.decodeIfPresent(UUID.self, forKey: .activeEmbeddingModelID)
        if let activeEmbeddingModelID,
           !embeddingModels.contains(where: { $0.id == activeEmbeddingModelID }) {
            self.activeEmbeddingModelID = nil
        }
        toolCatalog = try container.decodeIfPresent([ToolDefinition].self, forKey: .toolCatalog) ?? ToolDefinition.defaultCatalog
        harnessSkills = try container.decodeIfPresent([HarnessSkill].self, forKey: .harnessSkills) ?? HarnessSkill.recommended
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(agents, forKey: .agents)
        try container.encodeIfPresent(selectedAgentID, forKey: .selectedAgentID)
        try container.encode(llmModels, forKey: .llmModels)
        try container.encode(embeddingModels, forKey: .embeddingModels)
        try container.encodeIfPresent(activeEmbeddingModelID, forKey: .activeEmbeddingModelID)
        try container.encode(toolCatalog, forKey: .toolCatalog)
        try container.encode(harnessSkills, forKey: .harnessSkills)
    }

    public var selectedAgent: AgentDefinition? {
        agents.first { $0.id == selectedAgentID }
    }

    public static var sample: AgentWorkspace {
        let release = AgentDefinition.sample(number: 1, name: "Release Readiness Agent")
        let data = AgentDefinition.dataPipelineSample(name: "Static Data Pipeline Agent")
        let support = AgentDefinition.supportTriageSample(name: "Support Triage Agent")
        return AgentWorkspace(agents: [release, data, support], selectedAgentID: release.id)
    }
}

public struct AgentDefinition: Identifiable, Codable, Equatable, Sendable {
    public var id: UUID
    public var name: String
    public var summary: String
    public var llmModelConfigID: UUID?
    public var nodes: [AgentNode]
    public var edges: [AgentEdge]
    public var schedules: [AgentSchedule]
    public var runs: [AgentRun]
    public var createdAt: Date
    public var updatedAt: Date

    public init(
        id: UUID = UUID(),
        name: String,
        summary: String = "Design, run, and observe an agent workflow.",
        llmModelConfigID: UUID? = LLMModelConfig.defaultModelID,
        nodes: [AgentNode],
        edges: [AgentEdge],
        schedules: [AgentSchedule] = [],
        runs: [AgentRun] = [],
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.summary = summary
        self.llmModelConfigID = llmModelConfigID
        self.nodes = nodes
        self.edges = edges
        self.schedules = schedules
        self.runs = runs
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case summary
        case llmModelConfigID
        case nodes
        case edges
        case schedules
        case runs
        case createdAt
        case updatedAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        summary = try container.decodeIfPresent(String.self, forKey: .summary) ?? "Design, run, and observe an agent workflow."
        llmModelConfigID = try container.decodeIfPresent(UUID.self, forKey: .llmModelConfigID) ?? LLMModelConfig.defaultModelID
        nodes = try container.decode([AgentNode].self, forKey: .nodes)
        edges = try container.decode([AgentEdge].self, forKey: .edges)
        schedules = try container.decodeIfPresent([AgentSchedule].self, forKey: .schedules) ?? []
        runs = try container.decodeIfPresent([AgentRun].self, forKey: .runs) ?? []
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt) ?? Date()
        updatedAt = try container.decodeIfPresent(Date.self, forKey: .updatedAt) ?? Date()
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(summary, forKey: .summary)
        try container.encodeIfPresent(llmModelConfigID, forKey: .llmModelConfigID)
        try container.encode(nodes, forKey: .nodes)
        try container.encode(edges, forKey: .edges)
        try container.encode(schedules, forKey: .schedules)
        try container.encode(runs, forKey: .runs)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(updatedAt, forKey: .updatedAt)
    }

    public var nextRunNumber: Int {
        (runs.map(\.number).max() ?? 0) + 1
    }

    public static func blank(number: Int) -> AgentDefinition {
        let start = AgentNode(kind: .start, title: "Start", note: "Initial state enters here.", position: CanvasPoint(x: 252, y: 64))
        let ai = AgentNode(kind: .ai, title: "Node \(number)", note: "Use the prompt and tools to update state.", position: CanvasPoint(x: 252, y: 220))
        let end = AgentNode(kind: .end, title: "End", note: "Final state is emitted here.", position: CanvasPoint(x: 252, y: 376))
        return AgentDefinition(
            name: "Agent \(number)",
            nodes: [start, ai, end],
            edges: [
                AgentEdge(from: start.id, to: ai.id, fromPort: .bottom, toPort: .top, label: "next"),
                AgentEdge(from: ai.id, to: end.id, fromPort: .bottom, toPort: .top, label: "next")
            ]
        )
    }

    public static func sample(number: Int, name: String) -> AgentDefinition {
        let start = AgentNode(kind: .start, title: "Start", note: "Collect repository and release state.", position: CanvasPoint(x: 48, y: 176))
        let collect = AgentNode(
            kind: .tool,
            title: "Collect Signals",
            note: "Read starter tool signals from AWS and social sources.",
            position: CanvasPoint(x: 252, y: 112),
            selectedToolIDs: ["aws", "reddit", "twitter"]
        )
        let plan = AgentNode(
            kind: .ai,
            title: "Plan Release",
            note: "Ask the model for the release decision and checklist.",
            position: CanvasPoint(x: 456, y: 112),
            prompt: "Review current state and return JSON with data.release_plan and data.risk."
        )
        let gate = AgentNode(
            kind: .condition,
            title: "Risk Gate",
            note: "Route safe releases to package, risky ones to review.",
            position: CanvasPoint(x: 456, y: 264),
            branches: ["safe", "review"]
        )
        let package = AgentNode(
            kind: .code,
            title: "Package",
            note: "Create local release artifacts from the accepted plan.",
            position: CanvasPoint(x: 252, y: 328),
            pythonCode: "return {\"data\": {\"package\": \"release-candidate\"}}"
        )
        let review = AgentNode(
            kind: .ai,
            title: "Request Review",
            note: "Generate review tasks when risk is high.",
            position: CanvasPoint(x: 456, y: 416),
            prompt: "Create a concise review request and return it in data.review_request."
        )
        let end = AgentNode(kind: .end, title: "End", note: "Run result is stored with logs and state.", position: CanvasPoint(x: 48, y: 392))

        let now = Date()
        let schedule = AgentSchedule(name: "Weekday readiness check", cronExpression: "0 9 * * 1-5", isEnabled: true, createdAt: now)
        let run = AgentRun(
            number: 1,
            status: .succeeded,
            trigger: .manual,
            startedAt: now.addingTimeInterval(-600),
            finishedAt: now.addingTimeInterval(-540),
            logLines: [
                "Start: loaded workspace state",
                "Collect Signals: gathered tool inputs",
                "Plan Release: produced release_plan",
                "Risk Gate: routed safe",
                "Package: produced local artifact"
            ],
            stateSummary: "release_plan ready, package=release-candidate"
        )

        return AgentDefinition(
            name: name,
            summary: "A sample Jenkins-style agent with a schedule, run history, tools, and conditional routing.",
            nodes: [start, collect, plan, gate, package, review, end],
            edges: [
                AgentEdge(from: start.id, to: collect.id, fromPort: .right, toPort: .left, label: "next"),
                AgentEdge(from: collect.id, to: plan.id, fromPort: .right, toPort: .left, label: "next"),
                AgentEdge(from: plan.id, to: gate.id, fromPort: .bottom, toPort: .top, label: "next"),
                AgentEdge(from: gate.id, to: package.id, fromPort: .left, toPort: .right, label: "safe"),
                AgentEdge(from: gate.id, to: review.id, fromPort: .bottom, toPort: .top, label: "review"),
                AgentEdge(from: package.id, to: end.id, fromPort: .left, toPort: .right, label: "next"),
                AgentEdge(from: review.id, to: end.id, fromPort: .left, toPort: .right, label: "next")
            ],
            schedules: [schedule],
            runs: [run],
            createdAt: now,
            updatedAt: now
        )
    }

    public static func dataPipelineSample(name: String) -> AgentDefinition {
        let start = AgentNode(kind: .start, title: "Start", note: "Load a local batch into state.", position: CanvasPoint(x: 48, y: 176))
        let load = AgentNode(
            kind: .code,
            title: "Load Batch",
            note: "Create deterministic in-memory records.",
            position: CanvasPoint(x: 252, y: 112),
            pythonCode: """
records = [{"id": 1, "email": " A@EXAMPLE.COM "}, {"id": 2, "email": ""}]
return {"data": {"records": records}}
"""
        )
        let profile = AgentNode(
            kind: .code,
            title: "Profile Fields",
            note: "Count empty fields and normalize emails.",
            position: CanvasPoint(x: 456, y: 112),
            pythonCode: """
records = state["data"]["records"]
invalid = [row for row in records if not row["email"].strip()]
return {"data": {"invalid_count": len(invalid)}}
"""
        )
        let gate = AgentNode(
            kind: .condition,
            title: "Quality Gate",
            note: "Repair the batch when validation finds empty fields.",
            position: CanvasPoint(x: 456, y: 264),
            branches: ["repair", "clean"]
        )
        let repair = AgentNode(
            kind: .code,
            title: "Repair Records",
            note: "Fill deterministic fallback values.",
            position: CanvasPoint(x: 252, y: 328),
            pythonCode: """
return {"data": {"repair_status": "filled_missing_emails"}}
"""
        )
        let summarize = AgentNode(
            kind: .ai,
            title: "Summarize Clean Batch",
            note: "Explain the clean path for operators.",
            position: CanvasPoint(x: 456, y: 416),
            prompt: "Summarize the validated local batch without calling external systems."
        )
        let end = AgentNode(kind: .end, title: "End", note: "Persist the local batch state summary.", position: CanvasPoint(x: 48, y: 392))

        let now = Date()
        let run = AgentRun(
            number: 1,
            status: .succeeded,
            trigger: .manual,
            startedAt: now.addingTimeInterval(-420),
            finishedAt: now.addingTimeInterval(-414),
            logLines: [
                "Start: initialized local batch state",
                "Load Batch: executed local Python block",
                "Profile Fields: executed local Python block",
                "Quality Gate: selected route repair",
                "Repair Records: executed local Python block",
                "End: finalized agent state"
            ],
            stateSummary: "invalid_count=1, repair_status=filled_missing_emails, route=repair, finished=true"
        )

        return AgentDefinition(
            name: name,
            summary: "A static local Python flow that validates, repairs, and summarizes batch data.",
            nodes: [start, load, profile, gate, repair, summarize, end],
            edges: [
                AgentEdge(from: start.id, to: load.id, fromPort: .right, toPort: .left, label: "next"),
                AgentEdge(from: load.id, to: profile.id, fromPort: .right, toPort: .left, label: "next"),
                AgentEdge(from: profile.id, to: gate.id, fromPort: .bottom, toPort: .top, label: "next"),
                AgentEdge(from: gate.id, to: repair.id, fromPort: .left, toPort: .right, label: "repair"),
                AgentEdge(from: gate.id, to: summarize.id, fromPort: .bottom, toPort: .top, label: "clean"),
                AgentEdge(from: repair.id, to: end.id, fromPort: .left, toPort: .right, label: "next"),
                AgentEdge(from: summarize.id, to: end.id, fromPort: .left, toPort: .right, label: "next")
            ],
            runs: [run],
            createdAt: now,
            updatedAt: now
        )
    }

    public static func supportTriageSample(name: String) -> AgentDefinition {
        let start = AgentNode(kind: .start, title: "Start", note: "Receive a local support ticket payload.", position: CanvasPoint(x: 48, y: 176))
        let parse = AgentNode(
            kind: .code,
            title: "Parse Ticket",
            note: "Extract fields from a static ticket.",
            position: CanvasPoint(x: 252, y: 112),
            pythonCode: """
ticket = {"subject": "Billing question", "body": "Need invoice copy"}
return {"data": {"ticket": ticket}}
"""
        )
        let classify = AgentNode(
            kind: .ai,
            title: "Classify Intent",
            note: "Classify the ticket from current state.",
            position: CanvasPoint(x: 456, y: 112),
            prompt: "Classify the local ticket as billing, bug, or account. Return data.intent."
        )
        let gate = AgentNode(
            kind: .condition,
            title: "Priority Gate",
            note: "Route normal tickets to a reply draft.",
            position: CanvasPoint(x: 456, y: 264),
            branches: ["customer", "audit"]
        )
        let draft = AgentNode(
            kind: .ai,
            title: "Draft Reply",
            note: "Draft a short customer response.",
            position: CanvasPoint(x: 252, y: 328),
            prompt: "Draft a concise support reply using only state.data.ticket."
        )
        let record = AgentNode(
            kind: .code,
            title: "Record Outcome",
            note: "Write the simulated resolution into state.",
            position: CanvasPoint(x: 456, y: 416),
            pythonCode: """
return {"data": {"resolution": "drafted_reply"}}
"""
        )
        let end = AgentNode(kind: .end, title: "End", note: "Store triage result and run logs.", position: CanvasPoint(x: 48, y: 392))

        let now = Date()
        let run = AgentRun(
            number: 1,
            status: .succeeded,
            trigger: .manual,
            startedAt: now.addingTimeInterval(-300),
            finishedAt: now.addingTimeInterval(-293),
            logLines: [
                "Start: initialized ticket state",
                "Parse Ticket: executed local Python block",
                "Classify Intent: rendered prompt and produced JSON state update",
                "Priority Gate: selected route customer",
                "Draft Reply: rendered prompt and produced JSON state update",
                "Record Outcome: executed local Python block",
                "End: finalized agent state"
            ],
            stateSummary: "intent=billing, resolution=drafted_reply, route=customer, finished=true"
        )

        return AgentDefinition(
            name: name,
            summary: "A static ticket triage flow with Python parsing, AI classification, and local outcome recording.",
            nodes: [start, parse, classify, gate, draft, record, end],
            edges: [
                AgentEdge(from: start.id, to: parse.id, fromPort: .right, toPort: .left, label: "next"),
                AgentEdge(from: parse.id, to: classify.id, fromPort: .right, toPort: .left, label: "next"),
                AgentEdge(from: classify.id, to: gate.id, fromPort: .bottom, toPort: .top, label: "next"),
                AgentEdge(from: gate.id, to: draft.id, fromPort: .left, toPort: .right, label: "customer"),
                AgentEdge(from: gate.id, to: record.id, fromPort: .bottom, toPort: .top, label: "audit"),
                AgentEdge(from: draft.id, to: record.id, fromPort: .right, toPort: .left, label: "next"),
                AgentEdge(from: record.id, to: end.id, fromPort: .left, toPort: .right, label: "next")
            ],
            runs: [run],
            createdAt: now,
            updatedAt: now
        )
    }
}

public struct CanvasPoint: Codable, Equatable, Sendable {
    public var x: Double
    public var y: Double

    public init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }
}

public enum NodePort: String, CaseIterable, Codable, Equatable, Identifiable, Sendable {
    case top
    case right
    case bottom
    case left

    public var id: String { rawValue }
}

public enum AgentNodeKind: String, CaseIterable, Codable, Equatable, Identifiable, Sendable {
    case start
    case ai
    case code
    case tool
    case condition
    case end

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .start: "Start"
        case .ai: "AI"
        case .code: "Python"
        case .tool: "Tool"
        case .condition: "Conditional"
        case .end: "End"
        }
    }

    public var symbolName: String {
        switch self {
        case .start: "play.circle"
        case .ai: "sparkles"
        case .code: "curlybraces"
        case .tool: "wrench.and.screwdriver"
        case .condition: "arrow.triangle.branch"
        case .end: "stop.circle"
        }
    }
}

public struct AgentNode: Identifiable, Codable, Equatable, Sendable {
    public var id: UUID
    public var kind: AgentNodeKind
    public var title: String
    public var note: String
    public var position: CanvasPoint
    public var width: Double
    public var height: Double
    public var prompt: String
    public var pythonCode: String
    public var repositoryPath: String?
    public var validationCommand: String?
    public var selectedToolIDs: [String]
    public var branches: [String]

    public init(
        id: UUID = UUID(),
        kind: AgentNodeKind,
        title: String,
        note: String,
        position: CanvasPoint,
        width: Double = 190,
        height: Double = 96,
        prompt: String = "Use the current state and return a JSON state update.",
        pythonCode: String = "return {}",
        repositoryPath: String? = nil,
        validationCommand: String? = nil,
        selectedToolIDs: [String] = [],
        branches: [String] = ["next"]
    ) {
        self.id = id
        self.kind = kind
        self.title = title
        self.note = note
        self.position = position
        self.width = width
        self.height = height
        self.prompt = prompt
        self.pythonCode = pythonCode
        self.repositoryPath = repositoryPath
        self.validationCommand = validationCommand
        self.selectedToolIDs = selectedToolIDs
        self.branches = branches
    }
}

public struct AgentEdge: Identifiable, Codable, Equatable, Sendable {
    public var id: UUID
    public var from: UUID
    public var to: UUID
    public var fromPort: NodePort?
    public var toPort: NodePort?
    public var label: String

    public init(
        id: UUID = UUID(),
        from: UUID,
        to: UUID,
        fromPort: NodePort? = nil,
        toPort: NodePort? = nil,
        label: String = "next"
    ) {
        self.id = id
        self.from = from
        self.to = to
        self.fromPort = fromPort
        self.toPort = toPort
        self.label = label
    }
}

public enum AgentRunStatus: String, CaseIterable, Codable, Equatable, Identifiable, Sendable {
    case queued
    case running
    case succeeded
    case failed
    case cancelled

    public var id: String { rawValue }
}

public enum AgentRunTrigger: String, CaseIterable, Codable, Equatable, Identifiable, Sendable {
    case manual
    case scheduled
    case webhook

    public var id: String { rawValue }
}

public struct AgentRunSnapshot: Codable, Equatable, Sendable {
    public var agentName: String
    public var agentSummary: String
    public var nodes: [AgentNode]
    public var edges: [AgentEdge]

    public init(agentName: String, agentSummary: String, nodes: [AgentNode], edges: [AgentEdge]) {
        self.agentName = agentName
        self.agentSummary = agentSummary
        self.nodes = nodes
        self.edges = edges
    }

    public init(agent: AgentDefinition) {
        self.init(agentName: agent.name, agentSummary: agent.summary, nodes: agent.nodes, edges: agent.edges)
    }
}

public struct AgentRun: Identifiable, Codable, Equatable, Sendable {
    public var id: UUID
    public var number: Int
    public var status: AgentRunStatus
    public var trigger: AgentRunTrigger
    public var startedAt: Date
    public var finishedAt: Date?
    public var logLines: [String]
    public var stateSummary: String
    public var snapshot: AgentRunSnapshot?

    public init(
        id: UUID = UUID(),
        number: Int,
        status: AgentRunStatus,
        trigger: AgentRunTrigger,
        startedAt: Date = Date(),
        finishedAt: Date? = nil,
        logLines: [String] = [],
        stateSummary: String = "",
        snapshot: AgentRunSnapshot? = nil
    ) {
        self.id = id
        self.number = number
        self.status = status
        self.trigger = trigger
        self.startedAt = startedAt
        self.finishedAt = finishedAt
        self.logLines = logLines
        self.stateSummary = stateSummary
        self.snapshot = snapshot
    }
}

public struct AgentSchedule: Identifiable, Codable, Equatable, Sendable {
    public var id: UUID
    public var name: String
    public var cronExpression: String
    public var isEnabled: Bool
    public var createdAt: Date
    public var lastRunAt: Date?

    public init(
        id: UUID = UUID(),
        name: String,
        cronExpression: String,
        isEnabled: Bool = true,
        createdAt: Date = Date(),
        lastRunAt: Date? = nil
    ) {
        self.id = id
        self.name = name
        self.cronExpression = cronExpression
        self.isEnabled = isEnabled
        self.createdAt = createdAt
        self.lastRunAt = lastRunAt
    }
}

public enum LLMBackend: String, CaseIterable, Codable, Equatable, Identifiable, Sendable {
    case openAI = "OpenAI"
    case azureOpenAI = "Azure OpenAI"
    case anthropic = "Anthropic"
    case localOpenAICompatible = "Local OpenAI-compatible"
    case customHTTP = "Custom HTTP"

    public var id: String { rawValue }

    public var defaultBaseURL: String {
        switch self {
        case .openAI:
            return "https://api.openai.com/v1"
        case .azureOpenAI:
            return ""
        case .anthropic:
            return "https://api.anthropic.com/v1"
        case .localOpenAICompatible:
            return "http://127.0.0.1:1234/v1"
        case .customHTTP:
            return ""
        }
    }
}

public struct LLMModelConfig: Identifiable, Codable, Equatable, Sendable {
    public var id: UUID
    public var nickname: String
    public var backend: LLMBackend
    public var baseURL: String
    public var apiKey: String
    public var modelName: String

    public init(
        id: UUID = UUID(),
        nickname: String,
        backend: LLMBackend,
        baseURL: String,
        apiKey: String = "",
        modelName: String
    ) {
        self.id = id
        self.nickname = nickname
        self.backend = backend
        self.baseURL = baseURL
        self.apiKey = apiKey
        self.modelName = modelName
    }

    public var displayName: String {
        let cleanNickname = nickname.trimmingCharacters(in: .whitespacesAndNewlines)
        return cleanNickname.isEmpty ? modelName : cleanNickname
    }

    public var details: String {
        [backend.rawValue, modelName, baseURL]
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }

    public static let localQwenModelID = UUID(uuidString: "B1F7F61C-4565-47DE-9385-9307A8523E25")!
    public static let openAIProductionModelID = UUID(uuidString: "5B00E8B7-2758-4451-B91D-4F8857D407DA")!
    public static let defaultModelID = localQwenModelID
    public static let defaultConfigs: [LLMModelConfig] = [
        LLMModelConfig(
            id: localQwenModelID,
            nickname: "Local Qwen 35B",
            backend: .localOpenAICompatible,
            baseURL: LLMBackend.localOpenAICompatible.defaultBaseURL,
            apiKey: "local",
            modelName: "qwen/qwen3.6-35b-a3b"
        ),
        LLMModelConfig(
            id: openAIProductionModelID,
            nickname: "OpenAI Production",
            backend: .openAI,
            baseURL: LLMBackend.openAI.defaultBaseURL,
            modelName: "gpt-4.1"
        )
    ]
}

public struct EmbeddingModelConfig: Identifiable, Codable, Equatable, Sendable {
    public var id: UUID
    public var nickname: String
    public var backend: LLMBackend
    public var baseURL: String
    public var apiKey: String
    public var modelName: String

    public init(
        id: UUID = UUID(),
        nickname: String,
        backend: LLMBackend,
        baseURL: String,
        apiKey: String = "",
        modelName: String
    ) {
        self.id = id
        self.nickname = nickname
        self.backend = backend
        self.baseURL = baseURL
        self.apiKey = apiKey
        self.modelName = modelName
    }

    public var displayName: String {
        let cleanNickname = nickname.trimmingCharacters(in: .whitespacesAndNewlines)
        return cleanNickname.isEmpty ? modelName : cleanNickname
    }

    public var details: String {
        [backend.rawValue, modelName, baseURL]
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }
}

public struct ToolDefinition: Identifiable, Codable, Equatable, Sendable {
    public var id: String
    public var name: String
    public var category: String
    public var summary: String
    public var isMutating: Bool
    public var pythonCode: String

    public init(
        id: String,
        name: String,
        category: String,
        summary: String,
        isMutating: Bool = false,
        pythonCode: String
    ) {
        self.id = id
        self.name = name
        self.category = category
        self.summary = summary
        self.isMutating = isMutating
        self.pythonCode = pythonCode
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case category
        case summary
        case isMutating
        case pythonCode
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        category = try container.decode(String.self, forKey: .category)
        summary = try container.decode(String.self, forKey: .summary)
        isMutating = try container.decodeIfPresent(Bool.self, forKey: .isMutating) ?? false
        pythonCode = try container.decodeIfPresent(String.self, forKey: .pythonCode) ?? Self.defaultPythonCode(for: id)
    }

    public static let defaultCatalog: [ToolDefinition] = [
        ToolDefinition(
            id: "reddit",
            name: "Reddit",
            category: "Social",
            summary: "Prepare Reddit search, thread fetch, and draft-post tool calls.",
            isMutating: true,
            pythonCode: """
from typing import Any


def run(state: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    query = kwargs.get("query") or state.get("data", {}).get("query", "")
    subreddit = kwargs.get("subreddit") or state.get("data", {}).get("subreddit", "all")
    return {
        "data": {
            "reddit": {
                "query": query,
                "subreddit": subreddit,
                "operations": [
                    {"name": "search_posts", "method": "GET", "path": f"/r/{subreddit}/search", "params": {"q": query}},
                    {"name": "fetch_thread", "method": "GET", "path": "/comments/{post_id}"},
                    {"name": "draft_post", "method": "POST", "path": f"/r/{subreddit}/submit", "requires_approval": True},
                ],
            }
        }
    }
"""
        ),
        ToolDefinition(
            id: "twitter",
            name: "Twitter / X",
            category: "Social",
            summary: "Prepare X search, thread fetch, profile lookup, and draft-post tool calls.",
            isMutating: true,
            pythonCode: """
from typing import Any


def run(state: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    query = kwargs.get("query") or state.get("data", {}).get("query", "")
    username = kwargs.get("username") or state.get("data", {}).get("username", "")
    return {
        "data": {
            "twitter": {
                "query": query,
                "username": username,
                "operations": [
                    {"name": "search_recent", "method": "GET", "path": "/2/tweets/search/recent", "params": {"query": query}},
                    {"name": "fetch_thread", "method": "GET", "path": "/2/tweets/{tweet_id}"},
                    {"name": "lookup_user", "method": "GET", "path": f"/2/users/by/username/{username}"},
                    {"name": "draft_post", "method": "POST", "path": "/2/tweets", "requires_approval": True},
                ],
            }
        }
    }
"""
        ),
        ToolDefinition(
            id: "aws",
            name: "AWS Read-Only",
            category: "Cloud",
            summary: "Read-only AWS inventory calls for identity, S3, EC2, RDS, CloudWatch, and IAM.",
            isMutating: false,
            pythonCode: """
from typing import Any


def run(state: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    region = kwargs.get("region") or state.get("data", {}).get("aws_region", "us-east-1")
    return {
        "data": {
            "aws_read_only": {
                "region": region,
                "operations": [
                    {"name": "get_caller_identity", "service": "sts", "method": "get_caller_identity"},
                    {"name": "list_s3_buckets", "service": "s3", "method": "list_buckets"},
                    {"name": "describe_ec2_instances", "service": "ec2", "method": "describe_instances", "region": region},
                    {"name": "describe_rds_instances", "service": "rds", "method": "describe_db_instances", "region": region},
                    {"name": "list_cloudwatch_alarms", "service": "cloudwatch", "method": "describe_alarms", "region": region},
                    {"name": "list_iam_roles", "service": "iam", "method": "list_roles"},
                ],
                "read_only": True,
            }
        }
    }
"""
        )
    ]

    public static func starterTool(id: String) -> ToolDefinition? {
        defaultCatalog.first { $0.id == id }
    }

    public static func defaultPythonCode(for id: String) -> String {
        starterTool(id: id)?.pythonCode ?? """
from typing import Any


def run(state: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    return {"data": {"tool_result": {}}}
"""
    }
}

public struct PythonValidationResult: Codable, Equatable, Sendable {
    public var isValid: Bool
    public var message: String

    public init(isValid: Bool, message: String) {
        self.isValid = isValid
        self.message = message
    }
}

public enum PythonToolValidator {
    public static func validate(_ code: String) -> PythonValidationResult {
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            return PythonValidationResult(isValid: false, message: "Python code is empty.")
        }

        if let result = pythonASTValidation(trimmed) {
            return result
        }

        let lines = trimmed.split(separator: "\n", omittingEmptySubsequences: false)
        let hasRun = lines.contains { line in
            let value = line.trimmingCharacters(in: .whitespaces)
            return value.hasPrefix("def run(") || value.hasPrefix("async def run(")
        }
        if !hasRun {
            return PythonValidationResult(isValid: false, message: "Tool code must define run(state, **kwargs).")
        }

        if let message = balanceError(in: trimmed) {
            return PythonValidationResult(isValid: false, message: message)
        }

        return PythonValidationResult(isValid: true, message: "Static Python tool check passed.")
    }

    private static func pythonASTValidation(_ code: String) -> PythonValidationResult? {
        let pythonPath = "/usr/bin/python3"
        guard FileManager.default.isExecutableFile(atPath: pythonPath) else { return nil }

        let script = """
import ast
import sys

code = sys.stdin.read()
try:
    tree = ast.parse(code)
except SyntaxError as exc:
    print(f"Python syntax error on line {exc.lineno}: {exc.msg}", file=sys.stderr)
    sys.exit(1)

has_run = any(
    isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == "run"
    for node in tree.body
)
if not has_run:
    print("Tool code must define run(state, **kwargs).", file=sys.stderr)
    sys.exit(1)
"""

        let process = Process()
        process.executableURL = URL(fileURLWithPath: pythonPath)
        process.arguments = ["-c", script]

        let input = Pipe()
        let error = Pipe()
        process.standardInput = input
        process.standardError = error

        do {
            try process.run()
            if let data = code.data(using: .utf8) {
                input.fileHandleForWriting.write(data)
            }
            try? input.fileHandleForWriting.close()
            process.waitUntilExit()
        } catch {
            return nil
        }

        if process.terminationStatus == 0 {
            return PythonValidationResult(isValid: true, message: "Python syntax and tool entrypoint check passed.")
        }

        let errorData = error.fileHandleForReading.readDataToEndOfFile()
        let message = String(data: errorData, encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return PythonValidationResult(isValid: false, message: message?.isEmpty == false ? message! : "Python tool validation failed.")
    }

    private static func balanceError(in code: String) -> String? {
        var stack: [Character] = []
        var quote: Character?
        var escaped = false
        var inComment = false
        let pairs: [Character: Character] = [")": "(", "]": "[", "}": "{"]
        let openers = Set<Character>(["(", "[", "{"])

        for character in code {
            if inComment {
                if character == "\n" {
                    inComment = false
                }
                continue
            }
            if let activeQuote = quote {
                if escaped {
                    escaped = false
                } else if character == "\\" {
                    escaped = true
                } else if character == activeQuote {
                    quote = nil
                }
                continue
            }
            if character == "#" {
                inComment = true
            } else if character == "\"" || character == "'" {
                quote = character
            } else if openers.contains(character) {
                stack.append(character)
            } else if let expected = pairs[character] {
                guard stack.popLast() == expected else {
                    return "Python delimiters are not balanced."
                }
            }
        }

        if quote != nil {
            return "Python string literal is not closed."
        }
        if !stack.isEmpty {
            return "Python delimiters are not balanced."
        }
        return nil
    }

}

public struct HarnessSkill: Identifiable, Codable, Equatable, Sendable {
    public var id: String
    public var name: String
    public var purpose: String
    public var artifactPath: String
    public var qualityGate: String

    public init(id: String, name: String, purpose: String, artifactPath: String, qualityGate: String) {
        self.id = id
        self.name = name
        self.purpose = purpose
        self.artifactPath = artifactPath
        self.qualityGate = qualityGate
    }

    public static let recommended: [HarnessSkill] = [
        HarnessSkill(id: "map", name: "Repository Map", purpose: "Tell agents where to start and what not to touch.", artifactPath: "AGENTS.md", qualityGate: "Must stay short and point to docs."),
        HarnessSkill(id: "docs", name: "Progressive Docs", purpose: "Keep durable product and architecture decisions searchable.", artifactPath: "docs/INDEX.md", qualityGate: "Docs updated with behavior changes."),
        HarnessSkill(id: "checks", name: "Mechanical Checks", purpose: "Turn objective regressions into scripts.", artifactPath: "Scripts/check-macapp.sh", qualityGate: "Build and tests pass locally."),
        HarnessSkill(id: "samples", name: "Representative Samples", purpose: "Open with a realistic agent so reviewers can inspect the whole loop.", artifactPath: "AgentDefinition.sample", qualityGate: "Sample has nodes, tools, run history, and schedule."),
        HarnessSkill(id: "state", name: "Explicit State Model", purpose: "Make agent graphs, runs, and schedules serializable.", artifactPath: "Sources/MacAgentFlowCore/Models.swift", qualityGate: "Core model tests cover mutations."),
        HarnessSkill(id: "runbook", name: "Runbook", purpose: "Document how to build, test, and recover.", artifactPath: "docs/QUALITY.md", qualityGate: "Commands copy-paste cleanly."),
        HarnessSkill(id: "review", name: "Review Loop", purpose: "Promote repeated UI feedback into docs or tests.", artifactPath: "docs/PRODUCT.md", qualityGate: "New UX rules land in docs."),
        HarnessSkill(id: "isolation", name: "Project Isolation", purpose: "Keep MacApp independent from the static website.", artifactPath: "Package.swift", qualityGate: "No dependency on site assets or app scripts.")
    ]
}
