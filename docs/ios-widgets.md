# iOS Widgets (DoneBun)

Native home-screen widgets for the Tauri iOS app:

1. **Today** — today's personal tasks (title + local time). Tap a row to complete. Mic button opens voice quick add. Tap empty space / small widget to open DoneBun.
2. **Calendar** (small / large) — current month grid with today highlighted and task-count dots. Large also shows a scrollable list of today's tasks below the calendar, plus a mic that opens voice quick-add. Tap a day to open that date in Timeline; tap a task title to open it / checkbox to complete.

## Architecture

```
React (Convex queries) → widgetSync.ts → tauri-plugin-widgets → App Group JSON
                                                                      ↓
                                                         WidgetKit extension (SwiftUI)
```

- **Bundle ID:** `app.donebun.ios`
- **App Group:** `group.app.donebun.ios` (must match exactly in Xcode for app + widget extension)
- **Widget filter:** always `personal` (each phone shows the signed-in user's day)
- **Freshness:** snapshot written when DoneBun runs while signed in. Completing from the widget calls Convex directly via App Intent (uses auth token cached in App Group).
- **App Group keys:** `widget_tasks`, `widget_calendar_month`, `widget_auth_token`, `widget_open_action` (`voice` or `timeline:YYYY-MM-DD`)

## Mac prerequisites

All iOS build, sign, and widget work requires a **Mac with full Xcode** (not Command Line Tools alone).

1. Apple Developer Program ($99/yr) — see `human_checklist.md`
2. Xcode — open once after install
3. `brew install cocoapods`
4. Rust iOS targets:
   ```bash
   rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
   ```
5. Register family iPhone **UDIDs** at [developer.apple.com/account/resources/devices](https://developer.apple.com/account/resources/devices) for Ad Hoc installs

## Repo layout

| Path | Purpose |
|------|---------|
| `src/lib/todayTasks.ts` | Shared "today" task filter (Dashboard + widget) |
| `src/lib/calendarMonth.ts` | Month task counts for calendar widget |
| `src/lib/widgetSync.ts` | Builds JSON config + App Group snapshots |
| `src-tauri/gen/apple/DoneBunWidget/` | Today + Calendar WidgetKit sources |
| `src-tauri/ios-widget/MyWidget.swift` | Widget template (reference) |
| `src-tauri/gen/apple/` | Xcode project (tracked in git) |

After `npm run tauri ios init`, regenerate the Xcode project when `project.yml` changes:

```bash
cd src-tauri/gen/apple && xcodegen generate
```

## One-time Xcode widget setup

These steps are **manual in Xcode** (cannot be fully automated):

1. Initialize iOS (if not done):
   ```bash
   npm install
   npm run tauri ios init
   ```

2. Scaffold widget sources:
   ```bash
   npx tauri-plugin-widgets-api init-ios --app-group group.app.donebun.ios
   ```

3. Open Xcode:
   ```bash
   open src-tauri/gen/apple/tauri-app.xcodeproj
   ```

4. **File → New → Target → Widget Extension**
   - Name: e.g. `DoneBunWidget`
   - You may enable controls/intents (DoneBun includes a Control Center "Complete next" control)
   - Set **iOS Deployment Target → 17.0** on both app and widget targets

5. **Add TauriWidgets Swift package** to the **widget target only** (if not already linked):
   - File → Add Package Dependencies → Add Local
   - Path: `node_modules/tauri-plugin-widgets-api/swift/`
   - Add to target: `DoneBunWidget` / `WidgetExtension` (not the main app)

6. Re-sync widget Swift from the plugin:
   ```bash
   npx tauri-plugin-widgets-api init-ios --app-group group.app.donebun.ios
   ```

7. **Signing & Capabilities** on **both** main app and widget extension:
   - App Groups → `group.app.donebun.ios`
   - Same Apple Team
   - Bundle IDs: `app.donebun.ios` and `app.donebun.ios.DoneBunWidget` (or your extension suffix)

8. Apple Developer portal: enable App Groups on both App IDs.

## Development on device

Production Convex URLs are baked in at build time via `.env.production` (`npm run build` / `tauri ios build`).

```bash
npm run tauri ios dev
```

Sign in on device. If auth fails, note the WebView origin in Xcode console and add it to `trustedOrigins` in `convex/auth.ts` (common: `tauri://localhost`, `https://tauri.localhost`).

After login, open the app once so `syncTodayWidget` runs. Then add the widget: long-press home screen → Widgets → DoneBun.

## Ad Hoc distribution (family phones)

Preferred over TestFlight for a household app (no 90-day build expiry).

1. Register all device UDIDs in Apple Developer portal
2. Create App IDs with App Groups for app + widget extension
3. Create Ad Hoc provisioning profile including those devices (or let Xcode manage on export)
4. Archive:
   ```bash
   npm run tauri ios build
   ```
   Or open Xcode → Product → Archive → Distribute App → **Ad Hoc**
5. Install IPA via Finder/Apple Configurator (USB) or OTA HTTPS + `manifest.plist`

After install: open DoneBun → sign in → add widget.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Blank / placeholder widget | App never opened after install, or user not signed in |
| Stale task list | Expected — open DoneBun to refresh snapshot |
| Widget empty but app shows tasks | App Group ID mismatch between app and extension |
| Yellow stop / prohibition overlays on taps | Too many `Button(intent:)` controls (calendar day grid) — days/titles/mic use `Link` + `donebun://` deep links; only checkboxes stay as App Intents |
| Task title tap doesn't open detail | Deep link / App Group `widget_open_action` not draining after sign-in |
| Sign-in fails on iOS | Missing WebView origin in Better Auth `trustedOrigins` |
| `import TauriWidgets` fails | Package linked to main app instead of widget target |

## Out of scope (later)

- Android widgets
- Widget calling Convex without cached session (sign in once so token is written to App Group)
- Background refresh without opening the app
- App Store public listing
