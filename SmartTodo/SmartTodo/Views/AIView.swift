import SwiftUI

struct AIView: View {
    @EnvironmentObject var aiViewModel: AIViewModel
    @EnvironmentObject var taskViewModel: TaskViewModel
    @EnvironmentObject var settingsViewModel: SettingsViewModel
    @State private var inputText = ""
    @FocusState private var isInputFocused: Bool
    
    var themeColor: Color {
        settingsViewModel.themeColor.color
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Luma风格简洁头部
            LumaStyleHeader(themeColor: themeColor)
            
            // 消息列表
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 16) {
                        ForEach(aiViewModel.messages) { message in
                            MessageBubbleView(message: message, themeColor: themeColor)
                                .id(message.id)
                        }
                        
                        if aiViewModel.isLoading {
                            TypingBubble(themeColor: themeColor)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 20)
                }
                .onChange(of: aiViewModel.messages.count) { oldValue, newValue in
                    if let lastMessage = aiViewModel.messages.last {
                        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                            proxy.scrollTo(lastMessage.id, anchor: .bottom)
                        }
                    }
                }
            }
            
            // 快捷操作
            QuickActionsRow(themeColor: themeColor, sendQuickMessage: sendQuickMessage)
            
            // 输入区域
            ChatInputBar(
                inputText: $inputText,
                isInputFocused: $isInputFocused,
                themeColor: themeColor,
                sendMessage: sendMessage
            )
            
            // 底部留空给导航栏
            Color.clear
                .frame(height: 100)
        }
        .background(Color(red: 0.05, green: 0.05, blue: 0.07).ignoresSafeArea())
    }
    
    func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        
        inputText = ""
        isInputFocused = false
        
        Task {
            await aiViewModel.sendMessage(text, taskViewModel: taskViewModel)
        }
    }
    
    func sendQuickMessage(_ text: String) {
        Task {
            await aiViewModel.sendMessage(text, taskViewModel: taskViewModel)
        }
    }
}

// MARK: - Luma风格头部
struct LumaStyleHeader: View {
    let themeColor: Color
    
    var body: some View {
        HStack(spacing: 12) {
            // AI 头像
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [themeColor, themeColor.opacity(0.6)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 40, height: 40)
                
                Image(systemName: "sparkles")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text("AI 智能助手")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(.white)
                
                HStack(spacing: 4) {
                    Circle()
                        .fill(Color.green)
                        .frame(width: 6, height: 6)
                    Text("在线")
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.5))
                }
            }
            
            Spacer()
            
            // 右侧按钮组 - Luma风格胶囊
            HStack(spacing: 0) {
                Button(action: {}) {
                    Image(systemName: "plus")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(.white.opacity(0.8))
                        .frame(width: 40, height: 36)
                }
                
                Button(action: {}) {
                    Image(systemName: "bell")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(.white.opacity(0.8))
                        .frame(width: 40, height: 36)
                }
            }
            .background(
                Capsule()
                    .fill(Color.white.opacity(0.1))
                    .overlay(
                        Capsule()
                            .stroke(Color.white.opacity(0.15), lineWidth: 0.5)
                    )
            )
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}

// MARK: - 消息气泡
struct MessageBubbleView: View {
    let message: ChatMessage
    let themeColor: Color
    
    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if message.isUser {
                Spacer(minLength: 50)
            } else {
                // AI 头像
                Circle()
                    .fill(themeColor.opacity(0.2))
                    .frame(width: 28, height: 28)
                    .overlay(
                        Image(systemName: "sparkles")
                            .font(.system(size: 12))
                            .foregroundColor(themeColor)
                    )
            }
            
