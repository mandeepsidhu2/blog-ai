import AppKit
import MacAgentFlowCore
import SwiftUI

struct ToolsManagementPage: View {
    @EnvironmentObject private var store: WorkspaceStore
    @State private var draft: ToolDefinition?
    @State private var validation: PythonValidationResult?
    @State private var isCodeFocused = false

    var body: some View {
        ToolDetailPane(
            draft: $draft,
            validation: $validation,
            isCodeFocused: $isCodeFocused
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear(perform: syncDraft)
        .onChange(of: store.selectedToolID) { _, _ in syncDraft() }
        .onChange(of: store.workspace.toolCatalog) { _, _ in syncDraftIfNeeded() }
    }

    private func syncDraft() {
        draft = store.selectedTool
        validation = nil
    }

    private func syncDraftIfNeeded() {
        guard let draft else {
            self.draft = store.selectedTool
            return
        }
        if !store.workspace.toolCatalog.contains(where: { $0.id == draft.id }) {
            self.draft = store.selectedTool
            validation = nil
        }
    }
}

struct ToolLibrarySidebar: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Tools")
                        .font(.title3.weight(.semibold))
                    Text("Workspace Python tools")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button {
                    store.addTool()
                } label: {
                    Label("Add", systemImage: "plus")
                }
            }
            .padding(16)

            Divider()

            ScrollView {
                LazyVStack(spacing: 6) {
                    ForEach(store.workspace.toolCatalog) { tool in
                        Button {
                            store.selectedToolID = tool.id
                        } label: {
                            ToolLibraryRow(tool: tool, isSelected: store.selectedToolID == tool.id)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(10)
            }
        }
        .background(Color(nsColor: .controlBackgroundColor))
    }
}

struct ToolLibraryRow: View {
    let tool: ToolDefinition
    let isSelected: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 7) {
                Image(systemName: tool.isMutating ? "exclamationmark.triangle.fill" : "checkmark.shield.fill")
                    .foregroundStyle(tool.isMutating ? Color.orange : Color.green)
                Text(tool.name)
                    .font(.subheadline.weight(isSelected ? .semibold : .regular))
                    .lineLimit(1)
            }
            Text("\(tool.category) · \(tool.summary)")
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .padding(10)
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

struct ToolDetailPane: View {
    @EnvironmentObject private var store: WorkspaceStore
    @Binding var draft: ToolDefinition?
    @Binding var validation: PythonValidationResult?
    @Binding var isCodeFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                PageTitle(
                    title: draft?.name ?? "No Tool Selected",
                    subtitle: "Edit reusable Python tool code and metadata.",
                    systemImage: "wrench.and.screwdriver"
                )
                Spacer()
                Button(isCodeFocused ? "Show Details" : "Focus Code") {
                    isCodeFocused.toggle()
                }
                .disabled(draft == nil)
                Button {
                    store.addTool()
                } label: {
                    Label("Add Tool", systemImage: "plus")
                }
                Button(role: .destructive) {
                    guard let id = draft?.id else { return }
                    store.deleteTool(id)
                    draft = store.selectedTool
                    validation = nil
                } label: {
                    Label("Delete", systemImage: "trash")
                }
                .disabled(draft == nil)
            }

            if draft == nil {
                ContentUnavailableView("No Tool Selected", systemImage: "wrench.and.screwdriver")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                if !isCodeFocused {
                    ToolMetadataFields(draft: $draft)
                }

                HStack {
                    Text("Python tool code")
                        .font(.headline)
                    Spacer()
                    Button("Paste Code") {
                        if let value = NSPasteboard.general.string(forType: .string), !value.isEmpty {
                            draft?.pythonCode = value
                            validation = nil
                        }
                    }
                    Button("Check Code") {
                        validation = PythonToolValidator.validate(draft?.pythonCode ?? "")
                    }
                    Button("Save") {
                        guard let draft else { return }
                        validation = store.saveTool(draft)
                    }
                    .keyboardShortcut(.return, modifiers: [.command])
                }

                PythonCodeEditor(text: Binding(
                    get: { draft?.pythonCode ?? "" },
                    set: {
                        draft?.pythonCode = $0
                        validation = nil
                    }
                ), isEditable: true)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.18)))

                if let validation {
                    Label(validation.message, systemImage: validation.isValid ? "checkmark.circle.fill" : "xmark.octagon")
                        .font(.caption)
                        .foregroundStyle(validation.isValid ? .green : .red)
                } else {
                    Text("Tool code must define `run(state, **kwargs)`. Save validates syntax without executing the code.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(18)
    }
}

