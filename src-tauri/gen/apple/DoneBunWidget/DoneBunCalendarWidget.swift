import WidgetKit
import SwiftUI
import TauriWidgets

private let widgetAppGroup = "group.app.donebun.ios"
private let calendarKey = "widget_calendar_month"
private let calendarEventsKey = "widget_calendar_events"

// MARK: - Snapshot models

struct WidgetCalendarEventRecord: Codable, Identifiable {
    let id: String
    let title: String
    let time: String?
    let dateKey: String
    let isAllDay: Bool
}

struct CalendarMonthSnapshot: Codable {
    let year: Int
    let month: Int
    let today: String
    let days: [String: Int]
    /// Embedded upcoming events (preferred). Optional for older snapshots.
    let upcomingEvents: [WidgetCalendarEventRecord]?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        year = try c.decode(Int.self, forKey: .year)
        month = try c.decode(Int.self, forKey: .month)
        today = try c.decode(String.self, forKey: .today)
        days = try c.decode([String: Int].self, forKey: .days)
        // Don't fail the whole month snapshot if events decode poorly.
        upcomingEvents = try? c.decodeIfPresent([WidgetCalendarEventRecord].self, forKey: .upcomingEvents) ?? nil
    }
}

struct CalendarDayCell: Identifiable {
    let id: String
    let day: Int
    let dateKey: String
    let isCurrentMonth: Bool
    let isToday: Bool
    let taskCount: Int
}

struct CalendarMonthEntry: TimelineEntry {
    let date: Date
    let snapshot: CalendarMonthSnapshot?
    let cells: [CalendarDayCell]
    let monthTitle: String
    let upcomingEvents: [WidgetCalendarEventRecord]
}

// MARK: - Provider

