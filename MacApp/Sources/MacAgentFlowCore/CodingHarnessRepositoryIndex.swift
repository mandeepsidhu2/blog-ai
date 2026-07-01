import Foundation

public struct RepositoryRetrievalOptions: Equatable, Sendable {
    public var semanticModel: LLMModelConfig?
    public var embeddingModelName: String?
    public var forcedPaths: [String]
    public var extraSearchTerms: [String]
    public var includeSymbols: Bool

    public init(
        semanticModel: LLMModelConfig? = nil,
        embeddingModelName: String? = nil,
        forcedPaths: [String] = [],
        extraSearchTerms: [String] = [],
        includeSymbols: Bool = true
    ) {
        self.semanticModel = semanticModel
        self.embeddingModelName = embeddingModelName
        self.forcedPaths = forcedPaths
        self.extraSearchTerms = extraSearchTerms
        self.includeSymbols = includeSymbols
    }
}

public struct RepositorySymbol: Equatable, Sendable {
    public var name: String
    public var kind: String
    public var path: String
    public var line: Int
}

public enum RepositoryIndexer {
    private struct IndexedFile {
        var path: String
        var text: String
        var byteCount: Int
        var symbols: [RepositorySymbol]
        var score: Int
    }

    public static func context(
        rootURL: URL,
        query: String,
        maxContextTokens: Int,
        options: RepositoryRetrievalOptions = RepositoryRetrievalOptions()
    ) -> RepositoryContext {
        let root = rootURL.standardizedFileURL
        let terms = queryTerms(query + "\n" + options.extraSearchTerms.joined(separator: " "))
        let forcedPathSet = Set(options.forcedPaths.map(normalizeRelativePath))
        let maxContextCharacters = max(8_000, maxContextTokens * 4)
        var files: [IndexedFile] = []
        var notes: [String] = []

        guard let enumerator = FileManager.default.enumerator(
            at: root,
            includingPropertiesForKeys: [.isDirectoryKey, .fileSizeKey],
            options: [.skipsHiddenFiles]
        ) else {
            return RepositoryContext(
                rootPath: root.path,
                selectedFiles: [],
                estimatedTokens: 0,
                text: "",
                retrievalNotes: ["repository enumerator was unavailable"],
                candidateOverview: ""
            )
        }

        for case let fileURL as URL in enumerator {
            let normalizedFileURL = fileURL.standardizedFileURL
            let relative = relativePath(normalizedFileURL, root: root)
            if shouldSkip(relativePath: relative) {
                if isLikelyDirectory(normalizedFileURL) {
                    enumerator.skipDescendants()
                }
                continue
            }
            guard isTextCandidate(relative) else { continue }
            let byteCount = (try? normalizedFileURL.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            guard byteCount > 0, byteCount <= 400_000 else { continue }
            guard let text = try? String(contentsOf: normalizedFileURL, encoding: .utf8) else { continue }
            let symbols = options.includeSymbols ? SymbolExtractor.extract(path: relative, text: text) : []
            let score = scoreFile(
                path: relative,
                text: text,
                symbols: symbols,
                terms: terms,
                isForced: forcedPathSet.contains(normalizeRelativePath(relative))
            )
            files.append(IndexedFile(path: relative, text: text, byteCount: byteCount, symbols: symbols, score: score))
        }

        if let semanticModel = options.semanticModel {
            let semantic = SemanticFileRanker.score(
                files: files.map { SemanticFileCandidate(path: $0.path, text: $0.text, symbols: $0.symbols, lexicalScore: $0.score) },
                query: query,
                model: semanticModel,
                embeddingModelName: options.embeddingModelName
            )
            if !semantic.scores.isEmpty {
                notes.append("semantic rerank used \(semantic.embeddingModelName ?? "local embedding model") on \(semantic.scores.count) candidates")
                files = files.map { file in
                    var file = file
                    if let semanticScore = semantic.scores[file.path] {
                        file.score += semanticScore
                    }
                    return file
                }
            } else if let note = semantic.note {
                notes.append(note)
            }
        } else {
            notes.append("semantic rerank skipped")
        }

        files.sort {
            if $0.score == $1.score { return $0.path < $1.path }
            return $0.score > $1.score
        }

        let relevantSymbols = files.flatMap(\.symbols).filter { symbol in
            terms.contains { term in
                symbol.name.lowercased().contains(term) || symbol.path.lowercased().contains(term)
            }
        }
        let symbolSummary = symbolSummary(from: relevantSymbols.isEmpty ? Array(files.flatMap(\.symbols).prefix(80)) : relevantSymbols)
        let candidateOverview = candidateOverview(files: files, symbols: symbolSummary)

        var selected: [String] = []
        var renderedSections: [String] = []
        var usedCharacters = 0
        if !symbolSummary.isEmpty, options.includeSymbols {
            let section = """
            ### Repository Symbol Index
            \(symbolSummary)
            """
            renderedSections.append(section)
            usedCharacters += section.count
        }

        for file in files where file.score > 0 {
            if usedCharacters >= maxContextCharacters { break }
            let remaining = maxContextCharacters - usedCharacters
            let excerpt = excerpt(for: file.text, terms: terms, maxCharacters: min(remaining, maxFileCharacters(for: file)))
            guard !excerpt.isEmpty else { continue }
            let section = """
            ### File: \(file.path)
            ```\(languageHint(for: file.path))
            \(excerpt)
            ```
            """
            renderedSections.append(section)
            selected.append(file.path)
            usedCharacters += section.count
        }

        let text = renderedSections.joined(separator: "\n\n")
        return RepositoryContext(
            rootPath: root.path,
            selectedFiles: selected,
            estimatedTokens: estimateTokens(text),
            text: text,
            retrievalNotes: notes,
            candidateOverview: candidateOverview
        )
    }

    private static func scoreFile(
        path: String,
        text: String,
        symbols: [RepositorySymbol],
        terms: [String],
        isForced: Bool
    ) -> Int {
        let lowerPath = path.lowercased()
        let lowerText = text.lowercased()
        var score = isForced ? 10_000 : 0
        if lowerPath == "agents.md" { score += 2_500 }
        if lowerPath.hasSuffix("/agents.md") { score += 1_500 }
        if lowerPath == "readme.md" || lowerPath.hasSuffix("/readme.md") { score += 1_200 }
        if lowerPath == "package.swift" || lowerPath == "package.json" || lowerPath == "pyproject.toml" { score += 1_200 }
        if lowerPath == "docs/index.md" || lowerPath.hasSuffix("/docs/index.md") { score += 900 }
        if lowerPath.contains("test") { score += 300 }
        if isSourcePath(lowerPath) { score += 200 }

        for term in terms {
            if lowerPath.contains(term) { score += 1_400 }
            if lowerText.contains(term) {
                score += min(700, lowerText.components(separatedBy: term).count * 35)
            }
            for symbol in symbols {
                if symbol.name.lowercased().contains(term) {
                    score += 1_000
                }
            }
        }
        return score
    }

    private static func queryTerms(_ query: String) -> [String] {
        let stop = Set([
            "the", "and", "for", "with", "that", "this", "from", "into", "have", "code",
            "node", "make", "edit", "update", "change", "should", "able", "repo"
        ])
        let parts = query.lowercased().split { !$0.isLetter && !$0.isNumber }.map(String.init)
        return Array(Set(parts.filter { $0.count >= 3 && !stop.contains($0) })).sorted()
    }

    private static func excerpt(for text: String, terms: [String], maxCharacters: Int) -> String {
        guard maxCharacters > 0 else { return "" }
        if text.count <= maxCharacters { return text }
        let lower = text.lowercased()
        if let term = terms.first(where: { lower.contains($0) }),
           let range = lower.range(of: term) {
            let center = lower.distance(from: lower.startIndex, to: range.lowerBound)
            let startOffset = max(0, center - maxCharacters / 2)
            let start = text.index(text.startIndex, offsetBy: startOffset)
            let end = text.index(start, offsetBy: min(maxCharacters, text.distance(from: start, to: text.endIndex)))
            return "[...snip...]\n" + String(text[start..<end]) + "\n[...snip...]"
        }
        let end = text.index(text.startIndex, offsetBy: min(maxCharacters, text.count))
        return String(text[..<end]) + "\n[...snip...]"
    }

    private static func maxFileCharacters(for file: IndexedFile) -> Int {
        if file.path.lowercased().hasSuffix("agents.md") { return 20_000 }
        if file.path.lowercased().hasPrefix("docs/") { return 16_000 }
        return 32_000
    }

    private static func shouldSkip(relativePath: String) -> Bool {
        let parts = relativePath.split(separator: "/").map(String.init)
        let ignored = Set([
            ".git", ".build", "build", "dist", "node_modules", ".venv", "venv",
            "__pycache__", ".pytest_cache", ".mypy_cache", "DerivedData", ".swiftpm"
        ])
        return parts.contains { ignored.contains($0) }
    }

    private static func isTextCandidate(_ path: String) -> Bool {
        let lower = path.lowercased()
        let allowedExtensions = [
            ".swift", ".py", ".js", ".ts", ".tsx", ".jsx", ".json", ".md", ".toml",
            ".yaml", ".yml", ".sh", ".html", ".css", ".sql", ".txt", ".xml"
        ]
        let allowedNames = ["makefile", "dockerfile", "package.swift", "package.resolved"]
        return allowedExtensions.contains(where: lower.hasSuffix) || allowedNames.contains((lower as NSString).lastPathComponent)
    }

    private static func isSourcePath(_ lowerPath: String) -> Bool {
        lowerPath.hasSuffix(".swift") || lowerPath.hasSuffix(".py") || lowerPath.hasSuffix(".js") ||
            lowerPath.hasSuffix(".ts") || lowerPath.hasSuffix(".tsx") || lowerPath.hasSuffix(".jsx")
    }

    private static func languageHint(for path: String) -> String {
        let lower = path.lowercased()
        if lower.hasSuffix(".swift") { return "swift" }
        if lower.hasSuffix(".py") { return "python" }
        if lower.hasSuffix(".js") { return "javascript" }
        if lower.hasSuffix(".ts") { return "typescript" }
        if lower.hasSuffix(".json") { return "json" }
        if lower.hasSuffix(".md") { return "markdown" }
        return ""
    }

    private static func estimateTokens(_ text: String) -> Int {
        max(1, text.count / 4)
    }

    private static func relativePath(_ fileURL: URL, root: URL) -> String {
        let rootPath = root.path.hasSuffix("/") ? root.path : root.path + "/"
        if fileURL.path.hasPrefix(rootPath) {
            return String(fileURL.path.dropFirst(rootPath.count))
        }
        return fileURL.lastPathComponent
    }

    private static func isLikelyDirectory(_ url: URL) -> Bool {
        ((try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) ?? false) == true
    }

    private static func normalizeRelativePath(_ path: String) -> String {
        path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }

    private static func symbolSummary(from symbols: [RepositorySymbol]) -> String {
        symbols
            .prefix(120)
            .map { "- \($0.path):\($0.line) \($0.kind) \($0.name)" }
            .joined(separator: "\n")
    }

    private static func candidateOverview(files: [IndexedFile], symbols: String) -> String {
        let paths = files.prefix(180).map { file in
            let symbolNames = file.symbols.prefix(8).map(\.name).joined(separator: ", ")
            if symbolNames.isEmpty {
                return "- \(file.path) score=\(file.score)"
            }
            return "- \(file.path) score=\(file.score) symbols=[\(symbolNames)]"
        }.joined(separator: "\n")
        if symbols.isEmpty { return paths }
        return """
        Candidate files:
        \(paths)

        Symbol highlights:
        \(symbols)
        """
    }
}

private enum SymbolExtractor {
    static func extract(path: String, text: String) -> [RepositorySymbol] {
        let lower = path.lowercased()
        if lower.hasSuffix(".py") {
            return extractPython(path: path, text: text)
        }
        if lower.hasSuffix(".swift") {
            return extractSwift(path: path, text: text)
        }
        if lower.hasSuffix(".js") || lower.hasSuffix(".jsx") || lower.hasSuffix(".ts") || lower.hasSuffix(".tsx") {
            return extractJavaScript(path: path, text: text)
        }
        return []
    }

