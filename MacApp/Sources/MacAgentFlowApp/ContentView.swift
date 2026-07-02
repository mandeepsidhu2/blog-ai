import MacAgentFlowCore
import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        VStack(spacing: 0) {
            AppTopBar()
            Divider()
            if store.appPage == .runs {
                RunsHistoryPage()
                    .frame(minWidth: 720, maxWidth: .infinity, maxHeight: .infinity)
            } else {
                HSplitView {
                    if store.isWorkspaceSidebarCollapsed {
                        CollapsedSidebarRail()
                            .frame(width: 44)
                    } else {
                        WorkspaceSidebarView()
                            .frame(minWidth: 220, idealWidth: 280, maxWidth: 460)
                    }

                    switch store.appPage {
                    case .console:
                        ConsoleSplitView()
                    case .runs:
                        EmptyView()
                    case .tools:
                        ToolsManagementPage()
                            .frame(minWidth: 720, maxWidth: .infinity, maxHeight: .infinity)
                    case .models:
                        ModelsManagementPage()
                            .frame(minWidth: 720, maxWidth: .infinity, maxHeight: .infinity)
                    }
                }
            }
        }
        .background(Color(nsColor: .windowBackgroundColor))
        .alert("Run blocked", isPresented: Binding(
            get: { store.runPreflightMessage != nil },
            set: { isPresented in
                if !isPresented {
                    store.runPreflightMessage = nil
                }
            }
        )) {
            Button("OK") {
                store.runPreflightMessage = nil
            }
        } message: {
            Text(store.runPreflightMessage ?? "")
        }
        .alert("Delete agent?", isPresented: Binding(
            get: { store.pendingAgentDeletionID != nil },
            set: { isPresented in
                if !isPresented {
                    store.cancelPendingAgentDeletion()
                }
            }
        )) {
            Button("Delete", role: .destructive) {
                store.confirmPendingAgentDeletion()
            }
            Button("Cancel", role: .cancel) {
                store.cancelPendingAgentDeletion()
            }
        } message: {
            Text("Delete \(store.pendingAgentDeletionName), including its graph, schedules, and run history.")
        }
    }
}

struct ConsoleSplitView: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        HSplitView {
            AgentDesignerView()
                .frame(minWidth: 520, maxWidth: .infinity, maxHeight: .infinity)
            if store.isRightPanelCollapsed {
                CollapsedRightRail(title: "Inspector")
                    .frame(width: 44)
            } else {
                InspectorView()
                    .frame(minWidth: 300, idealWidth: 380, maxWidth: 680, maxHeight: .infinity)
            }
        }
    }
}

struct AppTopBar: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        HStack(spacing: 14) {
            if store.appPage == .runs {
                Button {
                    withAnimation(.easeInOut(duration: 0.16)) {
                        store.isWorkspaceSidebarCollapsed = false
                        store.openConsole()
                    }
                } label: {
                    Label("Agents", systemImage: "chevron.left")
                        .frame(minWidth: 78, alignment: .leading)
                }
                .buttonStyle(.bordered)
                .help("Back to agent editor and main agent menu")
            } else {
                Button {
                    withAnimation(.easeInOut(duration: 0.16)) {
                        store.isWorkspaceSidebarCollapsed.toggle()
                    }
                } label: {
                    Image(systemName: store.isWorkspaceSidebarCollapsed ? "sidebar.leading" : "sidebar.left")
                        .frame(width: 24, height: 24)
                }
                .buttonStyle(.borderless)
                .help(store.isWorkspaceSidebarCollapsed ? "Show left menu" : "Collapse left menu")
            }

