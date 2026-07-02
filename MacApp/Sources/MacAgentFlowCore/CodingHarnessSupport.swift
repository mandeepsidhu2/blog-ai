import Foundation

struct CodingHarnessPlan {
    var summary: String
    var textEdits: [TextEdit]
    var fileEdits: [FileEdit]
    var testCommand: String?
}

struct TextEdit {
    var path: String
    var oldText: String
    var newText: String
    var replaceAll: Bool
}

struct FileEdit {
    var path: String
    var content: String
}

enum CodingHarnessPlanParser {
    static func parse(_ response: String) throws -> CodingHarnessPlan {
        let json = try JSONResponseExtractor.extractJSONObject(from: response)
        let data = Data(json.utf8)
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw HarnessError.message("Response JSON is not an object.")
        }

        let summary = object["summary"] as? String ?? object["message"] as? String ?? ""
        let testCommand = object["test_command"] as? String ?? object["testCommand"] as? String
        let rawEdits = object["file_edits"] as? [[String: Any]]
            ?? object["fileEdits"] as? [[String: Any]]
            ?? object["edits"] as? [[String: Any]]
            ?? []
        let rawTextEdits = object["text_edits"] as? [[String: Any]]
            ?? object["textEdits"] as? [[String: Any]]
            ?? object["patch_edits"] as? [[String: Any]]
            ?? object["patchEdits"] as? [[String: Any]]
            ?? []

        let textEdits = rawTextEdits.compactMap { edit -> TextEdit? in
            guard let path = edit["path"] as? String ?? edit["file"] as? String,
                  let oldText = edit["old"] as? String ?? edit["old_text"] as? String ?? edit["oldText"] as? String,
                  let newText = edit["new"] as? String ?? edit["new_text"] as? String ?? edit["newText"] as? String
            else { return nil }
            return TextEdit(
                path: path,
                oldText: oldText,
                newText: newText,
                replaceAll: edit["replace_all"] as? Bool ?? edit["replaceAll"] as? Bool ?? false
            )
        }

        let fileEdits = rawEdits.compactMap { edit -> FileEdit? in
            guard let path = edit["path"] as? String ?? edit["file"] as? String,
                  let content = edit["content"] as? String
            else { return nil }
            return FileEdit(path: path, content: content)
        }

        return CodingHarnessPlan(summary: summary, textEdits: textEdits, fileEdits: fileEdits, testCommand: testCommand)
    }
}

