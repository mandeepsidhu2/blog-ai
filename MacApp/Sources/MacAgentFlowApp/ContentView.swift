import MacAgentFlowCore
import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        VStack(spacing: 0) {
            AppTopBar()
            Divider()
            HStack(spacing: 0) {
                WorkspaceSidebarView()
                    .frame(width: 280)
                Divider()
                switch store.appPage {
                case .console:
                    HStack(spacing: 0) {
                        AgentDesignerView()
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                        Divider()
                        InspectorView()
                            .frame(width: 340)
                    }
                case .tools:
                    ToolsManagementPage()
                case .models:
                    ModelsManagementPage()
                }
            }
        }
        .background(Color(nsColor: .windowBackgroundColor))
    }
}

struct AppTopBar: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        HStack(spacing: 14) {
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

            if store.appPage == .console {
                Button {
                    store.inspectorSection = .source
                } label: {
                    Label("Source", systemImage: "curlybraces")
                }
                .help("View generated LangGraph Python source")

                Menu {
                    Button("AI Node") { store.addNode(kind: .ai) }
                    Button("Python Node") { store.addNode(kind: .code) }
                    Button("Tool Node") { store.addNode(kind: .tool) }
                    Button("Conditional") { store.addNode(kind: .condition) }
                } label: {
                    Label("Add Node", systemImage: "plus")
                }

                Button {
                    store.triggerRun()
                } label: {
                    Label("Run Agent", systemImage: "play.fill")
                }
                .keyboardShortcut("r", modifiers: [.command])

                Button {
                    store.addSchedule()
                } label: {
                    Label("Schedule", systemImage: "calendar.badge.clock")
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
            case .console:
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
                        Button {
                            store.selectAgent(agent.id)
                        } label: {
                            AgentRow(agent: agent, isSelected: agent.id == store.workspace.selectedAgentID)
                        }
                        .buttonStyle(.plain)
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

    var lastRun: AgentRun? {
        agent.runs.sorted { $0.number > $1.number }.first
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 8) {
                Image(systemName: "point.3.connected.trianglepath.dotted")
                    .foregroundStyle(isSelected ? Color.accentColor : Color.secondary)
                Text(agent.name)
                    .font(.subheadline.weight(isSelected ? .semibold : .regular))
                    .lineLimit(1)
            }
            HStack(spacing: 8) {
                Text("\(agent.nodes.count) nodes")
                Text("\(agent.schedules.filter(\.isEnabled).count) schedules")
                if let lastRun {
                    Text("last #\(lastRun.number) \(lastRun.status.rawValue)")
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
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