struct ToolMetadataFields: View {
    @Binding var draft: ToolDefinition?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                TextField("Tool name", text: Binding(
                    get: { draft?.name ?? "" },
                    set: { draft?.name = $0 }
                ))
                TextField("Category", text: Binding(
                    get: { draft?.category ?? "" },
                    set: { draft?.category = $0 }
                ))
                Toggle("Requires approval", isOn: Binding(
                    get: { draft?.isMutating ?? false },
                    set: { draft?.isMutating = $0 }
                ))
                .toggleStyle(.checkbox)
            }
            TextField("Summary", text: Binding(
                get: { draft?.summary ?? "" },
                set: { draft?.summary = $0 }
            ))
        }
        .padding(12)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
    }
}

struct ModelsManagementPage: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        ModelDetailPane()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear {
            if store.selectedModelConfig == nil {
                store.selectedModelConfigID = store.workspace.llmModels.first?.id
            }
            if store.selectedEmbeddingModelConfig == nil {
                store.selectedEmbeddingModelConfigID = store.workspace.activeEmbeddingModelID ?? store.workspace.embeddingModels.first?.id
            }
        }
    }
}

struct ModelLibrarySidebar: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Models")
                        .font(.title3.weight(.semibold))
                    Text("Chat and embedding profiles")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Menu {
                    Button("Chat model") {
                        store.addLLMModel()
                    }
                    Button("Embedding model") {
                        store.addEmbeddingModel()
                    }
                } label: {
                    Label("Add", systemImage: "plus")
                }
            }
            .padding(16)

            Divider()

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    Text("Chat models")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6)
                    ForEach(store.workspace.llmModels) { model in
                        Button {
                            store.selectedModelConfigKind = .chat
                            store.selectedModelConfigID = model.id
                        } label: {
                            ModelLibraryRow(
                                model: model,
                                isSelected: store.selectedModelConfigKind == .chat && store.selectedModelConfigID == model.id
                            )
                        }
                        .buttonStyle(.plain)
                    }

                    Divider()
                        .padding(.vertical, 4)

                    HStack {
                        Text("Embedding models")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Spacer()
                        if store.workspace.activeEmbeddingModelID != nil {
                            Button("Disable") {
                                store.setActiveEmbeddingModel(nil)
                            }
                            .font(.caption)
                            .buttonStyle(.borderless)
                            .help("Do not use embeddings for repository retrieval")
                        }
                    }
                    .padding(.horizontal, 6)

                    Text("Optional and shared across all agents. Enables semantic retrieval for coding nodes; if none is enabled, embeddings are not used.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 6)

                    if store.workspace.embeddingModels.isEmpty {
                        Button {
                            store.addEmbeddingModel()
                        } label: {
                            Label("Add embedding model", systemImage: "plus.circle")
                                .font(.caption)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(10)
                        }
                        .buttonStyle(.plain)
                    } else {
                        ForEach(store.workspace.embeddingModels) { model in
                            Button {
                                store.selectedModelConfigKind = .embedding
                                store.selectedEmbeddingModelConfigID = model.id
                            } label: {
                                EmbeddingModelLibraryRow(
                                    model: model,
                                    isSelected: store.selectedModelConfigKind == .embedding && store.selectedEmbeddingModelConfigID == model.id,
                                    isActive: store.workspace.activeEmbeddingModelID == model.id
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(10)
            }
        }
        .background(Color(nsColor: .controlBackgroundColor))
    }
}

struct ModelLibraryRow: View {
    let model: LLMModelConfig
    let isSelected: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 7) {
                Image(systemName: "brain.head.profile")
                    .foregroundStyle(Color.accentColor)
                Text(model.displayName)
                    .font(.subheadline.weight(isSelected ? .semibold : .regular))
                    .lineLimit(1)
            }
            Text(model.details)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .padding(10)
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

struct EmbeddingModelLibraryRow: View {
    let model: EmbeddingModelConfig
    let isSelected: Bool
    let isActive: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 7) {
                Image(systemName: "text.magnifyingglass")
                    .foregroundStyle(isActive ? Color.green : Color.accentColor)
                Text(model.displayName)
                    .font(.subheadline.weight(isSelected ? .semibold : .regular))
                    .lineLimit(1)
                if isActive {
                    Text("Active")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.green)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.green.opacity(0.12), in: Capsule())
                }
            }
            Text(model.details.isEmpty ? "Embedding endpoint not configured" : model.details)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .padding(10)
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