enum JSONResponseExtractor {
    static func extractJSONObject(from text: String) throws -> String {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("{"), trimmed.hasSuffix("}") {
            return trimmed
        }

        if let fencedStart = trimmed.range(of: "```json"),
           let fencedEnd = trimmed.range(of: "```", range: fencedStart.upperBound..<trimmed.endIndex) {
            return String(trimmed[fencedStart.upperBound..<fencedEnd.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
        }

        guard let first = trimmed.firstIndex(of: "{"), let last = trimmed.lastIndex(of: "}") else {
            throw HarnessError.message("No JSON object found.")
        }
        return String(trimmed[first...last])
    }
}

enum FileEditApplier {
    static func apply(
        textEdits: [TextEdit],
        fileEdits: [FileEdit],
        rootURL: URL
    ) -> (changedFiles: [String], logLines: [String], errorMessage: String?) {
        var changed: [String] = []
        var logs: [String] = []
        for edit in textEdits {
            guard isSafeRelativePath(edit.path) else {
                return (changed, logs, "Unsafe edit path rejected: \(edit.path)")
            }
            guard !edit.oldText.isEmpty else {
                return (changed, logs, "Text edit for \(edit.path) has empty old text.")
            }
            let target = rootURL.appendingPathComponent(edit.path)
            do {
                let previous = try String(contentsOf: target, encoding: .utf8)
                let occurrences = previous.components(separatedBy: edit.oldText).count - 1
                guard occurrences > 0 else {
                    return (changed, logs, "Text edit target was not found in \(edit.path).")
                }
                guard edit.replaceAll || occurrences == 1 else {
                    return (changed, logs, "Text edit target appears \(occurrences) times in \(edit.path); set replace_all to true or provide a narrower old text.")
                }
                let updated = edit.replaceAll
                    ? previous.replacingOccurrences(of: edit.oldText, with: edit.newText)
                    : previous.replacingOccurrences(of: edit.oldText, with: edit.newText, options: [], range: previous.range(of: edit.oldText))
                if updated != previous {
                    try updated.write(to: target, atomically: true, encoding: .utf8)
                    changed.append(edit.path)
                    logs.append("Coding harness: patched \(edit.path)")
                } else {
                    logs.append("Coding harness: text edit left \(edit.path) unchanged")
                }
            } catch {
                return (changed, logs, "Could not patch \(edit.path): \(error.localizedDescription)")
            }
        }

        for edit in fileEdits {
            guard isSafeRelativePath(edit.path) else {
                return (changed, logs, "Unsafe edit path rejected: \(edit.path)")
            }
            let target = rootURL.appendingPathComponent(edit.path)
            do {
                try FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
                let previous = try? String(contentsOf: target, encoding: .utf8)
                if previous != edit.content {
                    try edit.content.write(to: target, atomically: true, encoding: .utf8)
                    changed.append(edit.path)
                    logs.append("Coding harness: wrote \(edit.path)")
                } else {
                    logs.append("Coding harness: \(edit.path) already matched requested content")
                }
            } catch {
                return (changed, logs, "Could not write \(edit.path): \(error.localizedDescription)")
            }
        }
        if textEdits.isEmpty, fileEdits.isEmpty {
            logs.append("Coding harness: model returned no file edits")
        }
        return (Array(Set(changed)).sorted(), logs, nil)
    }

    private static func isSafeRelativePath(_ path: String) -> Bool {
        if path.hasPrefix("/") { return false }
        let parts = path.split(separator: "/").map(String.init)
        return !parts.isEmpty && !parts.contains("..") && !parts.contains(".git")
    }
}

enum CodingHarnessPromptBuilder {
    static let systemPrompt = """
    You are a coding harness worker. Return only valid JSON. Do not use Markdown.
    Prefer exact text edits for localized changes. Return complete file content only for new files or broad rewrites.
    """

    static func prompt(
        userPrompt: String,
        context: RepositoryContext,
        research: [String],
        previousFailure: String?,
        testCommand: String?
    ) -> String {
        """
        Task:
        \(userPrompt)

        Repository root:
        \(context.rootPath)

        Selected repository context:
        \(context.text)

        Internet research snippets:
        \(research.joined(separator: "\n\n---\n\n"))

        Validation command:
        \(testCommand ?? "None provided")

        Previous validation failure:
        \(previousFailure ?? "None")

        Return this JSON shape exactly:
        {
          "summary": "short explanation",
          "text_edits": [
            {"path": "relative/path.ext", "old": "exact existing text", "new": "replacement text", "replace_all": false}
          ],
          "file_edits": [
            {"path": "relative/path.ext", "content": "complete new file content"}
          ],
          "test_command": "\(escapeForJSONInstruction(testCommand ?? ""))"
        }
        """
    }

    private static func escapeForJSONInstruction(_ value: String) -> String {
        value.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"")
    }
}

public enum CodingHarnessPromptDirectives {
    public static func repositoryURL(from text: String) -> URL? {
        CodingHarnessDirectives.parseExplicitRepositoryURL(text)
            ?? CodingWorkspaceResolver.resolve(configuredPath: nil, prompt: text).url
    }

    public static func repositoryURL(fromPath path: String?) -> URL? {
        CodingHarnessDirectives.fileURL(fromPath: path)
    }

    public static func testCommand(from text: String) -> String? {
        CodingHarnessDirectives.parse(text).testCommand
    }

    public static func command(from text: String?) -> String? {
        CodingHarnessDirectives.normalizedCommand(text)
    }
}

public struct CodingWorkspaceResolution: Equatable, Sendable {
    public var url: URL?
    public var source: String
    public var message: String
    public var mentionedPaths: [String]
    public var needsPermission: Bool

