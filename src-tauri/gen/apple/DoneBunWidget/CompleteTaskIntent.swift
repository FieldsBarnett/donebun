import AppIntents
import Foundation

/// Completes a task (Control Center / “complete next”). Uses toggle on an incomplete task.
struct CompleteTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Complete Task"
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Task ID")
    var taskId: String

    init() {
        self.taskId = ""
    }

    init(taskId: String) {
        self.taskId = taskId
    }

    func perform() async throws -> some IntentResult {
        guard !taskId.isEmpty else { return .result() }
        _ = try await ToggleTaskStatusIntent(taskId: taskId).perform()
        return .result()
    }
}

struct WidgetTaskRecord: Codable {
    let id: String
    let title: String
    let time: String?
    let dateKey: String?
    let isOverdue: Bool
    var completed: Bool

    init(
        id: String,
        title: String,
        time: String?,
        dateKey: String? = nil,
        isOverdue: Bool,
        completed: Bool = false
    ) {
        self.id = id
        self.title = title
        self.time = time
        self.dateKey = dateKey
        self.isOverdue = isOverdue
        self.completed = completed
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decode(String.self, forKey: .title)
        time = try c.decodeIfPresent(String.self, forKey: .time)
        dateKey = try c.decodeIfPresent(String.self, forKey: .dateKey)
        isOverdue = try c.decodeIfPresent(Bool.self, forKey: .isOverdue) ?? false
        completed = try c.decodeIfPresent(Bool.self, forKey: .completed) ?? false
    }
}
