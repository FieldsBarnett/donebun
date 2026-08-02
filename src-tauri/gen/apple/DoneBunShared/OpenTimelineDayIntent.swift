import AppIntents
import Foundation

private let timelinePrefix = "timeline:"

/// Opens DoneBun to the Timeline scrolled to the tapped day.
/// Must be in both app + widget targets (see `OpenTaskIntent`).
struct OpenTimelineDayIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Timeline Day"
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Date")
    var dateKey: String

    init() {
        self.dateKey = ""
    }

    init(dateKey: String) {
        self.dateKey = dateKey
    }

    func perform() async throws -> some IntentResult {
        guard dateKey.count == 10 else { return .result() }
        WidgetOpenHelpers.writeOpenAction("\(timelinePrefix)\(dateKey)")
        try? await Task.sleep(nanoseconds: 50_000_000)
        return .result()
    }
}
