import Foundation

public struct RepositoryRetrievalOptions: Equatable, Sendable {
    public var embeddingModel: EmbeddingModelConfig?
    public var forcedPaths: [String]
    public var extraSearchTerms: [String]
    public var includeSymbols: Bool

    public init(
        embeddingModel: EmbeddingModelConfig? = nil,
        forcedPaths: [String] = [],
        extraSearchTerms: [String] = [],
        includeSymbols: Bool = true
    ) {
        self.embeddingModel = embeddingModel
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

fileprivate struct SourceFacts {
    var symbols: [RepositorySymbol]
    var references: [String]
}

public enum RepositoryIndexer {
    private struct IndexedFile {
        var path: String
        var text: String
        var byteCount: Int
        var symbols: [RepositorySymbol]
        var references: [String]
        var score: Int
    }

    private struct RawFile {
        var path: String
        var text: String
        var byteCount: Int
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
        var rawFiles: [RawFile] = []
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
            rawFiles.append(RawFile(path: relative, text: text, byteCount: byteCount))
        }

        if options.includeSymbols, !rawFiles.isEmpty {
            notes.append("generic source scan analyzed \(rawFiles.count) files")
        }

        for rawFile in rawFiles {
            let facts = options.includeSymbols
                ? SourceAnalyzer.extract(path: rawFile.path, text: rawFile.text)
                : SourceFacts(symbols: [], references: [])
            let score = scoreFile(
                path: rawFile.path,
                text: rawFile.text,
                symbols: facts.symbols,
                terms: terms,
                isForced: forcedPathSet.contains(normalizeRelativePath(rawFile.path))
            )
            files.append(IndexedFile(
                path: rawFile.path,
                text: rawFile.text,
                byteCount: rawFile.byteCount,
                symbols: facts.symbols,
                references: facts.references,
                score: score
            ))
        }

        let expansion = expandRelatedFiles(files)
        if !expansion.boosts.isEmpty {
            files = files.map { file in
                var file = file
                file.score += expansion.boosts[file.path] ?? 0
                return file
            }
            notes.append(expansion.note)
        }

        if let embeddingModel = options.embeddingModel {
            let semantic = SemanticFileRanker.score(
                files: files.map { SemanticFileCandidate(path: $0.path, text: $0.text, symbols: $0.symbols, lexicalScore: $0.score) },
                query: query,
                model: embeddingModel
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

    private static func expandRelatedFiles(_ files: [IndexedFile]) -> (boosts: [String: Int], note: String) {
        let scored = files.filter { $0.score > 0 }
        guard !scored.isEmpty else { return ([:], "") }

        let referenceMap = referenceTargetMap(files)
        var boosts: [String: Int] = [:]
        var reasons: Set<String> = []

        func boost(_ path: String, _ amount: Int, _ reason: String) {
            boosts[path, default: 0] += amount
            reasons.insert(reason)
        }

        let scoredPaths = Set(scored.map(\.path))
        for file in scored {
            for reference in file.references {
                for target in targets(for: reference, importerPath: file.path, referenceMap: referenceMap) where target != file.path {
                    boost(target, 900, "references")
                }
            }

            let sourceStem = canonicalTestStem(file.path)
            let fileIsTest = isTestPath(file.path)
            for candidate in files where candidate.path != file.path {
                if canonicalTestStem(candidate.path) == sourceStem,
                   isTestPath(candidate.path) != fileIsTest {
                    boost(candidate.path, 800, "test/source pairs")
                }
            }
        }

        for file in files where !scoredPaths.contains(file.path) {
            let referencedTargets = file.references.flatMap { targets(for: $0, importerPath: file.path, referenceMap: referenceMap) }
            if referencedTargets.contains(where: scoredPaths.contains) {
                boost(file.path, 650, "reverse references")
            }
        }

        let reasonText = reasons.sorted().joined(separator: ", ")
        return (boosts, boosts.isEmpty ? "" : "related-file expansion boosted \(boosts.count) files via \(reasonText)")
    }

    private static func referenceTargetMap(_ files: [IndexedFile]) -> [String: [String]] {
        var result: [String: Set<String>] = [:]
        for file in files {
            for key in referenceKeys(forPath: file.path) {
                result[key, default: []].insert(file.path)
            }
        }
        return result.mapValues { Array($0).sorted() }
    }

    private static func referenceKeys(forPath path: String) -> [String] {
        let normalized = path.replacingOccurrences(of: "\\", with: "/").lowercased()
        let withoutExtension = stripKnownExtension(normalized)
        let components = withoutExtension.split(separator: "/").map(String.init)
        let sourceRootNames = Set(["src", "source", "sources", "lib", "app", "apps", "package", "packages"])
        var keys: Set<String> = [normalized, withoutExtension, withoutExtension.replacingOccurrences(of: "/", with: ".")]
        if let filename = components.last {
            keys.insert(filename)
        }
        for start in components.indices {
            let suffix = components[start...].joined(separator: "/")
            keys.insert(suffix)
            keys.insert(suffix.replacingOccurrences(of: "/", with: "."))
        }
        if components.first.map(sourceRootNames.contains) == true, components.count > 1 {
            let suffix = components.dropFirst().joined(separator: "/")
            keys.insert(suffix)
            keys.insert(suffix.replacingOccurrences(of: "/", with: "."))
        }
        return Array(keys.filter { !$0.isEmpty })
    }

    private static func targets(for reference: String, importerPath: String, referenceMap: [String: [String]]) -> [String] {
        let names = resolvedReferenceKeys(reference, importerPath: importerPath)
        var result: Set<String> = []
        for name in names {
            if let paths = referenceMap[name] {
                result.formUnion(paths)
            }
            if let last = name.split(separator: ".").last,
               let paths = referenceMap[String(last)] {
                result.formUnion(paths)
            }
            if let last = name.split(separator: "/").last,
               let paths = referenceMap[String(last)] {
                result.formUnion(paths)
            }
        }
        return Array(result).sorted()
    }

    private static func resolvedReferenceKeys(_ reference: String, importerPath: String) -> [String] {
        let cleaned = normalizeReference(reference)
        guard !cleaned.isEmpty else { return [] }
        var keys: Set<String> = [cleaned, cleaned.replacingOccurrences(of: "/", with: ".")]
        if cleaned.hasPrefix(".") {
            let importerDirectory = (importerPath as NSString).deletingLastPathComponent
            if cleaned.hasPrefix("./") || cleaned.hasPrefix("../") {
                let relative = URL(fileURLWithPath: importerDirectory).appendingPathComponent(cleaned).standardized.path
                let normalizedRelative = relative.trimmingCharacters(in: CharacterSet(charactersIn: "/")).lowercased()
                keys.formUnion(referenceKeys(forPath: normalizedRelative))
            } else {
                let dotCount = cleaned.prefix { $0 == "." }.count
                let suffix = String(cleaned.dropFirst(dotCount)).replacingOccurrences(of: ".", with: "/")
                var directoryParts = importerDirectory.split(separator: "/").map(String.init)
                if dotCount > 1 {
                    directoryParts = Array(directoryParts.dropLast(min(dotCount - 1, directoryParts.count)))
                }
                let relative = (directoryParts + [suffix]).filter { !$0.isEmpty }.joined(separator: "/")
                keys.formUnion(referenceKeys(forPath: relative))
            }
        }
        if cleaned.hasPrefix("/") {
            keys.formUnion(referenceKeys(forPath: cleaned))
        }
        if let last = cleaned.split(separator: "/").last {
            keys.insert(String(last))
        }
        if let last = cleaned.split(separator: ".").last {
            keys.insert(String(last))
        }
        return Array(keys)
    }

    private static func normalizeReference(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "\"'`;"))
            .replacingOccurrences(of: "\\", with: "/")
            .lowercased()
    }

    private static func stripKnownExtension(_ path: String) -> String {
        let extensions = [
            ".swift", ".py", ".js", ".ts", ".tsx", ".jsx", ".json", ".md", ".toml",
            ".yaml", ".yml", ".sh", ".html", ".css", ".sql", ".txt", ".xml", ".go",
            ".rs", ".java", ".kt", ".kts", ".rb", ".php", ".c", ".cc", ".cpp", ".h",
            ".hpp", ".cs", ".scala", ".dart", ".ex", ".exs", ".erl", ".hrl", ".lua",
            ".r", ".m", ".mm", ".fs", ".fsx", ".clj", ".cljs", ".zig", ".nix", ".tf"
        ]
        for ext in extensions where path.hasSuffix(ext) {
            return String(path.dropLast(ext.count))
        }
        return path
    }

    private static func canonicalTestStem(_ path: String) -> String {
        let base = ((path as NSString).lastPathComponent as NSString).deletingPathExtension.lowercased()
        return base
            .replacingOccurrences(of: "^test[_-]", with: "", options: .regularExpression)
            .replacingOccurrences(of: "[_-]test$", with: "", options: .regularExpression)
            .replacingOccurrences(of: "\\.test$", with: "", options: .regularExpression)
            .replacingOccurrences(of: "tests$", with: "", options: .regularExpression)
    }

    private static func isTestPath(_ path: String) -> Bool {
        let lower = path.lowercased()
        let base = (lower as NSString).lastPathComponent
        return lower.contains("/test") || base.hasPrefix("test_") || base.hasSuffix("_test.py") ||
            base.hasSuffix(".test.ts") || base.hasSuffix(".test.js") || base.hasSuffix(".spec.ts") ||
            base.hasSuffix(".spec.js") || base.hasSuffix("tests.swift")
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
            ".yaml", ".yml", ".sh", ".html", ".css", ".sql", ".txt", ".xml", ".go",
            ".rs", ".java", ".kt", ".kts", ".rb", ".php", ".c", ".cc", ".cpp", ".h",
            ".hpp", ".cs", ".scala", ".dart", ".ex", ".exs", ".erl", ".hrl", ".lua",
            ".r", ".m", ".mm", ".fs", ".fsx", ".clj", ".cljs", ".zig", ".nix", ".tf"
        ]
        let allowedNames = ["makefile", "dockerfile", "package.swift", "package.resolved"]
        return allowedExtensions.contains(where: lower.hasSuffix) || allowedNames.contains((lower as NSString).lastPathComponent)
    }

    private static func isSourcePath(_ lowerPath: String) -> Bool {
        lowerPath.hasSuffix(".swift") || lowerPath.hasSuffix(".py") || lowerPath.hasSuffix(".js") ||
            lowerPath.hasSuffix(".ts") || lowerPath.hasSuffix(".tsx") || lowerPath.hasSuffix(".jsx") ||
            lowerPath.hasSuffix(".go") || lowerPath.hasSuffix(".rs") || lowerPath.hasSuffix(".java") ||
            lowerPath.hasSuffix(".kt") || lowerPath.hasSuffix(".rb") || lowerPath.hasSuffix(".php") ||
            lowerPath.hasSuffix(".c") || lowerPath.hasSuffix(".cc") || lowerPath.hasSuffix(".cpp") ||
            lowerPath.hasSuffix(".cs") || lowerPath.hasSuffix(".scala") || lowerPath.hasSuffix(".dart") ||
            lowerPath.hasSuffix(".ex") || lowerPath.hasSuffix(".exs") || lowerPath.hasSuffix(".tf")
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

private enum SourceAnalyzer {
    static func extract(path: String, text: String) -> SourceFacts {
        SourceFacts(
            symbols: symbols(path: path, text: text),
            references: references(text: text)
        )
    }

    private static func symbols(path: String, text: String) -> [RepositorySymbol] {
        let patterns: [(pattern: String, kind: String)] = [
            (#"^\s*(?:(?:public|private|internal|protected|export|open|final|static|async|mutating|nonmutating|override)\s+)*(?:func|function|def|fn|sub|proc|method)\s+([A-Za-z_$][A-Za-z0-9_$!?=]*)\b"#, "function"),
            (#"^\s*func\s*(?:\([^)]+\)\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*\("#, "function"),
            (#"^\s*(?:(?:public|private|internal|protected|export|open|final|abstract|sealed)\s+)*(?:class|struct|enum|interface|protocol|trait|type|actor|module|namespace)\s+([A-Za-z_$][A-Za-z0-9_$]*)\b"#, "type"),
            (#"^\s*(?:(?:public|private|internal|protected|export|static|const|let|var)\s+)*([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>)"#, "function"),
            (#"^\s*(?:(?:public|private|internal|protected|export|static|const|let|var)\s+)+([A-Za-z_$][A-Za-z0-9_$]*)\s*[:=]"#, "value")
        ]
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

    private static func references(text: String) -> [String] {
        let patterns: [(pattern: String, group: Int)] = [
            (#"\b(?:from|import|require|include|include_once|require_once|load|source)\b[^\n"']*["']([^"']+)["']"#, 1),
            (#"^\s*(?:import|from|use|mod|package)\s+([A-Za-z_@./][A-Za-z0-9_@./-]*)"#, 1),
            (#"^\s*#\s*include\s+[<"]([^>"]+)[>"]"#, 1),
            (#"^\s*@import\s+["']([^"']+)["']"#, 1)
        ]
        let lines = text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        let compiled = patterns.compactMap { pattern, group -> (NSRegularExpression, Int)? in
            guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
            return (regex, group)
        }
        var result: Set<String> = []
        for line in lines {
            let range = NSRange(line.startIndex..<line.endIndex, in: line)
            for (regex, group) in compiled {
                guard let match = regex.firstMatch(in: line, range: range),
                      match.numberOfRanges > group,
                      let valueRange = Range(match.range(at: group), in: line)
                else { continue }
                let value = String(line[valueRange])
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .trimmingCharacters(in: CharacterSet(charactersIn: "\"'`;"))
                if !value.isEmpty {
                    result.insert(value)
                }
            }
        }
        return Array(result).sorted()
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
        model: EmbeddingModelConfig
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
        let embeddingModelName = model.modelName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !embeddingModelName.isEmpty else {
            return Result(scores: [:], embeddingModelName: nil, note: "semantic rerank skipped because the embedding model name is empty")
        }
        let client = LocalEmbeddingClient(baseURL: model.baseURL, apiKey: model.apiKey)
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
