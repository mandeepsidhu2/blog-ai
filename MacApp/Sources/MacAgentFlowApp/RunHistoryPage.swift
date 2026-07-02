import MacAgentFlowCore
import SwiftUI

struct RunsHistoryPage: View {
    @EnvironmentObject private var store: WorkspaceStore
    @State private var selectedSnapshotNodeID: UUID?
    @State private var focusMode: RunHistoryFocusMode = .split
    @State private var usesArrangedSnapshot = true

    var body: some View {
        if let agent = store.selectedAgent {
            HSplitView {
                RunListPane(
                    agent: agent,
                    selectedSnapshotNodeID: $selectedSnapshotNodeID
                )
                .frame(minWidth: 240, idealWidth: 300, maxWidth: 380)

                RunDetailPane(
                    agent: agent,
                    selectedSnapshotNodeID: $selectedSnapshotNodeID,
                    focusMode: $focusMode,
                    usesArrangedSnapshot: $usesArrangedSnapshot
                )
                    .frame(minWidth: 720, maxWidth: .infinity, maxHeight: .infinity)
            }
            .onAppear {
                store.openRunsPage()
                selectedSnapshotNodeID = nil
            }
            .onChange(of: store.selectedRunID) { _, _ in
                selectedSnapshotNodeID = nil
            }
        } else {
            ContentUnavailableView("No Agent Selected", systemImage: "clock.arrow.circlepath")
        }
    }
}

enum RunHistoryFocusMode: String, CaseIterable, Identifiable {
    case split = "Split"
    case graph = "Graph"
    case logs = "Logs"

    var id: String { rawValue }

    var systemImage: String {
        switch self {
        case .split: "rectangle.split.2x1"
        case .graph: "point.3.connected.trianglepath.dotted"
        case .logs: "doc.text"
        }
    }
}

struct RunListPane: View {
    @EnvironmentObject private var store: WorkspaceStore
    let agent: AgentDefinition
    @Binding var selectedSnapshotNodeID: UUID?

    private var runs: [AgentRun] {
        agent.runs.sorted { $0.number > $1.number }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Runs")
                        .font(.headline)
                    Text(agent.name)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer()
                Button {
                    store.triggerManualRun()
                } label: {
                    Image(systemName: store.isManualRunPreflightInProgress ? "hourglass" : "play.fill")
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .disabled(store.isManualRunPreflightInProgress)
                .help("Run selected agent")
            }
            .padding(14)

            Divider()

            if runs.isEmpty {
                ContentUnavailableView("No Runs Yet", systemImage: "clock.badge.questionmark", description: Text("Run this agent to create historical logs."))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding()
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(runs) { run in
                            RunCard(run: run, isSelected: run.id == store.selectedRunID)
                                .contentShape(RoundedRectangle(cornerRadius: 8))
                                .onTapGesture {
                                    store.selectedRunID = run.id
                                    selectedSnapshotNodeID = nil
                                }
                        }
                    }
                    .padding(12)
                }
            }
        }
        .background(Color(nsColor: .controlBackgroundColor))
    }
}

struct RunDetailPane: View {
    let agent: AgentDefinition
    @Binding var selectedSnapshotNodeID: UUID?
    @Binding var focusMode: RunHistoryFocusMode
    @Binding var usesArrangedSnapshot: Bool
    @EnvironmentObject private var store: WorkspaceStore

    private var selectedRun: AgentRun? {
        store.selectedRun ?? agent.runs.sorted { $0.number > $1.number }.first
    }

    var body: some View {
        if let run = selectedRun {
            let snapshotAgent = RunSnapshotAgent.agent(for: run, fallback: agent)
            VStack(alignment: .leading, spacing: 0) {
                RunDetailHeader(
                    run: run,
                    snapshotName: snapshotAgent.name,
                    focusMode: $focusMode,
                    usesArrangedSnapshot: $usesArrangedSnapshot
                )
                    .padding(16)

                Divider()

                if store.isRightPanelCollapsed {
                    HSplitView {
                        RunSnapshotCanvas(
                            agent: snapshotAgent,
                            run: run,
                            selectedNodeID: $selectedSnapshotNodeID,
                            usesArrangedSnapshot: usesArrangedSnapshot
                        )
                        .frame(minWidth: 440, maxWidth: .infinity, maxHeight: .infinity)

                        CollapsedRightRail(title: "Run logs")
                            .frame(width: 44)
                    }
                } else {
                    switch focusMode {
                    case .split:
                        HSplitView {
                            RunSnapshotCanvas(
                                agent: snapshotAgent,
                                run: run,
                                selectedNodeID: $selectedSnapshotNodeID,
                                usesArrangedSnapshot: usesArrangedSnapshot
                            )
                            .frame(minWidth: 440, maxWidth: .infinity, maxHeight: .infinity)

                            RunLogsPane(agent: snapshotAgent, run: run, selectedNodeID: $selectedSnapshotNodeID)
                                .frame(minWidth: 360, idealWidth: 480, maxWidth: 640, maxHeight: .infinity)
                        }
                    case .graph:
                        RunSnapshotCanvas(
                            agent: snapshotAgent,
                            run: run,
                            selectedNodeID: $selectedSnapshotNodeID,
                            usesArrangedSnapshot: usesArrangedSnapshot
                        )
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    case .logs:
                        RunLogsPane(agent: snapshotAgent, run: run, selectedNodeID: $selectedSnapshotNodeID)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    }
                }
            }
        } else {
            ContentUnavailableView("No Run Selected", systemImage: "clock.arrow.circlepath", description: Text("Select a historical run from the list."))
        }
    }
}

