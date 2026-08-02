import Foundation

/// Custom-scheme URLs used by widget `Link`s (not App Intents).
/// Keeps interactive App Intent count low — calendar day grids otherwise exhaust
/// WidgetKit’s slot budget and leave task rows showing yellow/broken overlays.
enum WidgetDeepLinks {
    static func timeline(dateKey: String) -> URL {
        URL(string: "donebun://timeline?date=\(dateKey)")!
    }

    static func task(taskId: String, dateKey: String?) -> URL {
        var components = URLComponents()
        components.scheme = "donebun"
        components.host = "task"
        var items = [URLQueryItem(name: "id", value: taskId)]
        if let dateKey, !dateKey.isEmpty {
            items.append(URLQueryItem(name: "date", value: dateKey))
        }
        components.queryItems = items
        return components.url ?? URL(string: "donebun://today")!
    }

    static var voice: URL {
        URL(string: "donebun://voice")!
    }

    static var today: URL {
        URL(string: "donebun://today")!
    }
}
