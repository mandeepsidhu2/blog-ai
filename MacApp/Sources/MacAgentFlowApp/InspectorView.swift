import AppKit
import MacAgentFlowCore
import SwiftUI

struct InspectorView: View {
    @EnvironmentObject private var store: WorkspaceStore
    @State private var selectedItemMode: SelectedItemMode = .details

    var body: some View {
        VStack(spacing: 0) {
            SelectedItemPanel(mode: $selectedItemMode)
                .padding(12)

            Divider()

            VStack(alignment: .leading, spacing: 8) {
                Text("Agent & Workspace")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 12)
                InspectorTabBar(selection: $store.inspectorSection)
            }
            .padding(.top, 10)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    switch store.inspectorSection {
                    case .source:
                        GraphSourceSection()
                    case .agent:
                        AgentSettingsSection()
                    case .runs:
                        RunsSection()
                    case .schedules:
                        SchedulesSection()
                    case .harness:
                        HarnessSection()
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

struct InspectorTabBar: View {
    @Binding var selection: InspectorSection
    private let columns = [
        GridItem(.adaptive(minimum: 72), spacing: 6, alignment: .leading)
    ]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 6) {
            ForEach(InspectorSection.allCases) { section in
                Button {
                    selection = section
                } label: {
                    Text(section.rawValue)
                        .font(.caption.weight(.semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 6)
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
        .padding(.horizontal, 12)
        .padding(.bottom, 10)
    }
}

struct SelectedItemPanel: View {
    @EnvironmentObject private var store: WorkspaceStore
    @Binding var mode: SelectedItemMode

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let edge = store.selectedEdge {
                SelectedConnectorSection(edge: edge)
            } else if let node = store.selectedNode {
                HStack(alignment: .center) {
                    SectionHeader(title: "Selected Node", systemImage: "slider.horizontal.3")
                    Spacer()
                    Label(node.kind.title, systemImage: node.kind.symbolName)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.accentColor)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.accentColor.opacity(0.10), in: Capsule())
                }

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
                VStack(alignment: .leading, spacing: 6) {
                    SectionHeader(title: "Selected Item", systemImage: "cursorarrow.click")
                    Text("Select a node or connector on the canvas to edit it here.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(12)
        .background(Color.accentColor.opacity(0.05), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.accentColor.opacity(0.22)))
    }
}

struct AgentSettingsSection: View {
    @EnvironmentObject private var store: WorkspaceStore
    @State private var showsModelDetails = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "Agent", systemImage: "point.3.connected.trianglepath.dotted")
            if let agent = store.selectedAgent {
                TextField("Name", text: Binding(
                    get: { agent.name },
                    set: { store.renameSelectedAgent($0) }
                ))
                TextField("Summary", text: Binding(
                    get: { agent.summary },
                    set: { value in store.updateSelectedAgent { $0.summary = value } }
                ))
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
            SectionHeader(title: "Selected Connector", systemImage: "point.topleft.down.curvedto.point.bottomright.up")
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

    private var source: String {
        guard let agent = store.selectedAgent else { return "" }
        return AgentPythonSourceRenderer.render(agent: agent, model: store.selectedAgentLLMModel, tools: store.workspace.toolCatalog)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionHeader(title: "Python Source", systemImage: "curlybraces")
                Spacer()
                Button {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(source, forType: .string)
                    didCopy = true
                } label: {
                    Label(didCopy ? "Copied" : "Copy", systemImage: "doc.on.doc")
                }
                .disabled(source.isEmpty)
            }

            Text("Generated from the current canvas topology, model config, prompts, Python nodes, tools, branches, and connector labels.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            PythonCodeEditor(text: .constant(source), isEditable: false)
                .frame(height: 560)
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.18)))
        }
    }
}

