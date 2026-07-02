import AppKit
import MacAgentFlowCore
import SwiftUI

struct InspectorView: View {
    @EnvironmentObject private var store: WorkspaceStore
    @State private var selectedItemMode: SelectedItemMode = .details

    var body: some View {
        VStack(spacing: 0) {
            InspectorModeBar(selection: $store.inspectorSection)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    switch store.inspectorSection {
                    case .selection:
                        SelectedItemPanel(mode: $selectedItemMode)
                    case .source:
                        GraphSourceSection()
                    case .model:
                        ModelSettingsSection()
                    case .schedules:
                        SchedulesSection()
                    }
                }
                .padding(12)
            }
        }
        .background(Color(nsColor: .windowBackgroundColor))
    }
}

enum SelectedItemMode: String, CaseIterable, Identifiable {
    case details = "Details"
    case tools = "Tools"

    var id: String { rawValue }
}

struct InspectorModeBar: View {
    @Binding var selection: InspectorSection

    var body: some View {
        HStack(spacing: 8) {
            ForEach(InspectorSection.workspaceSections) { section in
                Button {
                    selection = section
                } label: {
                    Label(section.rawValue, systemImage: section.systemImage)
                        .font(.caption.weight(.semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 7)
                        .frame(maxWidth: .infinity)
                        .foregroundStyle(selection == section ? Color.white : Color.primary)
                        .background(
                            selection == section
                                ? AnyShapeStyle(Color.accentColor)
                                : AnyShapeStyle(Color.secondary.opacity(0.12)),
                            in: RoundedRectangle(cornerRadius: 7)
                        )
                }
                .buttonStyle(.plain)
                .help(section.rawValue)
            }
        }
    }
}

struct SelectedItemPanel: View {
    @EnvironmentObject private var store: WorkspaceStore
    @Binding var mode: SelectedItemMode

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center) {
                SectionHeader(title: headerTitle, systemImage: headerIcon)
                Spacer()
                if let node = store.selectedNode {
                    Label(node.kind.title, systemImage: node.kind.symbolName)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.accentColor)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.accentColor.opacity(0.10), in: Capsule())
                }
            }

            if let edge = store.selectedEdge {
                SelectedConnectorSection(edge: edge)
            } else if let node = store.selectedNode {
                Picker("Selected node mode", selection: $mode) {
                    ForEach(SelectedItemMode.allCases) { itemMode in
                        Text(itemMode.rawValue).tag(itemMode)
                    }
                }
                .pickerStyle(.segmented)
                .labelsHidden()

                switch mode {
                case .details:
                    SelectedNodeDetailsSection(node: node)
                case .tools:
                    SelectedNodeToolsSection(node: node)
                }
            } else {
                Text("Select a node or connector on the canvas to edit it here.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(Color.accentColor.opacity(0.05), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.accentColor.opacity(0.22)))
    }

    private var headerTitle: String {
        if store.selectedEdge != nil {
            return "Selected Connector"
        }
        if store.selectedNode != nil {
            return "Selected Node"
        }
        return "Selected Item"
    }

    private var headerIcon: String {
        if store.selectedEdge != nil {
            return "point.topleft.down.curvedto.point.bottomright.up"
        }
        if store.selectedNode != nil {
            return "slider.horizontal.3"
        }
        return "cursorarrow.click"
    }

}

struct ModelSettingsSection: View {
    @EnvironmentObject private var store: WorkspaceStore
    @State private var showsModelDetails = false
    @State private var showsAgentMetadata = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "Model", systemImage: "brain.head.profile")
            if let agent = store.selectedAgent {
                VStack(alignment: .leading, spacing: 8) {
                    if let fallbackModelID = store.workspace.llmModels.first?.id {
                        Picker("LLM model", selection: Binding<UUID>(
                            get: { agent.llmModelConfigID ?? fallbackModelID },
                            set: { store.setSelectedAgentLLMModel($0) }
                        )) {
                            ForEach(store.workspace.llmModels) { model in
                                Text(model.displayName).tag(model.id)
                            }
                        }
                        .pickerStyle(.menu)
                    } else {
                        Button("Add model") {
                            store.addLLMModel()
                        }
                    }

                    if let model = store.selectedAgentLLMModel {
                        DisclosureGroup(isExpanded: $showsModelDetails) {
                            ModelSummaryCard(model: model)
                                .padding(.top, 6)
                        } label: {
                            HStack {
                                Text(model.displayName)
                                    .font(.caption.weight(.semibold))
                                Spacer()
                                Text(model.backend.rawValue)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(8)
                        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
                    } else {
                        Text("Add a model for AI and conditional nodes.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Button("Manage models") {
                        store.openModelsPage(selecting: agent.llmModelConfigID)
                    }
                }

                DisclosureGroup(isExpanded: $showsAgentMetadata) {
                    VStack(alignment: .leading, spacing: 8) {
                        TextField("Name", text: Binding(
                            get: { agent.name },
                            set: { store.renameSelectedAgent($0) }
                        ))
                        TextField("Summary", text: Binding(
                            get: { agent.summary },
                            set: { value in store.updateSelectedAgent { $0.summary = value } }
                        ))
                    }
                    .padding(.top, 6)
                } label: {
                    Text("Agent metadata")
                        .font(.caption.weight(.semibold))
                }
                .padding(8)
                .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
            }

            Divider()
            GraphChecksSection()
        }
    }
}