            VStack(alignment: message.isUser ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .font(.system(size: 15))
                    .foregroundColor(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(
                        message.isUser
                            ? AnyShapeStyle(
                                LinearGradient(
                                    colors: [themeColor, themeColor.opacity(0.8)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                              )
                            : AnyShapeStyle(Color.white.opacity(0.1))
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                
                Text(formatTime(message.timestamp))
                    .font(.system(size: 10))
                    .foregroundColor(.white.opacity(0.3))
            }
            
            if !message.isUser {
                Spacer(minLength: 50)
            }
        }
    }
    
    func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }
}

// MARK: - 加载指示器
struct TypingBubble: View {
    let themeColor: Color
    @State private var animating = false
    
    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            Circle()
                .fill(themeColor.opacity(0.2))
                .frame(width: 28, height: 28)
                .overlay(
                    Image(systemName: "sparkles")
                        .font(.system(size: 12))
                        .foregroundColor(themeColor)
                )
            
            HStack(spacing: 4) {
                ForEach(0..<3) { index in
                    Circle()
                        .fill(themeColor)
                        .frame(width: 6, height: 6)
                        .scaleEffect(animating ? 1 : 0.5)
                        .animation(
                            .easeInOut(duration: 0.5)
                            .repeatForever()
                            .delay(Double(index) * 0.15),
                            value: animating
                        )
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.white.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            
            Spacer()
        }
        .onAppear { animating = true }
    }
}

// MARK: - 快捷操作行
struct QuickActionsRow: View {
    let themeColor: Color
    let sendQuickMessage: (String) -> Void
    
    let actions: [(icon: String, text: String, message: String)] = [
        ("wand.and.stars", "每日规划", "帮我制定今天的计划"),
        ("doc.text", "今日总结", "今日总结"),
        ("lightbulb", "智能建议", "给我一些建议")
    ]
    
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(actions, id: \.text) { action in
                    Button(action: { sendQuickMessage(action.message) }) {
                        HStack(spacing: 6) {
                            Image(systemName: action.icon)
                                .font(.system(size: 12, weight: .medium))
                            Text(action.text)
                                .font(.system(size: 13, weight: .medium))
                        }
                        .foregroundColor(.white.opacity(0.8))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            Capsule()
                                .fill(Color.white.opacity(0.08))
                                .overlay(
                                    Capsule()
                                        .stroke(Color.white.opacity(0.1), lineWidth: 0.5)
                                )
                        )
                    }
                }
            }
            .padding(.horizontal, 16)
        }
        .padding(.vertical, 8)
    }
}

// MARK: - 输入栏
struct ChatInputBar: View {
    @Binding var inputText: String
    var isInputFocused: FocusState<Bool>.Binding
    let themeColor: Color
    let sendMessage: () -> Void
    
    var canSend: Bool {
        !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
    
    var body: some View {
        HStack(spacing: 10) {
            // 输入框
            HStack(spacing: 8) {
                TextField("输入消息...", text: $inputText, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(.system(size: 15))
                    .foregroundColor(.white)
                    .focused(isInputFocused)
                    .lineLimit(1...4)
                
                if !inputText.isEmpty {
                    Button(action: { inputText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 16))
                            .foregroundColor(.white.opacity(0.3))
                    }
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                Capsule()
                    .fill(Color.white.opacity(0.08))
                    .overlay(
                        Capsule()
                            .stroke(Color.white.opacity(0.1), lineWidth: 0.5)
                    )
            )
            
            // 发送按钮
            Button(action: sendMessage) {
                Circle()
                    .fill(
                        canSend
                            ? LinearGradient(colors: [themeColor, themeColor.opacity(0.8)], startPoint: .topLeading, endPoint: .bottomTrailing)
                            : LinearGradient(colors: [Color.white.opacity(0.1), Color.white.opacity(0.08)], startPoint: .topLeading, endPoint: .bottomTrailing)
                    )
                    .frame(width: 40, height: 40)
                    .overlay(
                        Image(systemName: "arrow.up")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(canSend ? .white : .white.opacity(0.3))
                    )
                    .shadow(color: canSend ? themeColor.opacity(0.3) : .clear, radius: 8, y: 4)
            }
            .disabled(!canSend)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color(red: 0.05, green: 0.05, blue: 0.07))
    }
}

#Preview {
    AIView()
        .environmentObject(AIViewModel())
        .environmentObject(TaskViewModel())
        .environmentObject(SettingsViewModel())
}
