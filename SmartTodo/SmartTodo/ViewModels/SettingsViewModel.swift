import Foundation
import SwiftUI

class SettingsViewModel: ObservableObject {
    @Published var themeColor: ThemeColor = .teal
    @Published var notificationsEnabled: Bool = true
    @Published var soundEnabled: Bool = true
    @Published var pomodoroMinutes: Int = 25
    @Published var breakMinutes: Int = 5
    
    enum ThemeColor: String, CaseIterable {
        case blue, red, teal, orange, purple
        
        var color: Color {
            switch self {
            case .blue: return .blue
            case .red: return .red
            case .teal: return Color(red: 0.2, green: 0.8, blue: 0.7)
            case .orange: return .orange
            case .purple: return .purple
            }
        }
    }
    
    init() {
        loadSettings()
    }
    
    func saveSettings() {
        UserDefaults.standard.set(themeColor.rawValue, forKey: "themeColor")
        UserDefaults.standard.set(notificationsEnabled, forKey: "notificationsEnabled")
        UserDefaults.standard.set(soundEnabled, forKey: "soundEnabled")
        UserDefaults.standard.set(pomodoroMinutes, forKey: "pomodoroMinutes")
        UserDefaults.standard.set(breakMinutes, forKey: "breakMinutes")
    }
    
    private func loadSettings() {
        if let color = UserDefaults.standard.string(forKey: "themeColor"),
           let theme = ThemeColor(rawValue: color) {
            themeColor = theme
        }
        notificationsEnabled = UserDefaults.standard.bool(forKey: "notificationsEnabled")
        soundEnabled = UserDefaults.standard.bool(forKey: "soundEnabled")
        
        let pomodoro = UserDefaults.standard.integer(forKey: "pomodoroMinutes")
        pomodoroMinutes = pomodoro > 0 ? pomodoro : 25
        
        let breakTime = UserDefaults.standard.integer(forKey: "breakMinutes")
        breakMinutes = breakTime > 0 ? breakTime : 5
    }
}

