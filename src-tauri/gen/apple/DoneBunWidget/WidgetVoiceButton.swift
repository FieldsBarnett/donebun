import AppIntents
import SwiftUI

/// Mic control: opens DoneBun and queues voice quick-add via App Group.
/// Uses App Intent (not Link) — custom-scheme Links open the app but Tauri
/// often never delivers the URL to the JS bridge on iOS.
struct WidgetVoiceButton: View {
    var compact: Bool = false

    private var size: CGFloat { compact ? 24 : 28 }
    private var iconSize: CGFloat { compact ? 11 : 13 }

    var body: some View {
        Button(intent: OpenVoiceIntent()) {
            Image(systemName: "mic.fill")
                .font(.system(size: iconSize, weight: .semibold))
                .foregroundStyle(DoneBunWidgetTheme.primary)
                .frame(width: size, height: size)
                .background(DoneBunWidgetTheme.surfaceSoft)
                .clipShape(Circle())
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Voice quick add")
    }
}
