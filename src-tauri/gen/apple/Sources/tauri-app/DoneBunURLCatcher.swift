import Foundation
import ObjectiveC
import UIKit

/// Relays `donebun://…` Links into the App Group open-action queue.
///
/// Widget `Link`s open the app via the custom URL scheme, but Tauri/JS deep-link
/// delivery is unreliable on iOS cold start. Writing `widget_open_action` here lets
/// the existing JS poller navigate (timeline day, task, voice) without App Intents.
enum DoneBunURLCatcher {
    private static var installed = false
    private static var openURLSwizzled = false

    static func install() {
        guard !installed else { return }
        // Host app only — widget extension must not swizzle.
        guard Bundle.main.bundleIdentifier == "app.donebun.ios" else { return }
        installed = true

        NotificationCenter.default.addObserver(
            forName: UIApplication.didFinishLaunchingNotification,
            object: nil,
            queue: .main
        ) { notification in
            if let url = notification.userInfo?[UIApplication.LaunchOptionsKey.url] as? URL {
                handle(url)
            }
            swizzleOpenURLIfNeeded()
        }
    }

    static func handle(_ url: URL) {
        guard url.scheme?.lowercased() == "donebun" else { return }

        let comps = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let host = (url.host ?? comps?.host ?? "").lowercased()
        let items = comps?.queryItems ?? []

        func query(_ name: String) -> String? {
            items.first(where: { $0.name == name })?.value
        }

        switch host {
        case "voice":
            WidgetOpenHelpers.writeOpenAction("voice")
        case "timeline":
            if let date = query("date"), date.count == 10 {
                WidgetOpenHelpers.writeOpenAction("timeline:\(date)")
            }
        case "task":
            if let id = query("id"), !id.isEmpty {
                WidgetOpenHelpers.writeTaskOpenAction(taskId: id, dateKey: query("date") ?? "")
            }
        default:
            break
        }
    }

    private static func swizzleOpenURLIfNeeded() {
        guard !openURLSwizzled else { return }
        guard let cls = NSClassFromString("AppDelegate") else { return }
        let sel = NSSelectorFromString("application:openURL:options:")
        guard let method = class_getInstanceMethod(cls, sel) else { return }

        openURLSwizzled = true
        let originalIMP = method_getImplementation(method)
        let block: @convention(block) (AnyObject, UIApplication, URL, NSDictionary) -> Bool = {
            obj, app, url, options in
            DoneBunURLCatcher.handle(url)
            typealias Original = @convention(c) (
                AnyObject, Selector, UIApplication, URL, NSDictionary
            ) -> Bool
            let original = unsafeBitCast(originalIMP, to: Original.self)
            return original(obj, sel, app, url, options)
        }
        method_setImplementation(method, imp_implementationWithBlock(block))
    }
}

@_cdecl("donebun_install_url_catcher")
public func donebun_install_url_catcher() {
    DoneBunURLCatcher.install()
}