    private static func extractPython(path: String, text: String) -> [RepositorySymbol] {
        symbols(
            path: path,
            text: text,
            patterns: [
                #"^\s*(?:async\s+def|def)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\("#: "function",
                #"^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)\s*[\(:]"#: "class"
            ]
        )
    }

    private static func extractSwift(path: String, text: String) -> [RepositorySymbol] {
        symbols(
            path: path,
            text: text,
            patterns: [
                #"^\s*(?:(?:public|private|internal|open|final|static|mutating|nonmutating)\s+)*(?:func)\s+([A-Za-z_][A-Za-z0-9_]*)\b"#: "function",
                #"^\s*(?:(?:public|private|internal|open|final)\s+)*(?:struct)\s+([A-Za-z_][A-Za-z0-9_]*)\b"#: "struct",
                #"^\s*(?:(?:public|private|internal|open|final)\s+)*(?:class)\s+([A-Za-z_][A-Za-z0-9_]*)\b"#: "class",
                #"^\s*(?:(?:public|private|internal|open)\s+)*(?:enum)\s+([A-Za-z_][A-Za-z0-9_]*)\b"#: "enum",
                #"^\s*(?:(?:public|private|internal|open)\s+)*(?:protocol)\s+([A-Za-z_][A-Za-z0-9_]*)\b"#: "protocol",
                #"^\s*(?:(?:public|private|internal|open)\s+)*(?:actor)\s+([A-Za-z_][A-Za-z0-9_]*)\b"#: "actor"
            ]
        )
    }

