import Foundation
import MacAgentFlowCore
import SwiftUI

@MainActor
final class WorkspaceStore: ObservableObject {
    @Published var workspace: AgentWorkspace
    @Published var selectedNodeID: UUID?
    @Published var selectedEdgeID: UUID?
    @Published var selectedRunID: UUID?
    @Published var inspectorSection: InspectorSection = .configuration

    private let persistenceURL: URL
    @Published private var copiedNode: AgentNode?

    init(workspace: AgentWorkspace = .sample, persistenceURL: URL? = nil) {
        self.persistenceURL = persistenceURL ?? Self.defaultPersistenceURL()
        var shouldPersistNormalizedWorkspace = false
        if let data = try? Data(contentsOf: self.persistenceURL),
           let decoded = try? JSONDecoder.agentFlow.decode(AgentWorkspace.self, from: data) {
            let normalized = Self.normalizedWorkspace(decoded)
            shouldPersistNormalizedWorkspace = normalized != decoded
            self.workspace = normalized
        } else {
            self.workspace = workspace
        }
        selectedNodeID = selectedAgent?.nodes.first(where: { $0.kind == .start })?.id
        selectedRunID = selectedAgent?.runs.sorted(by: { $0.number > $1.number }).first?.id
        inspectorSection = selectedRunID == nil ? .configuration : .runs
        if shouldPersistNormalizedWorkspace {
            persist()
        }
    }

    var selectedAgent: AgentDefinition? {
        workspace.agents.first { $0.id == workspace.selectedAgentID }
    }

    var selectedNode: AgentNode? {
        guard let selectedNodeID else { return nil }
        return selectedAgent?.nodes.first { $0.id == selectedNodeID }
    }

    var selectedEdge: AgentEdge? {
        guard let selectedEdgeID else { return nil }
        return selectedAgent?.edges.first { $0.id == selectedEdgeID }
    }

    var selectedRun: AgentRun? {
        guard let selectedRunID else { return nil }
        return selectedAgent?.runs.first { $0.id == selectedRunID }
    }

    var selectedAgentLLMModel: LLMModelConfig? {
        guard let modelID = selectedAgent?.llmModelConfigID else { return nil }
        return workspace.llmModels.first { $0.id == modelID }
    }

    var canDeleteSelection: Bool {
        if selectedEdge != nil { return true }
        guard let selectedNode else { return false }
        return ![AgentNodeKind.start, .end].contains(selectedNode.kind)
    }

    var canCopySelection: Bool {
        guard let selectedNode else { return false }
        return ![AgentNodeKind.start, .end].contains(selectedNode.kind)
    }

    var canPasteSelection: Bool {
        copiedNode != nil && selectedAgent != nil
    }

    func selectAgent(_ id: UUID) {
        workspace.selectedAgentID = id
        selectedNodeID = selectedAgent?.nodes.first(where: { $0.kind == .start })?.id
        selectedEdgeID = nil
        selectedRunID = selectedAgent?.runs.sorted(by: { $0.number > $1.number }).first?.id
        inspectorSection = selectedRunID == nil ? .configuration : .runs
        persist()
    }

    func selectNode(_ id: UUID) {
        selectedNodeID = id
        selectedEdgeID = nil
        inspectorSection = .configuration
    }

    func selectEdge(_ id: UUID) {
        selectedEdgeID = id
        selectedNodeID = nil
        inspectorSection = .configuration
    }

    func createAgent() {
        var agent = AgentDefinition.blank(number: workspace.agents.count + 1)
        agent.llmModelConfigID = workspace.llmModels.first?.id
        workspace.agents.append(agent)
        selectAgent(agent.id)
    }

    func renameSelectedAgent(_ name: String) {
        updateSelectedAgent { agent in
            agent.name = name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? agent.name : name
        }
    }

    func setSelectedAgentLLMModel(_ modelID: UUID?) {
        updateSelectedAgent { agent in
            agent.llmModelConfigID = modelID
        }
    }

