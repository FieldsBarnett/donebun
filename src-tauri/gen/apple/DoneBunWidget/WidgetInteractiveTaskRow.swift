import AppIntents
import SwiftUI

/// Shared widget task row.
/// - `interactiveComplete`: checkbox toggles status via App Intent (task list widget).
/// - Large calendar widget uses a separate event row (no task checkboxes).
struct WidgetInteractiveTaskRow: View {
    let task: WidgetTaskRecord
    var compact: Bool = false
    /// When false, checkbox is display-only; tapping the row opens the task.
    var interactiveComplete: Bool = true

    private var iconSize: CGFloat { compact ? 12 : 14 }
    private var titleSize: CGFloat { compact ? 12 : 14 }
    private var timeSize: CGFloat { compact ? 11 : 13 }
    private var timeWidth: CGFloat { compact ? 46 : 54 }
    private var rowHeight: CGFloat { compact ? 22 : 26 }

    var body: some View {
        if interactiveComplete {
            HStack(spacing: compact ? 6 : 8) {
                Button(intent: ToggleTaskStatusIntent(taskId: task.id)) {
                    statusIcon
                }
                .buttonStyle(.plain)

                Button(intent: OpenTaskIntent(taskId: task.id, dateKey: task.dateKey ?? "")) {
                    titleContent
                }
                .buttonStyle(.plain)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            // Calendar: zero checkbox App Intents — whole row opens the task.
            Button(intent: OpenTaskIntent(taskId: task.id, dateKey: task.dateKey ?? "")) {
                HStack(spacing: compact ? 6 : 8) {
                    statusIcon
                    titleContent
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }

    private var statusIcon: some View {
        Image(systemName: task.completed ? "checkmark.circle.fill" : "circle")
            .font(.system(size: iconSize))
            .foregroundStyle(
                task.completed ? DoneBunWidgetTheme.primary : DoneBunWidgetTheme.muted
            )
            .frame(width: rowHeight, height: rowHeight)
            .contentShape(Rectangle())
    }

    private var scheduleLabel: String? {
        let todayKey = Self.localDateKey(Date())
        let isToday = task.dateKey == nil || task.dateKey == todayKey
        let hasTime = !(task.time ?? "").isEmpty

        if isToday {
            return hasTime ? task.time : nil
        }
        let day = Self.shortDayLabel(dateKey: task.dateKey!)
        if hasTime {
            return "\(day) \(task.time!)"
        }
        return day
    }

    private var scheduleWidth: CGFloat {
        let todayKey = Self.localDateKey(Date())
        let isToday = task.dateKey == nil || task.dateKey == todayKey
        return isToday ? timeWidth : (compact ? 62 : 72)
    }

    private var titleContent: some View {
        HStack(spacing: compact ? 6 : 8) {
            if let label = scheduleLabel {
                Text(label)
                    .font(.system(size: timeSize, weight: .medium))
                    .monospacedDigit()
                    .foregroundStyle(DoneBunWidgetTheme.muted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    .allowsTightening(true)
                    .frame(width: scheduleWidth, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Text(task.title)
                .font(.system(size: titleSize))
                .strikethrough(task.completed)
                .foregroundStyle(
                    task.completed ? DoneBunWidgetTheme.muted : DoneBunWidgetTheme.ink
                )
                .lineLimit(1)
                .truncationMode(.tail)
                .multilineTextAlignment(.leading)
                .layoutPriority(1)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, minHeight: rowHeight, maxHeight: rowHeight, alignment: .leading)
        .fixedSize(horizontal: false, vertical: true)
        .contentShape(Rectangle())
    }

    private static func localDateKey(_ date: Date) -> String {
        let c = Calendar.current
        return String(
            format: "%04d-%02d-%02d",
            c.component(.year, from: date),
            c.component(.month, from: date),
            c.component(.day, from: date)
        )
    }

    private static func shortDayLabel(dateKey: String) -> String {
        let parts = dateKey.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return dateKey }
        var c = DateComponents()
        c.year = parts[0]
        c.month = parts[1]
        c.day = parts[2]
        guard let date = Calendar.current.date(from: c) else { return dateKey }
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE"
        return formatter.string(from: date)
    }
}
