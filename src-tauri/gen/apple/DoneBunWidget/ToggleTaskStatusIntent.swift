import AppIntents
import Foundation
import WidgetKit
import TauriWidgets

private let appGroup = "group.app.donebun.ios"
private let pendingStatusKey = "widget_pending_status_updates"
private let pendingCompletesKey = "widget_pending_completes"
private let moveTasksPrefKey = "widget_move_tasks_preference"

/// Toggles a task completed ↔ active from the widget checkbox.
struct ToggleTaskStatusIntent: AppIntent {
    static var title: LocalizedStringResource = "Toggle Task"
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

        let currentlyCompleted = currentCompletedState(taskId: taskId)
        let newStatus = currentlyCompleted ? "active" : "completed"

        queuePendingStatus(taskId: taskId, status: newStatus)

        let token = TauriWidgetDataStore.readValue(forKey: "widget_auth_token", appGroup: appGroup)
        let convexUrl = TauriWidgetDataStore.readValue(forKey: "widget_convex_url", appGroup: appGroup)

        if let token, let convexUrl, let base = URL(string: convexUrl) {
            _ = await updateViaConvex(taskId: taskId, status: newStatus, token: token, convexUrl: base)
        }

        applyLocalStatus(taskId: taskId, status: newStatus)
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }

    private func currentCompletedState(taskId: String) -> Bool {
        guard
            let raw = TauriWidgetDataStore.readValue(forKey: "widget_tasks", appGroup: appGroup),
            let data = raw.data(using: .utf8),
            let tasks = try? JSONDecoder().decode([WidgetTaskRecord].self, from: data),
            let task = tasks.first(where: { $0.id == taskId })
        else { return false }
        return task.completed
    }

    @discardableResult
    private func updateViaConvex(
        taskId: String,
        status: String,
        token: String,
        convexUrl: URL
    ) async -> Bool {
        let endpoint = convexUrl.appendingPathComponent("api/mutation")
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let body: [String: Any] = [
            "path": "tasks:updateTaskStatus",
            "args": [
                "id": taskId,
                "status": status,
            ],
            "format": "json",
        ]

        guard let data = try? JSONSerialization.data(withJSONObject: body) else { return false }
        request.httpBody = data

        do {
            let (responseData, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { return false }
            if (200..<300).contains(http.statusCode) {
                return true
            }
            let text = String(data: responseData, encoding: .utf8) ?? ""
            print("ToggleTaskStatusIntent Convex error \(http.statusCode): \(text)")
            return false
        } catch {
            print("ToggleTaskStatusIntent network error: \(error)")
            return false
        }
    }

    private func queuePendingStatus(taskId: String, status: String) {
        var pending: [PendingStatusUpdate] = []
        if let raw = TauriWidgetDataStore.readValue(forKey: pendingStatusKey, appGroup: appGroup),
           let data = raw.data(using: .utf8),
           let arr = try? JSONDecoder().decode([PendingStatusUpdate].self, from: data) {
            pending = arr
        }
        pending.removeAll { $0.id == taskId }
        pending.append(PendingStatusUpdate(id: taskId, status: status))
        if let out = try? JSONEncoder().encode(pending),
           let str = String(data: out, encoding: .utf8) {
            TauriWidgetDataStore.writeValue(str, forKey: pendingStatusKey, appGroup: appGroup)
        }

        // Clear legacy complete-only queue entry for this id if present.
        if let raw = TauriWidgetDataStore.readValue(forKey: pendingCompletesKey, appGroup: appGroup),
           let data = raw.data(using: .utf8),
           var ids = try? JSONDecoder().decode([String].self, from: data) {
            ids.removeAll { $0 == taskId }
            if let out = try? JSONEncoder().encode(ids),
               let str = String(data: out, encoding: .utf8) {
                TauriWidgetDataStore.writeValue(str, forKey: pendingCompletesKey, appGroup: appGroup)
            }
        }
    }

    private func moveTasksPreference() -> String {
        TauriWidgetDataStore.readValue(forKey: moveTasksPrefKey, appGroup: appGroup) ?? "next_day"
    }

    private func applyLocalStatus(taskId: String, status: String) {
        guard
            let raw = TauriWidgetDataStore.readValue(forKey: "widget_tasks", appGroup: appGroup),
            let data = raw.data(using: .utf8),
            var tasks = try? JSONDecoder().decode([WidgetTaskRecord].self, from: data)
        else { return }

        let completed = status == "completed"
        let preference = moveTasksPreference()

        if completed && preference == "immediately" {
            tasks.removeAll { $0.id == taskId }
        } else {
            tasks = tasks.map { task in
                guard task.id == taskId else { return task }
                return WidgetTaskRecord(
                    id: task.id,
                    title: task.title,
                    time: task.time,
                    dateKey: task.dateKey,
                    isOverdue: completed ? false : task.isOverdue,
                    completed: completed
                )
            }
        }

        // Keep day-first, completed-last ordering after local toggle.
        tasks.sort { a, b in
            let dayA = a.dateKey ?? "9999-99-99"
            let dayB = b.dateKey ?? "9999-99-99"
            if dayA != dayB { return dayA < dayB }
            if a.completed != b.completed { return !a.completed && b.completed }
            return a.title.localizedCaseInsensitiveCompare(b.title) == .orderedAscending
        }

        if let out = try? JSONEncoder().encode(tasks),
           let str = String(data: out, encoding: .utf8) {
            TauriWidgetDataStore.writeValue(str, forKey: "widget_tasks", appGroup: appGroup)
        }
    }
}

struct PendingStatusUpdate: Codable {
    let id: String
    let status: String
}
