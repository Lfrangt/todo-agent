import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0
    @EnvironmentObject var settingsViewModel: SettingsViewModel
    
    var body: some View {
        ZStack(alignment: .bottom) {
            // 主内容区域
            Group {
                switch selectedTab {
                case 0:
                    HomeView()
                case 1:
                    AIView()
                case 2:
                    CalendarView()
                case 3:
                    SettingsView()
                default:
                    HomeView()
                }
            }
            
            // Luma风格浮动胶囊导航栏 - 所有页面都显示
            LumaStyleTabBar(
                selectedTab: $selectedTab,
                themeColor: settingsViewModel.themeColor.color
            )
            .padding(.bottom, 30)
        }
        .ignoresSafeArea(.keyboard)
    }
}

// MARK: - Luma风格浮动胶囊导航栏
struct LumaStyleTabBar: View {
    @Binding var selectedTab: Int
    let themeColor: Color
    @State private var showAddTask = false
    @EnvironmentObject var taskViewModel: TaskViewModel
    
    var body: some View {
        HStack(spacing: 0) {
            // 首页
            LumaTabItem(
                icon: "house.fill",
                label: "主页",
                isSelected: selectedTab == 0
            ) {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                    selectedTab = 0
                }
            }
            
            // AI
            LumaTabItem(
                icon: "sparkles",
                label: "AI",
                isSelected: selectedTab == 1
            ) {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                    selectedTab = 1
                }
            }
            
            // 添加按钮
            Button(action: { showAddTask = true }) {
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [themeColor, themeColor.opacity(0.8)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 44, height: 44)
                        .shadow(color: themeColor.opacity(0.4), radius: 8, y: 4)
                    
                    Image(systemName: "plus")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(.white)
                }
            }
            .padding(.horizontal, 12)
            
            // 日历
            LumaTabItem(
                icon: "calendar",
                label: "日历",
                isSelected: selectedTab == 2
            ) {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                    selectedTab = 2
                }
            }
            
            // 设置
            LumaTabItem(
                icon: "gearshape.fill",
                label: "设置",
                isSelected: selectedTab == 3
            ) {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                    selectedTab = 3
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(
            // 高透明度毛玻璃胶囊
            Capsule()
                .fill(.ultraThinMaterial.opacity(0.8))
                .overlay(
                    Capsule()
                        .fill(Color.white.opacity(0.08))
                )
                .overlay(
                    Capsule()
                        .stroke(Color.white.opacity(0.2), lineWidth: 0.5)
                )
                .shadow(color: .black.opacity(0.25), radius: 20, y: 10)
        )
        .sheet(isPresented: $showAddTask) {
            AddTaskView()
        }
    }
}

// MARK: - Luma Tab 单项
struct LumaTabItem: View {
    let icon: String
    let label: String
    let isSelected: Bool
    let action: () -> Void
    @EnvironmentObject var settingsViewModel: SettingsViewModel
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: isSelected ? .semibold : .regular))
                    .foregroundColor(isSelected ? settingsViewModel.themeColor.color : .white.opacity(0.5))
                
                Text(label)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(isSelected ? settingsViewModel.themeColor.color : .white.opacity(0.4))
            }
            .frame(width: 50)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(isSelected ? settingsViewModel.themeColor.color.opacity(0.15) : Color.clear)
                    .padding(.horizontal, -4)
            )
        }
        .buttonStyle(ScaleButtonStyle())
    }
}

// MARK: - 按钮缩放样式
struct ScaleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.9 : 1)
            .animation(.spring(response: 0.2), value: configuration.isPressed)
    }
}

#Preview {
    MainTabView()
        .environmentObject(TaskViewModel())
        .environmentObject(AIViewModel())
        .environmentObject(SettingsViewModel())
}