struct CalendarMonthProvider: TimelineProvider {
    func placeholder(in context: Context) -> CalendarMonthEntry {
        makeEntry(snapshot: nil, now: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (CalendarMonthEntry) -> Void) {
        completion(makeEntry(snapshot: CalendarMonthStore.load(), now: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CalendarMonthEntry>) -> Void) {
        let now = Date()
        let entry = makeEntry(snapshot: CalendarMonthStore.load(), now: now)
        // Refresh at midnight so "today" highlight rolls over.
        let midnight = Calendar.current.startOfDay(for: now).addingTimeInterval(86_400)
        completion(Timeline(entries: [entry], policy: .after(midnight)))
    }

    private func makeEntry(snapshot: CalendarMonthSnapshot?, now: Date) -> CalendarMonthEntry {
        let cal = Calendar.current
        let year = snapshot?.year ?? cal.component(.year, from: now)
        let month = snapshot?.month ?? cal.component(.month, from: now)
        let todayKey = snapshot?.today ?? Self.localDateKey(now)
        let counts = snapshot?.days ?? [:]

        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = 1
        let firstOfMonth = cal.date(from: components) ?? now

        let cells = Self.buildCells(
            year: year,
            month: month,
            todayKey: todayKey,
            counts: counts,
            calendar: cal,
            firstOfMonth: firstOfMonth
        )

        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        let title = formatter.string(from: firstOfMonth)

        // Prefer events embedded in the month snapshot (same write as the grid).
        // Fall back to the dedicated key for older app builds.
        let events =
            snapshot?.upcomingEvents
            ?? CalendarEventsStore.load(appGroup: widgetAppGroup)
            ?? []

        return CalendarMonthEntry(
            date: now,
            snapshot: snapshot,
            cells: cells,
            monthTitle: title,
            upcomingEvents: events
        )
    }

    static func localDateKey(_ date: Date) -> String {
        let c = Calendar.current
        let y = c.component(.year, from: date)
        let m = c.component(.month, from: date)
        let d = c.component(.day, from: date)
        return String(format: "%04d-%02d-%02d", y, m, d)
    }

    static func buildCells(
        year: Int,
        month: Int,
        todayKey: String,
        counts: [String: Int],
        calendar: Calendar,
        firstOfMonth: Date
    ) -> [CalendarDayCell] {
        let range = calendar.range(of: .day, in: .month, for: firstOfMonth) ?? 1..<31
        let firstWeekday = calendar.component(.weekday, from: firstOfMonth) // 1=Sun
        let leading = (firstWeekday - calendar.firstWeekday + 7) % 7

        var cells: [CalendarDayCell] = []

        // Leading padding from previous month
        if leading > 0,
           let prevMonthDate = calendar.date(byAdding: .day, value: -leading, to: firstOfMonth) {
            for offset in 0..<leading {
                guard let date = calendar.date(byAdding: .day, value: offset, to: prevMonthDate) else { continue }
                let key = localDateKey(date)
                cells.append(
                    CalendarDayCell(
                        id: key,
                        day: calendar.component(.day, from: date),
                        dateKey: key,
                        isCurrentMonth: false,
                        isToday: key == todayKey,
                        taskCount: 0
                    )
                )
            }
        }

        for day in range {
            let key = String(format: "%04d-%02d-%02d", year, month, day)
            cells.append(
                CalendarDayCell(
                    id: key,
                    day: day,
                    dateKey: key,
                    isCurrentMonth: true,
                    isToday: key == todayKey,
                    taskCount: counts[key] ?? 0
                )
            )
        }

        // Trailing padding to complete the last week
        while cells.count % 7 != 0 {
            let lastKey = cells.last?.dateKey ?? todayKey
            guard
                let lastDate = dateFromKey(lastKey, calendar: calendar),
                let next = calendar.date(byAdding: .day, value: 1, to: lastDate)
            else { break }
            let key = localDateKey(next)
            cells.append(
                CalendarDayCell(
                    id: key,
                    day: calendar.component(.day, from: next),
                    dateKey: key,
                    isCurrentMonth: false,
                    isToday: key == todayKey,
                    taskCount: 0
                )
            )
        }

        return cells
    }

    static func dateFromKey(_ key: String, calendar: Calendar) -> Date? {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var c = DateComponents()
        c.year = parts[0]
        c.month = parts[1]
        c.day = parts[2]
        return calendar.date(from: c)
    }
}

enum CalendarMonthStore {
    static func load(appGroup: String = widgetAppGroup) -> CalendarMonthSnapshot? {
        guard
            let raw = TauriWidgetDataStore.readValue(forKey: calendarKey, appGroup: appGroup),
            let data = raw.data(using: .utf8),
            let snapshot = try? JSONDecoder().decode(CalendarMonthSnapshot.self, from: data)
        else { return nil }
        return snapshot
    }
}

enum CalendarEventsStore {
    static func load(appGroup: String = widgetAppGroup) -> [WidgetCalendarEventRecord]? {
        guard
            let raw = TauriWidgetDataStore.readValue(forKey: calendarEventsKey, appGroup: appGroup),
            let data = raw.data(using: .utf8),
            let events = try? JSONDecoder().decode([WidgetCalendarEventRecord].self, from: data)
        else { return nil }
        return events
    }
}

// MARK: - Widget

struct DoneBunCalendarWidget: Widget {
    let kind = "DoneBunCalendarWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CalendarMonthProvider()) { entry in
            CalendarMonthWidgetView(entry: entry)
        }
        .configurationDisplayName("DoneBun Calendar")
        .description("Month grid — large size also shows upcoming calendar events.")
        .supportedFamilies([.systemSmall, .systemLarge])
        .contentMarginsDisabled()
    }
}

// MARK: - Layout metrics per family

private struct CalendarLayout {
    let padding: CGFloat
    let titleFont: Font
    let weekdayFont: Font
    let dayFontSize: CGFloat
    let dayCircle: CGFloat
    let dayMinHeight: CGFloat
    let rowSpacing: CGFloat
    let stackSpacing: CGFloat
    let showWeekdayHeader: Bool
    let showMonthYear: Bool
    let maxDots: Int
    let dotSize: CGFloat
    let abbreviatedTitle: Bool
    let showEventList: Bool

