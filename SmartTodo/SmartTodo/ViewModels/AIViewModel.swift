import Foundation

class AIViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var isLoading: Bool = false
    @Published var apiKey: String = ""
    
    private let apiKeyStorage = "gemini_api_key"
    
    init() {
        loadApiKey()
        // 添加欢迎消息
        messages.append(ChatMessage(
            content: "👋 你好！我是你的智能助手。\n\n我可以帮你：\n• 添加和管理任务\n• 制定每日计划\n• 提供智能建议\n\n直接告诉我你想做什么吧！",
            isUser: false
        ))
    }
    
    func sendMessage(_ text: String, taskViewModel: TaskViewModel) async {
        let userMessage = ChatMessage(content: text, isUser: true)
        
        await MainActor.run {
            messages.append(userMessage)
            isLoading = true
        }
        
        // 分析用户意图并处理
        let response = await processWithAI(text, tasks: taskViewModel.tasks)
        
        await MainActor.run {
            messages.append(ChatMessage(content: response.message, isUser: false))
            isLoading = false
            
            // 执行任务操作
            if let action = response.action {
                executeAction(action, taskViewModel: taskViewModel)
            }
        }
    }
    
    private func processWithAI(_ text: String, tasks: [TodoTask]) async -> AIResponse {
        // 简单的意图识别
        let lowercased = text.lowercased()
        
        // 添加任务
        if lowercased.contains("添加") || lowercased.contains("新建") || lowercased.contains("创建") {
            let taskText = extractTaskText(from: text)
            if !taskText.isEmpty {
                return AIResponse(
                    message: "✅ 好的，已为你添加任务「\(taskText)」",
                    action: .addTask(text: taskText)
                )
            }
        }
        
        // 查看任务
        if lowercased.contains("查看") || lowercased.contains("列出") || lowercased.contains("有什么任务") {
            let pendingTasks = tasks.filter { !$0.completed }
            if pendingTasks.isEmpty {
                return AIResponse(message: "🎉 太棒了！你目前没有待完成的任务。", action: nil)
            } else {
                let taskList = pendingTasks.prefix(5).map { "• \($0.text)" }.joined(separator: "\n")
                return AIResponse(
                    message: "📋 你有 \(pendingTasks.count) 个待完成任务：\n\n\(taskList)",
                    action: nil
                )
            }
        }
        
        // 今日总结
        if lowercased.contains("总结") || lowercased.contains("统计") {
            let completed = tasks.filter { $0.completed }.count
            let pending = tasks.filter { !$0.completed }.count
            return AIResponse(
                message: "📊 今日统计：\n\n✅ 已完成：\(completed) 个\n⏳ 待完成：\(pending) 个\n\n继续加油！",
                action: nil
            )
        }
        
        // 调用 Gemini API
        if !apiKey.isEmpty {
            if let geminiResponse = await callGeminiAPI(text) {
                return AIResponse(message: geminiResponse, action: nil)
            }
        }
        
        // 默认回复
        return AIResponse(
            message: "我理解你说的是「\(text)」。\n\n你可以试试：\n• 「添加任务：买菜」\n• 「查看今天的任务」\n• 「今日总结」",
            action: nil
        )
    }
    
    private func extractTaskText(from text: String) -> String {
        // 简单提取任务内容
        let patterns = ["添加任务", "新建任务", "创建任务", "添加", "新建", "创建", "帮我", "：", ":"]
        var result = text
        for pattern in patterns {
            result = result.replacingOccurrences(of: pattern, with: "")
        }
        return result.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    private func executeAction(_ action: AIAction, taskViewModel: TaskViewModel) {
        switch action {
        case .addTask(let text):
            let task = TodoTask(text: text, dueDate: Date())
            taskViewModel.addTask(task)
        }
    }
    
    private func callGeminiAPI(_ prompt: String) async -> String? {
        guard !apiKey.isEmpty else { return nil }
        
        let url = URL(string: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=\(apiKey)")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "contents": [
                ["parts": [["text": prompt]]]
            ]
        ]
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let candidates = json["candidates"] as? [[String: Any]],
               let content = candidates.first?["content"] as? [String: Any],
               let parts = content["parts"] as? [[String: Any]],
               let text = parts.first?["text"] as? String {
                return text
            }
        } catch {
            print("Gemini API error: \(error)")
        }
        
        return nil
    }
    
    func saveApiKey(_ key: String) {
        apiKey = key
        UserDefaults.standard.set(key, forKey: apiKeyStorage)
    }
    
    private func loadApiKey() {
        apiKey = UserDefaults.standard.string(forKey: apiKeyStorage) ?? ""
    }
}

struct AIResponse {
    let message: String
    let action: AIAction?
}

enum AIAction {
    case addTask(text: String)
}