struct RunDetailHeader: View {
    let run: AgentRun
    let snapshotName: String
    @Binding var focusMode: RunHistoryFocusMode
    @Binding var usesArrangedSnapshot: Bool

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text("Run #\(run.number)")
                        .font(.title3.weight(.semibold))
                    StatusBadge(status: run.status)
                }
                Text("\(snapshotName) · \(run.startedAt.formatted(date: .abbreviated, time: .shortened)) · \(run.trigger.rawValue)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Picker("Run view", selection: $focusMode) {
                ForEach(RunHistoryFocusMode.allCases) { mode in
                    Label(mode.rawValue, systemImage: mode.systemImage).tag(mode)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .frame(width: 230)
            .help("Choose split, graph-only, or logs-only run view")

            Toggle(isOn: $usesArrangedSnapshot) {
                Image(systemName: "square.grid.3x3")
            }
            .toggleStyle(.button)
            .help(usesArrangedSnapshot ? "Showing arranged snapshot" : "Showing original snapshot positions")

            if let finishedAt = run.finishedAt {
                Text("Finished \(finishedAt.formatted(date: .omitted, time: .shortened))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

struct RunSnapshotCanvas: View {
    let agent: AgentDefinition
    let run: AgentRun
    @Binding var selectedNodeID: UUID?
    let usesArrangedSnapshot: Bool

    private var displayedAgent: AgentDefinition {
        usesArrangedSnapshot ? RunSnapshotLayout.arranged(agent: agent, run: run) : agent
    }

    private var canvasSize: CGSize {
        let maxX = displayedAgent.nodes.map { $0.position.x + $0.width }.max() ?? 900
        let maxY = displayedAgent.nodes.map { $0.position.y + $0.height }.max() ?? 580
        return CGSize(width: max(maxX + 120, 900), height: max(maxY + 140, 580))
    }

    private var path: HighlightedPath {
        RunPath.path(for: run, agent: displayedAgent)
    }

    var body: some View {
        ScrollView([.horizontal, .vertical]) {
            ZStack(alignment: .topLeading) {
                GridBackground(size: canvasSize)
                EdgeLayer(agent: displayedAgent, highlightedEdgeIDs: path.edgeIDs, selectedEdgeID: nil)
                ForEach(displayedAgent.nodes) { node in
                    RunSnapshotNodeCard(
                        node: node,
                        isRunHighlighted: path.nodeIDs.contains(node.id),
                        isSelected: selectedNodeID == node.id
                    ) {
                        selectedNodeID = node.id
                    }
                    .position(x: node.position.x + node.width / 2, y: node.position.y + node.height / 2)
                }
            }
            .frame(width: canvasSize.width, height: canvasSize.height)
        }
        .background(Color(nsColor: .textBackgroundColor))
    }
}

struct RunSnapshotNodeCard: View {
    let node: AgentNode
    let isRunHighlighted: Bool
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 9) {
                HStack(spacing: 8) {
                    Image(systemName: node.kind.symbolName)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(iconColor)
                        .frame(width: 23, height: 23)
                        .background(iconColor.opacity(0.12), in: RoundedRectangle(cornerRadius: 6))
                    Text(node.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Spacer()
                    Text(node.kind.title)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    if isRunHighlighted {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.green)
                    }
                }

                Text(node.note)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)

                HStack(spacing: 6) {
                    if isRunHighlighted {
                        Pill(text: "ran")
                    }
                    if isSelected {
                        Pill(text: "logs")
                    }
                    Spacer()
                }
            }
            .padding(11)
            .frame(width: node.width, height: node.height, alignment: .topLeading)
            .background(background)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(borderColor, lineWidth: isSelected ? 2 : 1.4)
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .shadow(color: shadowColor, radius: isSelected || isRunHighlighted ? 8 : 4, y: 2)
        }
        .buttonStyle(.plain)
        .help("Show logs for \(node.title)")
    }

    private var iconColor: Color {
        switch node.kind {
        case .start, .end: .green
        case .ai: .purple
        case .code: .blue
        case .tool: .teal
        case .condition: .orange
        }
    }

    private var background: some ShapeStyle {
        if node.kind == .ai {
            return AnyShapeStyle(LinearGradient(colors: [Color.purple.opacity(0.14), Color(nsColor: .controlBackgroundColor)], startPoint: .topLeading, endPoint: .bottomTrailing))
        }
        return AnyShapeStyle(Color(nsColor: .controlBackgroundColor))
    }

    private var borderColor: Color {
        if isSelected { return .accentColor }
        if isRunHighlighted { return .green.opacity(0.72) }
        return Color.secondary.opacity(0.18)
    }

    private var shadowColor: Color {
        if isSelected { return Color.accentColor.opacity(0.14) }
        if isRunHighlighted { return Color.green.opacity(0.15) }
        return Color.black.opacity(0.04)
    }
}