            HStack(spacing: 9) {
                Image(systemName: "point.3.connected.trianglepath.dotted")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.accentColor)
                    .frame(width: 28, height: 28)
                    .background(Color.accentColor.opacity(0.12), in: RoundedRectangle(cornerRadius: 7))
                VStack(alignment: .leading, spacing: 1) {
                    Text("Mac Agent Flow")
                        .font(.headline)
                    Text(store.appPage == .console ? "Agent operations console" : "\(store.appPage.rawValue) workspace")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Divider()
                .frame(height: 28)

            if let agent = store.selectedAgent {
                VStack(alignment: .leading, spacing: 2) {
                    Text(agent.name)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                    Text(agent.summary)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .frame(maxWidth: 430, alignment: .leading)
            }

            Spacer()

            if store.appPage == .console || store.appPage == .runs {
                Button {
                    withAnimation(.easeInOut(duration: 0.16)) {
                        store.isRightPanelCollapsed.toggle()
                    }
                } label: {
                    Image(systemName: store.isRightPanelCollapsed ? "sidebar.trailing" : "sidebar.right")
                        .frame(width: 24, height: 24)
                }
                .buttonStyle(.borderless)
                .help(store.isRightPanelCollapsed ? "Show right panel" : "Collapse right panel")
            }

            if store.appPage == .console {
                Menu {
                    Button("AI Node") { store.addNode(kind: .ai) }
                    Button("Python Node") { store.addNode(kind: .code) }
                    Button("Tool Node") { store.addNode(kind: .tool) }
                    Button("Conditional") { store.addNode(kind: .condition) }
                } label: {
                    Label("Add Node", systemImage: "plus")
                }

                RunAgentToolbarButton()

                Button {
                    store.addSchedule()
                } label: {
                    Label("Add Schedule", systemImage: "calendar.badge.clock")
                }
            }

            if store.appPage == .runs {
                RunAgentToolbarButton()

                Button {
                    store.addSchedule()
                } label: {
                    Label("Add Schedule", systemImage: "calendar.badge.clock")
                }
            }

            if store.appPage == .console,
               store.canCopySelection || store.canPasteSelection || store.canDeleteSelection {
                Divider()
                    .frame(height: 24)

                HStack(spacing: 6) {
                    if store.canCopySelection {
                        Button {
                            store.copySelection()
                        } label: {
                            Label("Copy", systemImage: "doc.on.doc")
                        }
                        .help("Copy selected node (Command-C)")
                    }

                    if store.canPasteSelection {
                        Button {
                            store.pasteSelection()
                        } label: {
                            Label("Paste", systemImage: "doc.on.clipboard")
                        }
                        .help("Paste copied node (Command-V)")
                    }

                    if store.canDeleteSelection {
                        Button(role: .destructive) {
                            store.deleteSelection()
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                        .help("Delete selected node or connector")
                    }
                }
                .buttonStyle(.bordered)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 10)
        .background(.bar)
    }
}

struct RunAgentToolbarButton: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        Button {
            store.triggerManualRun()
        } label: {
            Label(store.isManualRunPreflightInProgress ? "Checking" : "Run Agent", systemImage: store.isManualRunPreflightInProgress ? "hourglass" : "play.fill")
        }
        .buttonStyle(.borderedProminent)
        .tint(.green)
        .keyboardShortcut("r", modifiers: [.command])
        .disabled(store.isManualRunPreflightInProgress)
        .help("Run the selected agent now")
    }
}

struct CollapsedSidebarRail: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        VStack {
            Button {
                withAnimation(.easeInOut(duration: 0.16)) {
                    store.isWorkspaceSidebarCollapsed = false
                }
            } label: {
                Image(systemName: "chevron.right")
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.borderless)
            .help("Show left menu")

            Spacer()
        }
        .padding(.top, 12)
        .frame(maxHeight: .infinity)
        .background(Color(nsColor: .controlBackgroundColor))
    }
}

struct CollapsedRightRail: View {
    @EnvironmentObject private var store: WorkspaceStore
    let title: String

    var body: some View {
        VStack {
            Button {
                withAnimation(.easeInOut(duration: 0.16)) {
                    store.isRightPanelCollapsed = false
                }
            } label: {
                Image(systemName: "chevron.left")
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.borderless)
            .help("Show \(title.lowercased())")

            Spacer()
        }
        .padding(.top, 12)
        .frame(maxHeight: .infinity)
        .background(Color(nsColor: .windowBackgroundColor))
    }
}

struct WorkspaceSidebarView: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        VStack(spacing: 0) {
            SidebarPrimaryNavigation()
                .padding(.horizontal, 12)
                .padding(.top, 12)
                .padding(.bottom, 10)

            Divider()

            switch store.appPage {
            case .console, .runs:
                AgentSidebarContent()
            case .tools:
                ToolLibrarySidebar()
            case .models:
                ModelLibrarySidebar()
            }
        }
        .background(Color(nsColor: .controlBackgroundColor))
    }
}

struct SidebarPrimaryNavigation: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            SidebarNavRow(
                title: "Console",
                systemImage: "rectangle.3.group",
                isSelected: store.appPage == .console
            ) {
                store.openConsole()
            }
            SidebarNavRow(
                title: "Tools",
                systemImage: "wrench.and.screwdriver",
                isSelected: store.appPage == .tools
            ) {
                store.openToolsPage()
            }
            SidebarNavRow(
                title: "Models",
                systemImage: "brain.head.profile",
                isSelected: store.appPage == .models
            ) {
                store.openModelsPage()
            }
        }
    }
}

