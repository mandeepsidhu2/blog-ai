import Foundation

struct CodingHarnessPlan {
    var summary: String
    var fileEdits: [FileEdit]
    var testCommand: String?
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

        let edits = rawEdits.compactMap { edit -> FileEdit? in
            guard let path = edit["path"] as? String ?? edit["file"] as? String,
                  let content = edit["content"] as? String
            else { return nil }
            return FileEdit(path: path, content: content)
        }

        return CodingHarnessPlan(summary: summary, fileEdits: edits, testCommand: testCommand)
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
    static func apply(_ edits: [FileEdit], rootURL: URL) -> (changedFiles: [String], logLines: [String], errorMessage: String?) {
        var changed: [String] = []
        var logs: [String] = []
        for edit in edits {
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
        if edits.isEmpty {
            logs.append("Coding harness: model returned no file edits")
        }
        return (changed, logs, nil)
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
    Edit files by returning complete replacement content for each changed file.
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
        CodingHarnessDirectives.parseRepositoryURL(text)
    }

    public static func testCommand(from text: String) -> String? {
        CodingHarnessDirectives.parse(text).testCommand
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
        guard let value = parseLineDirective(text, keys: ["repo", "repository", "cwd", "workspace"]) else { return nil }
        return URL(fileURLWithPath: NSString(string: value).expandingTildeInPath)
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
    static func complete(model: LLMModelConfig, systemPrompt: String, userPrompt: String) throws -> String {
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

        let body: [String: Any] = [
            "model": model.modelName,
            "temperature": 0.1,
            "messages": [
                ["role": "system", "content": systemPrompt],
                ["role": "user", "content": userPrompt]
            ]
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let responseData = LockedValue<Data?>(nil)
        let responseErrorMessage = LockedValue<String?>(nil)
        let semaphore = DispatchSemaphore(value: 0)
        URLSession.shared.dataTask(with: request) { data, _, error in
            responseData.set(data)
            responseErrorMessage.set(error?.localizedDescription)
            semaphore.signal()
        }.resume()
        _ = semaphore.wait(timeout: .now() + 240)

        if let responseErrorMessage = responseErrorMessage.get() {
            throw HarnessError.message(responseErrorMessage)
        }
        guard let data = responseData.get() else { throw HarnessError.message("No model response data.") }
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw HarnessError.message("Model response was not JSON.")
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
        return content
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
