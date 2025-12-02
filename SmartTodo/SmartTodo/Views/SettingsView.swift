import SwiftUI
import AuthenticationServices
import CommonCrypto

struct SettingsView: View {
    @EnvironmentObject var settingsViewModel: SettingsViewModel
    @EnvironmentObject var aiViewModel: AIViewModel
    @EnvironmentObject var taskViewModel: TaskViewModel
    @StateObject private var cloudSync = CloudSyncService.shared
    
    @State private var apiKey = ""
    @State private var showLoginSheet = false
    @State private var showAlert = false
    @State private var alertMessage = ""
    @State private var isSyncing = false
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // 标题
                HStack {
                    Text("⚙️ 设置")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                    Spacer()
                }
                
                // 云端备份设置
                SettingsSection(title: "☁️ 云端备份") {
                    VStack(spacing: 16) {
                        if cloudSync.isLoggedIn {
                            // 已登录状态
                            HStack {
                                Image(systemName: "person.circle.fill")
                                    .font(.system(size: 40))
                                    .foregroundColor(settingsViewModel.themeColor.color)
                                
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(cloudSync.currentUser?.email ?? "已登录")
                                        .font(.headline)
                                        .foregroundColor(.white)
                                    
                                    if let lastSync = cloudSync.lastSyncTime {
                                        Text("上次同步: \(formatDate(lastSync))")
                                            .font(.caption)
                                            .foregroundColor(.gray)
                                    }
                                }
                                
                                Spacer()
                                
                                // 同步状态指示
                                if cloudSync.isSyncing {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Circle()
                                        .fill(Color.green)
                                        .frame(width: 10, height: 10)
                                }
                            }
                            
                            Divider()
                                .background(Color.white.opacity(0.2))
                            
                            // 同步按钮
                            Button(action: syncNow) {
                                HStack {
                                    Image(systemName: "arrow.triangle.2.circlepath")
                                    Text(isSyncing ? "同步中..." : "立即同步")
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(settingsViewModel.themeColor.color)
                                .foregroundColor(.white)
                                .cornerRadius(10)
                            }
                            .disabled(isSyncing)
                            
                            // 登出按钮
                            Button(action: {
                                cloudSync.logout()
                            }) {
                                HStack {
                                    Image(systemName: "rectangle.portrait.and.arrow.right")
                                    Text("退出登录")
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(Color.red.opacity(0.2))
                                .foregroundColor(.red)
                                .cornerRadius(10)
                            }
                        } else {
                            // 未登录状态
                            VStack(spacing: 12) {
                                Image(systemName: "icloud")
                                    .font(.system(size: 50))
                                    .foregroundColor(.gray)
                                
                                Text("登录以启用云端备份")
                                    .foregroundColor(.white)
                                
                                Text("您的任务将自动同步到云端，随时随地访问")
                                    .font(.caption)
                                    .foregroundColor(.gray)
                                    .multilineTextAlignment(.center)
                                
                                Button(action: { showLoginSheet = true }) {
                                    HStack {
                                        Image(systemName: "person.badge.plus")
                                        Text("登录 / 注册")
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                                    .background(settingsViewModel.themeColor.color)
                                    .foregroundColor(.white)
                                    .cornerRadius(10)
                                }
                            }
                            .padding(.vertical, 8)
                        }
                    }
                }
                
                // 外观设置
                SettingsSection(title: "🎨 外观") {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("主题色")
                            .foregroundColor(.white)
                        
                        HStack(spacing: 12) {
                            ForEach(SettingsViewModel.ThemeColor.allCases, id: \.self) { color in
                                Circle()
                                    .fill(color.color)
                                    .frame(width: 36, height: 36)
                                    .overlay(
                                        Circle()
                                            .stroke(Color.white, lineWidth: settingsViewModel.themeColor == color ? 3 : 0)
                                    )
                                    .onTapGesture {
                                        settingsViewModel.themeColor = color
                                        settingsViewModel.saveSettings()
                                    }
                            }
                        }
                    }
                }
                
                // 通知设置
                SettingsSection(title: "🔔 通知") {
                    SettingsToggle(
                        title: "任务提醒",
                        subtitle: "在任务到期前提醒您",
                        isOn: $settingsViewModel.notificationsEnabled
                    )
                    
                    SettingsToggle(
                        title: "完成音效",
                        subtitle: "完成任务时播放音效",
                        isOn: $settingsViewModel.soundEnabled
                    )
                }
                
                // 番茄钟设置
                SettingsSection(title: "🍅 番茄钟") {
                    VStack(spacing: 16) {
                        SettingsStepper(
                            title: "专注时长",
                            value: $settingsViewModel.pomodoroMinutes,
                            range: 15...60,
                            unit: "分钟"
                        )
                        
                        SettingsStepper(
                            title: "休息时长",
                            value: $settingsViewModel.breakMinutes,
                            range: 3...15,
                            unit: "分钟"
                        )
                    }
                }
                
                // AI 设置
                SettingsSection(title: "🤖 AI 设置") {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Gemini API Key")
                            .foregroundColor(.white)
                        
                        SecureField("输入 API Key", text: $apiKey)
                            .textFieldStyle(.plain)
                            .padding(12)
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(10)
                            .foregroundColor(.white)
                        
                        Button(action: {
                            aiViewModel.saveApiKey(apiKey)
                            alertMessage = "API Key 已保存"
                            showAlert = true
                        }) {
                            Text("保存")
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(settingsViewModel.themeColor.color)
                                .foregroundColor(.white)
                                .cornerRadius(10)
                        }
                    }
                }
                
