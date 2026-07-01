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
                    store.triggerRun()
                }
                .keyboardShortcut("r", modifiers: [.command])
            }

            CommandMenu("Selection") {
                Button("Copy Node") {
                    store.copySelection()
                }
                .keyboardShortcut("c", modifiers: [.command])
                .disabled(!store.canCopySelection)

                Button("Paste Node") {
                    store.pasteSelection()
                }
                .keyboardShortcut("v", modifiers: [.command])
                .disabled(!store.canPasteSelection)

                Button("Delete Selection") {
                    store.deleteSelection()
                }
                .keyboardShortcut(.delete, modifiers: [])
                .disabled(!store.canDeleteSelection)
            }
        }
    }
}
