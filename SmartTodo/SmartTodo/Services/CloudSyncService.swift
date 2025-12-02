import Foundation
import AuthenticationServices

// MARK: - 云端同步服务
class CloudSyncService: ObservableObject {
    static let shared = CloudSyncService()
    
    // 后端服务器地址 - Railway 部署
    private let baseURL = "https://todo-agent-production-e6aa.up.railway.app"
    
    @Published var isLoggedIn = false
    @Published var currentUser: User?
    @Published var isSyncing = false
    @Published var lastSyncTime: Date?
    @Published var syncError: String?
    
    private var authToken: String? {
        get { UserDefaults.standard.string(forKey: "auth_token") }
        set { UserDefaults.standard.set(newValue, forKey: "auth_token") }
    }
    
    init() {
        // 检查是否已登录
        if let token = authToken {
            Task {
                await verifyToken(token)
            }
        }
    }
    
    // MARK: - 认证 API
    
    /// 注册
    func register(email: String, password: String, name: String) async throws -> User {
        let body: [String: Any] = [
            "email": email,
            "password": password,
            "name": name
        ]
        
        let response: AuthResponse = try await post("/api/auth/register", body: body)
        
        await MainActor.run {
            self.authToken = response.token
            self.currentUser = response.user
            self.isLoggedIn = true
        }
        
        return response.user
    }
    
    /// 强制注册（重置账户）
    func forceRegister(email: String, password: String, name: String) async throws -> User {
        let body: [String: Any] = [
            "email": email,
            "password": password,
            "name": name
        ]
        
        let response: AuthResponse = try await post("/api/auth/force-register", body: body)
        
        await MainActor.run {
            self.authToken = response.token
            self.currentUser = response.user
            self.isLoggedIn = true
        }
        
        return response.user
    }
    
    /// 登录
    func login(email: String, password: String) async throws -> User {
        let body: [String: Any] = [
            "email": email,
            "password": password
        ]
        
        let response: AuthResponse = try await post("/api/auth/login", body: body)
        
        await MainActor.run {
            self.authToken = response.token
            self.currentUser = response.user
            self.isLoggedIn = true
        }
        
        return response.user
    }
    
    /// 登出
    func logout() {
        authToken = nil
        currentUser = nil
        isLoggedIn = false
    }
    
    /// 验证 Token
    private func verifyToken(_ token: String) async {
        do {
            let response: VerifyResponse = try await get("/api/auth/verify")
            await MainActor.run {
                self.currentUser = response.user
                self.isLoggedIn = true
            }
        } catch {
            await MainActor.run {
                self.authToken = nil
                self.isLoggedIn = false
            }
        }
    }
    
    /// 修改密码
    func changePassword(currentPassword: String, newPassword: String) async throws {
        let body: [String: Any] = [
            "currentPassword": currentPassword,
            "newPassword": newPassword
        ]
        
        let _: SuccessResponse = try await post("/api/auth/change-password", body: body)
    }
    
    /// Google 登录 (使用 ID Token)
    func loginWithGoogle(idToken: String) async throws -> User {
        let body: [String: Any] = [
            "idToken": idToken
        ]
        
        let response: AuthResponse = try await post("/api/auth/google", body: body)
        
        await MainActor.run {
            self.authToken = response.token
            self.currentUser = response.user
            self.isLoggedIn = true
        }
        
        return response.user
    }
    
    /// Google 登录 (使用授权码)
    func loginWithGoogleCode(code: String) async throws -> User {
        let body: [String: Any] = [
            "code": code
        ]
        
        let response: AuthResponse = try await post("/api/auth/google-code", body: body)
        
        await MainActor.run {
            self.authToken = response.token
            self.currentUser = response.user
            self.isLoggedIn = true
        }
        
        return response.user
    }
    
