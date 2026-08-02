import SwiftUI
import WidgetKit

enum DoneBunEmptyState {
    /// Widget was added before the app ever synced data.
    case needsSetup
}

struct DoneBunWidgetEmptyView: View {
    let state: DoneBunEmptyState
    let family: WidgetFamily

    var body: some View {
        VStack(alignment: .leading, spacing: family == .systemSmall ? 6 : 8) {
            header

            Text(primaryMessage)
                .font(family == .systemSmall ? .caption : .footnote)
                .foregroundStyle(DoneBunWidgetTheme.muted)
                .fixedSize(horizontal: false, vertical: true)

            if family != .systemSmall {
                Text(secondaryMessage)
                    .font(.caption2)
                    .foregroundStyle(DoneBunWidgetTheme.muted.opacity(0.9))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var header: some View {
        HStack(spacing: 6) {
            Text("★")
                .font(.system(size: family == .systemSmall ? 14 : 16))
                .foregroundStyle(DoneBunWidgetTheme.yellow)
            Text("DoneBun")
                .font(family == .systemSmall ? .subheadline.bold() : .headline.bold())
                .foregroundStyle(DoneBunWidgetTheme.ink)
        }
    }

    private var primaryMessage: String {
        switch state {
        case .needsSetup:
            return family == .systemSmall
                ? "Open the app to sync"
                : "Open DoneBun to load your tasks"
        }
    }

    private var secondaryMessage: String {
        switch state {
        case .needsSetup:
            return "Sign in inside the app, then your tasks will appear here."
        }
    }
}