struct RunLogsPane: View {
    let agent: AgentDefinition
    let run: AgentRun
    @Binding var selectedNodeID: UUID?

    private var selectedNode: AgentNode? {
        guard let selectedNodeID else { return nil }
        return agent.nodes.first { $0.id == selectedNodeID }
    }

    private var visibleLines: [String] {
        guard let selectedNode else { return run.logLines }
        return run.logLines.filter { line in
            guard let title = line.split(separator: ":", maxSplits: 1).first else { return false }
            return String(title).trimmingCharacters(in: .whitespacesAndNewlines) == selectedNode.title
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(selectedNode.map { "Logs for \($0.title)" } ?? "Run Logs")
                            .font(.headline)
                        Text(selectedNode == nil ? "Click a node in the snapshot to filter logs." : "Showing log lines emitted by the selected node.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if selectedNodeID != nil {
                        Button("All logs") {
                            selectedNodeID = nil
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Log Lines")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    if visibleLines.isEmpty {
                        Text("No log lines for this node.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(Array(visibleLines.enumerated()), id: \.offset) { _, line in
                            Text(line)
                                .font(.caption.monospaced())
                                .textSelection(.enabled)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(8)
                                .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 6))
                        }
                    }
                }

                RunStateSummary(summary: run.stateSummary)

                RunTimeline(steps: RunTimelineStep.steps(from: run))
            }
            .padding(16)
        }
        .background(Color(nsColor: .windowBackgroundColor))
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
            Text("\(RunTimelineStep.steps(from: run).count) steps")
                .font(.caption)
                .foregroundStyle(.secondary)
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

struct RunPath {
    static func orderedNodeIDs(for run: AgentRun, agent: AgentDefinition) -> [UUID] {
        let titles = RunTimelineStep.steps(from: run).map(\.title)
        var used: Set<UUID> = []
        return titles.compactMap { title in
            guard let node = agent.nodes.first(where: { $0.title == title && !used.contains($0.id) }) else {
                return nil
            }
            used.insert(node.id)
            return node.id
        }
    }

    static func path(for run: AgentRun, agent: AgentDefinition) -> HighlightedPath {
        let nodeIDs = orderedNodeIDs(for: run, agent: agent)
        var edgeIDs: Set<UUID> = []
        for index in nodeIDs.indices.dropLast() {
            let from = nodeIDs[index]
            let to = nodeIDs[index + 1]
            if let edge = agent.edges.first(where: { $0.from == from && $0.to == to }) {
                edgeIDs.insert(edge.id)
            }
        }
        return HighlightedPath(nodeIDs: Set(nodeIDs), edgeIDs: edgeIDs)
    }
}

struct RunSnapshotLayout {
    static func arranged(agent: AgentDefinition, run: AgentRun) -> AgentDefinition {
        let pathIDs = RunPath.orderedNodeIDs(for: run, agent: agent)
        guard !pathIDs.isEmpty else { return compactFallback(agent) }

        var arranged = agent
        let pathSet = Set(pathIDs)
        let laneX: Double = 220
        let sideX: Double = 520
        let firstY: Double = 64
        let rowGap: Double = 138

        for (index, nodeID) in pathIDs.enumerated() {
            guard let nodeIndex = arranged.nodes.firstIndex(where: { $0.id == nodeID }) else { continue }
            arranged.nodes[nodeIndex].position = CanvasPoint(x: laneX, y: firstY + Double(index) * rowGap)
        }

        let branchNodes = arranged.nodes
            .filter { !pathSet.contains($0.id) }
            .sorted { $0.position.y < $1.position.y }
        for (index, node) in branchNodes.enumerated() {
            guard let nodeIndex = arranged.nodes.firstIndex(where: { $0.id == node.id }) else { continue }
            arranged.nodes[nodeIndex].position = CanvasPoint(x: sideX, y: firstY + Double(index) * rowGap)
        }

        return arranged
    }

    private static func compactFallback(_ agent: AgentDefinition) -> AgentDefinition {
        var arranged = agent
        for index in arranged.nodes.indices {
            let column = index % 2
            let row = index / 2
            arranged.nodes[index].position = CanvasPoint(x: 180 + Double(column) * 300, y: 64 + Double(row) * 138)
        }
        return arranged
    }
}

struct RunSnapshotAgent {
    static func agent(for run: AgentRun, fallback: AgentDefinition) -> AgentDefinition {
        guard let snapshot = run.snapshot else { return fallback }
        return AgentDefinition(
            name: snapshot.agentName,
            summary: snapshot.agentSummary,
            llmModelConfigID: fallback.llmModelConfigID,
            nodes: snapshot.nodes,
            edges: snapshot.edges,
            schedules: [],
            runs: []
        )
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