struct ModelSummaryCard: View {
    let model: LLMModelConfig

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(model.displayName)
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(model.backend.rawValue)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            if !model.modelName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                LabeledContent("Model", value: model.modelName)
                    .font(.caption)
            }
            if !model.baseURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                LabeledContent("Endpoint", value: model.baseURL)
                    .font(.caption)
            }
            LabeledContent("API key", value: model.apiKey.isEmpty ? "Not saved" : "Saved")
                .font(.caption)
        }
        .padding(10)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
    }
}

struct SelectedNodeDetailsSection: View {
    @EnvironmentObject private var store: WorkspaceStore
    let node: AgentNode

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("Title", text: Binding(
                get: { node.title },
                set: { value in store.updateSelectedNode { $0.title = value } }
            ))
            TextField("Canvas note", text: Binding(
                get: { node.note },
                set: { value in store.updateSelectedNode { $0.note = value } }
            ))

            if node.kind == .ai || node.kind == .condition {
                if node.kind == .ai {
                    CodingRepositorySection(node: node)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text(node.kind == .condition ? "Router prompt" : "Prompt")
                        .font(.caption.weight(.semibold))
                    TextEditor(text: Binding(
                        get: { node.prompt },
                        set: { value in store.updateSelectedNode { $0.prompt = value } }
                    ))
                    .font(.system(.body, design: .monospaced))
                    .frame(minHeight: 110)
                    .scrollContentBackground(.hidden)
                    .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 6))
                }
            }

            if node.kind == .code {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Python code")
                        .font(.caption.weight(.semibold))
                    PythonCodeEditor(text: Binding(
                        get: { node.pythonCode },
                        set: { value in store.updateSelectedNode { $0.pythonCode = value } }
                    ), isEditable: true)
                    .frame(height: 180)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.18)))
                }
            }

            if node.kind == .condition {
                TextField("Branches", text: Binding(
                    get: { node.branches.joined(separator: ", ") },
                    set: { value in
                        store.updateSelectedNode {
                            $0.branches = value.split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
                        }
                    }
                ))
                .help("Comma-separated branch labels")
            }

            if ![AgentNodeKind.start, .end].contains(node.kind) || store.canPasteSelection {
                HStack {
                    if ![AgentNodeKind.start, .end].contains(node.kind) {
                        Button("Copy") {
                            store.copySelection()
                        }
                        Button("Delete node", role: .destructive) {
                            store.deleteSelectedNode()
                        }
                    }
                    if store.canPasteSelection {
                        Button("Paste") {
                            store.pasteSelection()
                        }
                    }
                    Spacer()
                }
            } else {
                Text("\(node.kind.title) is a fixed system node.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

struct CodingRepositorySection: View {
    @EnvironmentObject private var store: WorkspaceStore
    let node: AgentNode

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Workspace")
                .font(.caption.weight(.semibold))

            Label(resolution.message, systemImage: resolutionIcon)
                .font(.caption)
                .foregroundStyle(resolutionColor)
                .lineLimit(2)
                .truncationMode(.middle)

            Text("Mention a local folder naturally in the prompt. Choose a folder only when macOS needs access or the path is ambiguous.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            if resolution.needsPermission || resolution.source == "chosen" {
                HStack {
                    Button(resolution.needsPermission ? "Grant Access" : "Change Folder") {
                        chooseWorkspace()
                    }
                    if normalizedOptional(node.repositoryPath) != nil {
                        Button("Forget Folder") {
                            store.updateSelectedNode { $0.repositoryPath = nil }
                        }
                    }
                    Spacer()
                }
            }

            TextField("Validation command", text: Binding(
                get: { node.validationCommand ?? "" },
                set: { value in
                    store.updateSelectedNode {
                        $0.validationCommand = normalizedOptional(value)
                    }
                }
            ))
            .help("Optional local command run after code edits")
        }
        .padding(10)
        .background(Color.accentColor.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.accentColor.opacity(0.14)))
    }

    private var resolution: CodingWorkspaceResolution {
        CodingWorkspaceResolver.resolve(configuredPath: node.repositoryPath, prompt: node.prompt)
    }

    private var resolutionIcon: String {
        if resolution.url != nil { return "checkmark.circle.fill" }
        return resolution.needsPermission ? "exclamationmark.triangle.fill" : "sparkles"
    }

    private var resolutionColor: Color {
        if resolution.url != nil { return .green }
        return resolution.needsPermission ? .orange : .secondary
    }

    private func chooseWorkspace() {
        let panel = NSOpenPanel()
        panel.title = "Grant Workspace Access"
        panel.message = "Choose the local folder this AI node is allowed to inspect and edit."
        panel.prompt = "Select"
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.resolvesAliases = true
        if let path = normalizedOptional(node.repositoryPath) {
            panel.directoryURL = URL(fileURLWithPath: NSString(string: path).expandingTildeInPath)
        }
        guard panel.runModal() == .OK, let url = panel.url else { return }
        store.updateSelectedNode { $0.repositoryPath = url.path }
    }
}