struct ModelDetailPane: View {
    @EnvironmentObject private var store: WorkspaceStore

    var body: some View {
        switch store.selectedModelConfigKind {
        case .chat:
            ChatModelDetailPane()
        case .embedding:
            EmbeddingModelDetailPane()
        }
    }
}

struct ChatModelDetailPane: View {
    @EnvironmentObject private var store: WorkspaceStore
    @State private var isTestingModel = false
    @State private var modelTestResult: LLMModelTestResult?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                PageTitle(
                    title: store.selectedModelConfig?.displayName ?? "No Model Selected",
                    subtitle: "Edit model backend, endpoint, and credential details.",
                    systemImage: "brain.head.profile"
                )
                Spacer()
                Button {
                    testSelectedModel()
                } label: {
                    Label(isTestingModel ? "Testing" : "Test", systemImage: isTestingModel ? "hourglass" : "checkmark.circle")
                }
                .disabled(store.selectedModelConfig == nil || isTestingModel)
                Button {
                    store.addLLMModel()
                } label: {
                    Label("Add Model", systemImage: "plus")
                }
                Button(role: .destructive) {
                    guard let id = store.selectedModelConfig?.id else { return }
                    store.deleteLLMModel(id)
                } label: {
                    Label("Delete", systemImage: "trash")
                }
                .disabled(store.workspace.llmModels.count <= 1 || store.selectedModelConfig == nil)
            }

            if let model = store.selectedModelConfig {
                VStack(alignment: .leading, spacing: 12) {
                    TextField("Nickname", text: Binding(
                        get: { model.nickname },
                        set: { value in store.updateLLMModel(model.id) { $0.nickname = value } }
                    ))
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
                    Text("Agents reference this profile by nickname. Saved API keys are never emitted into generated source.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(14)
                .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))

                if let modelTestResult {
                    Label(modelTestResult.message, systemImage: modelTestResult.isConnected ? "checkmark.circle.fill" : "xmark.octagon")
                        .font(.caption)
                        .foregroundStyle(modelTestResult.isConnected ? .green : .red)
                        .fixedSize(horizontal: false, vertical: true)
                }

                AgentModelUsage(modelID: model.id)
            } else {
                ContentUnavailableView("No Model Selected", systemImage: "brain.head.profile")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }

            Spacer()
        }
        .padding(18)
        .onChange(of: store.selectedModelConfigID) { _, _ in
            modelTestResult = nil
            isTestingModel = false
        }
    }

    private func testSelectedModel() {
        guard let model = store.selectedModelConfig else { return }
        isTestingModel = true
        modelTestResult = nil
        Task {
            let result = await Task.detached(priority: .utility) {
                LLMModelConnectionTester.test(model)
            }.value
            await MainActor.run {
                if store.selectedModelConfig?.id == model.id {
                    modelTestResult = result
                }
                isTestingModel = false
            }
        }
    }
}

struct AgentModelUsage: View {
    @EnvironmentObject private var store: WorkspaceStore
    let modelID: UUID

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Used by agents")
                .font(.headline)
            let agents = store.workspace.agents.filter { $0.llmModelConfigID == modelID }
            if agents.isEmpty {
                Text("No agents currently use this model.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(agents) { agent in
                    Label(agent.name, systemImage: "point.3.connected.trianglepath.dotted")
                        .font(.subheadline)
                }
            }
        }
        .padding(14)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
    }
}

