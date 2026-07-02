import AppKit
import SwiftUI

@main
struct MacAgentFlowApp: App {
    @StateObject private var store = WorkspaceStore()

    init() {
        NSApplication.shared.setActivationPolicy(.regular)
        DispatchQueue.main.async {
            NSApplication.shared.activate(ignoringOtherApps: true)
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .frame(minWidth: 1260, minHeight: 780)
        }
        .commands {
            CommandGroup(replacing: .undoRedo) {
                Button("Undo") {
                    store.undo()
                }
                .keyboardShortcut("z", modifiers: [.command])
                .disabled(!store.canUndo)

                Button("Redo") {
                    store.redo()
                }
                .keyboardShortcut("z", modifiers: [.command, .shift])
                .disabled(!store.canRedo)
            }

            CommandMenu("Agent") {
                Button("New Agent") {
                    store.createAgent()
                }
                .keyboardShortcut("n", modifiers: [.command])

                Button("Trigger Run") {
                    store.triggerManualRun()
                }
                .keyboardShortcut("r", modifiers: [.command])
                .disabled(store.isManualRunPreflightInProgress)
            }

            CommandMenu("Selection") {
                Button("Copy Node") {
                    performCopyCommand()
                }
                .keyboardShortcut("c", modifiers: [.command])

                Button("Paste Node") {
                    performPasteCommand()
                }
                .keyboardShortcut("v", modifiers: [.command])

                Button("Delete Selection") {
                    store.deleteSelection()
                }
                .keyboardShortcut(.delete, modifiers: [])
                .disabled(!store.canDeleteSelection)
            }
        }
    }

    private func performCopyCommand() {
        if Self.forwardTextCommand(#selector(NSText.copy(_:))) { return }
        store.copySelection()
    }

    private func performPasteCommand() {
        if Self.forwardTextCommand(#selector(NSText.paste(_:))) { return }
        store.pasteSelection()
    }

    private static func forwardTextCommand(_ selector: Selector) -> Bool {
        guard NSApp.keyWindow?.firstResponder is NSTextView else { return false }
        return NSApp.sendAction(selector, to: nil, from: nil)
    }
}