    public var hasLocalHint: Bool {
        !mentionedPaths.isEmpty
    }
}

public enum CodingWorkspaceResolver {
    public static func resolve(configuredPath: String?, prompt: String) -> CodingWorkspaceResolution {
        let directive = CodingHarnessDirectives.parseExplicitRepositoryURL(prompt)
        let mentions = pathMentions(in: prompt)
        let allMentions = ([directive?.path].compactMap { $0 } + mentions).uniqued()

        for mention in allMentions {
            if let url = resolvePathMention(mention) {
                return CodingWorkspaceResolution(
                    url: url,
                    source: directive?.path == mention ? "legacy directive" : "prompt",
                    message: "Detected local folder from prompt: \(url.path)",
                    mentionedPaths: allMentions,
                    needsPermission: false
                )
            }
        }

        if let configuredPath = CodingHarnessDirectives.normalizedCommand(configuredPath) {
            if let url = resolvePathMention(configuredPath) {
                if allMentions.isEmpty || mentionList(allMentions, canUseConfiguredURL: url) {
                    return CodingWorkspaceResolution(
                        url: url,
                        source: "chosen",
                        message: allMentions.isEmpty ? "Using chosen folder: \(url.path)" : "Using granted access for prompt folder: \(url.path)",
                        mentionedPaths: allMentions.isEmpty ? [configuredPath] : allMentions,
                        needsPermission: false
                    )
                }
                return CodingWorkspaceResolution(
                    url: nil,
                    source: "prompt",
                    message: "The prompt mentions a different local folder than the saved override. Update the prompt or grant access to the intended folder.",
                    mentionedPaths: allMentions,
                    needsPermission: true
                )
            }
            return CodingWorkspaceResolution(
                url: nil,
                source: "chosen",
                message: "Chosen folder was not found or cannot be read.",
                mentionedPaths: allMentions.isEmpty ? [configuredPath] : allMentions,
                needsPermission: true
            )
        }

        return CodingWorkspaceResolution(
            url: nil,
            source: "prompt",
            message: allMentions.isEmpty ? "No local folder mentioned in the prompt." : "The prompt mentions a local folder, but it was not found or needs access.",
            mentionedPaths: allMentions,
            needsPermission: !allMentions.isEmpty
        )
    }

    private static func pathMentions(in text: String) -> [String] {
        let patterns = [
            #"(?:~|/(?:Users|private|var|tmp|Volumes|opt|Applications))[^,\n;]*"#,
            #"(?:Desktop|Documents|Downloads|Developer|Projects|Repos|repositories|workspace|workspaces|code|src|source|sources|app|apps|lib)(?:/[^\n,;]+)+"#
        ]
        var mentions: [String] = []
        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { continue }
            let range = NSRange(text.startIndex..<text.endIndex, in: text)
            for match in regex.matches(in: text, range: range) {
                guard let valueRange = Range(match.range, in: text) else { continue }
                let value = cleanMention(String(text[valueRange]))
                if value.contains("/") {
                    mentions.append(value)
                }
            }
        }
        return mentions.uniqued()
    }