    /// Google 登录 (使用 PKCE)
    func loginWithGooglePKCE(code: String, codeVerifier: String, redirectUri: String) async throws -> User {
        let body: [String: Any] = [
            "code": code,
            "codeVerifier": codeVerifier,
            "redirectUri": redirectUri
        ]
        
        let response: AuthResponse = try await post("/api/auth/google-pkce", body: body)
        
        await MainActor.run {
            self.authToken = response.token
            self.currentUser = response.user
            self.isLoggedIn = true
        }
        
        return response.user
    }
    
    /// Apple 登录
    func loginWithApple(identityToken: String, email: String?, fullName: String?) async throws -> User {
        let body: [String: Any] = [
            "identityToken": identityToken,
            "email": email ?? "",
            "name": fullName ?? ""
        ]
        
        let response: AuthResponse = try await post("/api/auth/apple", body: body)
        
        await MainActor.run {
            self.authToken = response.token
            self.currentUser = response.user
            self.isLoggedIn = true
        }
        
        return response.user
    }
    
    // MARK: - 任务同步 API
    
    /// 获取云端任务
    func fetchTasks() async throws -> [CloudTask] {
        let response: TasksResponse = try await get("/api/tasks")
        return response.tasks
    }
    
    /// 同步任务
    func syncTasks(_ tasks: [TodoTask]) async throws -> [CloudTask] {
        await MainActor.run {
            self.isSyncing = true
            self.syncError = nil
        }
        
        defer {
            Task { @MainActor in
                self.isSyncing = false
            }
        }
        
        let cloudTasks = tasks.map { task -> [String: Any] in
            var dict: [String: Any] = [
                "id": task.id,
                "text": task.text,
                "notes": task.notes,
                "completed": task.completed,
                "priority": task.priority.rawValue,
                "category": task.category.rawValue,
                "createdAt": Int(task.createdAt.timeIntervalSince1970 * 1000),
                "updatedAt": Int(task.updatedAt.timeIntervalSince1970 * 1000)
            ]
            
            if let dueDate = task.dueDate {
                dict["dueDate"] = ISO8601DateFormatter().string(from: dueDate)
            }
            
            return dict
        }
        
        let body: [String: Any] = [
            "tasks": cloudTasks,
            "deviceId": getDeviceId()
        ]
        
        let response: SyncResponse = try await post("/api/tasks/sync", body: body)
        
        await MainActor.run {
            self.lastSyncTime = Date()
            UserDefaults.standard.set(Date(), forKey: "last_sync_time")
        }
        
        return response.tasks
    }
    
    /// 删除云端任务
    func deleteTask(_ taskId: String) async throws {
        let _: SuccessResponse = try await delete("/api/tasks/\(taskId)")
    }
    
    // MARK: - 完整同步
    
    /// 完整数据同步
    func fullSync(tasks: [TodoTask], settings: [String: Any]?) async throws -> FullSyncData {
        await MainActor.run {
            self.isSyncing = true
            self.syncError = nil
        }
        
        defer {
            Task { @MainActor in
                self.isSyncing = false
            }
        }
        
        let cloudTasks = tasks.map { task -> [String: Any] in
            var dict: [String: Any] = [
                "id": task.id,
                "text": task.text,
                "notes": task.notes,
                "completed": task.completed,
                "priority": task.priority.rawValue,
                "category": task.category.rawValue,
                "createdAt": Int(task.createdAt.timeIntervalSince1970 * 1000),
                "updatedAt": Int(task.updatedAt.timeIntervalSince1970 * 1000)
            ]
            
            if let dueDate = task.dueDate {
                dict["dueDate"] = ISO8601DateFormatter().string(from: dueDate)
            }
            
            return dict
        }
        
        var body: [String: Any] = [
            "tasks": cloudTasks,
            "deviceId": getDeviceId()
        ]
        
        if let settings = settings {
            body["settings"] = settings
        }
        
        let response: FullSyncResponse = try await post("/api/sync/full", body: body)
        
        await MainActor.run {
            self.lastSyncTime = Date()
            UserDefaults.standard.set(Date(), forKey: "last_sync_time")
        }
        
        return response.data
    }
    
    // MARK: - 网络请求辅助方法
    
