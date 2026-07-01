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
        context.coordinator.applyHighlighting(to: textView)
        return scrollView
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        context.coordinator.parent = self
        guard let textView = scrollView.documentView as? NSTextView else { return }
        textView.isEditable = isEditable
        if textView.string != text {
            textView.string = text
            context.coordinator.applyHighlighting(to: textView)
        }
    }

    private static let baseFont = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)

    @MainActor
    final class Coordinator: NSObject, NSTextViewDelegate {
        var parent: PythonCodeEditor
        weak var textView: NSTextView?
        private var isApplyingHighlighting = false

        init(_ parent: PythonCodeEditor) {
            self.parent = parent
        }

        func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }
            parent.text = textView.string
            applyHighlighting(to: textView)
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

            apply(pattern: #"\b\d+(?:\.\d+)?\b"#, color: .systemPink, in: storage, range: fullRange)
            apply(
                pattern: #"\b(async|await|def|class|return|if|elif|else|for|while|in|try|except|finally|with|as|import|from|pass|break|continue|True|False|None|and|or|not|is|lambda|yield|raise|global|nonlocal|assert|del)\b"#,
                color: .systemPurple,
                fontWeight: .semibold,
                in: storage,
                range: fullRange
            )
            apply(
                pattern: #"\b(dict|list|set|tuple|str|int|float|bool|Any|TypedDict|StateGraph|AgentState)\b"#,
                color: .systemTeal,
                in: storage,
                range: fullRange
            )
            applyGroup(pattern: #"\bdef\s+([A-Za-z_][A-Za-z0-9_]*)"#, group: 1, color: .systemBlue, fontWeight: .semibold, in: storage, range: fullRange)
            apply(pattern: #"@[A-Za-z_][A-Za-z0-9_\.]*"#, color: .systemIndigo, in: storage, range: fullRange)
            apply(
                pattern: #"("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')"#,
                color: .systemOrange,
                in: storage,
                range: fullRange
            )
            apply(pattern: #"#.*$"#, color: .systemGreen, options: [.anchorsMatchLines], in: storage, range: fullRange)

            storage.endEditing()

            let safeRanges = selectedRanges.filter { NSMaxRange($0.rangeValue) <= fullRange.length }
            if !safeRanges.isEmpty {
                textView.selectedRanges = safeRanges
            }
        }

        private func apply(
            pattern: String,
            color: NSColor,
            fontWeight: NSFont.Weight = .regular,
            options: NSRegularExpression.Options = [],
            in storage: NSTextStorage,
            range: NSRange
        ) {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: options) else { return }
            for match in regex.matches(in: storage.string, options: [], range: range) {
                storage.addAttribute(.foregroundColor, value: color, range: match.range)
                if fontWeight != .regular {
                    storage.addAttribute(.font, value: NSFont.monospacedSystemFont(ofSize: 12, weight: fontWeight), range: match.range)
                }
            }
        }

        private func applyGroup(
            pattern: String,
            group: Int,
            color: NSColor,
            fontWeight: NSFont.Weight = .regular,
            in storage: NSTextStorage,
            range: NSRange
        ) {
            guard let regex = try? NSRegularExpression(pattern: pattern) else { return }
            for match in regex.matches(in: storage.string, options: [], range: range) where match.numberOfRanges > group {
                let groupRange = match.range(at: group)
                guard groupRange.location != NSNotFound else { continue }
                storage.addAttribute(.foregroundColor, value: color, range: groupRange)
                if fontWeight != .regular {
                    storage.addAttribute(.font, value: NSFont.monospacedSystemFont(ofSize: 12, weight: fontWeight), range: groupRange)
                }
            }
        }
    }
}