    private static func cleanMention(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "\"'`.,;:()[]{}"))
    }

    private static func resolvePathMention(_ mention: String) -> URL? {
        for candidate in candidateURLs(for: mention) {
            if let exact = readableDirectory(candidate) {
                return projectRoot(for: exact) ?? exact
            }
            if let prefix = longestReadableDirectoryPrefix(candidate.path) {
                let remainder = String(candidate.path.dropFirst(prefix.path.count))
                    .trimmingCharacters(in: CharacterSet(charactersIn: "/ "))
                if let fuzzy = fuzzyDirectoryMatch(under: prefix, remainder: remainder) {
                    return projectRoot(for: fuzzy) ?? fuzzy
                }
                if isSpecificDirectory(prefix) {
                    return projectRoot(for: prefix) ?? prefix
                }
            }
        }
        return nil
    }

    private static func mentionList(_ mentions: [String], canUseConfiguredURL url: URL) -> Bool {
        let configuredKey = normalizedFuzzyKey(url.path)
        return mentions.contains { mention in
            let mentionKey = normalizedFuzzyKey(mention)
            return configuredKey.hasSuffix(mentionKey) || configuredKey.contains(mentionKey) || mentionKey.contains(configuredKey)
        }
    }

    private static func projectRoot(for url: URL) -> URL? {
        var current = url.standardizedFileURL.path
        for _ in 0..<24 {
            if hasProjectMarker(atPath: current) {
                return URL(fileURLWithPath: current).standardizedFileURL
            }
            let parent = (current as NSString).deletingLastPathComponent
            if parent == current || parent.isEmpty {
                return nil
            }
            current = parent
        }
        return nil
    }

    private static func hasProjectMarker(atPath path: String) -> Bool {
        [
            ".git",
            "pyproject.toml",
            "package.json",
            "Package.swift",
            "Cargo.toml",
            "go.mod",
            "pom.xml",
            "build.gradle",
            "composer.json",
            "Gemfile"
        ].contains { marker in
            FileManager.default.fileExists(atPath: (path as NSString).appendingPathComponent(marker))
        }
    }

    private static func candidateURLs(for mention: String) -> [URL] {
        let expanded = NSString(string: cleanMention(mention)).expandingTildeInPath
        let home = FileManager.default.homeDirectoryForCurrentUser
        var paths: [String] = []
        if expanded.hasPrefix("/") {
            paths.append(expanded)
        } else {
            paths.append(home.appendingPathComponent(expanded).path)
            paths.append(home.appendingPathComponent("Desktop").appendingPathComponent(expanded).path)
            paths.append(home.appendingPathComponent("Documents").appendingPathComponent(expanded).path)
        }
        return paths.uniqued().map { URL(fileURLWithPath: $0).standardizedFileURL }
    }

    private static func readableDirectory(_ url: URL) -> URL? {
        var isDirectory = ObjCBool(false)
        let exists = FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory)
        guard exists, isDirectory.boolValue, FileManager.default.isReadableFile(atPath: url.path) else { return nil }
        return url.standardizedFileURL
    }

    private static func longestReadableDirectoryPrefix(_ path: String) -> URL? {
        var current = cleanMention(path)
        while current.count > 1 {
            let url = URL(fileURLWithPath: current).standardizedFileURL
            if let readable = readableDirectory(url) {
                return readable
            }
            current.removeLast()
            current = current.trimmingCharacters(in: CharacterSet(charactersIn: " /.,;:()[]{}\"'`"))
        }

        current = cleanMention(path)
        while current.count > 1 {
            let url = URL(fileURLWithPath: current).standardizedFileURL
            if let readable = readableDirectory(url) {
                return readable
            }
            let next = (current as NSString).deletingLastPathComponent
            if next == current || next.isEmpty { break }
            current = next
        }
        return nil
    }

    private static func fuzzyDirectoryMatch(under root: URL, remainder: String) -> URL? {
        let target = normalizedFuzzyKey(remainder)
        guard target.count >= 3,
              let enumerator = FileManager.default.enumerator(
                at: root,
                includingPropertiesForKeys: [.isDirectoryKey],
                options: [.skipsHiddenFiles]
              )
        else { return nil }

        let rootPath = root.standardizedFileURL.path
        var visited = 0
        for case let url as URL in enumerator {
            visited += 1
            if visited > 400 { break }
            guard isDirectory(url) else { continue }
            let urlPath = url.standardizedFileURL.path
            let relative = urlPath.hasPrefix(rootPath)
                ? String(urlPath.dropFirst(rootPath.count))
                : url.lastPathComponent
            let key = normalizedFuzzyKey(relative)
            if key == target || key.hasSuffix(target) || target.hasSuffix(key) {
                return url.standardizedFileURL
            }
            if relative.trimmingCharacters(in: CharacterSet(charactersIn: "/")).split(separator: "/").count >= 3 {
                enumerator.skipDescendants()
            }
        }
        return nil
    }

    private static func isDirectory(_ url: URL) -> Bool {
        ((try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) ?? false) == true
    }

    private static func isSpecificDirectory(_ url: URL) -> Bool {
        url.standardizedFileURL.pathComponents.count >= 4
    }

    private static func normalizedFuzzyKey(_ value: String) -> String {
        value.lowercased().filter { $0.isLetter || $0.isNumber }
    }
}