    private func get<T: Decodable>(_ path: String) async throws -> T {
        guard let url = URL(string: baseURL + path) else {
            throw SyncError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw SyncError.invalidResponse
        }
        
        if httpResponse.statusCode == 401 {
            await MainActor.run {
                self.logout()
            }
            throw SyncError.unauthorized
        }
        
        if httpResponse.statusCode >= 400 {
            if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                throw SyncError.serverError(errorResponse.error)
            }
            throw SyncError.serverError("请求失败")
        }
        
        return try JSONDecoder().decode(T.self, from: data)
    }
    
    private func post<T: Decodable>(_ path: String, body: [String: Any]) async throws -> T {
        guard let url = URL(string: baseURL + path) else {
            throw SyncError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw SyncError.invalidResponse
        }
        
        if httpResponse.statusCode == 401 {
            await MainActor.run {
                self.logout()
            }
            throw SyncError.unauthorized
        }
        
        if httpResponse.statusCode >= 400 {
            if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                throw SyncError.serverError(errorResponse.error)
            }
            throw SyncError.serverError("请求失败")
        }
        
        return try JSONDecoder().decode(T.self, from: data)
    }
    
    private func delete<T: Decodable>(_ path: String) async throws -> T {
        guard let url = URL(string: baseURL + path) else {
            throw SyncError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw SyncError.invalidResponse
        }
        
        if httpResponse.statusCode >= 400 {
            if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                throw SyncError.serverError(errorResponse.error)
            }
            throw SyncError.serverError("请求失败")
        }
        
        return try JSONDecoder().decode(T.self, from: data)
    }
    
    private func getDeviceId() -> String {
        if let deviceId = UserDefaults.standard.string(forKey: "device_id") {
            return deviceId
        }
        let newId = UUID().uuidString
        UserDefaults.standard.set(newId, forKey: "device_id")
        return newId
    }
}

// MARK: - 数据模型

struct User: Codable {
    let id: String
    let email: String
    let name: String?
}

struct AuthResponse: Codable {
    let success: Bool
    let token: String
    let user: User
}

struct VerifyResponse: Codable {
    let success: Bool
    let user: User
}

struct SuccessResponse: Codable {
    let success: Bool
}

struct ErrorResponse: Codable {
    let error: String
}

struct CloudTask: Codable {
    let id: String
    let text: String
    let notes: String?
    let completed: Bool
    let priority: String
    let category: String
    let dueDate: String?
    let recurring: String?
    let createdAt: Int?
    let updatedAt: Int?
    
    func toTodoTask() -> TodoTask {
        var task = TodoTask(
            id: id,
            text: text,
            notes: notes ?? "",
            completed: completed,
            priority: TodoTask.Priority(rawValue: priority) ?? .medium,
            category: TodoTask.Category(rawValue: category) ?? .personal
        )
        
        if let dueDateStr = dueDate {
            task.dueDate = ISO8601DateFormatter().date(from: dueDateStr)
        }
        
        if let createdAt = createdAt {
            task.createdAt = Date(timeIntervalSince1970: Double(createdAt) / 1000)
        }
        
        if let updatedAt = updatedAt {
            task.updatedAt = Date(timeIntervalSince1970: Double(updatedAt) / 1000)
        }
        
        return task
    }
}

struct TasksResponse: Codable {
    let success: Bool
    let tasks: [CloudTask]
}

struct SyncResponse: Codable {
    let success: Bool
    let tasks: [CloudTask]
    let updated: Int
    let created: Int
    let syncTime: Int
}

struct FullSyncData: Codable {
    let tasks: [CloudTask]
    let profile: [String: String]?
    let settings: [String: String]?
}

struct FullSyncResponse: Codable {
    let success: Bool
    let data: FullSyncData
    let syncTime: Int
}

// MARK: - 错误类型

enum SyncError: LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case serverError(String)
    case networkError(Error)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "无效的URL"
        case .invalidResponse:
            return "无效的响应"
        case .unauthorized:
            return "登录已过期，请重新登录"
        case .serverError(let message):
            return message
        case .networkError(let error):
            return error.localizedDescription
        }
    }
}

