import WidgetKit
import SwiftUI

@main
struct DoneBunWidgetBundle: WidgetBundle {
    var body: some Widget {
        DoneBunWidget()
        DoneBunCalendarWidget()
        if #available(iOS 18.0, *) {
            DoneBunWidgetControl()
        }
    }
}