                // 关于
                SettingsSection(title: "ℹ️ 关于") {
                    VStack(spacing: 12) {
                        HStack {
                            RoundedRectangle(cornerRadius: 12)
                                .fill(settingsViewModel.themeColor.color)
                                .frame(width: 60, height: 60)
                                .overlay(
                                    Image(systemName: "checkmark")
                                        .font(.title)
                                        .foregroundColor(.white)
                                )
                            
                            VStack(alignment: .leading) {
                                Text("Smart Todo")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                Text("版本 1.0.0")
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            }
                            
                            Spacer()
                        }
                    }
                }
            }
            .padding()
            .padding(.bottom, 120)
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
        .onAppear {
            apiKey = aiViewModel.apiKey
        }
        .sheet(isPresented: $showLoginSheet) {
            LoginView(cloudSync: cloudSync)
        }
        .alert("提示", isPresented: $showAlert) {
            Button("确定", role: .cancel) {}
        } message: {
            Text(alertMessage)
        }
    }
    
    private func syncNow() {
        isSyncing = true
        
        Task {
            do {
                let _ = try await cloudSync.syncTasks(taskViewModel.tasks)
                
                await MainActor.run {
                    isSyncing = false
                    alertMessage = "同步成功！"
                    showAlert = true
                }
            } catch {
                await MainActor.run {
                    isSyncing = false
                    alertMessage = error.localizedDescription
                    showAlert = true
                }
            }
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MM-dd HH:mm"
        return formatter.string(from: date)
    }
}

// MARK: - 登录视图
struct LoginView: View {
    @ObservedObject var cloudSync: CloudSyncService
    @Environment(\.dismiss) var dismiss
    
    @State private var isLogin = true
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var isLoading = false
    @State private var errorMessage = ""
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                // Logo
                ZStack {
                    Circle()
                        .fill(Color(red: 0.2, green: 0.8, blue: 0.7))
                        .frame(width: 80, height: 80)
                    
                    Image(systemName: "icloud.fill")
                        .font(.system(size: 36))
                        .foregroundColor(.white)
                }
                .padding(.top, 40)
                
                Text(isLogin ? "登录账户" : "创建账户")
                    .font(.title)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
                
                Text("同步您的任务到云端")
                    .foregroundColor(.gray)
                
                // Sign in with Apple 按钮
                SignInWithAppleButton(
                    onRequest: { request in
                        request.requestedScopes = [.fullName, .email]
                    },
                    onCompletion: handleAppleSignIn
                )
                .signInWithAppleButtonStyle(.white)
                .frame(height: 50)
                .cornerRadius(12)
                .padding(.horizontal)
                
