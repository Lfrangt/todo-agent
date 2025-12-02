import Foundation
import SwiftUI

class TaskViewModel: ObservableObject {
    @Published var tasks: [TodoTask] = []
    @Published var filter: TaskFilter = .all
    
    private let storageKey = "smart_todo_tasks"
    
    enum TaskFilter: String, CaseIterable {
        case all = "全部"
        case pending = "待完成"
        case completed = "已完成"
        case urgent = "紧急"
        case today = "今天"
    }
    
    init() {
        loadTasks()
    }
    
    var filteredTasks: [TodoTask] {
        switch filter {
        case .all:
            return tasks
        case .pending:
            return tasks.filter { !$0.completed }
        case .completed:
            return tasks.filter { $0.completed }
        case .urgent:
            return tasks.filter { $0.priority == .high && !$0.completed }
        case .today:
            return tasks.filter { task in
                guard let dueDate = task.dueDate else { return false }
                return Calendar.current.isDateInToday(dueDate)
            }
        }
    }
    
    var completedCount: Int {
        tasks.filter { $0.completed }.count
    }
    
    var pendingCount: Int {
        tasks.filter { !$0.completed }.count
    }
    
    var todayTasks: [TodoTask] {
        tasks.filter { task in
            guard let dueDate = task.dueDate else { return false }
            return Calendar.current.isDateInToday(dueDate) && !task.completed
        }
    }
    
    func addTask(_ task: TodoTask) {
        tasks.insert(task, at: 0)
        saveTasks()
    }
    
    func updateTask(_ task: TodoTask) {
        if let index = tasks.firstIndex(where: { $0.id == task.id }) {
            tasks[index] = task
            tasks[index].updatedAt = Date()
            saveTasks()
        }
    }
    
    func deleteTask(_ task: TodoTask) {
        tasks.removeAll { $0.id == task.id }
        saveTasks()
    }
    
    func toggleComplete(_ task: TodoTask) {
        if let index = tasks.firstIndex(where: { $0.id == task.id }) {
            tasks[index].completed.toggle()
            tasks[index].updatedAt = Date()
            saveTasks()
        }
    }
    
    func clearCompleted() {
        tasks.removeAll { $0.completed }
        saveTasks()
    }
    
    private func saveTasks() {
        if let encoded = try? JSONEncoder().encode(tasks) {
            UserDefaults.standard.set(encoded, forKey: storageKey)
        }
    }
    
    private func loadTasks() {
        if let data = UserDefaults.standard.data(forKey: storageKey),
           let decoded = try? JSONDecoder().decode([TodoTask].self, from: data) {
            tasks = decoded
        }
    }
}