    func updateSelectedAgent(persistChanges: Bool = true, _ mutate: (inout AgentDefinition) -> Void) {
        guard let index = workspace.agents.firstIndex(where: { $0.id == workspace.selectedAgentID }) else { return }
        mutate(&workspace.agents[index])
        workspace.agents[index].updatedAt = Date()
        if persistChanges {
            persist()
        }
    }

    func updateSelectedNode(_ mutate: (inout AgentNode) -> Void) {
        guard let selectedNodeID else { return }
        updateSelectedAgent { agent in
            guard let nodeIndex = agent.nodes.firstIndex(where: { $0.id == selectedNodeID }) else { return }
            mutate(&agent.nodes[nodeIndex])
        }
    }

    func updateSelectedEdge(_ mutate: (inout AgentEdge) -> Void) {
        guard let selectedEdgeID else { return }
        updateSelectedAgent { agent in
            guard let edgeIndex = agent.edges.firstIndex(where: { $0.id == selectedEdgeID }) else { return }
            mutate(&agent.edges[edgeIndex])
        }
    }

    func addNode(kind: AgentNodeKind) {
        updateSelectedAgent { agent in
            let count = agent.nodes.filter { ![.start, .end].contains($0.kind) }.count + 1
            let node = AgentNode(
                kind: kind,
                title: "\(kind.title) \(count)",
                note: defaultNote(for: kind),
                position: CanvasPoint(x: 252, y: 220 + Double(count - 1) * 156),
                branches: kind == .condition ? ["yes", "no"] : ["next"]
            )
            let endID = agent.nodes.first(where: { $0.kind == .end })?.id
            let previous = agent.nodes.last { $0.kind != .end }
            if let endIndex = agent.nodes.firstIndex(where: { $0.kind == .end }) {
                agent.nodes.insert(node, at: endIndex)
            } else {
                agent.nodes.append(node)
            }
            if let previous {
                if let endID {
                    agent.edges.removeAll { $0.from == previous.id && $0.to == endID }
                }
                agent.edges.append(AgentEdge(
                    from: previous.id,
                    to: node.id,
                    fromPort: .bottom,
                    toPort: .top,
                    label: previous.kind == .condition ? previous.branches.first ?? "next" : "next"
                ))
            }
            if let endID {
                agent.edges.append(AgentEdge(from: node.id, to: endID, fromPort: .bottom, toPort: .top, label: "next"))
            }
            selectedNodeID = node.id
            selectedEdgeID = nil
            inspectorSection = .configuration
        }
    }

    func deleteSelectedNode() {
        guard let selectedNodeID else { return }
        updateSelectedAgent { agent in
            guard AgentGraphEditor.deleteNode(selectedNodeID, in: &agent) != nil else { return }
            self.selectedNodeID = agent.nodes.first(where: { $0.kind == .start })?.id
            self.selectedEdgeID = nil
        }
    }

    func deleteSelection() {
        if let selectedEdgeID {
            deleteEdge(selectedEdgeID)
        } else {
            deleteSelectedNode()
        }
    }

    func copySelection() {
        guard let selectedNode, ![AgentNodeKind.start, .end].contains(selectedNode.kind) else { return }
        copiedNode = selectedNode
    }

    func pasteSelection() {
        guard let copiedNode else { return }
        updateSelectedAgent { agent in
            guard let copy = AgentGraphEditor.duplicateNode(copiedNode, in: &agent) else { return }
            self.selectedNodeID = copy.id
            self.selectedEdgeID = nil
            self.inspectorSection = .configuration
            self.copiedNode = copy
        }
    }

    func moveNode(_ nodeID: UUID, by translation: CGSize) {
        updateSelectedAgent(persistChanges: false) { agent in
            guard let index = agent.nodes.firstIndex(where: { $0.id == nodeID }) else { return }
            agent.nodes[index].position.x = max(24, agent.nodes[index].position.x + translation.width)
            agent.nodes[index].position.y = max(24, agent.nodes[index].position.y + translation.height)
        }
    }