struct SidebarNavRow: View {
    let title: String
    let systemImage: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.system(size: 15, weight: isSelected ? .semibold : .regular))
                .foregroundStyle(.primary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .contentShape(RoundedRectangle(cornerRadius: 8))
                .background(
                    isSelected
                        ? AnyShapeStyle(Color.secondary.opacity(0.14))
                        : AnyShapeStyle(Color.clear),
                    in: RoundedRectangle(cornerRadius: 8)
                )
        }
        .buttonStyle(.plain)
        .help(title)
    }
}

struct AgentSidebarContent: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Agents")
                    .font(.headline)
                Spacer()
                Button {
                    store.createAgent()
                } label: {
                    Label("New", systemImage: "plus")
                }
                .buttonStyle(.borderless)
                .help("Create agent")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)

            ScrollView {
                LazyVStack(spacing: 6) {
                    ForEach(store.workspace.agents) { agent in
                        let isSelected = agent.id == store.workspace.selectedAgentID
                        Button {
                            store.selectAgent(agent.id, openConsole: true)
                        } label: {
                            AgentRow(agent: agent, isSelected: isSelected)
                        }
                        .buttonStyle(.plain)
                        .help("Edit \(agent.name)")
                        .contextMenu {
                            Button {
                                store.selectAgent(agent.id, openConsole: true)
                            } label: {
                                Label("Edit Agent", systemImage: "slider.horizontal.3")
                            }

                            Button {
                                store.openRunsPage(for: agent.id)
                            } label: {
                                Label("View Runs", systemImage: "clock.arrow.circlepath")
                            }

                            Divider()

                            Button(role: .destructive) {
                                store.requestDeleteAgent(agent.id)
                            } label: {
                                Label("Delete Agent", systemImage: "trash")
                            }
                        }

                        if isSelected {
                            SelectedAgentSubmenu(agent: agent)
                        }
                    }
                }
                .padding(10)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)

            Divider()

            VStack(alignment: .leading, spacing: 8) {
                Label("Selected agent", systemImage: "point.3.connected.trianglepath.dotted")
                    .font(.subheadline.weight(.semibold))
                Text(store.selectedAgent?.name ?? "No agent")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(14)
        }
    }
}

struct AgentRow: View {
    let agent: AgentDefinition
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "point.3.connected.trianglepath.dotted")
                .foregroundStyle(isSelected ? Color.accentColor : Color.secondary)
            HStack(spacing: 8) {
                Text(agent.name)
                    .font(.subheadline.weight(isSelected ? .semibold : .regular))
                    .lineLimit(1)
                Spacer()
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 9)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(RoundedRectangle(cornerRadius: 8))
        .background(
            isSelected
                ? AnyShapeStyle(Color.accentColor.opacity(0.12))
                : AnyShapeStyle(Color.clear),
            in: RoundedRectangle(cornerRadius: 8)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(isSelected ? Color.accentColor.opacity(0.22) : Color.clear)
        )
    }
}

struct SelectedAgentSubmenu: View {
    @EnvironmentObject private var store: WorkspaceStore
    let agent: AgentDefinition

    private var lastRun: AgentRun? {
        agent.runs.sorted { $0.number > $1.number }.first
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            SidebarSubmenuRow(
                title: "Edit",
                subtitle: "Canvas and settings",
                systemImage: "slider.horizontal.3",
                isSelected: store.appPage == .console
            ) {
                store.selectAgent(agent.id, openConsole: true)
            }
            SidebarSubmenuRow(
                title: "Runs",
                subtitle: lastRun.map { "#\($0.number) \($0.status.rawValue)" } ?? "No runs yet",
                systemImage: "clock.arrow.circlepath",
                isSelected: store.appPage == .runs
            ) {
                store.openRunsPage()
            }
        }
        .padding(.leading, 24)
        .padding(.trailing, 4)
        .padding(.bottom, 4)
    }
}

struct SidebarSubmenuRow: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: systemImage)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(isSelected ? Color.accentColor : Color.secondary)
                    .frame(width: 18)
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.primary)
                    Text(subtitle)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer()
            }
            .padding(.horizontal, 9)
            .padding(.vertical, 7)
            .background(
                isSelected
                    ? AnyShapeStyle(Color.accentColor.opacity(0.10))
                    : AnyShapeStyle(Color.clear),
                in: RoundedRectangle(cornerRadius: 7)
            )
            .contentShape(RoundedRectangle(cornerRadius: 7))
        }
        .buttonStyle(.plain)
        .help(title)
    }
}

struct AgentDesignerView: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        if store.selectedAgent != nil {
            AgentCanvasView()
        } else {
            ContentUnavailableView("No Agent Selected", systemImage: "point.3.connected.trianglepath.dotted")
        }
    }
}
