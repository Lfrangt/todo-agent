import Foundation

struct TodoTask: Identifiable, Codable {
    var id: String = UUID().uuidString
    var text: String
    var notes: String = ""
    var completed: Bool = false
    var priority: Priority = .medium
    var category: Category = .personal
    var dueDate: Date?
    var createdAt: Date = Date()
    var updatedAt: Date = Date()
    
    enum Priority: String, Codable, CaseIterable {
        case low, medium, high
        
        var color: String {
            switch self {
            case .low: return "green"
            case .medium: return "yellow"
            case .high: return "red"
            }
        }
        
        var label: String {
            switch self {
            case .low: return "低"
            case .medium: return "中"
            case .high: return "高"
            }
        }
    }
    
    enum Category: String, Codable, CaseIterable {
        case personal, work, health, study, other
        
        var label: String {
            switch self {
            case .personal: return "个人"
            case .work: return "工作"
            case .health: return "健康"
            case .study: return "学习"
            case .other: return "其他"
            }
        }
        
        var icon: String {
            switch self {
            case .personal: return "🏠"
            case .work: return "💼"
            case .health: return "💪"
            case .study: return "📚"
            case .other: return "📌"
            }
        }
    }
}

struct ChatMessage: Identifiable {
    let id = UUID()
    let content: String
    let isUser: Bool
    let timestamp: Date = Date()
}