    func setNodePosition(_ nodeID: UUID, position: CanvasPoint) {
        updateSelectedAgent(persistChanges: false) { agent in
            guard let index = agent.nodes.firstIndex(where: { $0.id == nodeID }) else { return }
            agent.nodes[index].position.x = max(24, position.x)
            agent.nodes[index].position.y = max(24, position.y)
        }
    }

    func connect(from source: ConnectionPortSelection, to target: ConnectionPortSelection) {
        guard source.nodeID != target.nodeID else { return }
        updateSelectedAgent { agent in
            guard let sourceNode = agent.nodes.first(where: { $0.id == source.nodeID }),
                  agent.nodes.contains(where: { $0.id == target.nodeID }) else { return }
            agent.edges.removeAll { $0.from == source.nodeID && $0.to == target.nodeID }
            let edge = AgentEdge(
                from: source.nodeID,
                to: target.nodeID,
                fromPort: source.port,
                toPort: target.port,
                label: sourceNode.kind == .condition ? sourceNode.branches.first ?? "next" : "next"
            )
            agent.edges.append(edge)
            self.selectedNodeID = nil
            self.selectedEdgeID = edge.id
            self.inspectorSection = .configuration
        }
    }

    func reconnectEdge(_ edgeID: UUID, endpoint: ConnectionEndpoint, to port: ConnectionPortSelection) {
        updateSelectedAgent { agent in
            guard let index = agent.edges.firstIndex(where: { $0.id == edgeID }) else { return }
            switch endpoint {
            case .source:
                guard port.nodeID != agent.edges[index].to else {
                    agent.edges.remove(at: index)
                    self.selectedEdgeID = nil
                    return
                }
                agent.edges[index].from = port.nodeID
                agent.edges[index].fromPort = port.port
                if let source = agent.nodes.first(where: { $0.id == port.nodeID }), source.kind == .condition {
                    agent.edges[index].label = source.branches.first ?? agent.edges[index].label
                }
            case .target:
                guard port.nodeID != agent.edges[index].from else {
                    agent.edges.remove(at: index)
                    self.selectedEdgeID = nil
                    return
                }
                agent.edges[index].to = port.nodeID
                agent.edges[index].toPort = port.port
            }
            self.selectedNodeID = nil
            self.selectedEdgeID = edgeID
            self.inspectorSection = .configuration
        }
    }

    func deleteEdge(_ edgeID: UUID) {
        updateSelectedAgent { agent in
            AgentGraphEditor.deleteEdge(edgeID, in: &agent)
            if self.selectedEdgeID == edgeID {
                self.selectedEdgeID = nil
            }
        }
    }

    func addLLMModel() {
        let count = workspace.llmModels.count + 1
        workspace.llmModels.append(LLMModelConfig(
            nickname: "Model \(count)",
            backend: .openAI,
            baseURL: LLMBackend.openAI.defaultBaseURL,
            modelName: "gpt-4.1"
        ))
        inspectorSection = .models
        persist()
    }

    func updateLLMModel(_ modelID: UUID, mutate: (inout LLMModelConfig) -> Void) {
        guard let index = workspace.llmModels.firstIndex(where: { $0.id == modelID }) else { return }
        mutate(&workspace.llmModels[index])
        persist()
    }

    func deleteLLMModel(_ modelID: UUID) {
        guard workspace.llmModels.count > 1 else { return }
        workspace.llmModels.removeAll { $0.id == modelID }
        let fallbackID = workspace.llmModels.first?.id
        for index in workspace.agents.indices where workspace.agents[index].llmModelConfigID == modelID {
            workspace.agents[index].llmModelConfigID = fallbackID
        }
        persist()
    }