struct EmbeddingModelDetailPane: View {
    @EnvironmentObject private var store: WorkspaceStore
    @State private var isTestingModel = false
    @State private var modelTestResult: LLMModelTestResult?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                PageTitle(
                    title: store.selectedEmbeddingModelConfig?.displayName ?? "No Embedding Model Selected",
                    subtitle: "Optional workspace-wide semantic retrieval for coding nodes.",
                    systemImage: "text.magnifyingglass"
                )
                Spacer()
                Button {
                    testSelectedModel()
                } label: {
                    Label(isTestingModel ? "Testing" : "Test", systemImage: isTestingModel ? "hourglass" : "checkmark.circle")
                }
                .disabled(store.selectedEmbeddingModelConfig == nil || isTestingModel)
                Button {
                    store.addEmbeddingModel()
                } label: {
                    Label("Add Embedding", systemImage: "plus")
                }
                Button(role: .destructive) {
                    guard let id = store.selectedEmbeddingModelConfig?.id else { return }
                    store.deleteEmbeddingModel(id)
                } label: {
                    Label("Delete", systemImage: "trash")
                }
                .disabled(store.selectedEmbeddingModelConfig == nil)
            }

            Text("Embedding models are shared across all agents. They can improve coding-harness repository retrieval by semantically ranking candidate files. If no embedding model is enabled, the app does not call embeddings and falls back to lexical and symbol retrieval.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            if let model = store.selectedEmbeddingModelConfig {
                VStack(alignment: .leading, spacing: 12) {
                    TextField("Nickname", text: Binding(
                        get: { model.nickname },
                        set: { value in store.updateEmbeddingModel(model.id) { $0.nickname = value } }
                    ))
                    Picker("Backend", selection: Binding(
                        get: { model.backend },
                        set: { backend in
                            store.updateEmbeddingModel(model.id) {
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
                        set: { value in store.updateEmbeddingModel(model.id) { $0.baseURL = value } }
                    ))
                    TextField("Embedding model name", text: Binding(
                        get: { model.modelName },
                        set: { value in store.updateEmbeddingModel(model.id) { $0.modelName = value } }
                    ))
                    SecureField("API key", text: Binding(
                        get: { model.apiKey },
                        set: { value in store.updateEmbeddingModel(model.id) { $0.apiKey = value } }
                    ))

                    HStack {
                        if store.workspace.activeEmbeddingModelID == model.id {
                            Label("Enabled for all agents", systemImage: "checkmark.circle.fill")
                                .foregroundStyle(.green)
                            Button("Disable embeddings") {
                                store.setActiveEmbeddingModel(nil)
                            }
                        } else {
                            Text("Not currently used.")
                                .foregroundStyle(.secondary)
                            Button("Use for retrieval") {
                                store.setActiveEmbeddingModel(model.id)
                            }
                        }
                    }
                    .font(.caption)
                }
                .padding(14)
                .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))

                if let modelTestResult {
                    Label(modelTestResult.message, systemImage: modelTestResult.isConnected ? "checkmark.circle.fill" : "xmark.octagon")
                        .font(.caption)
                        .foregroundStyle(modelTestResult.isConnected ? .green : .red)
                        .fixedSize(horizontal: false, vertical: true)
                }
            } else {
                ContentUnavailableView("No Embedding Model", systemImage: "text.magnifyingglass", description: Text("Add an embedding model only when you want semantic retrieval for coding nodes. Otherwise the app will not use embeddings."))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }

            Spacer()
        }
        .padding(18)
        .onChange(of: store.selectedEmbeddingModelConfigID) { _, _ in
            modelTestResult = nil
            isTestingModel = false
        }
    }

    private func testSelectedModel() {
        guard let model = store.selectedEmbeddingModelConfig else { return }
        isTestingModel = true
        modelTestResult = nil
        Task {
            let result = await Task.detached(priority: .utility) {
                EmbeddingModelConnectionTester.test(model)
            }.value
            await MainActor.run {
                if store.selectedEmbeddingModelConfig?.id == model.id {
                    modelTestResult = result
                }
                isTestingModel = false
            }
        }
    }
}

struct PageTitle: View {
    let title: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Color.accentColor)
                .frame(width: 32, height: 32)
                .background(Color.accentColor.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.title3.weight(.semibold))
                    .lineLimit(1)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
