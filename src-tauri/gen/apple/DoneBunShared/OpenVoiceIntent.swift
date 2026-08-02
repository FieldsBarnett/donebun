import AppIntents
import Foundation

private let voiceAction = "voice"

/// Opens DoneBun and queues voice quick-add (read by the app on launch / resume).
/// Must be in both app + widget targets (see `OpenTaskIntent`).
struct OpenVoiceIntent: AppIntent {
    static var title: LocalizedStringResource = "Voice Quick Add"
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        WidgetOpenHelpers.writeOpenAction(voiceAction)
        try? await Task.sleep(nanoseconds: 50_000_000)
        return .result()
    }
}
