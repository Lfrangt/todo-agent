import Foundation
import SwiftUI
import Combine

class TaskViewModel: ObservableObject {
    @Published var tasks: [TodoTask] = []
    @Published var filter: TaskFilter = .all
    @Published var isSyncing = false
    @Published var lastSyncTime: Date?
    
    private let storageKey = "smart_todo_tasks"
    private let cloudSync = CloudSyncService.shared
    private var syncTimer: Timer?
    private var cancellables = Set<AnyCancellable>()
    
    enum TaskFilter: String, CaseIterable {
        case all = "全部"
        case pending = "待完成"
        case completed = "已完成"
        case urgent = "紧急"
        case today = "今天"
    }
    
    init() {
        loadTasks()
        setupAutoSync()
    }
    
    private func setupAutoSync() {
        // 监听登录状态变化，登录后自动同步
        cloudSync.$isLoggedIn
            .dropFirst()
            .sink { [weak self] isLoggedIn in
                if isLoggedIn {
                    self?.syncToCloud()
                }
            }
            .store(in: &cancellables)
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
        syncToCloudDebounced()
    }
    
    func updateTask(_ task: TodoTask) {
        if let index = tasks.firstIndex(where: { $0.id == task.id }) {
            tasks[index] = task
            tasks[index].updatedAt = Date()
            saveTasks()
            syncToCloudDebounced()
        }
    }
    
    func deleteTask(_ task: TodoTask) {
        tasks.removeAll { $0.id == task.id }
        saveTasks()
        syncToCloudDebounced()
    }
    
    func toggleComplete(_ task: TodoTask) {
        if let index = tasks.firstIndex(where: { $0.id == task.id }) {
            tasks[index].completed.toggle()
            tasks[index].updatedAt = Date()
            saveTasks()
            syncToCloudDebounced()
        }
    }
    
    func clearCompleted() {
        tasks.removeAll { $0.completed }
        saveTasks()
        syncToCloudDebounced()
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
    
    // MARK: - 云同步
    
    /// 防抖同步 - 延迟2秒执行，避免频繁同步
    private func syncToCloudDebounced() {
        syncTimer?.invalidate()
        syncTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: false) { [weak self] _ in
            self?.syncToCloud()
        }
    }
    
    /// 同步到云端
    func syncToCloud() {
        guard cloudSync.isLoggedIn else { return }
        
        Task {
            await MainActor.run {
                self.isSyncing = true
            }
            
            do {
                let cloudTasks = try await cloudSync.syncTasks(tasks)
                
                await MainActor.run {
                    // 合并云端任务
                    self.mergeTasks(cloudTasks)
                    self.lastSyncTime = Date()
                    self.isSyncing = false
                }
                
                print("✅ 同步成功，共 \(cloudTasks.count) 个任务")
            } catch {
                await MainActor.run {
                    self.isSyncing = false
                }
                print("❌ 同步失败: \(error.localizedDescription)")
            }
        }
    }
    
    /// 合并云端任务
    private func mergeTasks(_ cloudTasks: [CloudTask]) {
        var localTaskIds = Set(tasks.map { $0.id })
        
        for cloudTask in cloudTasks {
            if let index = tasks.firstIndex(where: { $0.id == cloudTask.id }) {
                // 更新本地任务（如果云端更新）
                let cloudUpdatedAt = cloudTask.updatedAt ?? 0
                let localUpdatedAt = Int(tasks[index].updatedAt.timeIntervalSince1970 * 1000)
                
                if cloudUpdatedAt > localUpdatedAt {
                    tasks[index] = cloudTask.toTodoTask()
                }
            } else {
                // 添加云端新任务
                tasks.append(cloudTask.toTodoTask())
            }
            localTaskIds.remove(cloudTask.id)
        }
        
        saveTasks()
    }
    
    /// 从云端拉取任务
    func pullFromCloud() {
        guard cloudSync.isLoggedIn else { return }
        
        Task {
            do {
                let cloudTasks = try await cloudSync.fetchTasks()
                
                await MainActor.run {
                    self.tasks = cloudTasks.map { $0.toTodoTask() }
                    self.saveTasks()
                    self.lastSyncTime = Date()
                }
                
                print("✅ 拉取成功，共 \(cloudTasks.count) 个任务")
            } catch {
                print("❌ 拉取失败: \(error.localizedDescription)")
            }
        }
    }
}