private extension Array where Element: Hashable {
    func uniqued() -> [Element] {
        var seen: Set<Element> = []
        return filter { seen.insert($0).inserted }
    }
}

enum CodingHarnessDirectives {
    struct Directives {
        var repositoryURL: URL?
        var testCommand: String?
        var urls: [URL]
    }

    static func parse(_ text: String) -> Directives {
        Directives(
            repositoryURL: parseRepositoryURL(text),
            testCommand: parseLineDirective(text, keys: ["test", "test_command", "validation"]),
            urls: parseURLs(text)
        )
    }

    static func parseRepositoryURL(_ text: String) -> URL? {
        parseExplicitRepositoryURL(text)
    }

    static func parseExplicitRepositoryURL(_ text: String) -> URL? {
        guard let value = parseLineDirective(text, keys: ["repo", "repository", "cwd", "workspace"]) else { return nil }
        return fileURL(fromPath: value)
    }

    static func fileURL(fromPath path: String?) -> URL? {
        guard let path = normalizedCommand(path) else { return nil }
        return URL(fileURLWithPath: NSString(string: path).expandingTildeInPath)
    }

    static func normalizedCommand(_ text: String?) -> String? {
        guard let text else { return nil }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private static func parseLineDirective(_ text: String, keys: [String]) -> String? {
        for line in text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init) {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            for key in keys {
                let prefix = key + ":"
                if trimmed.lowercased().hasPrefix(prefix) {
                    return String(trimmed.dropFirst(prefix.count)).trimmingCharacters(in: .whitespacesAndNewlines)
                }
            }
        }
        return nil
    }

    private static func parseURLs(_ text: String) -> [URL] {
        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        return detector?.matches(in: text, range: range).compactMap(\.url) ?? []
    }
}

enum InternetResearcher {
    static func research(for prompt: String, explicitURLs: [URL]) -> [String] {
        var snippets: [String] = []
        for url in explicitURLs.prefix(3) {
            if let text = fetch(url: url) {
                snippets.append("URL: \(url.absoluteString)\n\(String(text.prefix(6000)))")
            }
        }

        if explicitURLs.isEmpty, shouldSearch(prompt),
           let search = search(query: prompt) {
            snippets.append("Web search summary:\n\(String(search.prefix(6000)))")
        }
        return snippets
    }

    private static func shouldSearch(_ prompt: String) -> Bool {
        let lower = prompt.lowercased()
        return lower.contains("research") || lower.contains("look up") || lower.contains("internet") || lower.contains("latest")
    }

    private static func search(query: String) -> String? {
        var components = URLComponents(string: "https://duckduckgo.com/html/")
        components?.queryItems = [URLQueryItem(name: "q", value: query)]
        guard let url = components?.url else { return nil }
        return fetch(url: url).map(stripHTML)
    }

    private static func fetch(url: URL) -> String? {
        let result = LockedValue<String?>(nil)
        let semaphore = DispatchSemaphore(value: 0)
        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        request.setValue("MacAgentFlowCodingHarness/0.1", forHTTPHeaderField: "User-Agent")
        URLSession.shared.dataTask(with: request) { data, _, _ in
            if let data, let text = String(data: data, encoding: .utf8) {
                result.set(text)
            }
            semaphore.signal()
        }.resume()
        _ = semaphore.wait(timeout: .now() + 25)
        return result.get()
    }