    static func forFamily(_ family: WidgetFamily) -> CalendarLayout {
        switch family {
        case .systemSmall:
            return CalendarLayout(
                padding: 10,
                titleFont: .system(size: 13, weight: .bold),
                weekdayFont: .system(size: 8, weight: .semibold),
                dayFontSize: 10,
                dayCircle: 18,
                dayMinHeight: 22,
                rowSpacing: 1,
                stackSpacing: 3,
                showWeekdayHeader: true,
                showMonthYear: true,
                maxDots: 1,
                dotSize: 3,
                abbreviatedTitle: true,
                showEventList: false
            )
        default:
            // Large square — slightly tighter calendar so upcoming events fit below.
            return CalendarLayout(
                padding: 12,
                titleFont: .system(size: 15, weight: .bold),
                weekdayFont: .system(size: 10, weight: .semibold),
                dayFontSize: 12,
                dayCircle: 22,
                dayMinHeight: 28,
                rowSpacing: 1,
                stackSpacing: 4,
                showWeekdayHeader: true,
                showMonthYear: true,
                maxDots: 2,
                dotSize: 3.5,
                abbreviatedTitle: false,
                showEventList: true
            )
        }
    }
}

// MARK: - View

struct CalendarMonthWidgetView: View {
    @Environment(\.widgetFamily) private var family
    var entry: CalendarMonthEntry

    private var layout: CalendarLayout { .forFamily(family) }

    var body: some View {
        VStack(alignment: .leading, spacing: layout.stackSpacing) {
            if layout.showMonthYear {
                Text(titleText)
                    .font(layout.titleFont)
                    .foregroundStyle(DoneBunWidgetTheme.ink)
                    .lineLimit(1)
            }

            if layout.showWeekdayHeader {
                weekdayHeader
            }

            VStack(spacing: layout.rowSpacing) {
                ForEach(weekRows.indices, id: \.self) { rowIndex in
                    HStack(spacing: 0) {
                        ForEach(weekRows[rowIndex]) { cell in
                            dayCell(cell)
                        }
                    }
                }
            }

            if layout.showEventList {
                upcomingEventsSection
            } else {
                Spacer(minLength: 0)
            }
        }
        .padding(layout.padding)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(for: .widget) {
            DoneBunWidgetTheme.canvas
        }
    }

    private var titleText: String {
        if layout.abbreviatedTitle {
            let parts = entry.monthTitle.split(separator: " ")
            if let month = parts.first {
                return String(month)
            }
        }
        return entry.monthTitle
    }

    private var weekRows: [[CalendarDayCell]] {
        stride(from: 0, to: entry.cells.count, by: 7).map { start in
            Array(entry.cells[start..<min(start + 7, entry.cells.count)])
        }
    }