struct SelectedNodeToolsSection: View {
    @EnvironmentObject private var store: WorkspaceStore
    let node: AgentNode

    private var selectedTools: [ToolDefinition] {
        store.workspace.toolCatalog.filter { node.selectedToolIDs.contains($0.id) }
    }

    private var availableTools: [ToolDefinition] {
        store.workspace.toolCatalog.filter { !node.selectedToolIDs.contains($0.id) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if [AgentNodeKind.start, .end].contains(node.kind) {
                Text("\(node.kind.title) is a fixed system node and cannot attach tools.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                HStack {
                    Menu {
                        ForEach(availableTools) { tool in
                            Button(tool.name) {
                                store.toggleTool(tool.id, for: node.id)
                            }
                        }
                    } label: {
                        Label("Add Tool", systemImage: "plus")
                    }
                    .disabled(availableTools.isEmpty)

                    Spacer()

                    Button {
                        store.openToolsPage()
                    } label: {
                        Label("Tools Page", systemImage: "arrow.up.right.square")
                    }
                }

                if selectedTools.isEmpty {
                    Text("No tools attached to this node.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(selectedTools) { tool in
                            SelectedToolChipRow(tool: tool, node: node)
                        }
                    }
                }
            }
        }
    }
}

struct SelectedToolChipRow: View {
    @EnvironmentObject private var store: WorkspaceStore
    let tool: ToolDefinition
    let node: AgentNode

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: tool.isMutating ? "exclamationmark.triangle.fill" : "checkmark.shield.fill")
                .foregroundStyle(tool.isMutating ? Color.orange : Color.green)
                .frame(width: 16)
            VStack(alignment: .leading, spacing: 2) {
                Text(tool.name)
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
                Text(tool.summary)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Button {
                store.openToolsPage(selecting: tool.id)
            } label: {
                Image(systemName: "pencil")
            }
            .buttonStyle(.borderless)
            .help("Edit \(tool.name) on the Tools page")
            Button {
                store.toggleTool(tool.id, for: node.id)
            } label: {
                Image(systemName: "xmark")
            }
            .buttonStyle(.borderless)
            .help("Remove from this node")
        }
        .padding(8)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 7))
    }
}

struct SelectedConnectorSection: View {
    @EnvironmentObject private var store: WorkspaceStore
    let edge: AgentEdge

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("Label", text: Binding(
                get: { edge.label },
                set: { value in store.updateSelectedEdge { $0.label = value } }
            ))
            LabeledContent("From", value: endpointDescription(nodeID: edge.from, port: edge.fromPort))
            LabeledContent("To", value: endpointDescription(nodeID: edge.to, port: edge.toPort))

            Text("Drag either white endpoint handle to reconnect. Drop it on empty canvas to remove this connector.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            HStack {
                Button("Delete connector", role: .destructive) {
                    store.deleteEdge(edge.id)
                }
                Spacer()
            }
        }
    }

    private func endpointDescription(nodeID: UUID, port: NodePort?) -> String {
        let title = store.selectedAgent?.nodes.first(where: { $0.id == nodeID })?.title ?? "Missing node"
        guard let port else { return title }
        return "\(title) · \(port.rawValue)"
    }
}

