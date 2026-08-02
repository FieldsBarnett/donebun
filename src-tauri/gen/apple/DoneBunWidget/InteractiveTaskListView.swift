import SwiftUI
import TauriWidgets
import WidgetKit

struct InteractiveTaskListView: View {
    @Environment(\.widgetFamily) private var family
    let tasks: [WidgetTaskRecord]
    let appGroup: String

    /// Medium = short wide rectangle (4 rows); large = big block (10 rows).
    private var maxTasks: Int {
        switch family {
        case .systemLarge: return 10
        case .systemMedium: return 4
        default: return 4
        }
    }

    /// Day ascending, then incomplete before completed within the same day.
    private var sortedTasks: [WidgetTaskRecord] {
        tasks.sorted { a, b in
            let dayA = a.dateKey ?? "9999-99-99"
            let dayB = b.dateKey ?? "9999-99-99"
            if dayA != dayB { return dayA < dayB }
            if a.completed != b.completed { return !a.completed && b.completed }
            return a.title.localizedCaseInsensitiveCompare(b.title) == .orderedAscending
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text("★")
                    .font(.system(size: 16))
                    .foregroundStyle(DoneBunWidgetTheme.yellow)
                Text("Tasks")
                    .font(.headline.bold())
                    .foregroundStyle(DoneBunWidgetTheme.ink)
                Spacer(minLength: 0)
                WidgetVoiceButton()
            }

            if tasks.isEmpty {
                Text("All clear — no upcoming tasks")
                    .font(.footnote)
                    .foregroundStyle(DoneBunWidgetTheme.muted)
            } else {
                ForEach(sortedTasks.prefix(maxTasks), id: \.id) { task in
                    WidgetInteractiveTaskRow(task: task)
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

enum WidgetAuthStore {
    static func isSignedIn(appGroup: String) -> Bool {
        TauriWidgetDataStore.readValue(forKey: "widget_auth_token", appGroup: appGroup) != nil
    }
}

enum WidgetTaskStore {
    static func load(appGroup: String) -> [WidgetTaskRecord]? {
        guard
            let raw = TauriWidgetDataStore.readValue(forKey: "widget_tasks", appGroup: appGroup),
            let data = raw.data(using: .utf8),
            let tasks = try? JSONDecoder().decode([WidgetTaskRecord].self, from: data)
        else { return nil }
        return tasks
    }
}
