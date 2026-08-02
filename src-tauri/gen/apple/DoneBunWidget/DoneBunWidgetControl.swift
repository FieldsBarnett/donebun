import AppIntents
import SwiftUI
import WidgetKit
import TauriWidgets

private let widgetAppGroup = "group.app.donebun.ios"

/// Control Center / Lock Screen control — completes the next due task (iOS 18+).
@available(iOS 18.0, *)
struct DoneBunWidgetControl: ControlWidget {
    static let kind: String = "app.donebun.ios.DoneBunWidgetControl"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: CompleteNextTaskIntent()) {
                Label("Complete next", systemImage: "checkmark.circle")
            }
        }
        .displayName("Complete Next Task")
        .description("Mark the next upcoming task done in DoneBun.")
    }
}

@available(iOS 18.0, *)
struct CompleteNextTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Complete Next Task"
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult {
        guard
            let tasks = WidgetTaskStore.load(appGroup: widgetAppGroup),
            let first = tasks.first(where: { !$0.completed })
        else { return .result() }

        _ = try await CompleteTaskIntent(taskId: first.id).perform()
        return .result()
    }
}
