import Foundation

/// App Group helpers shared by the widget extension and the host app.
/// Open intents use `openAppWhenRun` and must compile into both targets (Apple requirement).
enum WidgetOpenHelpers {
    static let appGroup = "group.app.donebun.ios"
    static let openActionKey = "widget_open_action"

    /// Same on-disk format as `TauriWidgetDataStore.writeValue`.
    static func writeOpenAction(_ value: String) {
        guard
            let container = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: appGroup
            )
        else { return }
        let url = container.appendingPathComponent("widget_data.json")
        var map: [String: String] = [:]
        if let data = try? Data(contentsOf: url),
           let existing = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
            map = existing
        }
        map[openActionKey] = value
        if let out = try? JSONSerialization.data(
            withJSONObject: map,
            options: [.prettyPrinted, .sortedKeys]
        ) {
            try? out.write(to: url, options: .atomic)
        }
    }

    static func writeTaskOpenAction(taskId: String, dateKey: String) {
        var payload: [String: String] = [
            "kind": "task",
            "taskId": taskId,
        ]
        if !dateKey.isEmpty {
            payload["dateKey"] = dateKey
        }
        guard
            let data = try? JSONSerialization.data(withJSONObject: payload),
            let str = String(data: data, encoding: .utf8)
        else { return }
        writeOpenAction(str)
    }
}