    func toggleTool(_ toolID: String, for nodeID: UUID) {
        updateSelectedAgent { agent in
            guard let index = agent.nodes.firstIndex(where: { $0.id == nodeID }) else { return }
            if agent.nodes[index].selectedToolIDs.contains(toolID) {
                agent.nodes[index].selectedToolIDs.removeAll { $0 == toolID }
            } else {
                agent.nodes[index].selectedToolIDs.append(toolID)
            }
        }
    }

    func triggerRun(trigger: AgentRunTrigger = .manual) {
        updateSelectedAgent { agent in
            let run = AgentRunEngine.trigger(agent: agent, trigger: trigger)
            agent.runs.insert(run, at: 0)
            selectedRunID = run.id
            inspectorSection = .runs
        }
    }

    func addSchedule() {
        updateSelectedAgent { agent in
            agent.schedules.append(AgentSchedule(name: "New schedule", cronExpression: "0 9 * * 1-5"))
            inspectorSection = .schedules
        }
    }

    func updateSchedule(_ scheduleID: UUID, mutate: (inout AgentSchedule) -> Void) {
        updateSelectedAgent { agent in
            guard let index = agent.schedules.firstIndex(where: { $0.id == scheduleID }) else { return }
            mutate(&agent.schedules[index])
        }
    }

    func deleteSchedule(_ scheduleID: UUID) {
        updateSelectedAgent { agent in
            agent.schedules.removeAll { $0.id == scheduleID }
        }
    }

    func persist() {
        do {
            try FileManager.default.createDirectory(at: persistenceURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            let data = try JSONEncoder.agentFlow.encode(workspace)
            try data.write(to: persistenceURL, options: .atomic)
        } catch {
            assertionFailure("Unable to persist workspace: \(error)")
        }
    }

    private static func defaultPersistenceURL() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
        return base.appendingPathComponent("MacAgentFlow", isDirectory: true).appendingPathComponent("workspace.json")
    }

    private static func normalizedWorkspace(_ workspace: AgentWorkspace) -> AgentWorkspace {
        var result = workspace
        if result.llmModels.isEmpty {
            result.llmModels = LLMModelConfig.defaultConfigs
        }
        let modelIDs = Set(result.llmModels.map(\.id))
        for index in result.agents.indices {
            if let compacted = compactedStockAgent(result.agents[index]) {
                result.agents[index] = compacted
            } else if isDefaultBlankAgent(result.agents[index]) {
                result.agents[index] = compactedBlankAgent(result.agents[index])
            }
            if result.agents[index].llmModelConfigID == nil || !modelIDs.contains(result.agents[index].llmModelConfigID!) {
                result.agents[index].llmModelConfigID = result.llmModels.first?.id
            }
        }
        if result.agents.contains(where: isKnownStockAgent) {
            let existingNames = Set(result.agents.map(\.name))
            for sample in AgentWorkspace.sample.agents where !existingNames.contains(sample.name) {
                result.agents.append(sample)
            }
        }
        let finalModelIDs = Set(result.llmModels.map(\.id))
        for index in result.agents.indices where result.agents[index].llmModelConfigID == nil || !finalModelIDs.contains(result.agents[index].llmModelConfigID!) {
            result.agents[index].llmModelConfigID = result.llmModels.first?.id
        }
        return result
    }

    private static func isKnownStockAgent(_ agent: AgentDefinition) -> Bool {
        compactedStockAgent(agent) != nil
    }

    private static func compactedStockAgent(_ agent: AgentDefinition) -> AgentDefinition? {
        let reference: AgentDefinition
        switch agent.name {
        case "Release Readiness Agent":
            reference = AgentDefinition.sample(number: 1, name: agent.name)
        case "Static Data Pipeline Agent":
            reference = AgentDefinition.dataPipelineSample(name: agent.name)
        case "Support Triage Agent":
            reference = AgentDefinition.supportTriageSample(name: agent.name)
        default:
            return nil
        }

        let agentTitles = Set(agent.nodes.map(\.title))
        guard Set(reference.nodes.map(\.title)).allSatisfy(agentTitles.contains) else { return nil }
        return copyLayout(from: reference, into: agent)
    }

