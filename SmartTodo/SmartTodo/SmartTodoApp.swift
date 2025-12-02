import SwiftUI
import GoogleSignIn

@main
struct SmartTodoApp: App {
    @StateObject private var taskViewModel = TaskViewModel()
    @StateObject private var aiViewModel = AIViewModel()
    @StateObject private var settingsViewModel = SettingsViewModel()
    
    var body: some Scene {
        WindowGroup {
            MainTabView()
                .environmentObject(taskViewModel)
                .environmentObject(aiViewModel)
                .environmentObject(settingsViewModel)
                .preferredColorScheme(.dark)
                .onOpenURL { url in
                    GIDSignIn.sharedInstance.handle(url)
                }
        }
    }
}