    private static func stripHTML(_ html: String) -> String {
        html
            .replacingOccurrences(of: "<script[\\s\\S]*?</script>", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "<style[\\s\\S]*?</style>", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "<[^>]+>", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
    }
}

enum OpenAICompatibleChatClient {
    static func complete(model: LLMModelConfig, systemPrompt: String, userPrompt: String, maxTokens: Int? = nil) throws -> String {
        let base = model.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: base + "/chat/completions") else {
            throw HarnessError.message("Invalid model base URL.")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 180
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if !model.apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            request.setValue("Bearer \(model.apiKey)", forHTTPHeaderField: "Authorization")
        }

        var body: [String: Any] = [
            "model": model.modelName,
            "temperature": 0.1,
            "stream": false,
            "messages": [
                ["role": "system", "content": systemPrompt],
                ["role": "user", "content": userPrompt]
            ]
        ]
        if let maxTokens {
            body["max_tokens"] = maxTokens
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let responseData = LockedValue<Data?>(nil)
        let responseErrorMessage = LockedValue<String?>(nil)
        let responseStatus = LockedValue<Int?>(nil)
        let semaphore = DispatchSemaphore(value: 0)
        URLSession.shared.dataTask(with: request) { data, response, error in
            responseData.set(data)
            responseErrorMessage.set(error?.localizedDescription)
            responseStatus.set((response as? HTTPURLResponse)?.statusCode)
            semaphore.signal()
        }.resume()
        _ = semaphore.wait(timeout: .now() + 240)

        if let responseErrorMessage = responseErrorMessage.get() {
            throw HarnessError.message(responseErrorMessage)
        }
        guard let data = responseData.get() else { throw HarnessError.message("No model response data.") }
        if let status = responseStatus.get(), !(200..<300).contains(status) {
            throw HarnessError.message("Model endpoint returned HTTP \(status): \(responsePreview(data))")
        }
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw HarnessError.message("Model response was not JSON: \(responsePreview(data))")
        }
        if let error = object["error"] as? [String: Any] {
            throw HarnessError.message(String(describing: error["message"] ?? error))
        }
        guard let choices = object["choices"] as? [[String: Any]],
              let first = choices.first,
              let message = first["message"] as? [String: Any],
              let content = message["content"] as? String
        else {
            throw HarnessError.message("Model response did not include choices[0].message.content.")
        }
        if content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
           let reasoning = message["reasoning_content"] as? String,
           !reasoning.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            throw HarnessError.message("Model returned reasoning but no final assistant content. Increase the completion token budget or disable reasoning for this model.")
        }
        return content
    }

    private static func responsePreview(_ data: Data) -> String {
        let text = String(data: data, encoding: .utf8) ?? "<\(data.count) bytes>"
        let compact = text
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return String(compact.prefix(300))
    }
}

public struct LLMModelTestResult: Equatable, Sendable {
    public var isConnected: Bool
    public var message: String

    public init(isConnected: Bool, message: String) {
        self.isConnected = isConnected
        self.message = message
    }
}

public enum LLMModelConnectionTester {
    public static func test(_ model: LLMModelConfig) -> LLMModelTestResult {
        let baseURL = model.baseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        let modelName = model.modelName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !baseURL.isEmpty else {
            return LLMModelTestResult(isConnected: false, message: "Base URL is required.")
        }
        guard !modelName.isEmpty else {
            return LLMModelTestResult(isConnected: false, message: "Model name is required.")
        }
        guard URL(string: baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/chat/completions") != nil else {
            return LLMModelTestResult(isConnected: false, message: "Base URL is not valid.")
        }
        if model.backend != .localOpenAICompatible,
           model.apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return LLMModelTestResult(isConnected: false, message: "API key is required for this backend.")
        }

        do {
            let content = try OpenAICompatibleChatClient.complete(
                model: model,
                systemPrompt: "You are a connection test. Reply with a short plain-text acknowledgement.",
                userPrompt: "Reply with OK.",
                maxTokens: 512
            )
            let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty {
                return LLMModelTestResult(isConnected: false, message: "Connection succeeded but the model returned empty content.")
            }
            return LLMModelTestResult(isConnected: true, message: "Connection works. Model replied: \(String(trimmed.prefix(80)))")
        } catch {
            return LLMModelTestResult(isConnected: false, message: error.localizedDescription)
        }
    }
}