                // Google 登录按钮
                Button(action: signInWithGoogle) {
                    HStack(spacing: 12) {
                        Image(systemName: "g.circle.fill")
                            .font(.system(size: 20))
                        Text("Sign in with Google")
                            .font(.system(size: 17, weight: .medium))
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(Color.white)
                    .foregroundColor(.black)
                    .cornerRadius(12)
                }
                .padding(.horizontal)
                
                // 分割线
                HStack {
                    Rectangle()
                        .fill(Color.white.opacity(0.2))
                        .frame(height: 1)
                    Text("或")
                        .foregroundColor(.gray)
                        .font(.caption)
                    Rectangle()
                        .fill(Color.white.opacity(0.2))
                        .frame(height: 1)
                }
                .padding(.horizontal)
                
                // 邮箱密码登录
                VStack(spacing: 14) {
                    if !isLogin {
                        TextField("昵称", text: $name)
                            .textFieldStyle(.plain)
                            .padding(14)
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(12)
                            .foregroundColor(.white)
                    }
                    
                    TextField("邮箱", text: $email)
                        .textFieldStyle(.plain)
                        .textContentType(.emailAddress)
                        .autocapitalization(.none)
                        .padding(14)
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(12)
                        .foregroundColor(.white)
                    
                    SecureField("密码", text: $password)
                        .textFieldStyle(.plain)
                        .padding(14)
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(12)
                        .foregroundColor(.white)
                }
                .padding(.horizontal)
                
                if !errorMessage.isEmpty {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundColor(.red)
                }
                
                Button(action: submit) {
                    HStack {
                        if isLoading {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text(isLogin ? "登录" : "注册")
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color(red: 0.2, green: 0.8, blue: 0.7))
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
                .disabled(isLoading || email.isEmpty || password.isEmpty)
                .padding(.horizontal)
                
                Button(action: { isLogin.toggle() }) {
                    Text(isLogin ? "没有账户？点击注册" : "已有账户？点击登录")
                        .foregroundColor(.gray)
                }
                
                if isLogin {
                    Button(action: resetAccount) {
                        Text("忘记密码？重置账户")
                            .font(.caption)
                            .foregroundColor(.orange)
                    }
                    .padding(.top, 8)
                }
                
                Spacer()
            }
            .background(Color(red: 0.05, green: 0.05, blue: 0.08).ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        dismiss()
                    }
                    .foregroundColor(.gray)
                }
            }
        }
    }
    
    private func submit() {
        isLoading = true
        errorMessage = ""
        
        Task {
            do {
                if isLogin {
                    let _ = try await cloudSync.login(email: email, password: password)
                } else {
                    let _ = try await cloudSync.register(email: email, password: password, name: name)
                }
                
                await MainActor.run {
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                    errorMessage = error.localizedDescription
                }
            }
        }
    }
    
    private func signInWithGoogle() {
        // Google OAuth 配置 - 使用 Web Client + PKCE 流程
        let clientId = "367292299132-qrcf10ljl9dnroeq3bequ3ro3e6471ds.apps.googleusercontent.com" // Web Client
        let callbackScheme = "com.smarttodo.app"
        let redirectUri = "\(callbackScheme):/oauth2callback"
        let scope = "email profile openid"
        
        // 生成 PKCE code verifier 和 challenge
        let codeVerifier = generateCodeVerifier()
        let codeChallenge = generateCodeChallenge(from: codeVerifier)
        
        var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "redirect_uri", value: redirectUri),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: scope),
            URLQueryItem(name: "code_challenge", value: codeChallenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "access_type", value: "offline")
        ]
        
        guard let authURL = components.url else {
            errorMessage = "无法创建 Google 登录 URL"
            return
        }
        
        // 保存 code verifier 用于后续交换 token
        let savedCodeVerifier = codeVerifier
        
        // 使用 ASWebAuthenticationSession
        let session = ASWebAuthenticationSession(url: authURL, callbackURLScheme: callbackScheme) { callbackURL, error in
            if let error = error {
                DispatchQueue.main.async {
                    self.errorMessage = "Google 授权取消"
                }
                print("Google auth error: \(error)")
                return
            }
            
            guard let callbackURL = callbackURL,
                  let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                  let code = components.queryItems?.first(where: { $0.name == "code" })?.value else {
                DispatchQueue.main.async {
                    self.errorMessage = "Google 登录失败"
                }
                return
            }
            
            // 用授权码换取 token
            Task {
                do {
                    let _ = try await cloudSync.loginWithGooglePKCE(
                        code: code,
                        codeVerifier: savedCodeVerifier,
                        redirectUri: redirectUri
                    )
                    await MainActor.run {
                        dismiss()
                    }
                } catch {
                    await MainActor.run {
                        self.errorMessage = "登录失败: \(error.localizedDescription)"
                    }
                }
            }
        }
        
        session.presentationContextProvider = GoogleSignInContextProvider.shared
        session.prefersEphemeralWebBrowserSession = false
        session.start()
    }
    
    // PKCE: 生成 code verifier (43-128 字符的随机字符串)
    private func generateCodeVerifier() -> String {
        var buffer = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, buffer.count, &buffer)
        return Data(buffer).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
    
    // PKCE: 生成 code challenge (SHA256 hash of verifier)
    private func generateCodeChallenge(from verifier: String) -> String {
        guard let data = verifier.data(using: .utf8) else { return "" }
        var hash = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        data.withUnsafeBytes {
            _ = CC_SHA256($0.baseAddress, CC_LONG(data.count), &hash)
        }
        return Data(hash).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
    
    private func resetAccount() {
        guard !email.isEmpty, !password.isEmpty else {
            errorMessage = "请输入邮箱和新密码"
            return
        }
        
        isLoading = true
        errorMessage = ""
        
        Task {
            do {
                // 使用 force-register 端点重置账户
                let _ = try await cloudSync.forceRegister(email: email, password: password, name: name)
                
                await MainActor.run {
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                    errorMessage = error.localizedDescription
                }
            }
        }
    }
    
    private func handleAppleSignIn(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            if let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential {
                guard let identityTokenData = appleIDCredential.identityToken,
                      let identityToken = String(data: identityTokenData, encoding: .utf8) else {
                    errorMessage = "无法获取 Apple 登录凭证"
                    return
                }
                
                let email = appleIDCredential.email
                let fullName = [appleIDCredential.fullName?.givenName, appleIDCredential.fullName?.familyName]
                    .compactMap { $0 }
                    .joined(separator: " ")
                
                isLoading = true
                
                Task {
                    do {
                        let _ = try await cloudSync.loginWithApple(
                            identityToken: identityToken,
                            email: email,
                            fullName: fullName.isEmpty ? nil : fullName
                        )
                        
                        await MainActor.run {
                            dismiss()
                        }
                    } catch {
                        await MainActor.run {
                            isLoading = false
                            errorMessage = error.localizedDescription
                        }
                    }
                }
            }
        case .failure(let error):
            errorMessage = error.localizedDescription
        }
    }
}