struct GraphSourceSection: View {
    @EnvironmentObject private var store: WorkspaceStore
    @State private var didCopy = false
    @State private var renderedSource = ""
    @State private var renderedKey = GraphSourceRenderKey.empty

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionHeader(title: "Code", systemImage: "chevron.left.forwardslash.chevron.right")
                Spacer()
                Button {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(renderedSource, forType: .string)
                    didCopy = true
                } label: {
                    Label(didCopy ? "Copied" : "Copy", systemImage: "doc.on.doc")
                }
                .disabled(renderedSource.isEmpty)
            }

            Text("Generated LangGraph Python for the current topology, model config, prompts, Python nodes, tools, branches, and connector labels.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            PythonCodeEditor(text: .constant(renderedSource), isEditable: false)
                .frame(height: 560)
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.18)))
        }
        .onAppear(perform: refreshSourceIfNeeded)
        .onChange(of: currentRenderKey) { _, _ in
            refreshSourceIfNeeded()
        }
    }

    private var currentRenderKey: GraphSourceRenderKey {
        guard let agent = store.selectedAgent else { return .empty }
        let selectedToolIDs = Set(agent.nodes.flatMap(\.selectedToolIDs))
        let toolFingerprints = store.workspace.toolCatalog
            .filter { selectedToolIDs.contains($0.id) }
            .sorted { $0.id < $1.id }
            .map { tool in
                "\(tool.id)|\(tool.name)|\(tool.category)|\(tool.summary)|\(tool.isMutating)|\(tool.pythonCode.hashValue)"
            }
        let model = store.selectedAgentLLMModel
        return GraphSourceRenderKey(
            agentID: agent.id,
            agentUpdatedAt: agent.updatedAt,
            modelFingerprint: model.map { "\($0.id)|\($0.nickname)|\($0.backend.rawValue)|\($0.baseURL)|\($0.modelName)" } ?? "",
            toolFingerprints: toolFingerprints
        )
    }

    private func refreshSourceIfNeeded() {
        let key = currentRenderKey
        guard key != renderedKey else { return }
        renderedKey = key
        didCopy = false
        guard let agent = store.selectedAgent else {
            renderedSource = ""
            return
        }
        renderedSource = AgentPythonSourceRenderer.render(agent: agent, model: store.selectedAgentLLMModel, tools: store.workspace.toolCatalog)
    }
}

private struct GraphSourceRenderKey: Equatable {
    var agentID: UUID?
    var agentUpdatedAt: Date?
    var modelFingerprint: String
    var toolFingerprints: [String]

    static let empty = GraphSourceRenderKey(agentID: nil, agentUpdatedAt: nil, modelFingerprint: "", toolFingerprints: [])
}

struct SchedulesSection: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionHeader(title: "Schedule", systemImage: "alarm")
                Spacer()
                Button("Add") {
                    store.addSchedule()
                }
            }
            if let agent = store.selectedAgent {
                ForEach(agent.schedules) { schedule in
                    ScheduleEditor(schedule: schedule)
                }
                if agent.schedules.isEmpty {
                    Text("No schedules. Add one to trigger this agent later.")
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

struct ScheduleEditor: View {
    @EnvironmentObject private var store: WorkspaceStore
    let schedule: AgentSchedule

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Toggle("", isOn: Binding(
                    get: { schedule.isEnabled },
                    set: { value in store.updateSchedule(schedule.id) { $0.isEnabled = value } }
                ))
                .labelsHidden()
                TextField("Schedule name", text: Binding(
                    get: { schedule.name },
                    set: { value in store.updateSchedule(schedule.id) { $0.name = value } }
                ))
                Button(role: .destructive) {
                    store.deleteSchedule(schedule.id)
                } label: {
                    Image(systemName: "trash")
                }
                .buttonStyle(.borderless)
            }
            TextField("Cron", text: Binding(
                get: { schedule.cronExpression },
                set: { value in store.updateSchedule(schedule.id) { $0.cronExpression = value } }
            ))
            .font(.system(.body, design: .monospaced))
            Text(CronExpression.summary(schedule.cronExpression))
                .font(.caption)
                .foregroundStyle(CronExpression.isValid(schedule.cronExpression) ? Color.secondary : Color.red)
        }
        .padding(10)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
    }
}

struct GraphChecksSection: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Graph Checks", systemImage: "checkmark.seal")
            let issues = store.selectedAgent.map(AgentGraphValidator.validate) ?? []
            if issues.isEmpty {
                Label("Graph is ready to run", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(.green)
            } else {
                ForEach(issues) { issue in
                    Label(issue.message, systemImage: issue.severity == .error ? "xmark.octagon" : "exclamationmark.triangle")
                        .font(.caption)
                        .foregroundStyle(issue.severity == .error ? .red : .orange)
                }
            }
        }
    }
}

struct SectionHeader: View {
    let title: String
    let systemImage: String

    var body: some View {
        Label(title, systemImage: systemImage)
            .font(.headline)
    }
}

struct StatusBadge: View {
    let status: AgentRunStatus

    var body: some View {
        Text(status.rawValue)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(color.opacity(0.14), in: Capsule())
            .foregroundStyle(color)
    }

    private var color: Color {
        switch status {
        case .queued: .secondary
        case .running: .blue
        case .succeeded: .green
        case .failed: .red
        case .cancelled: .orange
        }
    }
}

private func normalizedOptional(_ value: String?) -> String? {
    guard let value else { return nil }
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
}
