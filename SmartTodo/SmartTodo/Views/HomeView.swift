import SwiftUI

struct HomeView: View {
    @EnvironmentObject var taskViewModel: TaskViewModel
    @EnvironmentObject var settingsViewModel: SettingsViewModel
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // 头部问候
                    HeaderView()
                    
                    // 统计卡片
                    StatsCard()
                    
                    // AI 建议卡片
                    AISuggestionCard()
                    
                    // 筛选标签
                    FilterTabs()
                    
                    // 任务列表
                    TaskListView()
                }
                .padding(.horizontal)
                .padding(.bottom, 100)
            }
            .background(
                LinearGradient(
                    colors: [
                        Color(red: 0.04, green: 0.06, blue: 0.12),
                        Color(red: 0.06, green: 0.08, blue: 0.16)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
            )
        }
    }
}

struct HeaderView: View {
    var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 12 { return "早上好" }
        else if hour < 18 { return "下午好" }
        else { return "晚上好" }
    }
    
    var dateString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy年M月d日 EEEE"
        formatter.locale = Locale(identifier: "zh_CN")
        return formatter.string(from: Date())
    }
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(dateString)
                    .font(.caption)
                    .foregroundColor(.gray)
                
                Text(greeting)
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(.white)
                
                Text("保持专注，继续前进 💪")
                    .font(.subheadline)
                    .foregroundColor(.gray)
            }
            
            Spacer()
            
            // 进度环
            ProgressRing()
        }
        .padding(.top)
    }
}

struct ProgressRing: View {
    @EnvironmentObject var taskViewModel: TaskViewModel
    @EnvironmentObject var settingsViewModel: SettingsViewModel
    
    var progress: Double {
        guard taskViewModel.tasks.count > 0 else { return 0 }
        return Double(taskViewModel.completedCount) / Double(taskViewModel.tasks.count)
    }
    
    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.gray.opacity(0.3), lineWidth: 6)
            
            Circle()
                .trim(from: 0, to: progress)
                .stroke(settingsViewModel.themeColor.color, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                .rotationEffect(.degrees(-90))
            
            Text("\(Int(progress * 100))%")
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(.white)
        }
        .frame(width: 50, height: 50)
    }
}

struct StatsCard: View {
    @EnvironmentObject var taskViewModel: TaskViewModel
    
    var body: some View {
        HStack(spacing: 0) {
            StatItem(value: "\(taskViewModel.tasks.count)", label: "总任务")
            Divider().frame(height: 40)
            StatItem(value: "\(taskViewModel.completedCount)", label: "已完成")
            Divider().frame(height: 40)
            StatItem(value: "\(taskViewModel.pendingCount)", label: "待完成")
            Divider().frame(height: 40)
            StatItem(value: "🍅", label: "番茄钟")
        }
        .padding(.vertical, 16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white.opacity(0.05))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.1), lineWidth: 1)
                )
        )
    }
}

struct StatItem: View {
    let value: String
    let label: String
    
    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: 20, weight: .bold))
                .foregroundColor(Color(red: 0.2, green: 0.8, blue: 0.7))
            Text(label)
                .font(.caption)
                .foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity)
    }
}

struct AISuggestionCard: View {
    @EnvironmentObject var taskViewModel: TaskViewModel
    @State private var isExpanded = true
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                HStack(spacing: 8) {
                    Image(systemName: "sparkles")
                        .foregroundColor(.purple)
                    Text("AI 智能建议")
                        .font(.headline)
                        .foregroundColor(.white)
                }
                
                Spacer()
                
                Button(action: { withAnimation { isExpanded.toggle() } }) {
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .foregroundColor(.gray)
                }
            }
            
            if isExpanded {
                if taskViewModel.todayTasks.count > 0 {
                    SuggestionRow(icon: "calendar", text: "今日还有 \(taskViewModel.todayTasks.count) 个任务", color: .blue)
                }
                
                let highPriority = taskViewModel.tasks.filter { $0.priority == .high && !$0.completed }
                if highPriority.count > 0 {
                    SuggestionRow(icon: "exclamationmark.triangle", text: "\(highPriority.count) 个高优先级任务待处理", color: .red)
                }
                
                if taskViewModel.completedCount > 0 {
                    SuggestionRow(icon: "checkmark.circle", text: "太棒了！已完成 \(taskViewModel.completedCount) 个任务", color: .green)
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white.opacity(0.05))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color(red: 0.2, green: 0.8, blue: 0.7).opacity(0.3), lineWidth: 1)
                )
        )
    }
}