    private static func extractJavaScript(path: String, text: String) -> [RepositorySymbol] {
        symbols(
            path: path,
            text: text,
            patterns: [
                #"^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\("#: "function",
                #"^\s*(?:export\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)\b"#: "class",
                #"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\("#: "function",
                #"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*"#: "value"
            ]
        )
    }

    private static func symbols(path: String, text: String, patterns: [String: String]) -> [RepositorySymbol] {
        let lines = text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        let compiled = patterns.compactMap { pattern, kind -> (NSRegularExpression, String)? in
            guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
            return (regex, kind)
        }
        var result: [RepositorySymbol] = []
        for (index, line) in lines.enumerated() {
            let range = NSRange(line.startIndex..<line.endIndex, in: line)
            for (regex, kind) in compiled {
                guard let match = regex.firstMatch(in: line, range: range),
                      match.numberOfRanges > 1,
                      let nameRange = Range(match.range(at: 1), in: line)
                else { continue }
                result.append(RepositorySymbol(
                    name: String(line[nameRange]),
                    kind: kind,
                    path: path,
                    line: index + 1
                ))
            }
        }
        return result
    }
}

private struct SemanticFileCandidate {
    var path: String
    var text: String
    var symbols: [RepositorySymbol]
    var lexicalScore: Int
}

private enum SemanticFileRanker {
    struct Result {
        var scores: [String: Int]
        var embeddingModelName: String?
        var note: String?
    }

