import Foundation

public struct CodingHarnessRequest: Equatable, Sendable {
    public var prompt: String
    public var repositoryURL: URL
    public var model: LLMModelConfig
    public var testCommand: String?
    public var maxContextTokens: Int
    public var maxIterations: Int
    public var allowInternetResearch: Bool
    public var enableSymbolIndex: Bool
    public var enableSemanticIndex: Bool
    public var enableMultiPassRetrieval: Bool
    public var embeddingModelName: String?

    public init(
        prompt: String,
        repositoryURL: URL,
        model: LLMModelConfig,
        testCommand: String? = nil,
        maxContextTokens: Int = 180_000,
        maxIterations: Int = 2,
        allowInternetResearch: Bool = true,
        enableSymbolIndex: Bool = true,
        enableSemanticIndex: Bool = true,
        enableMultiPassRetrieval: Bool = true,
        embeddingModelName: String? = nil
    ) {
        self.prompt = prompt
        self.repositoryURL = repositoryURL
        self.model = model
        self.testCommand = testCommand
        self.maxContextTokens = maxContextTokens
        self.maxIterations = max(1, maxIterations)
        self.allowInternetResearch = allowInternetResearch
        self.enableSymbolIndex = enableSymbolIndex
        self.enableSemanticIndex = enableSemanticIndex
        self.enableMultiPassRetrieval = enableMultiPassRetrieval
        self.embeddingModelName = embeddingModelName
    }
}

public struct CodingHarnessResult: Equatable, Sendable {
    public var status: AgentRunStatus
    public var summary: String
    public var changedFiles: [String]
    public var logLines: [String]
    public var finalTestOutput: String?

    public init(
        status: AgentRunStatus,
        summary: String,
        changedFiles: [String] = [],
        logLines: [String] = [],
        finalTestOutput: String? = nil
    ) {
        self.status = status
        self.summary = summary
        self.changedFiles = changedFiles
        self.logLines = logLines
        self.finalTestOutput = finalTestOutput
    }
}

public struct RepositoryContext: Equatable, Sendable {
    public var rootPath: String
    public var selectedFiles: [String]
    public var estimatedTokens: Int
    public var text: String
    public var retrievalNotes: [String]
    public var candidateOverview: String
}