    private static func isDefaultBlankAgent(_ agent: AgentDefinition) -> Bool {
        guard agent.summary == "Design, run, and observe an agent workflow.",
              agent.nodes.count == 3,
              agent.nodes.filter({ $0.kind == .start }).count == 1,
              agent.nodes.filter({ $0.kind == .end }).count == 1,
              agent.nodes.filter({ ![.start, .end].contains($0.kind) }).count == 1
        else {
            return false
        }
        return agent.edges.count >= 2
    }

    private static func compactedBlankAgent(_ agent: AgentDefinition) -> AgentDefinition {
        var result = agent
        let orderedPositions: [(AgentNodeKind, CanvasPoint)] = [
            (.start, CanvasPoint(x: 252, y: 64)),
            (.ai, CanvasPoint(x: 252, y: 220)),
            (.code, CanvasPoint(x: 252, y: 220)),
            (.tool, CanvasPoint(x: 252, y: 220)),
            (.condition, CanvasPoint(x: 252, y: 220)),
            (.end, CanvasPoint(x: 252, y: 376))
        ]
        for index in result.nodes.indices {
            if let layout = orderedPositions.first(where: { $0.0 == result.nodes[index].kind }) {
                result.nodes[index].position = layout.1
            } else if ![.start, .end].contains(result.nodes[index].kind) {
                result.nodes[index].position = CanvasPoint(x: 252, y: 220)
            }
            result.nodes[index].width = 190
            result.nodes[index].height = 96
        }
        let startID = result.nodes.first(where: { $0.kind == .start })?.id
        let middleID = result.nodes.first(where: { ![.start, .end].contains($0.kind) })?.id
        let endID = result.nodes.first(where: { $0.kind == .end })?.id
        for index in result.edges.indices {
            if result.edges[index].from == startID && result.edges[index].to == middleID {
                result.edges[index].fromPort = .bottom
                result.edges[index].toPort = .top
            }
            if result.edges[index].from == middleID && result.edges[index].to == endID {
                result.edges[index].fromPort = .bottom
                result.edges[index].toPort = .top
            }
        }
        return result
    }

    private static func copyLayout(from reference: AgentDefinition, into agent: AgentDefinition) -> AgentDefinition {
        var result = agent
        let compactSampleNodes = Dictionary(uniqueKeysWithValues: reference.nodes.map { ($0.title, $0) })
        for index in result.nodes.indices {
            guard let sampleNode = compactSampleNodes[result.nodes[index].title] else { continue }
            result.nodes[index].position = sampleNode.position
            result.nodes[index].width = sampleNode.width
            result.nodes[index].height = sampleNode.height
        }
        return result
    }
}

struct ConnectionPortSelection: Equatable {
    let nodeID: UUID
    let port: NodePort
}

enum ConnectionEndpoint: Equatable {
    case source
    case target
}

enum InspectorSection: String, CaseIterable, Identifiable {
    case configuration = "Config"
    case models = "Models"
    case tools = "Tools"
    case runs = "Runs"
    case schedules = "Schedule"
    case harness = "Harness"

    var id: String { rawValue }
}

private func defaultNote(for kind: AgentNodeKind) -> String {
    switch kind {
    case .start: "Initial state enters here."
    case .ai: "Prompt an LLM and merge the returned state update."
    case .code: "Run local Python code against current state."
    case .tool: "Prepare or run selected tool boundaries."
    case .condition: "Route the workflow by branch label."
    case .end: "Final state is emitted here."
    }
}

private extension JSONEncoder {
    static var agentFlow: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }
}

private extension JSONDecoder {
    static var agentFlow: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