    static func score(
        files: [SemanticFileCandidate],
        query: String,
        model: LLMModelConfig,
        embeddingModelName: String?
    ) -> Result {
        guard isLocalBaseURL(model.baseURL) else {
            return Result(scores: [:], embeddingModelName: nil, note: "semantic rerank skipped for non-local model base URL")
        }
        let candidates = files
            .filter { $0.lexicalScore > 0 }
            .sorted { $0.lexicalScore > $1.lexicalScore }
            .prefix(80)
        guard !candidates.isEmpty else {
            return Result(scores: [:], embeddingModelName: nil, note: "semantic rerank skipped because no lexical candidates were available")
        }
        let client = LocalEmbeddingClient(baseURL: model.baseURL, apiKey: model.apiKey)
        guard let embeddingModelName = embeddingModelName ?? client.discoverEmbeddingModelName() else {
            return Result(scores: [:], embeddingModelName: nil, note: "semantic rerank skipped because no local embedding model was discovered")
        }
        guard let queryVector = client.embedding(model: embeddingModelName, input: query) else {
            return Result(scores: [:], embeddingModelName: embeddingModelName, note: "semantic rerank skipped because query embedding failed")
        }

        var scores: [String: Int] = [:]
        for candidate in candidates {
            let preview = semanticPreview(candidate)
            guard let vector = client.embedding(model: embeddingModelName, input: preview) else { continue }
            let similarity = cosine(queryVector, vector)
            if similarity.isFinite {
                scores[candidate.path] = max(0, Int(similarity * 2_500))
            }
        }
        return Result(scores: scores, embeddingModelName: embeddingModelName, note: scores.isEmpty ? "semantic rerank produced no scores" : nil)
    }