public enum CodingHarnessEngine {
    public static func run(_ request: CodingHarnessRequest) -> CodingHarnessResult {
        var logs: [String] = []
        let root = request.repositoryURL.standardizedFileURL
        guard FileManager.default.fileExists(atPath: root.path) else {
            return CodingHarnessResult(
                status: .failed,
                summary: "Repository path does not exist.",
                logLines: ["Coding harness: repository path not found: \(root.path)"]
            )
        }

        let directives = CodingHarnessDirectives.parse(request.prompt)
        let effectiveTestCommand = request.testCommand ?? directives.testCommand
        logs.append("Coding harness: indexing \(root.path)")
        let retrievalOptions = RepositoryRetrievalOptions(
            semanticModel: request.enableSemanticIndex ? request.model : nil,
            embeddingModelName: request.embeddingModelName,
            forcedPaths: [],
            extraSearchTerms: [],
            includeSymbols: request.enableSymbolIndex
        )
        var context = RepositoryIndexer.context(
            rootURL: root,
            query: request.prompt,
            maxContextTokens: request.maxContextTokens,
            options: retrievalOptions
        )
        logs.append(contentsOf: context.retrievalNotes.map { "Coding harness retrieval: \($0)" })
        logs.append("Coding harness: selected \(context.selectedFiles.count) files, estimated \(context.estimatedTokens) tokens")

        let research = request.allowInternetResearch
            ? InternetResearcher.research(for: request.prompt, explicitURLs: directives.urls)
            : []
        if !research.isEmpty {
            logs.append("Coding harness: attached \(research.count) internet research snippets")
        }

        if request.enableMultiPassRetrieval {
            let suggestion = ContextRetrievalPlanner.suggest(
                model: request.model,
                task: request.prompt,
                context: context,
                previousFailure: nil
            )
            if !suggestion.paths.isEmpty || !suggestion.searchTerms.isEmpty {
                logs.append(
                    "Coding harness retrieval: planner requested paths=\(suggestion.paths.joined(separator: ", ")) terms=\(suggestion.searchTerms.joined(separator: ", "))"
                )
                context = RepositoryIndexer.context(
                    rootURL: root,
                    query: request.prompt,
                    maxContextTokens: request.maxContextTokens,
                    options: RepositoryRetrievalOptions(
                        semanticModel: request.enableSemanticIndex ? request.model : nil,
                        embeddingModelName: request.embeddingModelName,
                        forcedPaths: suggestion.paths,
                        extraSearchTerms: suggestion.searchTerms,
                        includeSymbols: request.enableSymbolIndex
                    )
                )
                logs.append(contentsOf: context.retrievalNotes.map { "Coding harness retrieval: \($0)" })
                logs.append("Coding harness: planner selected \(context.selectedFiles.count) files, estimated \(context.estimatedTokens) tokens")
            }
        }

        var changedFiles: [String] = []
        var lastTestOutput: String?
        var previousFailure: String?
        var lastSummary = "No model summary returned."

        for iteration in 1...request.maxIterations {
            logs.append("Coding harness: model iteration \(iteration)")
            let prompt = CodingHarnessPromptBuilder.prompt(
                userPrompt: request.prompt,
                context: context,
                research: research,
                previousFailure: previousFailure,
                testCommand: effectiveTestCommand
            )

            let modelResponse: String
            do {
                modelResponse = try OpenAICompatibleChatClient.complete(
                    model: request.model,
                    systemPrompt: CodingHarnessPromptBuilder.systemPrompt,
                    userPrompt: prompt
                )
            } catch {
                logs.append("Coding harness: model call failed: \(error.localizedDescription)")
                return CodingHarnessResult(
                    status: .failed,
                    summary: "Model call failed.",
                    changedFiles: changedFiles,
                    logLines: logs,
                    finalTestOutput: lastTestOutput
                )
            }

            let plan: CodingHarnessPlan
            do {
                plan = try CodingHarnessPlanParser.parse(modelResponse)
            } catch {
                logs.append("Coding harness: could not parse model JSON: \(error.localizedDescription)")
                logs.append("Coding harness raw response: \(String(modelResponse.prefix(1200)))")
                return CodingHarnessResult(
                    status: .failed,
                    summary: "Model did not return the required JSON edit plan.",
                    changedFiles: changedFiles,
                    logLines: logs,
                    finalTestOutput: lastTestOutput
                )
            }

            lastSummary = plan.summary.isEmpty ? lastSummary : plan.summary
            let applied = FileEditApplier.apply(plan.fileEdits, rootURL: root)
            logs.append(contentsOf: applied.logLines)
            changedFiles.append(contentsOf: applied.changedFiles)
            changedFiles = Array(Set(changedFiles)).sorted()

            if let error = applied.errorMessage {
                return CodingHarnessResult(
                    status: .failed,
                    summary: error,
                    changedFiles: changedFiles,
                    logLines: logs,
                    finalTestOutput: lastTestOutput
                )
            }

            guard let command = plan.testCommand ?? effectiveTestCommand,
                  !command.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            else {
                return CodingHarnessResult(
                    status: .succeeded,
                    summary: lastSummary,
                    changedFiles: changedFiles,
                    logLines: logs,
                    finalTestOutput: lastTestOutput
                )
            }

            let test = ShellCommandRunner.run(command, cwd: root)
            lastTestOutput = test.output
            logs.append("Coding harness: test command exited \(test.exitCode): \(command)")
            if !test.output.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                logs.append("Coding harness test output: \(String(test.output.prefix(1600)))")
            }
            if test.exitCode == 0 {
                return CodingHarnessResult(
                    status: .succeeded,
                    summary: lastSummary,
                    changedFiles: changedFiles,
                    logLines: logs,
                    finalTestOutput: lastTestOutput
                )
            }

            previousFailure = """
            The previous edit failed validation.
            Command: \(command)
            Exit code: \(test.exitCode)
            Output:
            \(String(test.output.prefix(6000)))
            """
            context = RepositoryIndexer.context(
                rootURL: root,
                query: request.prompt + "\n" + (previousFailure ?? ""),
                maxContextTokens: request.maxContextTokens,
                options: RepositoryRetrievalOptions(
                    semanticModel: request.enableSemanticIndex ? request.model : nil,
                    embeddingModelName: request.embeddingModelName,
                    forcedPaths: plan.fileEdits.map(\.path),
                    extraSearchTerms: [],
                    includeSymbols: request.enableSymbolIndex
                )
            )
            logs.append(contentsOf: context.retrievalNotes.map { "Coding harness retrieval: \($0)" })
        }

        return CodingHarnessResult(
            status: .failed,
            summary: "Validation did not pass after \(request.maxIterations) iteration(s). \(lastSummary)",
            changedFiles: changedFiles,
            logLines: logs,
            finalTestOutput: lastTestOutput
        )
    }
}