    private var weekdayHeader: some View {
        let symbols = Calendar.current.veryShortWeekdaySymbols
        let first = Calendar.current.firstWeekday - 1
        let ordered = Array(symbols[first...]) + Array(symbols[..<first])
        return HStack(spacing: 0) {
            ForEach(Array(ordered.enumerated()), id: \.offset) { _, symbol in
                Text(symbol)
                    .font(layout.weekdayFont)
                    .foregroundStyle(DoneBunWidgetTheme.muted)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    @ViewBuilder
    private var upcomingEventsSection: some View {
        Divider()
            .padding(.vertical, 2)

        HStack(spacing: 4) {
            Text("★")
                .font(.system(size: 12))
                .foregroundStyle(DoneBunWidgetTheme.yellow)
            Text("Upcoming")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(DoneBunWidgetTheme.ink)
            Spacer(minLength: 0)
            WidgetVoiceButton(compact: true)
        }

        if entry.upcomingEvents.isEmpty {
            Text("No upcoming events")
                .font(.system(size: 12))
                .foregroundStyle(DoneBunWidgetTheme.muted)
            Spacer(minLength: 0)
        } else {
            // No checkbox App Intents — rows open the day in Timeline;
            // mic is the only other App Intent in this section.
            VStack(alignment: .leading, spacing: 4) {
                // Hard cap — large calendar is not scrollable; extra rows clip badly.
                ForEach(entry.upcomingEvents.prefix(4), id: \.id) { event in
                    WidgetCalendarEventRow(event: event)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    @ViewBuilder
    private func dayCell(_ cell: CalendarDayCell) -> some View {
        let content = VStack(spacing: 1) {
            Text("\(cell.day)")
                .font(.system(size: layout.dayFontSize, weight: cell.isToday ? .bold : .medium))
                .foregroundStyle(dayForeground(cell))
                .frame(width: layout.dayCircle, height: layout.dayCircle)
                .background {
                    if cell.isToday {
                        Circle().fill(DoneBunWidgetTheme.primary)
                    }
                }

            taskDots(count: cell.taskCount, dimmed: !cell.isCurrentMonth)
                .frame(height: layout.dotSize + 1)
        }
        .frame(maxWidth: .infinity, minHeight: layout.dayMinHeight)

        if cell.isCurrentMonth {
            // Link (not App Intent): a full month of Button(intent:) exhausts WidgetKit's
            // interactive budget and leaves the event list with yellow broken overlays.
            Link(destination: WidgetDeepLinks.timeline(dateKey: cell.dateKey)) {
                content
            }
        } else {
            content.opacity(0.35)
        }
    }

    private func dayForeground(_ cell: CalendarDayCell) -> Color {
        if cell.isToday { return .white }
        if !cell.isCurrentMonth { return DoneBunWidgetTheme.muted }
        return DoneBunWidgetTheme.ink
    }

    @ViewBuilder
    private func taskDots(count: Int, dimmed: Bool) -> some View {
        let n = min(count, layout.maxDots)
        if n <= 0 {
            Color.clear
        } else {
            HStack(spacing: 1.5) {
                ForEach(0..<n, id: \.self) { _ in
                    Circle()
                        .fill(DoneBunWidgetTheme.primary.opacity(dimmed ? 0.4 : 1))
                        .frame(width: layout.dotSize, height: layout.dotSize)
                }
            }
        }
    }
}

/// Compact calendar-event row for the large calendar widget (opens Timeline day).
struct WidgetCalendarEventRow: View {
    let event: WidgetCalendarEventRecord

    private var dateLabel: String {
        monthDayLabel(for: event.dateKey)
    }

    private var timeLabel: String {
        if event.isAllDay || event.time == nil || event.time?.isEmpty == true {
            return "All day"
        }
        return event.time!
    }

    var body: some View {
        Link(destination: WidgetDeepLinks.timeline(dateKey: event.dateKey)) {
            HStack(spacing: 6) {
                Image(systemName: "calendar")
                    .font(.system(size: 12))
                    .foregroundStyle(DoneBunWidgetTheme.primary)
                    .frame(width: 22, height: 22)

                Text(dateLabel)
                    .font(.system(size: 11, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(DoneBunWidgetTheme.ink)
                    .lineLimit(1)
                    .frame(width: 40, alignment: .leading)

                Text(timeLabel)
                    .font(.system(size: 11, weight: .medium))
                    .monospacedDigit()
                    .foregroundStyle(DoneBunWidgetTheme.muted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .frame(width: 52, alignment: .leading)

                Text(event.title)
                    .font(.system(size: 12))
                    .foregroundStyle(DoneBunWidgetTheme.ink)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .layoutPriority(1)

                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, minHeight: 22, maxHeight: 22, alignment: .leading)
            .contentShape(Rectangle())
        }
    }

    private func monthDayLabel(for dateKey: String) -> String {
        let parts = dateKey.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return dateKey }
        var c = DateComponents()
        c.year = parts[0]
        c.month = parts[1]
        c.day = parts[2]
        guard let date = Calendar.current.date(from: c) else { return dateKey }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
}
