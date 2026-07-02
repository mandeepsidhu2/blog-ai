import AppKit
import SwiftUI

struct PythonCodeEditor: NSViewRepresentable {
    @Binding var text: String
    var isEditable: Bool

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSScrollView()
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = true
        scrollView.autohidesScrollers = false
        scrollView.borderType = .noBorder
        scrollView.drawsBackground = true
        scrollView.backgroundColor = .textBackgroundColor

        let textView = NSTextView()
        textView.delegate = context.coordinator
        textView.string = text
        textView.isEditable = isEditable
        textView.isSelectable = true
        textView.allowsUndo = true
        textView.isRichText = false
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticTextReplacementEnabled = false
        textView.importsGraphics = false
        textView.font = Self.baseFont
        textView.textContainerInset = NSSize(width: 11, height: 10)
        textView.backgroundColor = .textBackgroundColor
        textView.textColor = .labelColor
        textView.minSize = NSSize(width: 0, height: 0)
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = true
        textView.autoresizingMask = [.width]
        textView.textContainer?.containerSize = NSSize(
            width: CGFloat.greatestFiniteMagnitude,
            height: CGFloat.greatestFiniteMagnitude
        )
        textView.textContainer?.widthTracksTextView = false

        scrollView.documentView = textView
        context.coordinator.textView = textView
        context.coordinator.scheduleHighlighting(to: textView)
        return scrollView
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        context.coordinator.parent = self
        guard let textView = scrollView.documentView as? NSTextView else { return }
        textView.isEditable = isEditable
        if textView.string != text {
            textView.string = text
            context.coordinator.scheduleHighlighting(to: textView)
        }
    }

    private static let baseFont = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
    private static let semiboldFont = NSFont.monospacedSystemFont(ofSize: 12, weight: .semibold)

    private struct HighlightRule {
        var regex: NSRegularExpression
        var color: NSColor
        var fontWeight: NSFont.Weight
        var captureGroup: Int?
    }

    private static let highlightRules: [HighlightRule] = [
        HighlightRule(regex: regex(#"\b\d+(?:\.\d+)?\b"#), color: .systemPink, fontWeight: .regular, captureGroup: nil),
        HighlightRule(
            regex: regex(#"\b(async|await|def|class|return|if|elif|else|for|while|in|try|except|finally|with|as|import|from|pass|break|continue|True|False|None|and|or|not|is|lambda|yield|raise|global|nonlocal|assert|del)\b"#),
            color: .systemPurple,
            fontWeight: .semibold,
            captureGroup: nil
        ),
        HighlightRule(
            regex: regex(#"\b(dict|list|set|tuple|str|int|float|bool|Any|TypedDict|StateGraph|AgentState)\b"#),
            color: .systemTeal,
            fontWeight: .regular,
            captureGroup: nil
        ),
        HighlightRule(regex: regex(#"\bdef\s+([A-Za-z_][A-Za-z0-9_]*)"#), color: .systemBlue, fontWeight: .semibold, captureGroup: 1),
        HighlightRule(regex: regex(#"@[A-Za-z_][A-Za-z0-9_\.]*"#), color: .systemIndigo, fontWeight: .regular, captureGroup: nil),
        HighlightRule(
            regex: regex(#"("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')"#),
            color: .systemOrange,
            fontWeight: .regular,
            captureGroup: nil
        ),
        HighlightRule(regex: regex(#"#.*$"#, options: [.anchorsMatchLines]), color: .systemGreen, fontWeight: .regular, captureGroup: nil)
    ]

    private static func regex(_ pattern: String, options: NSRegularExpression.Options = []) -> NSRegularExpression {
        do {
            return try NSRegularExpression(pattern: pattern, options: options)
        } catch {
            assertionFailure("Invalid Python syntax highlight regex: \(error)")
            return try! NSRegularExpression(pattern: #"a\A"#)
        }
    }

    @MainActor
    final class Coordinator: NSObject, NSTextViewDelegate {
        var parent: PythonCodeEditor
        weak var textView: NSTextView?
        private var isApplyingHighlighting = false
        private var highlightWorkItem: DispatchWorkItem?

        init(_ parent: PythonCodeEditor) {
            self.parent = parent
        }

        func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }
            parent.text = textView.string
            scheduleHighlighting(to: textView)
        }

        func scheduleHighlighting(to textView: NSTextView) {
            highlightWorkItem?.cancel()
            let item = DispatchWorkItem { [weak self, weak textView] in
                guard let self, let textView else { return }
                self.applyHighlighting(to: textView)
            }
            highlightWorkItem = item
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.035, execute: item)
        }

        func applyHighlighting(to textView: NSTextView) {
            guard !isApplyingHighlighting, let storage = textView.textStorage else { return }
            isApplyingHighlighting = true
            defer { isApplyingHighlighting = false }

            let selectedRanges = textView.selectedRanges
            let fullRange = NSRange(location: 0, length: (storage.string as NSString).length)
            guard fullRange.length > 0 else { return }

            storage.beginEditing()
            storage.setAttributes([
                .font: PythonCodeEditor.baseFont,
                .foregroundColor: NSColor.labelColor
            ], range: fullRange)

            for rule in PythonCodeEditor.highlightRules {
                apply(rule: rule, in: storage, range: fullRange)
            }

            storage.endEditing()

            let safeRanges = selectedRanges.filter { NSMaxRange($0.rangeValue) <= fullRange.length }
            if !safeRanges.isEmpty {
                textView.selectedRanges = safeRanges
            }
        }

        private func apply(rule: PythonCodeEditor.HighlightRule, in storage: NSTextStorage, range: NSRange) {
            for match in rule.regex.matches(in: storage.string, options: [], range: range) {
                let highlightRange: NSRange
                if let captureGroup = rule.captureGroup {
                    guard match.numberOfRanges > captureGroup else { continue }
                    let groupRange = match.range(at: captureGroup)
                    guard groupRange.location != NSNotFound else { continue }
                    highlightRange = groupRange
                } else {
                    highlightRange = match.range
                }
                storage.addAttribute(.foregroundColor, value: rule.color, range: highlightRange)
                if rule.fontWeight != .regular {
                    storage.addAttribute(.font, value: PythonCodeEditor.semiboldFont, range: highlightRange)
                }
            }
        }
    }
}