    private static func semanticPreview(_ candidate: SemanticFileCandidate) -> String {
        let symbols = candidate.symbols.prefix(30).map { "\($0.kind) \($0.name)" }.joined(separator: "\n")
        let body = String(candidate.text.prefix(3_000))
        return "Path: \(candidate.path)\nSymbols:\n\(symbols)\n\nContent:\n\(body)"
    }

    private static func isLocalBaseURL(_ value: String) -> Bool {
        guard let host = URL(string: value)?.host?.lowercased() else { return false }
        return host == "localhost" || host == "127.0.0.1" || host == "::1"
    }

    private static func cosine(_ left: [Double], _ right: [Double]) -> Double {
        guard left.count == right.count, !left.isEmpty else { return 0 }
        var dot = 0.0
        var leftNorm = 0.0
        var rightNorm = 0.0
        for index in left.indices {
            dot += left[index] * right[index]
            leftNorm += left[index] * left[index]
            rightNorm += right[index] * right[index]
        }
        guard leftNorm > 0, rightNorm > 0 else { return 0 }
        return dot / (sqrt(leftNorm) * sqrt(rightNorm))
    }
}

private final class LocalEmbeddingClient {
    private let baseURL: String
    private let apiKey: String

    init(baseURL: String, apiKey: String) {
        self.baseURL = baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        self.apiKey = apiKey
    }

    func discoverEmbeddingModelName() -> String? {
        guard let url = URL(string: baseURL + "/models") else { return nil }
        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        if !apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }
        guard let data = Self.syncData(for: request),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let models = object["data"] as? [[String: Any]]
        else { return nil }
        let ids = models.compactMap { $0["id"] as? String }
        return ids.first { $0.localizedCaseInsensitiveContains("qwen") && $0.localizedCaseInsensitiveContains("embedding") }
            ?? ids.first { $0.localizedCaseInsensitiveContains("embedding") }
    }

    func embedding(model: String, input: String) -> [Double]? {
        guard let url = URL(string: baseURL + "/embeddings") else { return nil }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 45
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if !apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }
        let payload: [String: Any] = ["model": model, "input": String(input.prefix(8_000))]
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        guard let data = Self.syncData(for: request),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let rows = object["data"] as? [[String: Any]],
              let embedding = rows.first?["embedding"] as? [Double]
        else { return nil }
        return embedding
    }

    private static func syncData(for request: URLRequest) -> Data? {
        let responseData = LockedValue<Data?>(nil)
        let semaphore = DispatchSemaphore(value: 0)
        URLSession.shared.dataTask(with: request) { data, _, _ in
            responseData.set(data)
            semaphore.signal()
        }.resume()
        _ = semaphore.wait(timeout: .now() + 60)
        return responseData.get()
    }
}

struct RetrievalSuggestion {
    var paths: [String]
    var searchTerms: [String]
}

enum ContextRetrievalPlanner {
    static func suggest(
        model: LLMModelConfig,
        task: String,
        context: RepositoryContext,
        previousFailure: String?
    ) -> RetrievalSuggestion {
        let prompt = """
        You are selecting repository context for a coding agent.
        Return only JSON with paths and search_terms. Pick at most 8 paths and 12 search_terms.
        Use only paths that appear in the candidate overview.

        Task:
        \(task)

        Current selected files:
        \(context.selectedFiles.joined(separator: "\n"))

        Previous failure:
        \(previousFailure ?? "None")

        Candidate overview:
        \(String(context.candidateOverview.prefix(18_000)))

        JSON shape:
        {"paths": ["relative/path.py"], "search_terms": ["symbol_or_term"]}
        """
        do {
            let response = try OpenAICompatibleChatClient.complete(
                model: model,
                systemPrompt: "Return only compact JSON. Do not include Markdown.",
                userPrompt: prompt
            )
            let json = try JSONResponseExtractor.extractJSONObject(from: response)
            guard let object = try JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any] else {
                return RetrievalSuggestion(paths: [], searchTerms: [])
            }
            let paths = (object["paths"] as? [String] ?? object["files"] as? [String] ?? [])
                .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
                .prefix(8)
            let terms = (object["search_terms"] as? [String] ?? object["searchTerms"] as? [String] ?? [])
                .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
                .prefix(12)
            return RetrievalSuggestion(paths: Array(paths), searchTerms: Array(terms))
        } catch {
            return RetrievalSuggestion(paths: [], searchTerms: [])
        }
    }
}