struct SuggestionRow: View {
    let icon: String
    let text: String
    let color: Color
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(color)
                .frame(width: 30)
            Text(text)
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.8))
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(color.opacity(0.1))
        .cornerRadius(10)
    }
}

struct FilterTabs: View {
    @EnvironmentObject var taskViewModel: TaskViewModel
    
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(TaskViewModel.TaskFilter.allCases, id: \.self) { filter in
                    FilterTab(filter: filter, isSelected: taskViewModel.filter == filter) {
                        taskViewModel.filter = filter
                    }
                }
            }
        }
    }
}

struct FilterTab: View {
    let filter: TaskViewModel.TaskFilter
    let isSelected: Bool
    let action: () -> Void
    @EnvironmentObject var settingsViewModel: SettingsViewModel
    
    var body: some View {
        Button(action: action) {
            Text(filter.rawValue)
                .font(.subheadline)
                .fontWeight(isSelected ? .semibold : .regular)
                .foregroundColor(isSelected ? .white : .gray)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(
                    Capsule()
                        .fill(isSelected ? settingsViewModel.themeColor.color : Color.white.opacity(0.05))
                )
        }
    }
}

struct TaskListView: View {
    @EnvironmentObject var taskViewModel: TaskViewModel
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("任务列表")
                    .font(.headline)
                    .foregroundColor(.white)
                
                Spacer()
                
                if taskViewModel.completedCount > 0 {
                    Button("清除已完成") {
                        taskViewModel.clearCompleted()
                    }
                    .font(.caption)
                    .foregroundColor(.red)
                }
            }
            
            if taskViewModel.filteredTasks.isEmpty {
                EmptyTaskView()
            } else {
                ForEach(taskViewModel.filteredTasks) { task in
                    TaskRow(task: task)
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white.opacity(0.05))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.1), lineWidth: 1)
                )
        )
    }
}

struct EmptyTaskView: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 40))
                .foregroundColor(.gray)
            Text("没有任务")
                .foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
}

struct TaskRow: View {
    let task: TodoTask
    @EnvironmentObject var taskViewModel: TaskViewModel
    @EnvironmentObject var settingsViewModel: SettingsViewModel
    
    var priorityColor: Color {
        switch task.priority {
        case .high: return .red
        case .medium: return .yellow
        case .low: return .green
        }
    }
    
    var body: some View {
        HStack(spacing: 12) {
            // 优先级指示条
            Rectangle()
                .fill(priorityColor)
                .frame(width: 4)
                .cornerRadius(2)
            
            // 复选框
            Button(action: { taskViewModel.toggleComplete(task) }) {
                Image(systemName: task.completed ? "checkmark.square.fill" : "square")
                    .font(.title2)
                    .foregroundColor(task.completed ? settingsViewModel.themeColor.color : .gray)
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(task.text)
                    .foregroundColor(task.completed ? .gray : .white)
                    .strikethrough(task.completed)
                
                HStack(spacing: 8) {
                    Text("\(task.category.icon) \(task.category.label)")
                        .font(.caption)
                        .foregroundColor(.gray)
                    
                    if let dueDate = task.dueDate {
                        Text("⏰ \(formatDate(dueDate))")
                            .font(.caption)
                            .foregroundColor(isOverdue(dueDate) && !task.completed ? .red : .gray)
                    }
                }
            }
            
            Spacer()
            
            // 删除按钮
            Button(action: { taskViewModel.deleteTask(task) }) {
                Image(systemName: "trash")
                    .foregroundColor(.red.opacity(0.7))
            }
        }
        .padding(.vertical, 12)
    }
    
    func formatDate(_ date: Date) -> String {
        if Calendar.current.isDateInToday(date) {
            return "今天"
        } else if Calendar.current.isDateInTomorrow(date) {
            return "明天"
        } else {
            let formatter = DateFormatter()
            formatter.dateFormat = "M月d日"
            return formatter.string(from: date)
        }
    }
    
    func isOverdue(_ date: Date) -> Bool {
        return date < Date() && !Calendar.current.isDateInToday(date)
    }
}

#Preview {
    HomeView()
        .environmentObject(TaskViewModel())
        .environmentObject(SettingsViewModel())
}