public enum EmbeddingModelConnectionTester {
    public static func test(_ model: EmbeddingModelConfig) -> LLMModelTestResult {
        let baseURL = model.baseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        let modelName = model.modelName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !baseURL.isEmpty else {
            return LLMModelTestResult(isConnected: false, message: "Base URL is required.")
        }
        guard !modelName.isEmpty else {
            return LLMModelTestResult(isConnected: false, message: "Embedding model name is required.")
        }
        guard let url = URL(string: baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/embeddings") else {
            return LLMModelTestResult(isConnected: false, message: "Base URL is not valid.")
        }
        if model.backend != .localOpenAICompatible,
           model.apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return LLMModelTestResult(isConnected: false, message: "API key is required for this backend.")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if !model.apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            request.setValue("Bearer \(model.apiKey)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "model": modelName,
            "input": "connection test"
        ])

        let responseData = LockedValue<Data?>(nil)
        let responseCode = LockedValue<Int?>(nil)
        let semaphore = DispatchSemaphore(value: 0)
        URLSession.shared.dataTask(with: request) { data, response, _ in
            responseData.set(data)
            responseCode.set((response as? HTTPURLResponse)?.statusCode)
            semaphore.signal()
        }.resume()
        if semaphore.wait(timeout: .now() + 35) == .timedOut {
            return LLMModelTestResult(isConnected: false, message: "Embedding request timed out.")
        }
        guard let data = responseData.get() else {
            return LLMModelTestResult(isConnected: false, message: "Embedding endpoint returned no data.")
        }
        guard (200..<300).contains(responseCode.get() ?? 0) else {
            let body = String(data: data, encoding: .utf8) ?? "<\(data.count) bytes>"
            return LLMModelTestResult(isConnected: false, message: "Embedding endpoint returned HTTP \(responseCode.get() ?? 0): \(String(body.prefix(160)))")
        }
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let rows = object["data"] as? [[String: Any]],
              let embedding = rows.first?["embedding"] as? [Double],
              !embedding.isEmpty else {
            return LLMModelTestResult(isConnected: false, message: "Embedding endpoint responded but did not return an embedding vector.")
        }
        return LLMModelTestResult(isConnected: true, message: "Connection works. Returned \(embedding.count)-dimension embedding.")
    }
}

enum ShellCommandRunner {
    struct Result {
        var exitCode: Int32
        var output: String
    }

    static func run(_ command: String, cwd: URL) -> Result {
        guard isAllowed(command) else {
            return Result(exitCode: 126, output: "Blocked command by project policy: \(command)")
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-lc", command]
        process.currentDirectoryURL = cwd

        let output = Pipe()
        process.standardOutput = output
        process.standardError = output
        do {
            try process.run()
        } catch {
            return Result(exitCode: 127, output: error.localizedDescription)
        }
        process.waitUntilExit()
        let data = output.fileHandleForReading.readDataToEndOfFile()
        return Result(exitCode: process.terminationStatus, output: String(data: data, encoding: .utf8) ?? "")
    }

    private static func isAllowed(_ command: String) -> Bool {
        let blocked = ["aws", "terraform", "tofu", "kubectl", "helm"]
        let lowered = command.lowercased()
        for token in blocked {
            let pattern = "(^|[\\s;&|])\(token)([\\s;&|]|$)"
            if lowered.range(of: pattern, options: .regularExpression) != nil {
                return false
            }
        }
        return true
    }
}

enum HarnessError: Error, LocalizedError {
    case message(String)

    var errorDescription: String? {
        switch self {
        case .message(let message): message
        }
    }
}

final class LockedValue<Value>: @unchecked Sendable {
    private let lock = NSLock()
    private var value: Value

    init(_ value: Value) {
        self.value = value
    }

    func set(_ value: Value) {
        lock.lock()
        self.value = value
        lock.unlock()
    }

    func get() -> Value {
        lock.lock()
        let current = value
        lock.unlock()
        return current
    }
}
