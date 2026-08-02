import WidgetKit
import SwiftUI
import TauriWidgets

private let widgetAppGroup = "group.app.donebun.ios"

struct DoneBunWidget: Widget {
    let kind = "DoneBunTodayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: TauriWidgetProvider(appGroup: widgetAppGroup)
        ) { entry in
            DoneBunWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("DoneBun")
        .description("Upcoming tasks — tap a row to complete.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

struct DoneBunWidgetEntryView: View {
    var entry: TauriWidgetEntry

    private var showVoiceOverlay: Bool {
        guard entry.config != nil, WidgetAuthStore.isSignedIn(appGroup: widgetAppGroup) else {
            return false
        }
        if entry.family == .systemSmall { return true }
        return WidgetTaskStore.load(appGroup: widgetAppGroup) == nil
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Group {
                if entry.config == nil {
                    DoneBunWidgetEmptyView(state: .needsSetup, family: entry.family)
                } else if entry.family == .systemSmall {
                    TauriWidgetView(entry: entry)
                } else if WidgetAuthStore.isSignedIn(appGroup: widgetAppGroup),
                          let tasks = WidgetTaskStore.load(appGroup: widgetAppGroup) {
                    InteractiveTaskListView(tasks: tasks, appGroup: widgetAppGroup)
                } else {
                    TauriWidgetView(entry: entry)
                }
            }

            if showVoiceOverlay {
                WidgetVoiceButton()
                    .padding(10)
            }
        }
        .containerBackground(for: .widget) {
            DoneBunWidgetTheme.canvas
        }
    }
}