struct RunsSection: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionHeader(title: "Runs", systemImage: "clock.arrow.circlepath")
                Spacer()
                Button("Trigger") {
                    store.triggerRun()
                }
            }

            if let agent = store.selectedAgent {
                ForEach(agent.runs.sorted(by: { $0.number > $1.number })) { run in
                    RunCard(run: run, isSelected: run.id == store.selectedRunID)
                        .onTapGesture {
                            store.selectedRunID = run.id
                        }
                }

                if agent.runs.isEmpty {
                    Text("No runs yet. Trigger a run to create history.")
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

struct RunCard: View {
    let run: AgentRun
    let isSelected: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("#\(run.number)")
                    .font(.headline)
                StatusBadge(status: run.status)
                Spacer()
                Text(run.trigger.rawValue)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Text(run.startedAt.formatted(date: .abbreviated, time: .shortened))
                .font(.caption)
                .foregroundStyle(.secondary)
            if isSelected {
                Divider()
                RunStateSummary(summary: run.stateSummary)
                RunTimeline(steps: RunTimelineStep.steps(from: run))
            } else {
                Text("\(RunTimelineStep.steps(from: run).count) steps")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(10)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(isSelected ? Color.accentColor : Color.secondary.opacity(0.16)))
    }
}

struct RunStateSummary: View {
    let summary: String

    var values: [String] {
        summary
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("State")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            if values.isEmpty {
                Text("No state summary")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                FlowLayout(spacing: 6) {
                    ForEach(values, id: \.self) { value in
                        Text(value)
                            .font(.caption2.monospaced())
                            .lineLimit(1)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(Color.secondary.opacity(0.10), in: Capsule())
                    }
                }
            }
        }
    }
}

struct RunTimeline: View {
    let steps: [RunTimelineStep]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Path")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
                    RunTimelineRow(step: step, isLast: index == steps.count - 1)
                }
            }
        }
    }
}

struct RunTimelineRow: View {
    let step: RunTimelineStep
    let isLast: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 9) {
            VStack(spacing: 0) {
                Image(systemName: step.symbolName)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 22, height: 22)
                    .background(step.color, in: Circle())
                if !isLast {
                    Rectangle()
                        .fill(step.color.opacity(0.28))
                        .frame(width: 2, height: 24)
                }
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(step.title)
                    .font(.caption.weight(.semibold))
                Text(step.detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
    }
}

struct RunTimelineStep: Identifiable, Equatable {
    let id: Int
    let title: String
    let detail: String

    var symbolName: String {
        switch title {
        case "Start":
            return "play.fill"
        case "End":
            return "checkmark"
        default:
            if title.localizedCaseInsensitiveContains("Gate") { return "arrow.triangle.branch" }
            if detail.localizedCaseInsensitiveContains("tool") { return "wrench.and.screwdriver" }
            if detail.localizedCaseInsensitiveContains("prompt") || detail.localizedCaseInsensitiveContains("JSON") { return "sparkles" }
            if detail.localizedCaseInsensitiveContains("Python") || detail.localizedCaseInsensitiveContains("code") { return "curlybraces" }
            return "circle.fill"
        }
    }

    var color: Color {
        switch title {
        case "Start", "End":
            return .green
        default:
            if title.localizedCaseInsensitiveContains("Gate") { return .orange }
            if detail.localizedCaseInsensitiveContains("tool") { return .teal }
            if detail.localizedCaseInsensitiveContains("prompt") || detail.localizedCaseInsensitiveContains("JSON") { return .purple }
            if detail.localizedCaseInsensitiveContains("Python") || detail.localizedCaseInsensitiveContains("code") { return .blue }
            return .accentColor
        }
    }

    static func steps(from run: AgentRun) -> [RunTimelineStep] {
        run.logLines.enumerated().map { index, line in
            let parts = line.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false)
            let title = parts.first.map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) } ?? "Step"
            let detail = parts.dropFirst().first.map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) } ?? line
            return RunTimelineStep(id: index, title: title, detail: detail)
        }
    }
}

struct FlowLayout<Content: View>: View {
    let spacing: CGFloat
    @ViewBuilder var content: Content

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: spacing) {
                content
            }
            VStack(alignment: .leading, spacing: spacing) {
                content
            }
        }
    }
}

struct SchedulesSection: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionHeader(title: "Schedules", systemImage: "calendar.badge.clock")
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

struct HarnessSection: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Harness Skills", systemImage: "checklist")
            Text("These are the local harness skills that make the Mac app maintainable by agents.")
                .font(.caption)
                .foregroundStyle(.secondary)
            ForEach(store.workspace.harnessSkills) { skill in
                VStack(alignment: .leading, spacing: 5) {
                    Text(skill.name)
                        .font(.subheadline.weight(.semibold))
                    Text(skill.purpose)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    LabeledContent("Artifact", value: skill.artifactPath)
                        .font(.caption)
                    LabeledContent("Gate", value: skill.qualityGate)
                        .font(.caption)
                }
                .padding(10)
                .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
            }
        }
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
