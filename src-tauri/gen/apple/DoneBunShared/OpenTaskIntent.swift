import AppIntents
import Foundation

/// Opens DoneBun to a specific task (title tap on widget rows).
///
/// Must be a member of **both** the app and widget extension targets when
/// `openAppWhenRun` is true — otherwise interactive controls render as yellow
/// stop overlays and navigation never reaches the host app.
struct OpenTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Task"
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Task ID")
    var taskId: String

    @Parameter(title: "Date Key")
    var dateKey: String

    init() {
        self.taskId = ""
        self.dateKey = ""
    }

    init(taskId: String, dateKey: String = "") {
        self.taskId = taskId
        self.dateKey = dateKey
    }

    func perform() async throws -> some IntentResult {
        guard !taskId.isEmpty else { return .result() }
        WidgetOpenHelpers.writeTaskOpenAction(taskId: taskId, dateKey: dateKey)
        // Tiny delay so App Group file flush lands before cold-start WebView boots.
        try? await Task.sleep(nanoseconds: 50_000_000)
        return .result()
    }
}
