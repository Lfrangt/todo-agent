import SwiftUI

struct AddTaskView: View {
    @EnvironmentObject var taskViewModel: TaskViewModel
    @EnvironmentObject var settingsViewModel: SettingsViewModel
    @Environment(\.dismiss) var dismiss
    
    @State private var taskText = ""
    @State private var notes = ""
    @State private var priority: TodoTask.Priority = .medium
    @State private var category: TodoTask.Category = .personal
    @State private var dueDate = Date()
    @State private var hasDueDate = true
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // 任务名称
                    VStack(alignment: .leading, spacing: 8) {
                        Text("任务名称")
                            .font(.headline)
                            .foregroundColor(.white)
                        
                        TextField("输入任务内容", text: $taskText)
                            .textFieldStyle(.plain)
                            .padding()
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(12)
                            .foregroundColor(.white)
                    }
                    
                    // 备注
                    VStack(alignment: .leading, spacing: 8) {
                        Text("备注")
                            .font(.headline)
                            .foregroundColor(.white)
                        
                        TextField("添加备注（可选）", text: $notes, axis: .vertical)
                            .textFieldStyle(.plain)
                            .padding()
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(12)
                            .foregroundColor(.white)
                            .lineLimit(3...6)
                    }
                    
                    // 优先级
                    VStack(alignment: .leading, spacing: 8) {
                        Text("优先级")
                            .font(.headline)
                            .foregroundColor(.white)
                        
                        HStack(spacing: 12) {
                            ForEach(TodoTask.Priority.allCases, id: \.self) { p in
                                PriorityButton(priority: p, isSelected: priority == p) {
                                    priority = p
                                }
                            }
                        }
                    }
                    
                    // 分类
                    VStack(alignment: .leading, spacing: 8) {
                        Text("分类")
                            .font(.headline)
                            .foregroundColor(.white)
                        
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 10) {
                                ForEach(TodoTask.Category.allCases, id: \.self) { c in
                                    CategoryButton(category: c, isSelected: category == c) {
                                        category = c
                                    }
                                }
                            }
                        }
                    }
                    
                    // 截止日期
                    VStack(alignment: .leading, spacing: 8) {
                        Toggle(isOn: $hasDueDate) {
                            Text("设置截止日期")
                                .font(.headline)
                                .foregroundColor(.white)
                        }
                        .tint(settingsViewModel.themeColor.color)
                        
                        if hasDueDate {
                            DatePicker(
                                "截止日期",
                                selection: $dueDate,
                                displayedComponents: [.date, .hourAndMinute]
                            )
                            .datePickerStyle(.compact)
                            .colorScheme(.dark)
                            .accentColor(settingsViewModel.themeColor.color)
                        }
                    }
                    .padding()
                    .background(Color.white.opacity(0.1))
                    .cornerRadius(12)
                }
                .padding()
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
            .navigationTitle("添加任务")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        dismiss()
                    }
                    .foregroundColor(.gray)
                }
                
                ToolbarItem(placement: .confirmationAction) {
                    Button("添加") {
                        addTask()
                    }
                    .foregroundColor(settingsViewModel.themeColor.color)
                    .disabled(taskText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }
    
    func addTask() {
        let task = TodoTask(
            text: taskText.trimmingCharacters(in: .whitespacesAndNewlines),
            notes: notes,
            priority: priority,
            category: category,
            dueDate: hasDueDate ? dueDate : nil
        )
        
        taskViewModel.addTask(task)
        dismiss()
    }
}

struct PriorityButton: View {
    let priority: TodoTask.Priority
    let isSelected: Bool
    let action: () -> Void
    
    var color: Color {
        switch priority {
        case .low: return .green
        case .medium: return .yellow
        case .high: return .red
        }
    }
    
    var body: some View {
        Button(action: action) {
            Text(priority.label)
                .font(.subheadline)
                .fontWeight(isSelected ? .semibold : .regular)
                .foregroundColor(isSelected ? .white : color)
                .padding(.horizontal, 20)
                .padding(.vertical, 10)
                .background(
                    Capsule()
                        .fill(isSelected ? color : color.opacity(0.2))
                )
        }
    }
}

struct CategoryButton: View {
    let category: TodoTask.Category
    let isSelected: Bool
    let action: () -> Void
    @EnvironmentObject var settingsViewModel: SettingsViewModel
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(category.icon)
                Text(category.label)
            }
            .font(.subheadline)
            .foregroundColor(isSelected ? .white : .gray)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(
                Capsule()
                    .fill(isSelected ? settingsViewModel.themeColor.color : Color.white.opacity(0.1))
            )
        }
    }
}

#Preview {
    AddTaskView()
        .environmentObject(TaskViewModel())
        .environmentObject(SettingsViewModel())
}

