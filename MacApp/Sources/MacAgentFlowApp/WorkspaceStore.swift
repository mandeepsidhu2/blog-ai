import Foundation
import MacAgentFlowCore
import SwiftUI

@MainActor
final class WorkspaceStore: ObservableObject {
    @Published var workspace: AgentWorkspace
    @Published var selectedNodeID: UUID?
    @Published var selectedEdgeID: UUID?
    @Published var selectedRunID: UUID?
    @Published var appPage: AppPage = .console
    @Published var inspectorSection: InspectorSection = .source
    @Published var selectedToolID: String?
    @Published var selectedModelConfigID: UUID?
    @Published private(set) var canUndo = false
    @Published private(set) var canRedo = false

    private let persistenceURL: URL
    @Published private var copiedNode: AgentNode?
    private var undoStack: [AgentWorkspace] = []
    private var redoStack: [AgentWorkspace] = []
    private let maxHistoryDepth = 80

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
        selectedRunID = nil
        selectedToolID = self.workspace.toolCatalog.first?.id
        selectedModelConfigID = self.workspace.llmModels.first?.id
        inspectorSection = .source
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
        guard let agent = selectedAgent else { return nil }
        if let modelID = agent.llmModelConfigID,
           let model = workspace.llmModels.first(where: { $0.id == modelID }) {
            return model
        }
        return workspace.llmModels.first
    }

    var selectedTool: ToolDefinition? {
        if let selectedToolID,
           let tool = workspace.toolCatalog.first(where: { $0.id == selectedToolID }) {
            return tool
        }
        return workspace.toolCatalog.first
    }

    var selectedModelConfig: LLMModelConfig? {
        if let selectedModelConfigID,
           let model = workspace.llmModels.first(where: { $0.id == selectedModelConfigID }) {
            return model
        }
        return workspace.llmModels.first
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

    func openConsole() {
        appPage = .console
    }

    func openToolsPage(selecting toolID: String? = nil) {
        if let toolID, workspace.toolCatalog.contains(where: { $0.id == toolID }) {
            selectedToolID = toolID
        } else if selectedTool == nil {
            selectedToolID = workspace.toolCatalog.first?.id
        }
        appPage = .tools
    }

    func openModelsPage(selecting modelID: UUID? = nil) {
        if let modelID, workspace.llmModels.contains(where: { $0.id == modelID }) {
            selectedModelConfigID = modelID
        } else if selectedModelConfig == nil {
            selectedModelConfigID = workspace.llmModels.first?.id
        }
        appPage = .models
    }

    func selectAgent(_ id: UUID) {
        workspace.selectedAgentID = id
        selectedNodeID = selectedAgent?.nodes.first(where: { $0.kind == .start })?.id
        selectedEdgeID = nil
        selectedRunID = nil
        inspectorSection = .source
        persist()
    }

    func selectNode(_ id: UUID) {
        selectedNodeID = id
        selectedEdgeID = nil
        inspectorSection = .source
    }

    func selectEdge(_ id: UUID) {
        selectedEdgeID = id
        selectedNodeID = nil
        inspectorSection = .source
    }

    func createAgent() {
        let before = workspace
        var agent = AgentDefinition.blank(number: workspace.agents.count + 1)
        agent.llmModelConfigID = workspace.llmModels.first?.id
        workspace.agents.append(agent)
        workspace.selectedAgentID = agent.id
        selectedNodeID = agent.nodes.first(where: { $0.kind == .start })?.id
        selectedEdgeID = nil
        selectedRunID = nil
        inspectorSection = .source
        commitWorkspaceChange(from: before)
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

    func updateSelectedAgent(persistChanges: Bool = true, recordsUndo: Bool = true, _ mutate: (inout AgentDefinition) -> Void) {
        guard let index = workspace.agents.firstIndex(where: { $0.id == workspace.selectedAgentID }) else { return }
        let beforeWorkspace = workspace
        let beforeAgent = workspace.agents[index]
        mutate(&workspace.agents[index])
        if workspace.agents[index] != beforeAgent {
            workspace.agents[index].updatedAt = Date()
        }
        if recordsUndo {
            commitWorkspaceChange(from: beforeWorkspace, persistChanges: persistChanges)
        } else if persistChanges {
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
            inspectorSection = .source
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
            self.inspectorSection = .source
            self.copiedNode = copy
        }
    }

    func moveNode(_ nodeID: UUID, by translation: CGSize) {
        updateSelectedAgent(persistChanges: false, recordsUndo: false) { agent in
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
            self.inspectorSection = .source
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
            self.inspectorSection = .source
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
        let before = workspace
        let count = workspace.llmModels.count + 1
        let model = LLMModelConfig(
            nickname: "Model \(count)",
            backend: .openAI,
            baseURL: LLMBackend.openAI.defaultBaseURL,
            modelName: "gpt-4.1"
        )
        workspace.llmModels.append(model)
        selectedModelConfigID = model.id
        appPage = .models
        commitWorkspaceChange(from: before)
    }

    func updateLLMModel(_ modelID: UUID, mutate: (inout LLMModelConfig) -> Void) {
        let before = workspace
        guard let index = workspace.llmModels.firstIndex(where: { $0.id == modelID }) else { return }
        mutate(&workspace.llmModels[index])
        commitWorkspaceChange(from: before)
    }

    func deleteLLMModel(_ modelID: UUID) {
        guard workspace.llmModels.count > 1 else { return }
        let before = workspace
        workspace.llmModels.removeAll { $0.id == modelID }
        let fallbackID = workspace.llmModels.first?.id
        if selectedModelConfigID == modelID {
            selectedModelConfigID = fallbackID
        }
        for index in workspace.agents.indices where workspace.agents[index].llmModelConfigID == modelID {
            workspace.agents[index].llmModelConfigID = fallbackID
        }
        commitWorkspaceChange(from: before)
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

    func addTool() {
        let before = workspace
        let number = workspace.toolCatalog.count + 1
        let id = availableToolID(base: "custom_tool")
        let tool = ToolDefinition(
            id: id,
            name: "Custom Tool \(number)",
            category: "Custom",
            summary: "Paste Python code for a reusable workspace tool.",
            isMutating: false,
            pythonCode: ToolDefinition.defaultPythonCode(for: id)
        )
        workspace.toolCatalog.append(tool)
        selectedToolID = tool.id
        appPage = .tools
        commitWorkspaceChange(from: before)
    }

    @discardableResult
    func saveTool(_ tool: ToolDefinition) -> PythonValidationResult {
        let cleanName = tool.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanName.isEmpty else {
            return PythonValidationResult(isValid: false, message: "Tool name is required.")
        }
        let validation = PythonToolValidator.validate(tool.pythonCode)
        guard validation.isValid else { return validation }

        let before = workspace
        guard let index = workspace.toolCatalog.firstIndex(where: { $0.id == tool.id }) else {
            return PythonValidationResult(isValid: false, message: "Tool no longer exists.")
        }
        var saved = tool
        saved.name = cleanName
        workspace.toolCatalog[index] = saved
        selectedToolID = saved.id
        commitWorkspaceChange(from: before)
        return PythonValidationResult(isValid: true, message: "Tool saved.")
    }

    func deleteTool(_ toolID: String) {
        let before = workspace
        workspace.toolCatalog.removeAll { $0.id == toolID }
        if selectedToolID == toolID {
            selectedToolID = workspace.toolCatalog.first?.id
        }
        for agentIndex in workspace.agents.indices {
            for nodeIndex in workspace.agents[agentIndex].nodes.indices {
                workspace.agents[agentIndex].nodes[nodeIndex].selectedToolIDs.removeAll { $0 == toolID }
            }
        }
        commitWorkspaceChange(from: before)
    }

    func triggerRun(trigger: AgentRunTrigger = .manual) {
        let model = selectedAgentLLMModel
        let tools = workspace.toolCatalog
        updateSelectedAgent { agent in
            let run = AgentRunEngine.trigger(
                agent: agent,
                trigger: trigger,
                model: model,
                tools: tools,
                runtime: .liveCodingHarness
            )
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

    func undo() {
        guard let previous = undoStack.popLast() else { return }
        redoStack.append(workspace)
        workspace = previous
        reconcileSelectionAfterWorkspaceChange()
        syncHistoryAvailability()
        persist()
    }

    func redo() {
        guard let next = redoStack.popLast() else { return }
        undoStack.append(workspace)
        workspace = next
        reconcileSelectionAfterWorkspaceChange()
        syncHistoryAvailability()
        persist()
    }

    private func commitWorkspaceChange(from before: AgentWorkspace, persistChanges: Bool = true) {
        guard workspace != before else {
            if persistChanges {
                persist()
            }
            return
        }
        undoStack.append(before)
        if undoStack.count > maxHistoryDepth {
            undoStack.removeFirst(undoStack.count - maxHistoryDepth)
        }
        redoStack.removeAll()
        syncHistoryAvailability()
        reconcileSelectionAfterWorkspaceChange()
        if persistChanges {
            persist()
        }
    }

    private func syncHistoryAvailability() {
        canUndo = !undoStack.isEmpty
        canRedo = !redoStack.isEmpty
    }

    private func availableToolID(base: String) -> String {
        let existing = Set(workspace.toolCatalog.map(\.id))
        if !existing.contains(base) {
            return base
        }
        var index = 2
        while existing.contains("\(base)_\(index)") {
            index += 1
        }
        return "\(base)_\(index)"
    }

    private func reconcileSelectionAfterWorkspaceChange() {
        if let selectedAgentID = workspace.selectedAgentID,
           !workspace.agents.contains(where: { $0.id == selectedAgentID }) {
            workspace.selectedAgentID = workspace.agents.first?.id
        }
        if workspace.selectedAgentID == nil {
            workspace.selectedAgentID = workspace.agents.first?.id
        }

        guard let agent = selectedAgent else {
            selectedNodeID = nil
            selectedEdgeID = nil
            selectedRunID = nil
            return
        }

        if let selectedNodeID, !agent.nodes.contains(where: { $0.id == selectedNodeID }) {
            self.selectedNodeID = agent.nodes.first(where: { $0.kind == .start })?.id ?? agent.nodes.first?.id
        }
        if selectedNodeID == nil, selectedEdgeID == nil {
            selectedNodeID = agent.nodes.first(where: { $0.kind == .start })?.id ?? agent.nodes.first?.id
        }
        if let selectedEdgeID, !agent.edges.contains(where: { $0.id == selectedEdgeID }) {
            self.selectedEdgeID = nil
        }
        if let selectedRunID, !agent.runs.contains(where: { $0.id == selectedRunID }) {
            self.selectedRunID = agent.runs.sorted(by: { $0.number > $1.number }).first?.id
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
        result.toolCatalog = normalizedToolCatalog(result.toolCatalog)
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

    private static func normalizedToolCatalog(_ tools: [ToolDefinition]) -> [ToolDefinition] {
        if tools.isEmpty {
            return ToolDefinition.defaultCatalog
        }

        let legacyIDs: Set<String> = [
            "openai", "python", "git", "github", "gitlab", "terraform",
            "tofu", "aws", "kubernetes", "reddit", "twitter"
        ]
        let ids = Set(tools.map(\.id))
        if ids == legacyIDs {
            return ToolDefinition.defaultCatalog
        }

        var seen: Set<String> = []
        return tools.compactMap { tool in
            guard !seen.contains(tool.id) else { return nil }
            seen.insert(tool.id)
            return tool
        }
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

enum AppPage: String, CaseIterable, Identifiable {
    case console = "Console"
    case tools = "Tools"
    case models = "Models"

    var id: String { rawValue }
}

enum InspectorSection: String, CaseIterable, Identifiable {
    case source = "Source"
    case agent = "Agent"
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