struct SettingsSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(title)
                .font(.headline)
                .foregroundColor(.white)
            
            content
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
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

struct SettingsToggle: View {
    let title: String
    let subtitle: String
    @Binding var isOn: Bool
    @EnvironmentObject var settingsViewModel: SettingsViewModel
    
    var body: some View {
        Toggle(isOn: $isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .foregroundColor(.white)
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(.gray)
            }
        }
        .tint(settingsViewModel.themeColor.color)
        .onChange(of: isOn) { oldValue, newValue in
            settingsViewModel.saveSettings()
        }
    }
}

struct SettingsStepper: View {
    let title: String
    @Binding var value: Int
    let range: ClosedRange<Int>
    let unit: String
    @EnvironmentObject var settingsViewModel: SettingsViewModel
    
    var body: some View {
        HStack {
            Text(title)
                .foregroundColor(.white)
            
            Spacer()
            
            HStack(spacing: 12) {
                Button(action: {
                    if value > range.lowerBound {
                        value -= 5
                        settingsViewModel.saveSettings()
                    }
                }) {
                    Image(systemName: "minus.circle")
                        .foregroundColor(.gray)
                }
                
                Text("\(value) \(unit)")
                    .foregroundColor(.white)
                    .frame(width: 80)
                
                Button(action: {
                    if value < range.upperBound {
                        value += 5
                        settingsViewModel.saveSettings()
                    }
                }) {
                    Image(systemName: "plus.circle")
                        .foregroundColor(.gray)
                }
            }
        }
    }
}

// MARK: - Google Sign In Context Provider
class GoogleSignInContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = GoogleSignInContextProvider()
    
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = scene.windows.first else {
            return ASPresentationAnchor()
        }
        return window
    }
}

#Preview {
    SettingsView()
        .environmentObject(SettingsViewModel())
        .environmentObject(AIViewModel())
        .environmentObject(TaskViewModel())
}
