import MacAgentFlowCore
import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        VStack(spacing: 0) {
            AppTopBar()
            Divider()
            HStack(spacing: 0) {
                AgentSidebarView()
                    .frame(width: 250)
                Divider()
                AgentDesignerView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                Divider()
                InspectorView()
                    .frame(width: 340)
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
                    Text("Agent operations console")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Divider()
                .frame(height: 28)

            if let agent = store.selectedAgent {
                VStack(alignment: .leading, spacing: 2) {
                    TextField("Agent name", text: Binding(
                        get: { agent.name },
                        set: { store.renameSelectedAgent($0) }
                    ))
                    .textFieldStyle(.plain)
                    .font(.subheadline.weight(.semibold))
                    Text(agent.summary)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .frame(maxWidth: 430, alignment: .leading)
            }

            Spacer()

            HStack(spacing: 8) {
                Button {
                    store.copySelection()
                } label: {
                    Image(systemName: "doc.on.doc")
                }
                .disabled(!store.canCopySelection)
                .help("Copy selected node (Command-C)")

                Button {
                    store.pasteSelection()
                } label: {
                    Image(systemName: "doc.on.clipboard")
                }
                .disabled(!store.canPasteSelection)
                .help("Paste copied node (Command-V)")

                Button(role: .destructive) {
                    store.deleteSelection()
                } label: {
                    Image(systemName: "trash")
                }
                .disabled(!store.canDeleteSelection)
                .help("Delete selected node or connector")
            }
            .buttonStyle(.bordered)

            Button {
                store.inspectorSection = .models
            } label: {
                Label("Models", systemImage: "brain.head.profile")
            }
            .help("Manage LLM model configs")

            Menu {
                Button("AI Node") { store.addNode(kind: .ai) }
                Button("Python Node") { store.addNode(kind: .code) }
                Button("Tool Node") { store.addNode(kind: .tool) }
                Button("Conditional") { store.addNode(kind: .condition) }
            } label: {
                Label("Node", systemImage: "plus")
            }

            Button {
                store.triggerRun()
            } label: {
                Label("Run", systemImage: "play.fill")
            }
            .keyboardShortcut("r", modifiers: [.command])

            Button {
                store.addSchedule()
            } label: {
                Label("Schedule", systemImage: "calendar.badge.clock")
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 10)
        .background(.bar)
    }
}

struct AgentSidebarView: View {
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
                    Image(systemName: "plus")
                }
                .buttonStyle(.borderless)
                .help("Create agent")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color(nsColor: .controlBackgroundColor))

            List(selection: Binding(get: {
                store.workspace.selectedAgentID
            }, set: { newValue in
                if let newValue {
                    store.selectAgent(newValue)
                }
            })) {
                ForEach(store.workspace.agents) { agent in
                    AgentRow(agent: agent)
                        .tag(agent.id)
                }
            }
            .listStyle(.sidebar)

            Divider()

            VStack(alignment: .leading, spacing: 8) {
                Label("Run Center", systemImage: "clock.arrow.circlepath")
                    .font(.subheadline.weight(.semibold))
                Text("Agents can be edited, triggered manually, or scheduled with cron-style rules.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(14)
            .background(Color(nsColor: .controlBackgroundColor))
        }
        .background(Color(nsColor: .controlBackgroundColor))
    }
}

struct AgentRow: View {
    let agent: AgentDefinition

    var lastRun: AgentRun? {
        agent.runs.sorted { $0.number > $1.number }.first
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 8) {
                Image(systemName: "point.3.connected.trianglepath.dotted")
                    .foregroundStyle(.secondary)
                Text(agent.name)
                    .lineLimit(1)
            }
            HStack(spacing: 8) {
                Text("\(agent.nodes.count) nodes")
                Text("\(agent.schedules.filter(\.isEnabled).count) schedules")
                if let lastRun {
                    Text("#\(lastRun.number) \(lastRun.status.rawValue)")
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
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
