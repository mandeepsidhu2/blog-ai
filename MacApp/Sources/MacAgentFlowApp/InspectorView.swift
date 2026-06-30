import MacAgentFlowCore
import SwiftUI

struct InspectorView: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $store.inspectorSection) {
                ForEach(InspectorSection.allCases) { section in
                    Text(section.rawValue).tag(section)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .padding(12)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    switch store.inspectorSection {
                    case .configuration:
                        ConfigurationSection()
                    case .models:
                        LLMModelsSection()
                    case .tools:
                        ToolsSection()
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

struct ConfigurationSection: View {
    @EnvironmentObject private var store: WorkspaceStore

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
                    Picker("LLM model", selection: Binding<UUID?>(
                        get: { agent.llmModelConfigID },
                        set: { store.setSelectedAgentLLMModel($0) }
                    )) {
                        Text("No model").tag(UUID?.none)
                        ForEach(store.workspace.llmModels) { model in
                            Text(model.displayName).tag(Optional(model.id))
                        }
                    }
                    .pickerStyle(.menu)

                    if let model = store.selectedAgentLLMModel {
                        ModelSummaryCard(model: model)
                    } else {
                        Text("Choose a model for AI and conditional nodes, or add one in Models.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Button("Manage models") {
                        store.inspectorSection = .models
                    }
                }
            }

            Divider()
            if let edge = store.selectedEdge {
                SelectedConnectorSection(edge: edge)
            } else if let node = store.selectedNode {
                SelectedNodeSection(node: node)
            } else {
                Text("Select a node on the canvas to edit it.")
                    .foregroundStyle(.secondary)
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

struct SelectedNodeSection: View {
    @EnvironmentObject private var store: WorkspaceStore
    let node: AgentNode

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Selected Node", systemImage: "slider.horizontal.3")
            TextField("Title", text: Binding(
                get: { node.title },
                set: { value in store.updateSelectedNode { $0.title = value } }
            ))
            TextField("Canvas note", text: Binding(
                get: { node.note },
                set: { value in store.updateSelectedNode { $0.note = value } }
            ))

            LabeledContent("Kind") {
                Label(node.kind.title, systemImage: node.kind.symbolName)
            }

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
                    TextEditor(text: Binding(
                        get: { node.pythonCode },
                        set: { value in store.updateSelectedNode { $0.pythonCode = value } }
                    ))
                    .font(.system(.body, design: .monospaced))
                    .frame(minHeight: 140)
                    .scrollContentBackground(.hidden)
                    .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 6))
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

            HStack {
                Button("Copy") {
                    store.copySelection()
                }
                .disabled(!store.canCopySelection)
                Button("Paste") {
                    store.pasteSelection()
                }
                .disabled(!store.canPasteSelection)
                Button("Delete node", role: .destructive) {
                    store.deleteSelectedNode()
                }
                .disabled([AgentNodeKind.start, .end].contains(node.kind))
                Spacer()
            }
        }
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

struct LLMModelsSection: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionHeader(title: "LLM Models", systemImage: "brain.head.profile")
                Spacer()
                Button("Add") {
                    store.addLLMModel()
                }
            }

            ForEach(store.workspace.llmModels) { model in
                LLMModelEditor(model: model)
            }
        }
    }
}

struct LLMModelEditor: View {
    @EnvironmentObject private var store: WorkspaceStore
    let model: LLMModelConfig

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                TextField("Nickname", text: Binding(
                    get: { model.nickname },
                    set: { value in store.updateLLMModel(model.id) { $0.nickname = value } }
                ))
                Button(role: .destructive) {
                    store.deleteLLMModel(model.id)
                } label: {
                    Image(systemName: "trash")
                }
                .buttonStyle(.borderless)
                .disabled(store.workspace.llmModels.count <= 1)
                .help(store.workspace.llmModels.count <= 1 ? "At least one model config is required" : "Delete model config")
            }

            Picker("Backend", selection: Binding(
                get: { model.backend },
                set: { backend in
                    store.updateLLMModel(model.id) {
                        $0.backend = backend
                        if $0.baseURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            $0.baseURL = backend.defaultBaseURL
                        }
                    }
                }
            )) {
                ForEach(LLMBackend.allCases) { backend in
                    Text(backend.rawValue).tag(backend)
                }
            }
            .pickerStyle(.menu)

            TextField("Base URL", text: Binding(
                get: { model.baseURL },
                set: { value in store.updateLLMModel(model.id) { $0.baseURL = value } }
            ))
            TextField("Model name", text: Binding(
                get: { model.modelName },
                set: { value in store.updateLLMModel(model.id) { $0.modelName = value } }
            ))
            SecureField("API key", text: Binding(
                get: { model.apiKey },
                set: { value in store.updateLLMModel(model.id) { $0.apiKey = value } }
            ))

            Text(model.details.isEmpty ? "Complete this model config before assigning it to production agents." : model.details)
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(10)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
    }
}

struct ToolsSection: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Tools", systemImage: "wrench.and.screwdriver")
            if let node = store.selectedNode, node.kind != .start && node.kind != .end {
                ForEach(store.workspace.toolCatalog) { tool in
                    Button {
                        store.toggleTool(tool.id, for: node.id)
                    } label: {
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: node.selectedToolIDs.contains(tool.id) ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(node.selectedToolIDs.contains(tool.id) ? Color.accentColor : Color.secondary)
                            VStack(alignment: .leading, spacing: 3) {
                                HStack {
                                    Text(tool.name)
                                        .font(.subheadline.weight(.semibold))
                                    if tool.isMutating {
                                        Text("approval")
                                            .font(.caption2.weight(.semibold))
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(Color.orange.opacity(0.12), in: Capsule())
                                    }
                                }
                                Text("\(tool.category) · \(tool.summary)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            Spacer()
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    Divider()
                }
            } else {
                Text("Select an editable node to attach tools.")
                    .foregroundStyle(.secondary)
            }
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
