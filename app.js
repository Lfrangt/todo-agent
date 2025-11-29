// Smart Todo Agent Application v2.0 - iOS Edition

// ==================== 同步服务 ====================
class SyncService {
  constructor(app) {
    this.app = app;
    this.serverUrl = localStorage.getItem('syncServerUrl') || 'https://todo-agent-production-e6aa.up.railway.app';
    this.token = localStorage.getItem('syncToken') || '';
    this.user = JSON.parse(localStorage.getItem('syncUser') || 'null');
    this.lastSyncTime = parseInt(localStorage.getItem('lastSyncTime') || '0');
    this.isSyncing = false;
    this.deviceId = this.getDeviceId();
    
    // 自动同步间隔（5分钟）
    this.autoSyncInterval = 5 * 60 * 1000;
    this.startAutoSync();
  }
  
  getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }
  
  isLoggedIn() {
    return !!this.token && !!this.user;
  }
  
  // 设置服务器地址
  setServerUrl(url) {
    this.serverUrl = url;
    localStorage.setItem('syncServerUrl', url);
  }
  
  // 注册
  async register(email, password, name) {
    try {
      const response = await fetch(`${this.serverUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('syncToken', this.token);
        localStorage.setItem('syncUser', JSON.stringify(this.user));
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error('Register error:', err);
      return { success: false, error: '网络错误' };
    }
  }
  
  // 强制注册（重置账户）
  async forceRegister(email, password, name) {
    try {
      const response = await fetch(`${this.serverUrl}/api/auth/force-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('syncToken', this.token);
        localStorage.setItem('syncUser', JSON.stringify(this.user));
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error('Force register error:', err);
      return { success: false, error: '网络错误，请检查服务器地址' };
    }
  }
  
  // 登录
  async login(email, password) {
    try {
      const response = await fetch(`${this.serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('syncToken', this.token);
        localStorage.setItem('syncUser', JSON.stringify(this.user));
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: '网络错误，请检查服务器地址' };
    }
  }
  
  // 登出
  logout() {
    this.token = '';
    this.user = null;
    localStorage.removeItem('syncToken');
    localStorage.removeItem('syncUser');
    localStorage.removeItem('lastSyncTime');
  }
  
  // 完整同步
  async fullSync() {
    if (!this.isLoggedIn() || this.isSyncing) {
      return { success: false, error: '未登录或正在同步中' };
    }
    
    this.isSyncing = true;
    this.updateSyncStatus('syncing');
    
    try {
      // 准备本地数据
      const localData = {
        tasks: this.app.tasks.map(t => ({
          ...t,
          updatedAt: t.updatedAt || t.createdAt || Date.now()
        })),
        profile: this.app.agent?.userProfile || {},
        memories: this.app.agent?.memory || {},
        settings: this.app.settings,
        lastSyncTime: this.lastSyncTime,
        deviceId: this.deviceId
      };
      
      const response = await fetch(`${this.serverUrl}/api/sync/full`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(localData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 更新本地数据
        this.app.tasks = data.data.tasks.map(t => ({
          ...t,
          completed: !!t.completed
        }));
        this.app.saveTasks();
        this.app.renderTasks();
        
        // 更新资料
        if (data.data.profile && this.app.agent) {
          this.app.agent.userProfile = data.data.profile;
          localStorage.setItem('userProfile', JSON.stringify(data.data.profile));
        }
        
        // 更新记忆
        if (data.data.memories && this.app.agent) {
          this.app.agent.memory = data.data.memories;
          this.app.agent.saveMemory();
        }
        
        // 更新设置
        if (data.data.settings) {
          this.app.settings = { ...this.app.settings, ...data.data.settings };
          this.app.saveSettings();
        }
        
        // 记录同步时间
        this.lastSyncTime = data.syncTime;
        localStorage.setItem('lastSyncTime', this.lastSyncTime.toString());
        
        this.updateSyncStatus('success');
        return { success: true, syncTime: data.syncTime };
      } else {
        this.updateSyncStatus('error');
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error('Sync error:', err);
      this.updateSyncStatus('error');
      return { success: false, error: '同步失败：' + err.message };
    } finally {
      this.isSyncing = false;
    }
  }
  
  // 更新同步状态显示
  updateSyncStatus(status) {
    const statusEl = document.getElementById('sync-status');
    const lastSyncEl = document.getElementById('last-sync-time');
    
    if (statusEl) {
      statusEl.className = `sync-status ${status}`;
      const texts = {
        syncing: '⏳ 同步中...',
        success: '✅ 已同步',
        error: '❌ 同步失败',
        offline: '📴 离线'
      };
      statusEl.textContent = texts[status] || '';
    }
    
    if (lastSyncEl && this.lastSyncTime) {
      const date = new Date(this.lastSyncTime);
      lastSyncEl.textContent = `上次同步: ${date.toLocaleString('zh-CN')}`;
    }
  }
  
  // 启动自动同步
  startAutoSync() {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
    }
    
    this.autoSyncTimer = setInterval(() => {
      if (this.isLoggedIn()) {
        this.fullSync();
      }
    }, this.autoSyncInterval);
  }
  
  // 停止自动同步
  stopAutoSync() {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
    }
  }
}

// ==================== AI AGENT CLASS ====================
class AIAgent {
  constructor(app) {
    this.app = app;
    this.conversationHistory = [];
    this.isProcessing = false;
    this.recognition = null;
    this.isRecording = false;
    
    // Load settings
    this.provider = localStorage.getItem('aiProvider') || 'gemini';
    this.apiKey = localStorage.getItem('aiApiKey') || '';
    
    // 记忆系统
    this.memory = this.loadMemory();
    this.userProfile = this.loadUserProfile();
    
    // Agent tools definition
    this.tools = this.defineTools();
    
    // System prompt for the agent
    this.systemPrompt = this.buildSystemPrompt();
    
    // Initialize speech recognition
    this.initSpeechRecognition();
    
    // 启动每日规划检查
    this.startDailyPlanChecker();
    
    // 附件状态
    this.pendingAttachment = null;
    
    // 初始化文件上传
    this.initFileUpload();
  }
  
  // 初始化文件上传
  initFileUpload() {
    const imageInput = document.getElementById('image-input');
    const fileInput = document.getElementById('file-input');
    const uploadImageBtn = document.getElementById('upload-image-btn');
    const uploadFileBtn = document.getElementById('upload-file-btn');
    
    if (uploadImageBtn && imageInput) {
      uploadImageBtn.addEventListener('click', () => imageInput.click());
      imageInput.addEventListener('change', (e) => this.handleImageSelect(e));
    }
    
    if (uploadFileBtn && fileInput) {
      uploadFileBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }
  }
  
  // 处理图片选择
  async handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      this.app.showToast('请选择图片文件', 'error');
      return;
    }
    
    // 验证文件大小 (最大 10MB)
    if (file.size > 10 * 1024 * 1024) {
      this.app.showToast('图片大小不能超过 10MB', 'error');
      return;
    }
    
    // 读取图片为 base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result.split(',')[1];
      this.pendingAttachment = {
        type: 'image',
        name: file.name,
        mimeType: file.type,
        data: base64,
        preview: event.target.result
      };
      this.showAttachmentPreview();
    };
    reader.readAsDataURL(file);
    
    // 清空 input
    e.target.value = '';
  }
  
  // 处理文件选择
  async handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // 验证文件大小 (最大 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.app.showToast('文件大小不能超过 5MB', 'error');
      return;
    }
    
    // 读取文件内容
    const reader = new FileReader();
    reader.onload = (event) => {
      this.pendingAttachment = {
        type: 'file',
        name: file.name,
        mimeType: file.type,
        content: event.target.result
      };
      this.showAttachmentPreview();
    };
    reader.readAsText(file);
    
    // 清空 input
    e.target.value = '';
  }
  
  // 显示附件预览
  showAttachmentPreview() {
    const preview = document.getElementById('attachment-preview');
    if (!preview || !this.pendingAttachment) return;
    
    const att = this.pendingAttachment;
    
    if (att.type === 'image') {
      preview.innerHTML = `
        <div class="attachment-item">
          <img src="${att.preview}" alt="预览">
          <span class="file-name">${att.name}</span>
          <button class="remove-attachment" onclick="todoApp.agent.removeAttachment()">
            <span class="material-icons-outlined" style="font-size: 14px;">close</span>
          </button>
        </div>
      `;
    } else {
      preview.innerHTML = `
        <div class="attachment-item">
          <div class="file-icon">
            <span class="material-icons-outlined" style="font-size: 18px;">description</span>
          </div>
          <span class="file-name">${att.name}</span>
          <button class="remove-attachment" onclick="todoApp.agent.removeAttachment()">
            <span class="material-icons-outlined" style="font-size: 14px;">close</span>
          </button>
        </div>
      `;
    }
    
    preview.classList.add('show');
  }
  
  // 移除附件
  removeAttachment() {
    this.pendingAttachment = null;
    const preview = document.getElementById('attachment-preview');
    if (preview) {
      preview.innerHTML = '';
      preview.classList.remove('show');
    }
  }
  
  // 启动每日规划定时检查
  startDailyPlanChecker() {
    // 立即检查一次
    setTimeout(() => this.checkAndGenerateDailyPlan(), 3000);
    
    // 每分钟检查一次
    setInterval(() => this.checkAndGenerateDailyPlan(), 60000);
  }
  
  // 检查并生成每日规划
  async checkAndGenerateDailyPlan() {
    if (this.checkDailyPlan() && this.apiKey) {
      console.log('Generating daily plan...');
      const plan = await this.generateDailyPlan();
      if (plan) {
        this.showDailyPlanNotification(plan);
      }
    }
  }
  
  // 手动触发每日规划（强制重新生成）
  async triggerDailyPlan() {
    if (!this.apiKey) {
      this.app.showToast('请先设置 API Key', 'warning');
      return;
    }
    
    this.app.showToast('正在生成今日规划...', 'info');
    
    // 清除今天的标记，允许重新生成
    localStorage.removeItem('lastDailyPlanDate');
    
    const plan = await this.generateDailyPlan();
    if (plan) {
      this.showDailyPlanNotification(plan);
    } else {
      this.app.showToast('规划生成失败，请稍后重试', 'error');
    }
  }
  
  // ==================== 记忆系统 ====================
  
  loadMemory() {
    const saved = localStorage.getItem('aiMemory');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      facts: [],           // 关于用户的事实 (如：用户是程序员)
      preferences: [],     // 用户偏好 (如：喜欢早起)
      goals: [],          // 用户目标 (如：想学日语)
      habits: [],         // 用户习惯 (如：每天跑步)
      relationships: [],  // 重要的人 (如：女朋友小美)
      interests: [],      // 兴趣爱好 (如：喜欢摄影)
      context: []         // 最近的重要上下文
    };
  }
  
  saveMemory() {
    localStorage.setItem('aiMemory', JSON.stringify(this.memory));
  }
  
  loadUserProfile() {
    const saved = localStorage.getItem('userProfile');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      name: '',
      occupation: '',
      background: '',
      personality: '',
      goals: '',
      challenges: ''
    };
  }
  
  saveUserProfile(profile) {
    this.userProfile = { ...this.userProfile, ...profile };
    localStorage.setItem('userProfile', JSON.stringify(this.userProfile));
  }
  
  // 添加记忆
  addMemory(category, content) {
    if (!this.memory[category]) {
      this.memory[category] = [];
    }
    
    // 避免重复
    const exists = this.memory[category].some(m => 
      m.content.toLowerCase() === content.toLowerCase()
    );
    
    if (!exists) {
      this.memory[category].push({
        content: content,
        timestamp: Date.now(),
        source: 'conversation'
      });
      
      // 限制每个类别最多20条记忆
      if (this.memory[category].length > 20) {
        this.memory[category] = this.memory[category].slice(-20);
      }
      
      this.saveMemory();
      console.log(`Memory added [${category}]:`, content);
    }
  }
  
  // 获取记忆摘要
  getMemorySummary() {
    const parts = [];
    
    if (this.userProfile.name) {
      parts.push(`用户名字：${this.userProfile.name}`);
    }
    if (this.userProfile.occupation) {
      parts.push(`职业：${this.userProfile.occupation}`);
    }
    if (this.userProfile.background) {
      parts.push(`背景：${this.userProfile.background}`);
    }
    if (this.userProfile.goals) {
      parts.push(`目标：${this.userProfile.goals}`);
    }
    if (this.userProfile.challenges) {
      parts.push(`挑战：${this.userProfile.challenges}`);
    }
    
    // 添加记忆
    for (const [category, items] of Object.entries(this.memory)) {
      if (items.length > 0) {
        const categoryNames = {
          facts: '关于用户',
          preferences: '偏好',
          goals: '目标',
          habits: '习惯',
          relationships: '重要的人',
          interests: '兴趣',
          context: '最近上下文'
        };
        const recentItems = items.slice(-5).map(m => m.content);
        if (recentItems.length > 0) {
          parts.push(`${categoryNames[category] || category}：${recentItems.join('、')}`);
        }
      }
    }
    
    return parts.length > 0 ? parts.join('\n') : '暂无记忆';
  }
  
  // 清除记忆
  clearMemory() {
    this.memory = {
      facts: [],
      preferences: [],
      goals: [],
      habits: [],
      relationships: [],
      interests: [],
      context: []
    };
    this.saveMemory();
  }
  
  // ==================== 每日智能规划系统 ====================
  
  // 检查是否需要生成每日规划
  checkDailyPlan() {
    // 检查是否启用每日规划
    const enabled = localStorage.getItem('dailyPlanEnabled') !== 'false';
    if (!enabled) return false;
    
    const today = this.app.getTodayString();
    const lastPlanDate = localStorage.getItem('lastDailyPlanDate');
    const hour = new Date().getHours();
    const planTime = parseInt(localStorage.getItem('dailyPlanTime') || '8');
    
    // 如果今天还没生成规划，且时间已过设定时间
    if (lastPlanDate !== today && hour >= planTime) {
      return true;
    }
    return false;
  }
  
  // 获取每日规划的提示
  getDailyPlanPrompt() {
    const today = new Date();
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][today.getDay()];
    const dateStr = today.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
    
    // 获取用户信息
    const memorySummary = this.getMemorySummary();
    const profile = this.userProfile;
    
    // 获取现有任务
    const existingTasks = this.app.tasks.filter(t => !t.completed);
    const todayTasks = existingTasks.filter(t => t.dueDate === this.app.getTodayString());
    
    return `# 每日智能规划任务

今天是 ${dateStr} ${weekday}

## 用户背景
${profile.name ? `姓名：${profile.name}` : ''}
${profile.occupation ? `职业：${profile.occupation}` : ''}
${profile.goals ? `目标：${profile.goals}` : ''}
${profile.challenges ? `挑战：${profile.challenges}` : ''}

## 用户记忆
${memorySummary}

## 现有任务
今日已有任务：${todayTasks.length} 个
${todayTasks.map(t => `- ${t.text}`).join('\n') || '无'}

待完成任务：${existingTasks.length} 个

## 你的任务
请为用户生成今日智能待办清单，需要：

1. **结合用户目标**：根据用户的长期目标，安排有助于实现目标的小任务
2. **健康习惯**：每天的健康小习惯（吃水果、喝水、运动等）
3. **学习成长**：有助于个人成长的学习任务（读书、学技能等）
4. **日常事务**：根据今天是${weekday}，安排合理的日常任务
5. **避免重复**：不要添加已有的任务

请生成 3-5 个建议任务，每个任务需要：
- 具体可执行（不要太笼统）
- 适合今天完成
- 对用户有长期价值

对于每个建议的任务，调用 add_task 函数添加，设置合理的分类和优先级。

最后用温暖的语气总结今天的规划，鼓励用户开始新的一天。`;
  }
  
  // 生成每日规划
  async generateDailyPlan() {
    if (!this.apiKey) {
      console.log('No API key, skipping daily plan');
      return null;
    }
    
    const prompt = this.getDailyPlanPrompt();
    
    try {
      // 使用 Gemini API 生成规划
      const functionDeclarations = this.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }));
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompt }] },
          contents: [{ role: 'user', parts: [{ text: '请为我生成今天的智能待办规划' }] }],
          tools: [{ functionDeclarations }],
          toolConfig: { functionCallingConfig: { mode: "AUTO" } },
          generationConfig: { temperature: 0.7, maxOutputTokens: 1500 }
        })
      });
      
      const data = await response.json();
      console.log('Daily plan response:', data);
      
      if (data.error) {
        throw new Error(data.error.message);
      }
      
      const candidate = data.candidates?.[0];
      if (!candidate) return null;
      
      const parts = candidate.content?.parts || [];
      let textResponse = '';
      const addedTasks = [];
      
      // 执行函数调用
      for (const part of parts) {
        if (part.text) {
          textResponse += part.text;
        }
        if (part.functionCall && part.functionCall.name === 'add_task') {
          const result = await this.executeTool('add_task', part.functionCall.args || {});
          if (result.success) {
            addedTasks.push(result.task);
          }
        }
      }
      
      // 记录今天已生成规划
      localStorage.setItem('lastDailyPlanDate', this.app.getTodayString());
      
      return {
        message: textResponse,
        tasks: addedTasks
      };
      
    } catch (error) {
      console.error('Daily plan error:', error);
      return null;
    }
  }
  
  // 显示每日规划通知
  showDailyPlanNotification(plan) {
    if (!plan || plan.tasks.length === 0) return;
    
    const taskList = plan.tasks.map(t => `• ${t.text}`).join('\n');
    
    // 在聊天中显示
    this.addMessage('assistant', `🌅 **早安！今日智能规划已生成**

我根据你的目标为今天安排了 ${plan.tasks.length} 个任务：

${taskList}

${plan.message || '祝你有美好的一天！💪'}

---
_点击任务可以查看详情，完成后记得打勾哦~_`);
    
    // 显示 toast
    this.app.showToast(`✨ 今日规划已生成 ${plan.tasks.length} 个任务`, 'success');
  }

  // Define available tools for the agent
  defineTools() {
    return [
      {
        name: "add_task",
        description: "添加一个新的待办任务",
        parameters: {
          type: "object",
          properties: {
            text: { type: "string", description: "任务内容" },
            priority: { type: "string", enum: ["high", "medium", "low"], description: "优先级：high=紧急, medium=普通, low=不急" },
            category: { type: "string", enum: ["work", "personal", "study", "health"], description: "分类：work=工作, personal=个人, study=学习, health=健康" },
            dueDate: { type: "string", description: "到期日期，格式：YYYY-MM-DD" }
          },
          required: ["text"]
        }
      },
      {
        name: "complete_task",
        description: "将一个任务标记为完成",
        parameters: {
          type: "object",
          properties: {
            taskId: { type: "number", description: "任务ID" }
          },
          required: ["taskId"]
        }
      },
      {
        name: "delete_task",
        description: "删除一个任务",
        parameters: {
          type: "object",
          properties: {
            taskId: { type: "number", description: "任务ID" }
          },
          required: ["taskId"]
        }
      },
      {
        name: "list_tasks",
        description: "列出任务，可以按条件筛选",
        parameters: {
          type: "object",
          properties: {
            filter: { type: "string", enum: ["all", "today", "pending", "completed", "overdue"], description: "筛选条件" }
          }
        }
      },
      {
        name: "get_task_summary",
        description: "获取任务统计摘要",
        parameters: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "update_task",
        description: "修改一个已存在的任务",
        parameters: {
          type: "object",
          properties: {
            taskId: { type: "number", description: "任务ID" },
            text: { type: "string", description: "新的任务内容" },
            priority: { type: "string", enum: ["high", "medium", "low"], description: "新的优先级" },
            dueDate: { type: "string", description: "新的到期日期" }
          },
          required: ["taskId"]
        }
      },
      {
        name: "search_tasks",
        description: "搜索包含关键词的任务",
        parameters: {
          type: "object",
          properties: {
            keyword: { type: "string", description: "搜索关键词" }
          },
          required: ["keyword"]
        }
      },
      {
        name: "save_memory",
        description: "保存关于用户的重要信息到记忆中，以便未来更好地帮助用户",
        parameters: {
          type: "object",
          properties: {
            category: { 
              type: "string", 
              enum: ["facts", "preferences", "goals", "habits", "relationships", "interests"],
              description: "记忆类别：facts=用户的基本情况, preferences=偏好, goals=目标计划, habits=习惯, relationships=重要的人, interests=兴趣爱好"
            },
            content: { type: "string", description: "要记住的内容，简洁描述" }
          },
          required: ["category", "content"]
        }
      }
    ];
  }

  // Build system prompt
  buildSystemPrompt() {
    const today = new Date().toLocaleDateString('zh-CN', { 
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' 
    });
    
    const hour = new Date().getHours();
    let timeGreeting = '';
    let timeContext = '';
    if (hour < 6) {
      timeGreeting = '夜深了';
      timeContext = '这个时间还没睡，可能在加班或有心事';
    } else if (hour < 9) {
      timeGreeting = '早上好';
      timeContext = '新的一天开始，适合规划今天的安排';
    } else if (hour < 12) {
      timeGreeting = '上午好';
      timeContext = '上午是专注工作的黄金时间';
    } else if (hour < 14) {
      timeGreeting = '中午好';
      timeContext = '午餐时间，适合短暂休息';
    } else if (hour < 18) {
      timeGreeting = '下午好';
      timeContext = '下午可能会有些疲倦，注意劳逸结合';
    } else if (hour < 22) {
      timeGreeting = '晚上好';
      timeContext = '晚上适合复盘今天、规划明天';
    } else {
      timeGreeting = '夜深了';
      timeContext = '这么晚了还在忙，记得早点休息';
    }
    
    // 获取记忆摘要
    const memorySummary = this.getMemorySummary();
    
    return `# 角色：小助 - 你的私人智能助理

## 核心身份
你是用户的私人助理「小助」，不只是一个任务管理工具，而是一个真正了解用户、关心用户的伙伴。

## 当前时间
${today} ${timeGreeting}
时间背景：${timeContext}

## 关于用户的记忆
${memorySummary}

## 思考方式
在回复前，请思考：
1. 用户真正想要什么？表面需求背后有没有更深的需求？
2. 根据我对用户的了解，什么样的建议最适合 TA？
3. 有没有用户可能没想到但很重要的事？
4. 我能不能给出更有价值的见解，而不只是机械地执行？

## 对话风格
- 像一个贴心的朋友，不是冷冰冰的助手
- 会追问，会关心，会给建议
- 记住用户说过的事，在适当时候提起
- 有自己的思考和见解，不只是附和
- 适当表达关心，但不过度

## 记忆与学习
在对话中，注意记住以下信息：
- 用户提到的个人情况（职业、学校、城市等）
- 用户的目标和计划
- 用户的喜好和习惯
- 用户提到的重要的人
- 用户遇到的困难和挑战

当发现重要信息时，调用 save_memory 函数保存。

## 任务管理能力
【重要】当用户想管理任务时，必须调用相应函数：
- 想添加任务 → 调用 add_task（必须调用，不能只说"好的已添加"）
- 想完成任务 → 调用 complete_task
- 想查看任务 → 调用 list_tasks  
- 想删除任务 → 调用 delete_task
- 想保存关于用户的信息 → 调用 save_memory

【重要：当前日期】
今天的准确日期是：${this.app.getTodayString()}（${today}）
请务必使用正确的日期，不要弄错！

【日期解析规则】
- "今天" → ${this.app.getTodayString()}
- "明天" → ${this.getTomorrowString()}
- "后天" → ${this.getDayAfterTomorrowString()}
- "X号" 或 "X日" → 本月X日，格式：${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-XX
- "下个月X号" → 下月X日
- "27年" → 2027年

【智能分类】
- 工作（开会、项目、汇报）→ work
- 学习（看书、作业、课程）→ study
- 健康（运动、健身、跑步）→ health
- 其他 → personal

## 回复原则
1. 不要机械回复，要有温度
2. 可以提出建议和看法
3. 适当追问了解更多情况
4. 记住用户说过的话，建立连续性
5. 用 emoji 增加亲和力，但不要过多`;
  }
  
  getTomorrowString() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  
  getDayAfterTomorrowString() {
    const day = new Date();
    day.setDate(day.getDate() + 2);
    return day.toISOString().split('T')[0];
  }

  // Execute a tool
  async executeTool(name, params) {
    console.log(`Executing tool: ${name}`, params);
    
    switch (name) {
      case 'add_task':
        return this.toolAddTask(params);
      case 'complete_task':
        return this.toolCompleteTask(params);
      case 'delete_task':
        return this.toolDeleteTask(params);
      case 'list_tasks':
        return this.toolListTasks(params);
      case 'get_task_summary':
        return this.toolGetSummary();
      case 'update_task':
        return this.toolUpdateTask(params);
      case 'search_tasks':
        return this.toolSearchTasks(params);
      case 'save_memory':
        return this.toolSaveMemory(params);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  // Tool: Add task
  toolAddTask(params) {
    console.log('toolAddTask called with:', params);
    
    if (!params.text) {
      console.error('No task text provided');
      return { success: false, message: '任务内容不能为空' };
    }
    
    const task = {
      text: params.text,
      priority: params.priority || 'medium',
      category: params.category || 'personal',
      dueDate: params.dueDate || this.app.getTodayString(),
      notes: ''
    };
    
    console.log('Adding task:', task);
    this.app.addTask(task);
    console.log('Task added, current tasks:', this.app.tasks.length);
    
    return {
      success: true,
      message: `已添加任务：${task.text}`,
      task: task
    };
  }

  // Tool: Complete task
  toolCompleteTask(params) {
    const task = this.app.tasks.find(t => t.id === params.taskId);
    if (!task) {
      return { success: false, message: '找不到该任务' };
    }
    
    if (task.completed) {
      return { success: false, message: '该任务已经完成了' };
    }
    
    this.app.toggleTask(params.taskId);
    return { success: true, message: `已完成任务：${task.text}` };
  }

  // Tool: Delete task
  toolDeleteTask(params) {
    const task = this.app.tasks.find(t => t.id === params.taskId);
    if (!task) {
      return { success: false, message: '找不到该任务' };
    }
    
    this.app.deleteTask(params.taskId);
    return { success: true, message: `已删除任务：${task.text}` };
  }

  // Tool: List tasks
  toolListTasks(params) {
    const filter = params.filter || 'all';
    let tasks = this.app.tasks;
    const today = this.app.getTodayString();
    
    switch (filter) {
      case 'today':
        tasks = tasks.filter(t => t.dueDate === today && !t.completed);
        break;
      case 'pending':
        tasks = tasks.filter(t => !t.completed);
        break;
      case 'completed':
        tasks = tasks.filter(t => t.completed);
        break;
      case 'overdue':
        tasks = tasks.filter(t => !t.completed && this.app.isOverdue(t.dueDate));
        break;
    }
    
    return {
      success: true,
      filter: filter,
      count: tasks.length,
      tasks: tasks.map(t => ({
        id: t.id,
        text: t.text,
        priority: t.priority,
        category: t.category,
        dueDate: t.dueDate,
        completed: t.completed
      }))
    };
  }

  // Tool: Get summary
  toolGetSummary() {
    const tasks = this.app.tasks;
    const today = this.app.getTodayString();
    
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = tasks.filter(t => !t.completed).length;
    const todayTasks = tasks.filter(t => t.dueDate === today && !t.completed);
    const overdue = tasks.filter(t => !t.completed && this.app.isOverdue(t.dueDate)).length;
    const highPriority = tasks.filter(t => !t.completed && t.priority === 'high').length;
    
    return {
      success: true,
      summary: {
        total,
        completed,
        pending,
        todayCount: todayTasks.length,
        todayTasks: todayTasks.map(t => ({ id: t.id, text: t.text, priority: t.priority })),
        overdue,
        highPriority,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
      }
    };
  }

  // Tool: Update task
  toolUpdateTask(params) {
    const task = this.app.tasks.find(t => t.id === params.taskId);
    if (!task) {
      return { success: false, message: '找不到该任务' };
    }
    
    if (params.text) task.text = params.text;
    if (params.priority) task.priority = params.priority;
    if (params.dueDate) task.dueDate = params.dueDate;
    
    this.app.saveTasks();
    this.app.renderTasks();
    
    return { success: true, message: `已更新任务：${task.text}` };
  }

  // Tool: Search tasks
  toolSearchTasks(params) {
    const keyword = params.keyword.toLowerCase();
    const tasks = this.app.tasks.filter(t => 
      t.text.toLowerCase().includes(keyword) ||
      (t.notes && t.notes.toLowerCase().includes(keyword))
    );
    
    return {
      success: true,
      keyword: params.keyword,
      count: tasks.length,
      tasks: tasks.map(t => ({
        id: t.id,
        text: t.text,
        priority: t.priority,
        completed: t.completed,
        dueDate: t.dueDate
      }))
    };
  }
  
  // Tool: Save memory about user
  toolSaveMemory(params) {
    const { category, content } = params;
    
    if (!category || !content) {
      return { success: false, message: '需要提供类别和内容' };
    }
    
    this.addMemory(category, content);
    
    const categoryNames = {
      facts: '个人情况',
      preferences: '偏好',
      goals: '目标',
      habits: '习惯',
      relationships: '重要的人',
      interests: '兴趣'
    };
    
    return {
      success: true,
      message: `已记住：${content}`,
      category: categoryNames[category] || category
    };
  }

  // Get current context for the agent
  getCurrentContext() {
    const summary = this.toolGetSummary().summary;
    return `
当前任务状态：
- 总任务：${summary.total} 个
- 已完成：${summary.completed} 个
- 待完成：${summary.pending} 个
- 今日待办：${summary.todayCount} 个
- 逾期任务：${summary.overdue} 个
- 高优先级：${summary.highPriority} 个

今日任务列表：
${summary.todayTasks.map(t => `- [ID:${t.id}] ${t.text} (${t.priority === 'high' ? '紧急' : t.priority === 'low' ? '不急' : '普通'})`).join('\n') || '无'}
`;
  }

  // Test API key
  async testApiKey() {
    if (this.provider === 'gemini') {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
            generationConfig: { maxOutputTokens: 10 }
          })
        });
        
        const data = await response.json();
        
        if (data.error) {
          return { success: false, error: data.error.message };
        }
        
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    
    return { success: true };
  }

  // Initialize speech recognition
  initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'zh-CN';
      
      this.recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
          chatInput.value = transcript;
          this.autoResizeTextarea(chatInput);
        }
        
        if (event.results[0].isFinal) {
          this.stopRecording();
        }
      };
      
      this.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        this.stopRecording();
        this.app.showToast('语音识别失败，请重试', 'error');
      };
      
      this.recognition.onend = () => {
        this.stopRecording();
      };
    }
  }

  // Start voice recording
  startRecording() {
    if (!this.recognition) {
      this.app.showToast('您的浏览器不支持语音输入', 'warning');
      return;
    }
    
    this.isRecording = true;
    const voiceBtn = document.getElementById('voice-btn');
    if (voiceBtn) {
      voiceBtn.classList.add('recording');
    }
    
    this.app.haptic('medium');
    this.recognition.start();
  }

  // Stop voice recording
  stopRecording() {
    this.isRecording = false;
    const voiceBtn = document.getElementById('voice-btn');
    if (voiceBtn) {
      voiceBtn.classList.remove('recording');
    }
    
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Already stopped
      }
    }
  }

  // Toggle recording
  toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  // Auto resize textarea
  autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  // Process user message
  async processMessage(message) {
    if (!message.trim() && !this.pendingAttachment) return;
    if (this.isProcessing) {
      this.app.showToast('正在处理中，请稍候...', 'warning');
      return;
    }
    
    this.isProcessing = true;
    this.app.haptic('light');
    
    // 保存附件信息
    const attachment = this.pendingAttachment;
    this.removeAttachment();
    
    // Clear welcome message if exists
    const welcomeMsg = document.querySelector('.welcome-message');
    if (welcomeMsg) {
      welcomeMsg.remove();
    }
    
    // Add user message to chat (with image preview if any)
    let displayMessage = message;
    if (attachment && attachment.type === 'image') {
      displayMessage = message + `\n<img src="${attachment.preview}" class="chat-image" onclick="window.open('${attachment.preview}')">`;
    } else if (attachment && attachment.type === 'file') {
      displayMessage = message + `\n📎 ${attachment.name}`;
    }
    this.addMessage('user', displayMessage, null, true);
    
    // Show typing indicator
    this.showTypingIndicator();
    
    // Add to conversation history
    this.conversationHistory.push({ role: 'user', content: message });
    
    try {
      let response;
      
      // Check if using Gemini and has API key
      if (this.provider === 'gemini' && this.apiKey) {
        console.log('Using Gemini API with key:', this.apiKey.substring(0, 10) + '...');
        response = await this.processWithGeminiAgent(message, attachment);
        this.hideTypingIndicator();
        this.addMessage('assistant', response);
      } else if (this.provider !== 'local' && !this.apiKey) {
        // No API key set
        this.hideTypingIndicator();
        this.addMessage('assistant', '⚠️ 请先在设置页面配置 API Key\n\n前往：设置 → AI 助手 → 输入 API Key → 保存');
        this.isProcessing = false;
        return;
      } else {
        // Use local AI (rule-based + pattern matching)
        response = await this.processLocally(message);
        this.hideTypingIndicator();
        this.addMessage('assistant', response.text, response.actions);
      }
      
      // Add to conversation history
      const responseText = typeof response === 'string' ? response : response.text;
      this.conversationHistory.push({ role: 'assistant', content: responseText });
      
    } catch (error) {
      this.hideTypingIndicator();
      console.error('AI processing error:', error);
      this.addMessage('assistant', '❌ 出错了：' + error.message + '\n\n请检查 API Key 是否正确，或网络是否正常。');
    }
    
    this.isProcessing = false;
  }

  // Process with Gemini Agent (with function calling)
  async processWithGeminiAgent(message, attachment = null) {
    const context = this.getCurrentContext();
    
    // Build the full prompt with context
    const fullSystemPrompt = `${this.systemPrompt}\n\n${context}`;
    
    // Build conversation for Gemini
    const contents = [];
    
    // Add recent history
    for (const msg of this.conversationHistory.slice(-6)) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
    
    // Build current message parts
    const currentParts = [];
    
    // Add text message
    if (message) {
      currentParts.push({ text: message });
    }
    
    // Add image if present
    if (attachment && attachment.type === 'image') {
      currentParts.push({
        inlineData: {
          mimeType: attachment.mimeType,
          data: attachment.data
        }
      });
      // Add instruction for image analysis
      if (!message) {
        currentParts.unshift({ text: '请描述这张图片，如果图片中有待办事项、日程或任务相关内容，请帮我提取出来。' });
      }
    }
    
    // Add file content if present
    if (attachment && attachment.type === 'file') {
      const filePrompt = message || '请分析这个文件的内容';
      currentParts[0] = { 
        text: `${filePrompt}\n\n--- 文件内容 (${attachment.name}) ---\n${attachment.content}\n--- 文件结束 ---` 
      };
    }
    
    // Add current message
    contents.push({
      role: 'user',
      parts: currentParts
    });
    
    // Define function declarations for Gemini
    const functionDeclarations = this.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
    
    // First API call - let Gemini decide what to do
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: fullSystemPrompt }] },
        contents: contents,
        tools: [{ functionDeclarations }],
        toolConfig: {
          functionCallingConfig: {
            mode: "AUTO"
          }
        },
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1000
        }
      })
    });
    
    const data = await response.json();
    console.log('Gemini response:', JSON.stringify(data, null, 2));
    
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error('No response from Gemini');
    }
    
    // Check if Gemini wants to call functions
    const parts = candidate.content?.parts || [];
    console.log('Response parts:', parts);
    let textResponse = '';
    const functionCalls = [];
    
    for (const part of parts) {
      if (part.text) {
        textResponse += part.text;
      }
      if (part.functionCall) {
        functionCalls.push(part.functionCall);
      }
    }
    
    // If there are function calls, execute them
    if (functionCalls.length > 0) {
      console.log('Function calls detected:', functionCalls);
      const functionResults = [];
      
      for (const fc of functionCalls) {
        console.log('Executing function:', fc.name, 'with args:', fc.args);
        const result = await this.executeTool(fc.name, fc.args || {});
        console.log('Function result:', result);
        functionResults.push({
          name: fc.name,
          result: result
        });
        
        // Show action indicator
        this.showActionIndicator(fc.name, result);
      }
      
      // Second API call - get Gemini's response after function execution
      const followUpContents = [
        ...contents,
        {
          role: 'model',
          parts: parts
        },
        {
          role: 'user',
          parts: functionResults.map(fr => ({
            functionResponse: {
              name: fr.name,
              response: fr.result
            }
          }))
        }
      ];
      
      const followUpResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: fullSystemPrompt }] },
          contents: followUpContents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500
          }
        })
      });
      
      const followUpData = await followUpResponse.json();
      
      if (followUpData.candidates?.[0]?.content?.parts?.[0]?.text) {
        return followUpData.candidates[0].content.parts[0].text;
      }
      
      // Fallback: construct response from function results
      return this.buildResponseFromResults(functionResults);
    }
    
    // No function calls, just return the text
    return textResponse || '我理解了，有什么需要我帮忙的吗？';
  }

  // Show action indicator in chat
  showActionIndicator(toolName, result) {
    const actionNames = {
      'add_task': '➕ 添加任务',
      'complete_task': '✅ 完成任务',
      'delete_task': '🗑️ 删除任务',
      'list_tasks': '📋 查看任务',
      'get_task_summary': '📊 获取统计',
      'update_task': '✏️ 更新任务',
      'search_tasks': '🔍 搜索任务',
      'save_memory': '🧠 记住信息'
    };
    
    const actionName = actionNames[toolName] || toolName;
    console.log(`Agent action: ${actionName}`, result);
    
    // Haptic feedback for actions
    if (result.success) {
      this.app.haptic('success');
    }
  }

  // Build response from function results
  buildResponseFromResults(results) {
    const responses = [];
    
    for (const { name, result } of results) {
      if (name === 'add_task' && result.success) {
        responses.push(`✅ 已添加任务「${result.task.text}」`);
      } else if (name === 'complete_task' && result.success) {
        responses.push(`🎉 ${result.message}`);
      } else if (name === 'delete_task' && result.success) {
        responses.push(`🗑️ ${result.message}`);
      } else if (name === 'list_tasks') {
        if (result.count === 0) {
          responses.push('📭 暂无任务');
        } else {
          const taskList = result.tasks.slice(0, 5).map((t, i) => {
            const emoji = t.completed ? '✅' : (t.priority === 'high' ? '🔴' : t.priority === 'low' ? '🟢' : '🟡');
            return `${i + 1}. ${emoji} ${t.text}`;
          }).join('\n');
          responses.push(`📋 共 ${result.count} 个任务：\n${taskList}`);
        }
      } else if (name === 'get_task_summary') {
        const s = result.summary;
        responses.push(`📊 任务概览：\n` +
          `• 总计：${s.total} | 完成：${s.completed} | 待办：${s.pending}\n` +
          `• 今日待办：${s.todayCount} 个\n` +
          `• 完成率：${s.completionRate}%`);
      }
    }
    
    return responses.join('\n\n') || '操作完成！';
  }

  // Local AI processing (rule-based)
  async processLocally(message) {
    // Simulate thinking time
    await this.delay(500 + Math.random() * 1000);
    
    const lowerMessage = message.toLowerCase();
    const tasks = this.app.tasks;
    
    // Parse intent
    const intent = this.parseIntent(message);
    
    switch (intent.type) {
      case 'add_task':
        return this.handleAddTask(intent);
      case 'list_tasks':
        return this.handleListTasks(intent);
      case 'complete_task':
        return this.handleCompleteTask(intent);
      case 'delete_task':
        return this.handleDeleteTask(intent);
      case 'today_summary':
        return this.handleTodaySummary();
      case 'suggest':
        return this.handleSuggestions();
      case 'schedule':
        return this.handleSchedule();
      case 'greeting':
        return this.handleGreeting();
      case 'help':
        return this.handleHelp();
      default:
        return this.handleGeneral(message);
    }
  }

  // Parse user intent
  parseIntent(message) {
    const patterns = {
      add_task: [
        /^(添加|新建|创建|加|记|帮我记|帮我添加|帮我创建)(一个)?(.+)/,
        /^(提醒我|别忘了|记得)(.+)/,
        /(.+)(提醒|任务|待办)/,
        /^(明天|后天|下周|今天|今晚|周[一二三四五六日天])(.+)/
      ],
      list_tasks: [
        /^(查看|看看|显示|列出|有什么|有哪些)(.*)(任务|待办|事情)/,
        /^(今天|明天|本周)(有什么|有哪些|的)(任务|待办|事情)?/,
        /^我(今天|明天|这周)要做什么/
      ],
      complete_task: [
        /^(完成|做完|已完成|搞定|OK|ok|好了)(.+)/,
        /^(.+)(完成了|做完了|搞定了)/
      ],
      delete_task: [
        /^(删除|移除|取消|不要|去掉)(.+)/
      ],
      today_summary: [
        /^(今日|今天|当前)(总结|概况|情况|进度)/,
        /^(总结|概况|汇报)(一下)?/
      ],
      suggest: [
        /^(建议|推荐|提议|帮我分析|优化|怎么安排)/,
        /^(我该|应该)(做什么|干什么|先做什么)/
      ],
      schedule: [
        /^(安排|规划|计划|日程|排期)/,
        /^帮我(安排|规划|计划)/
      ],
      greeting: [
        /^(你好|hi|hello|嗨|早|晚上好|下午好|早上好)/i
      ],
      help: [
        /^(帮助|help|怎么用|如何使用|功能|你能做什么)/i
      ]
    };
    
    for (const [type, patternList] of Object.entries(patterns)) {
      for (const pattern of patternList) {
        const match = message.match(pattern);
        if (match) {
          return { type, match, message };
        }
      }
    }
    
    return { type: 'general', message };
  }

  // Parse date from text
  parseDateFromText(text) {
    const today = new Date();
    const datePatterns = {
      '今天': 0,
      '今晚': 0,
      '明天': 1,
      '后天': 2,
      '大后天': 3,
      '下周一': this.daysUntilWeekday(1),
      '下周二': this.daysUntilWeekday(2),
      '下周三': this.daysUntilWeekday(3),
      '下周四': this.daysUntilWeekday(4),
      '下周五': this.daysUntilWeekday(5),
      '下周六': this.daysUntilWeekday(6),
      '下周日': this.daysUntilWeekday(0),
      '周一': this.daysUntilWeekday(1, true),
      '周二': this.daysUntilWeekday(2, true),
      '周三': this.daysUntilWeekday(3, true),
      '周四': this.daysUntilWeekday(4, true),
      '周五': this.daysUntilWeekday(5, true),
      '周六': this.daysUntilWeekday(6, true),
      '周日': this.daysUntilWeekday(0, true),
      '周天': this.daysUntilWeekday(0, true)
    };
    
    for (const [pattern, days] of Object.entries(datePatterns)) {
      if (text.includes(pattern)) {
        const date = new Date(today);
        date.setDate(date.getDate() + days);
        return {
          date: date.toISOString().split('T')[0],
          matched: pattern
        };
      }
    }
    
    // Try to match specific date like "3月15日"
    const dateMatch = text.match(/(\d{1,2})月(\d{1,2})[日号]/);
    if (dateMatch) {
      const month = parseInt(dateMatch[1]) - 1;
      const day = parseInt(dateMatch[2]);
      const date = new Date(today.getFullYear(), month, day);
      if (date < today) {
        date.setFullYear(date.getFullYear() + 1);
      }
      return {
        date: date.toISOString().split('T')[0],
        matched: dateMatch[0]
      };
    }
    
    return null;
  }

  daysUntilWeekday(targetDay, thisWeek = false) {
    const today = new Date().getDay();
    let days = targetDay - today;
    if (days <= 0 && !thisWeek) days += 7;
    if (days < 0 && thisWeek) days += 7;
    return days;
  }

  // Parse priority from text
  parsePriorityFromText(text) {
    if (/紧急|重要|马上|立刻|尽快|必须|一定/.test(text)) {
      return 'high';
    }
    if (/不急|随便|有空|闲时/.test(text)) {
      return 'low';
    }
    return 'medium';
  }

  // Parse category from text
  parseCategoryFromText(text) {
    if (/工作|公司|项目|会议|客户|汇报|开会|报告/.test(text)) {
      return 'work';
    }
    if (/学习|看书|读书|课程|学|复习|练习/.test(text)) {
      return 'study';
    }
    if (/运动|跑步|健身|锻炼|健康|医院|体检/.test(text)) {
      return 'health';
    }
    return 'personal';
  }

  // Handle add task intent
  handleAddTask(intent) {
    let taskText = intent.message;
    
    // Extract task text from patterns
    const addPatterns = [
      /^(添加|新建|创建|加|记|帮我记|帮我添加|帮我创建|提醒我|别忘了|记得)(一个)?(任务|待办)?[：:,，]?\s*/,
    ];
    
    for (const pattern of addPatterns) {
      taskText = taskText.replace(pattern, '');
    }
    
    // Parse date
    const dateInfo = this.parseDateFromText(taskText);
    let dueDate = this.app.getTodayString();
    if (dateInfo) {
      dueDate = dateInfo.date;
      taskText = taskText.replace(dateInfo.matched, '').trim();
    }
    
    // Clean up task text
    taskText = taskText
      .replace(/[的地得]?(任务|待办|事情|事儿)$/, '')
      .replace(/^[要去]/, '')
      .trim();
    
    if (!taskText) {
      return {
        text: '请告诉我具体的任务内容，比如："添加明天下午开会"'
      };
    }
    
    // Parse priority and category
    const priority = this.parsePriorityFromText(intent.message);
    const category = this.parseCategoryFromText(taskText);
    
    const task = {
      text: taskText,
      priority,
      category,
      dueDate
    };
    
    const dateStr = this.formatDateDisplay(dueDate);
    const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' }[priority];
    
    return {
      text: `好的，我来帮你添加这个任务：`,
      actions: [
        {
          type: 'show_task_card',
          task: {
            ...task,
            dateDisplay: dateStr,
            priorityEmoji
          }
        },
        {
          type: 'confirm_add_task',
          task
        }
      ]
    };
  }

  // Handle list tasks intent
  handleListTasks(intent) {
    const tasks = this.app.tasks;
    const pendingTasks = tasks.filter(t => !t.completed);
    
    if (pendingTasks.length === 0) {
      return {
        text: '你目前没有待办任务，享受轻松的时光吧！🎉\n\n需要添加新任务吗？'
      };
    }
    
    // Check for date filter
    let filteredTasks = pendingTasks;
    let filterDesc = '待办';
    
    if (/今天|今日/.test(intent.message)) {
      filteredTasks = pendingTasks.filter(t => t.dueDate === this.app.getTodayString());
      filterDesc = '今天的';
    } else if (/明天/.test(intent.message)) {
      filteredTasks = pendingTasks.filter(t => t.dueDate === this.app.getFutureDateString(1));
      filterDesc = '明天的';
    }
    
    if (filteredTasks.length === 0) {
      return {
        text: `${filterDesc}没有任务安排。需要添加吗？`
      };
    }
    
    const taskList = filteredTasks.slice(0, 5).map((t, i) => {
      const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' }[t.priority];
      return `${i + 1}. ${priorityEmoji} ${t.text}`;
    }).join('\n');
    
    const remaining = filteredTasks.length > 5 ? `\n\n还有 ${filteredTasks.length - 5} 个任务...` : '';
    
    return {
      text: `你有 ${filteredTasks.length} 个${filterDesc}任务：\n\n${taskList}${remaining}`
    };
  }

  // Handle complete task intent
  handleCompleteTask(intent) {
    const taskName = intent.message.replace(/^(完成|做完|已完成|搞定|OK|ok|好了)|完成了|做完了|搞定了$/g, '').trim();
    
    const pendingTasks = this.app.tasks.filter(t => !t.completed);
    const matchingTask = pendingTasks.find(t => 
      t.text.includes(taskName) || taskName.includes(t.text.substring(0, 5))
    );
    
    if (matchingTask) {
      return {
        text: `太棒了！🎉 确认完成任务"${matchingTask.text}"？`,
        actions: [
          {
            type: 'confirm_complete',
            taskId: matchingTask.id,
            taskText: matchingTask.text
          }
        ]
      };
    }
    
    return {
      text: `找不到名为"${taskName}"的任务。你可以说具体的任务名称，或者去首页直接点击完成。`
    };
  }

  // Handle delete task intent
  handleDeleteTask(intent) {
    const taskName = intent.message.replace(/^(删除|移除|取消|不要|去掉)/, '').trim();
    
    const matchingTask = this.app.tasks.find(t => 
      t.text.includes(taskName) || taskName.includes(t.text.substring(0, 5))
    );
    
    if (matchingTask) {
      return {
        text: `确定要删除任务"${matchingTask.text}"吗？`,
        actions: [
          {
            type: 'confirm_delete',
            taskId: matchingTask.id,
            taskText: matchingTask.text
          }
        ]
      };
    }
    
    return {
      text: `找不到名为"${taskName}"的任务。`
    };
  }

  // Handle today summary
  handleTodaySummary() {
    const tasks = this.app.tasks;
    const today = this.app.getTodayString();
    
    const todayTasks = tasks.filter(t => t.dueDate === today);
    const completedToday = todayTasks.filter(t => t.completed).length;
    const pendingToday = todayTasks.filter(t => !t.completed).length;
    const overdue = tasks.filter(t => !t.completed && this.app.isOverdue(t.dueDate)).length;
    
    const total = tasks.length;
    const totalCompleted = tasks.filter(t => t.completed).length;
    const completionRate = total > 0 ? Math.round((totalCompleted / total) * 100) : 0;
    
    let summary = `📊 **今日总结**\n\n`;
    summary += `今日任务：${todayTasks.length} 个\n`;
    summary += `已完成：${completedToday} 个 ✅\n`;
    summary += `待完成：${pendingToday} 个 ⏳\n`;
    
    if (overdue > 0) {
      summary += `\n⚠️ 你有 ${overdue} 个逾期任务需要处理！`;
    }
    
    summary += `\n\n📈 总体完成率：${completionRate}%`;
    
    if (completionRate >= 80) {
      summary += '\n\n🌟 太棒了！继续保持！';
    } else if (completionRate >= 50) {
      summary += '\n\n💪 做得不错，再加把劲！';
    } else {
      summary += '\n\n🎯 加油，从最重要的任务开始！';
    }
    
    return { text: summary };
  }

  // Handle suggestions
  handleSuggestions() {
    const tasks = this.app.tasks;
    const pendingTasks = tasks.filter(t => !t.completed);
    
    if (pendingTasks.length === 0) {
      return {
        text: '你没有待办任务，不需要建议。\n\n要不要添加一些目标或计划？'
      };
    }
    
    const suggestions = [];
    
    // High priority first
    const highPriority = pendingTasks.filter(t => t.priority === 'high');
    if (highPriority.length > 0) {
      suggestions.push(`🔴 优先处理高优先级任务：\n   "${highPriority[0].text}"`);
    }
    
    // Overdue tasks
    const overdue = pendingTasks.filter(t => this.app.isOverdue(t.dueDate));
    if (overdue.length > 0) {
      suggestions.push(`⚠️ 有 ${overdue.length} 个逾期任务，建议立即处理`);
    }
    
    // Today's tasks
    const todayTasks = pendingTasks.filter(t => t.dueDate === this.app.getTodayString());
    if (todayTasks.length > 3) {
      suggestions.push(`📅 今天有 ${todayTasks.length} 个任务，考虑将非紧急任务推迟`);
    }
    
    // Pomodoro suggestion
    if (pendingTasks.length > 0) {
      suggestions.push(`🍅 试试番茄钟，25分钟专注一个任务`);
    }
    
    if (suggestions.length === 0) {
      suggestions.push('✨ 你的任务安排很合理，继续保持！');
    }
    
    return {
      text: `💡 **智能建议**\n\n${suggestions.join('\n\n')}`
    };
  }

  // Handle schedule
  handleSchedule() {
    const pendingTasks = this.app.tasks.filter(t => !t.completed);
    
    if (pendingTasks.length === 0) {
      return {
        text: '你目前没有待办任务需要安排。添加一些任务后我可以帮你规划日程。'
      };
    }
    
    // Group by date
    const byDate = {};
    pendingTasks.forEach(task => {
      const date = task.dueDate || '未定';
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(task);
    });
    
    let schedule = `📅 **日程安排**\n\n`;
    
    const dates = Object.keys(byDate).sort();
    for (const date of dates.slice(0, 5)) {
      const dateLabel = this.formatDateDisplay(date);
      schedule += `**${dateLabel}**\n`;
      byDate[date].slice(0, 3).forEach(t => {
        const emoji = { high: '🔴', medium: '🟡', low: '🟢' }[t.priority];
        schedule += `  ${emoji} ${t.text}\n`;
      });
      if (byDate[date].length > 3) {
        schedule += `  ... 还有 ${byDate[date].length - 3} 个\n`;
      }
      schedule += '\n';
    }
    
    return { text: schedule };
  }

  // Handle greeting
  handleGreeting() {
    const hour = new Date().getHours();
    let greeting = '你好';
    
    if (hour < 6) greeting = '夜深了，还在忙吗';
    else if (hour < 12) greeting = '早上好';
    else if (hour < 14) greeting = '中午好';
    else if (hour < 18) greeting = '下午好';
    else if (hour < 22) greeting = '晚上好';
    else greeting = '夜深了';
    
    const pending = this.app.tasks.filter(t => !t.completed).length;
    
    return {
      text: `${greeting}！👋 我是你的 AI 助手。\n\n你目前有 ${pending} 个待办任务。有什么我可以帮你的吗？`
    };
  }

  // Handle help
  handleHelp() {
    return {
      text: `🤖 **我可以帮你：**\n
📝 **添加任务**
"帮我添加明天开会"
"记得周五交报告"

✅ **完成任务**
"完成开会任务"
"搞定了"

📋 **查看任务**
"今天有什么任务"
"显示待办事项"

📊 **总结分析**
"今日总结"
"给我一些建议"

📅 **安排日程**
"帮我安排日程"

💡 你也可以直接用自然语言和我对话！`
    };
  }

  // Handle general message
  handleGeneral(message) {
    const responses = [
      '我理解你说的是"' + message + '"。你是想添加这个任务吗？',
      '你可以告诉我具体想做什么，比如添加任务、查看进度或获取建议。',
      '没太明白你的意思，可以换个方式说吗？比如"帮我添加一个任务"。'
    ];
    
    return {
      text: responses[Math.floor(Math.random() * responses.length)]
    };
  }

  // Process with cloud API
  async processWithAPI(message) {
    // 获取当前任务信息
    const pendingTasks = this.app.tasks.filter(t => !t.completed);
    const todayTasks = pendingTasks.filter(t => {
      if (!t.dueDate) return false;
      const today = new Date().toDateString();
      return new Date(t.dueDate).toDateString() === today;
    });
    const highPriorityTasks = pendingTasks.filter(t => t.priority === 'high');
    
    // 构建任务列表字符串
    let taskListStr = '';
    if (pendingTasks.length > 0) {
      taskListStr = '\n\n📋 当前待办事项：\n' + pendingTasks.map((t, i) => 
        `${i+1}. ${t.text}${t.dueDate ? ` (${new Date(t.dueDate).toLocaleDateString('zh-CN')})` : ''}${t.priority === 'high' ? ' ⚡紧急' : ''}`
      ).join('\n');
    }
    
    const systemPrompt = `你是小助，用户的私人智能助理 🌟

## 你的性格
- 温暖亲切，像一个贴心的朋友
- 积极主动，会根据用户的计划给出建议
- 幽默风趣，偶尔用 emoji 让对话更生动
- 记忆力好，会记住用户提到的事情

## 你的能力
- 帮用户安排和管理每日待办事项
- 理解用户的自然语言，智能提取任务信息
- 根据任务紧急程度给出优先级建议
- 在适当时候提醒用户休息或鼓励用户

## 互动方式
- 用户说想做什么，你帮他添加到待办并确认
- 用户问今天有什么事，你告诉他今日安排
- 用户说完成了某事，你夸他并标记完成
- 用户聊天时，你像朋友一样回应，但也会适时引导到任务管理

## 当前状态
- 今天是 ${new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- 待办任务：${pendingTasks.length} 个
- 今日任务：${todayTasks.length} 个
- 紧急任务：${highPriorityTasks.length} 个
${taskListStr}

## 回复要求
- 用中文回复，语气自然亲切
- 如果用户想添加任务，在回复中说明你会帮他添加
- 如果用户没有明确任务，就和他自然聊天，了解他的计划
- 回复保持简洁，不要太长`;

    try {
      let response;
      
      if (this.provider === 'gemini') {
        response = await this.callGemini(systemPrompt, message);
      } else if (this.provider === 'openai') {
        response = await this.callOpenAI(systemPrompt, message);
      } else if (this.provider === 'claude') {
        response = await this.callClaude(systemPrompt, message);
      } else if (this.provider === 'deepseek') {
        response = await this.callDeepSeek(systemPrompt, message);
      }
      
      return { text: response };
    } catch (error) {
      console.error('API call failed:', error);
      // Fallback to local processing
      return this.processLocally(message);
    }
  }

  // Call Google Gemini API
  async callGemini(systemPrompt, message) {
    // Build conversation history for Gemini format
    const contents = [];
    
    // Add conversation history
    for (const msg of this.conversationHistory.slice(-6)) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
    
    // Add current message with system prompt
    contents.push({
      role: 'user',
      parts: [{ text: `${systemPrompt}\n\n用户消息: ${message}` }]
    });
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
          topP: 0.9
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    }
    
    throw new Error('Invalid response from Gemini');
  }

  // Call OpenAI API
  async callOpenAI(systemPrompt, message) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          ...this.conversationHistory.slice(-6),
          { role: 'user', content: message }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
  }

  // Call Claude API
  async callClaude(systemPrompt, message) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        system: systemPrompt,
        messages: [
          ...this.conversationHistory.slice(-6),
          { role: 'user', content: message }
        ]
      })
    });
    
    const data = await response.json();
    return data.content[0].text;
  }

  // Call DeepSeek API
  async callDeepSeek(systemPrompt, message) {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          ...this.conversationHistory.slice(-6),
          { role: 'user', content: message }
        ],
        max_tokens: 500
      })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
  }

  // Format date for display
  formatDateDisplay(dateStr) {
    if (!dateStr || dateStr === '未定') return '未定日期';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    
    const diff = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
    
    if (diff === 0) return '今天';
    if (diff === 1) return '明天';
    if (diff === 2) return '后天';
    if (diff < 0) return `${Math.abs(diff)}天前`;
    if (diff <= 7) return `${diff}天后`;
    
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }

  // Add message to chat
  addMessage(role, content, actions = null, allowHtml = false) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    
    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    
    let actionsHTML = '';
    if (actions) {
      for (const action of actions) {
        if (action.type === 'show_task_card') {
          const t = action.task;
          actionsHTML += `
            <div class="message-task-card">
              <div class="task-title">${t.priorityEmoji} ${this.app.escapeHtml(t.text)}</div>
              <div class="task-meta">📅 ${t.dateDisplay} · ${this.getCategoryLabel(t.category)}</div>
            </div>
          `;
        }
        if (action.type === 'confirm_add_task') {
          actionsHTML += `
            <div class="message-actions">
              <button class="message-action-btn primary" onclick="todoApp.agent.confirmAddTask(${JSON.stringify(action.task).replace(/"/g, '&quot;')})">确认添加</button>
              <button class="message-action-btn" onclick="todoApp.agent.editBeforeAdd(${JSON.stringify(action.task).replace(/"/g, '&quot;')})">修改</button>
            </div>
          `;
        }
        if (action.type === 'confirm_complete') {
          actionsHTML += `
            <div class="message-actions">
              <button class="message-action-btn primary" onclick="todoApp.agent.confirmComplete(${action.taskId})">确认完成</button>
              <button class="message-action-btn" onclick="todoApp.agent.addMessage('assistant', '好的，已取消')">取消</button>
            </div>
          `;
        }
        if (action.type === 'confirm_delete') {
          actionsHTML += `
            <div class="message-actions">
              <button class="message-action-btn primary" onclick="todoApp.agent.confirmDelete(${action.taskId})">确认删除</button>
              <button class="message-action-btn" onclick="todoApp.agent.addMessage('assistant', '好的，已取消')">取消</button>
            </div>
          `;
        }
      }
    }
    
    messageDiv.innerHTML = `
      <div class="message-avatar">
        <span class="material-icons-outlined">${role === 'user' ? 'person' : 'psychology'}</span>
      </div>
      <div>
        <div class="message-content">
          ${this.formatMessageContent(content, allowHtml)}
          ${actionsHTML}
        </div>
        <div class="message-time">${time}</div>
      </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
  }

  // Format message content (simple markdown)
  formatMessageContent(content, allowHtml = false) {
    if (allowHtml) {
      // 允许 img 标签，其他内容进行格式化
      return content
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n(?!<img)/g, '<br>');
    }
    return content
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  // Get category label
  getCategoryLabel(category) {
    const labels = {
      work: '💼 工作',
      personal: '🏠 个人',
      study: '📚 学习',
      health: '💪 健康'
    };
    return labels[category] || '📌 其他';
  }

  // Show typing indicator
  showTypingIndicator() {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message assistant';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = `
      <div class="message-avatar">
        <span class="material-icons-outlined">psychology</span>
      </div>
      <div class="message-content">
        <div class="typing-indicator">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      </div>
    `;
    
    chatMessages.appendChild(typingDiv);
    this.scrollToBottom();
  }

  // Hide typing indicator
  hideTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  // Scroll to bottom of chat
  scrollToBottom() {
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  // Confirm add task
  confirmAddTask(taskData) {
    this.app.addTask(taskData);
    this.addMessage('assistant', '✅ 任务已添加！还有其他需要帮忙的吗？');
  }

  // Edit before adding
  editBeforeAdd(taskData) {
    this.app.selectedDate = taskData.dueDate;
    this.app.openModal();
    this.app.elements.taskInput.value = taskData.text;
    this.app.elements.taskPriority.value = taskData.priority;
    this.app.elements.taskDate.value = taskData.dueDate;
    
    document.querySelectorAll('.category-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.category === taskData.category);
    });
    
    this.addMessage('assistant', '已打开编辑窗口，你可以修改任务详情。');
  }

  // Confirm complete task
  confirmComplete(taskId) {
    this.app.toggleTask(taskId);
    this.addMessage('assistant', '🎉 太棒了！任务已完成。继续保持！');
  }

  // Confirm delete task
  confirmDelete(taskId) {
    this.app.deleteTask(taskId);
    this.addMessage('assistant', '✅ 任务已删除。');
  }

  // Execute actions
  executeActions(actions) {
    // Actions are handled via onclick in the message HTML
  }

  // Initialize chat with welcome message
  initChat() {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    // Check if already initialized
    if (chatMessages.children.length > 0) return;
    
    const summary = this.toolGetSummary().summary;
    const hour = new Date().getHours();
    let greeting = '你好';
    let emoji = '👋';
    
    if (hour < 6) { greeting = '夜深了'; emoji = '🌙'; }
    else if (hour < 12) { greeting = '早上好'; emoji = '☀️'; }
    else if (hour < 14) { greeting = '中午好'; emoji = '🍱'; }
    else if (hour < 18) { greeting = '下午好'; emoji = '💪'; }
    else if (hour < 22) { greeting = '晚上好'; emoji = '🌆'; }
    else { greeting = '夜深了'; emoji = '🌙'; }
    
    // Build today's task list
    let todayTasksHtml = '';
    if (summary.todayTasks.length > 0) {
      todayTasksHtml = `
        <div class="agent-task-list">
          <h4>📅 今日待办 (${summary.todayCount})</h4>
          ${summary.todayTasks.slice(0, 5).map(t => {
            const priorityEmoji = t.priority === 'high' ? '🔴' : t.priority === 'low' ? '🟢' : '🟡';
            return `<div class="agent-task-item" onclick="todoApp.agent.processMessage('完成任务 ${t.text.substring(0, 10)}')">
              ${priorityEmoji} ${t.text}
            </div>`;
          }).join('')}
          ${summary.todayTasks.length > 5 ? `<p class="more-hint">还有 ${summary.todayTasks.length - 5} 个...</p>` : ''}
        </div>
      `;
    }
    
    // Status badges
    let statusBadges = '';
    if (summary.overdue > 0) {
      statusBadges += `<span class="status-badge danger">⚠️ ${summary.overdue} 个逾期</span>`;
    }
    if (summary.highPriority > 0) {
      statusBadges += `<span class="status-badge warning">🔥 ${summary.highPriority} 个紧急</span>`;
    }
    if (summary.completionRate >= 80) {
      statusBadges += `<span class="status-badge success">🌟 完成率 ${summary.completionRate}%</span>`;
    }
    
    chatMessages.innerHTML = `
      <div class="welcome-message">
        <div class="welcome-icon">
          <span class="material-icons-outlined">psychology</span>
        </div>
        <h2>${greeting}！${emoji}</h2>
        <p>我是你的 AI 任务助手，可以帮你管理待办事项</p>
        
        <div class="agent-status-bar">
          <div class="status-item">
            <span class="status-number">${summary.pending}</span>
            <span class="status-label">待办</span>
          </div>
          <div class="status-item">
            <span class="status-number">${summary.completed}</span>
            <span class="status-label">已完成</span>
          </div>
          <div class="status-item">
            <span class="status-number">${summary.completionRate}%</span>
            <span class="status-label">完成率</span>
          </div>
        </div>
        
        ${statusBadges ? `<div class="status-badges">${statusBadges}</div>` : ''}
        
        ${todayTasksHtml}
        
        <div class="welcome-suggestions">
          <button class="welcome-suggestion" onclick="todoApp.agent.processMessage('帮我添加一个新任务')">
            ➕ 添加新任务
          </button>
          <button class="welcome-suggestion" onclick="todoApp.agent.processMessage('查看我所有的待办任务')">
            📋 查看所有任务
          </button>
          <button class="welcome-suggestion" onclick="todoApp.agent.processMessage('今日工作总结')">
            📊 今日总结
          </button>
        </div>
        
        <p class="agent-hint">💬 直接告诉我你想做什么，比如"帮我添加明天开会"</p>
      </div>
    `;
  }

  // Handle quick action
  handleQuickAction(action) {
    // 特殊处理每日规划
    if (action === 'daily-plan') {
      this.triggerDailyPlan();
      return;
    }
    
    const messages = {
      'add-task': '帮我添加一个任务',
      'today-summary': '今日总结',
      'suggest': '给我一些建议',
      'schedule': '帮我安排日程'
    };
    
    if (messages[action]) {
      this.processMessage(messages[action]);
    }
  }

  // Delay utility
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ==================== TODO APP CLASS ====================
class TodoApp {
  constructor() {
    this.tasks = this.loadTasks();
    this.settings = this.loadSettings();
    this.currentFilter = 'all';
    this.currentSort = 'default';
    this.editingTaskId = null;
    this.contextMenuTaskId = null;
    this.currentPage = 'home';
    this.searchQuery = '';
    
    // Calendar state
    this.calendarDate = new Date();
    this.selectedDate = null;
    
    // Pomodoro state
    this.pomodoro = {
      isRunning: false,
      isBreak: false,
      timeLeft: this.settings.pomodoroWork * 60,
      sessions: parseInt(localStorage.getItem('pomodoroSessions') || '0'),
      interval: null,
      selectedTask: null
    };
    
    // Capacitor plugins (will be loaded if available)
    this.Haptics = null;
    this.StatusBar = null;
    this.LocalNotifications = null;
    this.Keyboard = null;
    this.isNative = false;
    
    // AI Agent - 立即创建
    this.agent = new AIAgent(this);
    console.log('Agent created in constructor');
    
    // 同步服务
    this.syncService = new SyncService(this);
    console.log('SyncService created');
    
    // Start initialization
    this.init();
  }

  // Initialize Capacitor plugins
  async initCapacitor() {
    try {
      // Check if running in Capacitor
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        this.isNative = true;
        
        // Import Capacitor plugins
        const { Haptics } = await import('@capacitor/haptics');
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const { Keyboard } = await import('@capacitor/keyboard');
        
        this.Haptics = Haptics;
        this.StatusBar = StatusBar;
        this.LocalNotifications = LocalNotifications;
        this.Keyboard = Keyboard;
        
        // Configure status bar
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#0a0a1a' });
        
        // Request notification permissions
        const result = await LocalNotifications.requestPermissions();
        if (result.display === 'granted') {
          console.log('Notifications enabled');
        }
        
        // Keyboard listeners
        Keyboard.addListener('keyboardWillShow', (info) => {
          document.body.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
          document.body.classList.add('keyboard-open');
        });
        
        Keyboard.addListener('keyboardWillHide', () => {
          document.body.style.setProperty('--keyboard-height', '0px');
          document.body.classList.remove('keyboard-open');
        });
        
        console.log('Capacitor initialized successfully');
      }
    } catch (e) {
      console.log('Running in web mode (Capacitor not available)');
    }
  }

  // Haptic feedback
  async haptic(type = 'light') {
    if (this.Haptics && this.settings.sounds) {
      try {
        switch (type) {
          case 'light':
            await this.Haptics.impact({ style: 'light' });
            break;
          case 'medium':
            await this.Haptics.impact({ style: 'medium' });
            break;
          case 'heavy':
            await this.Haptics.impact({ style: 'heavy' });
            break;
          case 'success':
            await this.Haptics.notification({ type: 'success' });
            break;
          case 'warning':
            await this.Haptics.notification({ type: 'warning' });
            break;
          case 'error':
            await this.Haptics.notification({ type: 'error' });
            break;
          case 'selection':
            await this.Haptics.selectionStart();
            await this.Haptics.selectionEnd();
            break;
        }
      } catch (e) {
        // Haptics not available
      }
    }
  }

  // Schedule local notification
  async scheduleNotification(task) {
    if (!this.LocalNotifications || !this.settings.notifications || !task.dueDate) return;
    
    try {
      const dueDate = new Date(task.dueDate);
      dueDate.setHours(9, 0, 0, 0); // Notify at 9 AM
      
      if (dueDate > new Date()) {
        await this.LocalNotifications.schedule({
          notifications: [{
            id: task.id,
            title: '任务提醒',
            body: task.text,
            schedule: { at: dueDate },
            sound: 'default',
            actionTypeId: 'TASK_REMINDER'
          }]
        });
      }
    } catch (e) {
      console.log('Failed to schedule notification:', e);
    }
  }

  // Cancel notification
  async cancelNotification(taskId) {
    if (!this.LocalNotifications) return;
    
    try {
      await this.LocalNotifications.cancel({ notifications: [{ id: taskId }] });
    } catch (e) {
      // Notification may not exist
    }
  }

  // ==================== INITIALIZATION ====================
  
  loadTasks() {
    const savedTasks = localStorage.getItem('todoTasks');
    if (savedTasks) {
      return JSON.parse(savedTasks);
    }
    return this.getDefaultTasks();
  }

  getDefaultTasks() {
    return [
      {
        id: 1,
        text: '完成项目提案初稿',
        notes: '包含预算和时间线',
        completed: true,
        priority: 'high',
        category: 'work',
        dueDate: this.getTodayString(),
        recurring: null,
        createdAt: Date.now() - 86400000
      },
      {
        id: 2,
        text: '回顾 Q3 目标进度',
        notes: '',
        completed: true,
        priority: 'medium',
        category: 'work',
        dueDate: this.getTodayString(),
        recurring: null,
        createdAt: Date.now() - 43200000
      },
      {
        id: 3,
        text: '准备周五演示文稿',
        notes: '重点：数据可视化',
        completed: false,
        priority: 'high',
        category: 'work',
        dueDate: this.getFutureDateString(2),
        recurring: null,
        createdAt: Date.now() - 21600000
      },
      {
        id: 4,
        text: '阅读《深度工作》第三章',
        notes: '',
        completed: false,
        priority: 'low',
        category: 'study',
        dueDate: this.getFutureDateString(3),
        recurring: null,
        createdAt: Date.now()
      },
      {
        id: 5,
        text: '晨跑 5 公里',
        notes: '',
        completed: false,
        priority: 'medium',
        category: 'health',
        dueDate: this.getTodayString(),
        recurring: 'daily',
        createdAt: Date.now()
      }
    ];
  }

  loadSettings() {
    const savedSettings = localStorage.getItem('todoSettings');
    if (savedSettings) {
      return JSON.parse(savedSettings);
    }
    return {
      theme: 'dark',
      colorScheme: 'indigo',
      notifications: true,
      sounds: true,
      pomodoroWork: 25,
      pomodoroBreak: 5
    };
  }

  saveSettings() {
    localStorage.setItem('todoSettings', JSON.stringify(this.settings));
    this.applySettings();
  }

  saveTasks() {
    localStorage.setItem('todoTasks', JSON.stringify(this.tasks));
    this.updateStats();
    this.updateAISuggestions();
    this.updateStatsPage();
  }

  async init() {
    console.log('TodoApp init started');
    
    // Initialize Capacitor for iOS
    await this.initCapacitor();
    
    this.cacheDOMElements();
    this.applySettings();
    this.renderTasks();
    this.attachEventListeners();
    this.updateDateDisplay();
    this.updateStats();
    this.updateAISuggestions();
    this.addSVGGradients();
    this.initCalendar();
    this.updateStatsPage();
    this.updatePomodoroDisplay();
    
    // Set min date for date input
    const dateInput = document.getElementById('task-date');
    if (dateInput) {
      dateInput.min = this.getTodayString();
      dateInput.value = this.getTodayString();
    }
    
    // Handle recurring tasks
    this.handleRecurringTasks();
    
    // Schedule notifications for pending tasks
    this.tasks.filter(t => !t.completed).forEach(task => {
      this.scheduleNotification(task);
    });
    
    console.log('TodoApp init completed');
  }

  cacheDOMElements() {
    this.elements = {
      // Home page
      taskList: document.getElementById('task-list'),
      emptyState: document.getElementById('empty-state'),
      progressRing: document.getElementById('progress-ring'),
      progressText: document.getElementById('progress-text'),
      totalTasks: document.getElementById('total-tasks'),
      completedTasks: document.getElementById('completed-tasks'),
      pendingTasks: document.getElementById('pending-tasks'),
      aiSuggestions: document.getElementById('ai-suggestions'),
      clearCompleted: document.getElementById('clear-completed'),
      dateDisplay: document.getElementById('date-display'),
      greeting: document.getElementById('greeting'),
      subtitle: document.getElementById('subtitle'),
      
      // Search
      searchToggle: document.getElementById('search-toggle'),
      searchBar: document.getElementById('search-bar'),
      searchInput: document.getElementById('search-input'),
      searchClose: document.getElementById('search-close'),
      
      // Task Modal
      modalOverlay: document.getElementById('modal-overlay'),
      taskModal: document.getElementById('task-modal'),
      modalTitle: document.getElementById('modal-title'),
      taskForm: document.getElementById('task-form'),
      taskInput: document.getElementById('task-input'),
      taskNotes: document.getElementById('task-notes'),
      taskPriority: document.getElementById('task-priority'),
      taskDate: document.getElementById('task-date'),
      taskRecurring: document.getElementById('task-recurring'),
      recurringOptions: document.getElementById('recurring-options'),
      recurringType: document.getElementById('recurring-type'),
      submitBtn: document.getElementById('submit-btn'),
      addBtn: document.getElementById('add-task-btn'),
      modalClose: document.getElementById('modal-close'),
      cancelBtn: document.getElementById('cancel-btn'),
      
      // Pomodoro
      pomodoroOverlay: document.getElementById('pomodoro-overlay'),
      pomodoroTime: document.getElementById('pomodoro-time'),
      pomodoroStatus: document.getElementById('pomodoro-status'),
      pomodoroTaskName: document.getElementById('pomodoro-task-name'),
      pomodoroRing: document.getElementById('pomodoro-ring'),
      pomodoroStart: document.getElementById('pomodoro-start'),
      pomodoroStartIcon: document.getElementById('pomodoro-start-icon'),
      pomodoroReset: document.getElementById('pomodoro-reset'),
      pomodoroSkip: document.getElementById('pomodoro-skip'),
      pomodoroCount: document.getElementById('pomodoro-count'),
      pomodoroClose: document.getElementById('pomodoro-close'),
      startPomodoro: document.getElementById('start-pomodoro'),
      
      // Menus
      contextMenu: document.getElementById('context-menu'),
      sortBtn: document.getElementById('sort-btn'),
      sortMenu: document.getElementById('sort-menu'),
      
      // Confirm Dialog
      confirmOverlay: document.getElementById('confirm-overlay'),
      confirmTitle: document.getElementById('confirm-title'),
      confirmMessage: document.getElementById('confirm-message'),
      confirmIcon: document.getElementById('confirm-icon'),
      confirmOk: document.getElementById('confirm-ok'),
      confirmCancel: document.getElementById('confirm-cancel'),
      
      // Calendar
      calendarGrid: document.getElementById('calendar-grid'),
      currentMonth: document.getElementById('current-month'),
      prevMonth: document.getElementById('prev-month'),
      nextMonth: document.getElementById('next-month'),
      selectedDateTitle: document.getElementById('selected-date-title'),
      selectedDateTasks: document.getElementById('selected-date-tasks'),
      addTaskDate: document.getElementById('add-task-date'),
      
      // Settings
      themeToggle: document.getElementById('theme-toggle'),
      colorPicker: document.getElementById('color-picker'),
      notificationToggle: document.getElementById('notification-toggle'),
      soundToggle: document.getElementById('sound-toggle'),
      pomodoroWorkSelect: document.getElementById('pomodoro-work'),
      pomodoroBreakSelect: document.getElementById('pomodoro-break'),
      exportData: document.getElementById('export-data'),
      importData: document.getElementById('import-data'),
      importFile: document.getElementById('import-file'),
      clearAllData: document.getElementById('clear-all-data'),
      
      // Stats page elements
      statsTotal: document.getElementById('stats-total'),
      statsCompleted: document.getElementById('stats-completed'),
      statsPending: document.getElementById('stats-pending'),
      statsOverdue: document.getElementById('stats-overdue'),
      completionRing: document.getElementById('completion-ring'),
      completionPercent: document.getElementById('completion-percent'),
      legendCompleted: document.getElementById('legend-completed'),
      legendPending: document.getElementById('legend-pending'),
      weeklyChart: document.getElementById('weekly-chart'),
      categoryStats: document.getElementById('category-stats'),
      productivityScore: document.getElementById('productivity-score'),
      productivityBadge: document.getElementById('productivity-badge'),
      productivityTip: document.getElementById('productivity-tip'),
      
      // Toast
      toast: document.getElementById('toast'),
      toastMessage: document.getElementById('toast-message'),
      toastIcon: document.getElementById('toast-icon'),
      
      // AI Card
      aiCollapse: document.getElementById('ai-collapse'),
      aiCard: document.getElementById('ai-card')
    };
  }

  addSVGGradients() {
    // Add gradient definitions to SVGs
    const progressSvg = document.querySelector('.progress-ring');
    if (progressSvg && !progressSvg.querySelector('defs')) {
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.innerHTML = `
        <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:var(--primary);stop-opacity:1" />
          <stop offset="100%" style="stop-color:var(--accent);stop-opacity:1" />
        </linearGradient>
      `;
      progressSvg.insertBefore(defs, progressSvg.firstChild);
    }

    const completionSvg = document.querySelector('.completion-ring');
    if (completionSvg && !completionSvg.querySelector('defs')) {
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.innerHTML = `
        <linearGradient id="completion-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#06b6d4;stop-opacity:1" />
        </linearGradient>
      `;
      completionSvg.insertBefore(defs, completionSvg.firstChild);
    }

    const pomodoroSvg = document.querySelector('.pomodoro-ring');
    if (pomodoroSvg && !pomodoroSvg.querySelector('defs')) {
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.innerHTML = `
        <linearGradient id="pomodoro-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#ef4444;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#f59e0b;stop-opacity:1" />
        </linearGradient>
      `;
      pomodoroSvg.insertBefore(defs, pomodoroSvg.firstChild);
    }
  }

  async applySettings() {
    document.body.setAttribute('data-theme', this.settings.theme);
    document.body.setAttribute('data-color', this.settings.colorScheme);
    
    // Update iOS status bar
    if (this.StatusBar) {
      try {
        const { Style } = await import('@capacitor/status-bar');
        if (this.settings.theme === 'light') {
          await this.StatusBar.setStyle({ style: Style.Light });
          await this.StatusBar.setBackgroundColor({ color: '#f8fafc' });
        } else {
          await this.StatusBar.setStyle({ style: Style.Dark });
          await this.StatusBar.setBackgroundColor({ color: '#0a0a1a' });
        }
      } catch (e) {
        // Status bar not available
      }
    }
    
    // Update settings UI
    if (this.elements.themeToggle) {
      this.elements.themeToggle.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === this.settings.theme);
      });
    }
    
    if (this.elements.colorPicker) {
      this.elements.colorPicker.querySelectorAll('.color-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === this.settings.colorScheme);
      });
    }
    
    if (this.elements.notificationToggle) {
      this.elements.notificationToggle.checked = this.settings.notifications;
    }
    
    if (this.elements.soundToggle) {
      this.elements.soundToggle.checked = this.settings.sounds;
    }
    
    if (this.elements.pomodoroWorkSelect) {
      this.elements.pomodoroWorkSelect.value = this.settings.pomodoroWork;
    }
    
    if (this.elements.pomodoroBreakSelect) {
      this.elements.pomodoroBreakSelect.value = this.settings.pomodoroBreak;
    }
  }

  // ==================== DATE & TIME ====================

  updateDateDisplay() {
    const now = new Date();
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    const dateStr = now.toLocaleDateString('zh-CN', options);
    
    if (this.elements.dateDisplay) {
      this.elements.dateDisplay.textContent = dateStr;
    }
    
    const hour = now.getHours();
    let greeting = '今日待办';
    let subtitle = '开启高效的一天 ✨';
    
    if (hour < 6) {
      greeting = '夜深了';
      subtitle = '早点休息，明天继续加油 🌙';
    } else if (hour < 12) {
      greeting = '早安';
      subtitle = '美好的一天从现在开始 ☀️';
    } else if (hour < 14) {
      greeting = '午安';
      subtitle = '吃完午饭，休息一下 🍱';
    } else if (hour < 18) {
      greeting = '下午好';
      subtitle = '保持专注，继续前进 💪';
    } else if (hour < 22) {
      greeting = '晚上好';
      subtitle = '完成今日目标了吗？🌆';
    } else {
      greeting = '夜深了';
      subtitle = '辛苦了，早点休息 🌙';
    }
    
    if (this.elements.greeting) {
      this.elements.greeting.textContent = greeting;
    }
    if (this.elements.subtitle) {
      this.elements.subtitle.textContent = subtitle;
    }
  }

  getTodayString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getFutureDateString(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }

  isOverdue(dueDate) {
    if (!dueDate) return false;
    const todayStr = this.getTodayString();
    // 直接比较日期字符串，避免时区问题
    return dueDate < todayStr;
  }

  getDueStatus(dueDate) {
    if (!dueDate) return { text: '', class: '' };
    
    // 使用本地日期比较，避免时区问题
    const todayStr = this.getTodayString();
    
    // 直接比较日期字符串
    if (dueDate === todayStr) {
      return { text: '今天', class: 'today' };
    }
    
    // 计算天数差
    const today = new Date(todayStr + 'T00:00:00');
    const due = new Date(dueDate + 'T00:00:00');
    const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { text: `逾期 ${Math.abs(diffDays)} 天`, class: 'overdue' };
    } else if (diffDays === 1) {
      return { text: '明天', class: '' };
    } else if (diffDays <= 7) {
      return { text: `${diffDays} 天后`, class: '' };
    } else {
      return { text: this.formatDate(dueDate), class: '' };
    }
  }

  // ==================== STATS ====================

  updateStats() {
    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    if (this.elements.totalTasks) {
      this.elements.totalTasks.textContent = total;
    }
    if (this.elements.completedTasks) {
      this.elements.completedTasks.textContent = completed;
    }
    if (this.elements.pendingTasks) {
      this.elements.pendingTasks.textContent = pending;
    }
    if (this.elements.progressText) {
      this.elements.progressText.textContent = `${percentage}%`;
    }
    
    // Update progress ring (r=21, circumference = 2*π*21 ≈ 131.95)
    if (this.elements.progressRing) {
      const circumference = 2 * Math.PI * 21;
      const offset = circumference - (percentage / 100) * circumference;
      this.elements.progressRing.style.strokeDasharray = circumference;
      this.elements.progressRing.style.strokeDashoffset = offset;
    }
  }

  // ==================== AI SUGGESTIONS ====================

  updateAISuggestions() {
    if (!this.elements.aiSuggestions) return;
    
    const suggestions = this.generateAISuggestions();
    this.elements.aiSuggestions.innerHTML = suggestions.map(s => `
      <div class="suggestion-item" onclick="todoApp.handleSuggestion('${s.action}', '${s.data || ''}')">
        <div class="suggestion-icon" style="background: ${s.bgColor};">
          <span class="material-icons-outlined" style="color: ${s.iconColor}; font-size: 16px;">${s.icon}</span>
        </div>
        <div class="suggestion-content">
          <p class="suggestion-title">${s.title}</p>
          <p class="suggestion-desc">${s.desc}</p>
        </div>
      </div>
    `).join('');
  }

  generateAISuggestions() {
    const suggestions = [];
    const pendingTasks = this.tasks.filter(t => !t.completed);
    const highPriority = pendingTasks.filter(t => t.priority === 'high');
    const overdue = pendingTasks.filter(t => this.isOverdue(t.dueDate));
    const todayTasks = pendingTasks.filter(t => t.dueDate === this.getTodayString());
    
    if (overdue.length > 0) {
      suggestions.push({
        icon: 'warning',
        iconColor: '#ef4444',
        bgColor: 'rgba(239, 68, 68, 0.15)',
        title: `${overdue.length} 个任务已逾期`,
        desc: '立即处理这些任务',
        action: 'filter',
        data: 'overdue'
      });
    }
    
    if (highPriority.length > 0) {
      suggestions.push({
        icon: 'priority_high',
        iconColor: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.15)',
        title: `${highPriority.length} 个高优先级任务`,
        desc: `建议优先处理「${highPriority[0].text.substring(0, 12)}${highPriority[0].text.length > 12 ? '...' : ''}」`,
        action: 'filter',
        data: 'high'
      });
    }
    
    if (todayTasks.length > 0) {
      suggestions.push({
        icon: 'today',
        iconColor: '#3b82f6',
        bgColor: 'rgba(59, 130, 246, 0.15)',
        title: `今日还有 ${todayTasks.length} 个任务`,
        desc: '保持专注，完成今日目标',
        action: 'filter',
        data: 'today'
      });
    }
    
    const completedToday = this.tasks.filter(t => 
      t.completed && t.dueDate === this.getTodayString()
    ).length;
    
    if (completedToday >= 3) {
      suggestions.push({
        icon: 'celebration',
        iconColor: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.15)',
        title: '太棒了！',
        desc: `今天已完成 ${completedToday} 个任务，继续保持！`,
        action: 'none',
        data: ''
      });
    }
    
    if (suggestions.length === 0) {
      suggestions.push({
        icon: 'lightbulb',
        iconColor: '#fbbf24',
        bgColor: 'rgba(251, 191, 36, 0.15)',
        title: '开始新的一天',
        desc: '添加任务来规划你的日程',
        action: 'add',
        data: ''
      });
      
      if (pendingTasks.length > 0) {
        suggestions.push({
          icon: 'timer',
          iconColor: '#ef4444',
          bgColor: 'rgba(239, 68, 68, 0.15)',
          title: '开启番茄钟',
          desc: '使用番茄工作法提高效率',
          action: 'pomodoro',
          data: ''
        });
      }
    }
    
    return suggestions.slice(0, 3);
  }

  handleSuggestion(action, data) {
    switch (action) {
      case 'filter':
        this.setFilter(data);
        // Switch filter tab
        document.querySelectorAll('.filter-tab').forEach(tab => {
          tab.classList.toggle('active', tab.dataset.filter === data);
        });
        break;
      case 'add':
        this.openModal();
        break;
      case 'pomodoro':
        this.openPomodoroModal();
        break;
      default:
        break;
    }
  }

  // ==================== TASK RENDERING ====================

  renderTasks() {
    if (!this.elements.taskList) return;

    let filteredTasks = this.getFilteredTasks();
    
    // Apply search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filteredTasks = filteredTasks.filter(t => 
        t.text.toLowerCase().includes(query) ||
        (t.notes && t.notes.toLowerCase().includes(query))
      );
    }
    
    // Show/hide empty state
    if (this.elements.emptyState) {
      if (filteredTasks.length === 0) {
        this.elements.emptyState.classList.add('show');
        this.elements.taskList.style.display = 'none';
      } else {
        this.elements.emptyState.classList.remove('show');
        this.elements.taskList.style.display = 'flex';
      }
    }

    this.elements.taskList.innerHTML = '';
    
    const sortedTasks = this.sortTasks([...filteredTasks]);

    sortedTasks.forEach((task, index) => {
      const taskElement = this.createTaskElement(task, index);
      this.elements.taskList.appendChild(taskElement);
    });
  }

  getFilteredTasks() {
    switch (this.currentFilter) {
      case 'pending':
        return this.tasks.filter(t => !t.completed);
      case 'completed':
        return this.tasks.filter(t => t.completed);
      case 'high':
        return this.tasks.filter(t => t.priority === 'high' && !t.completed);
      case 'today':
        return this.tasks.filter(t => t.dueDate === this.getTodayString() && !t.completed);
      case 'overdue':
        return this.tasks.filter(t => !t.completed && this.isOverdue(t.dueDate));
      default:
        return this.tasks;
    }
  }

  sortTasks(tasks) {
    switch (this.currentSort) {
      case 'date-asc':
        return tasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      case 'date-desc':
        return tasks.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
      case 'priority':
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return tasks.sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
      case 'alpha':
        return tasks.sort((a, b) => a.text.localeCompare(b.text, 'zh-CN'));
      default:
        // Default: incomplete first, then by priority, then by date
        return tasks.sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          }
          return new Date(a.dueDate) - new Date(b.dueDate);
        });
    }
  }

  createTaskElement(task, index) {
    const div = document.createElement('div');
    div.className = `task-item ${task.completed ? 'completed' : ''}`;
    div.dataset.taskId = task.id;
    div.style.animationDelay = `${index * 0.03}s`;
    div.draggable = true;

    const dueStatus = this.getDueStatus(task.dueDate);
    const categoryLabels = {
      work: '💼 工作',
      personal: '🏠 个人',
      study: '📚 学习',
      health: '💪 健康'
    };
    
    const recurringLabels = {
      daily: '🔄 每天',
      weekly: '🔄 每周',
      monthly: '🔄 每月'
    };

    div.innerHTML = `
      <div class="priority-indicator ${task.priority}"></div>
      <div class="task-checkbox">
        <span class="material-icons-outlined check-icon">check</span>
      </div>
      <div class="task-content">
        <p class="task-text">${this.escapeHtml(task.text)}</p>
        <div class="task-meta">
          <span class="task-category ${task.category}">${categoryLabels[task.category] || '📌 其他'}</span>
          ${task.dueDate ? `
            <span class="task-due ${dueStatus.class}">
              <span class="material-icons-outlined">schedule</span>
              ${dueStatus.text}
            </span>
          ` : ''}
          ${task.recurring ? `<span class="task-recurring">${recurringLabels[task.recurring]}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="task-action-btn edit" title="编辑">
          <span class="material-icons-outlined">edit</span>
        </button>
        <button class="task-action-btn delete" title="删除">
          <span class="material-icons-outlined">delete</span>
        </button>
      </div>
    `;

    // Event listeners
    const checkbox = div.querySelector('.task-checkbox');
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleTask(task.id);
    });

    const editBtn = div.querySelector('.task-action-btn.edit');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.editTask(task.id);
    });

    const deleteBtn = div.querySelector('.task-action-btn.delete');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteTask(task.id);
    });

    // Context menu
    div.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e, task.id);
    });

    // Drag events
    div.addEventListener('dragstart', (e) => this.handleDragStart(e, task.id));
    div.addEventListener('dragover', (e) => this.handleDragOver(e));
    div.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    div.addEventListener('drop', (e) => this.handleDrop(e, task.id));
    div.addEventListener('dragend', (e) => this.handleDragEnd(e));

    return div;
  }

  // ==================== TASK OPERATIONS ====================

  toggleTask(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      
      // Handle recurring task
      if (task.completed && task.recurring) {
        this.createNextRecurringTask(task);
      }
      
      // Cancel or reschedule notification
      if (task.completed) {
        this.cancelNotification(task.id);
      } else {
        this.scheduleNotification(task);
      }
      
      this.saveTasks();
      this.renderTasks();
      
      if (task.completed) {
        this.haptic('success');
        this.showToast('任务已完成 🎉', 'success');
        if (this.settings.sounds) {
          this.playSound('complete');
        }
      } else {
        this.haptic('light');
      }
    }
  }

  addTask(taskData) {
    const newTask = {
      id: Date.now(),
      text: taskData.text.trim(),
      notes: taskData.notes?.trim() || '',
      completed: false,
      priority: taskData.priority || 'medium',
      category: taskData.category || 'work',
      dueDate: taskData.dueDate || this.getTodayString(),
      recurring: taskData.recurring || null,
      createdAt: Date.now()
    };

    this.tasks.unshift(newTask);
    this.scheduleNotification(newTask);
    this.saveTasks();
    this.renderTasks();
    this.updateCalendar();
    this.haptic('medium');
    this.showToast('任务已添加', 'success');
  }

  editTask(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    this.editingTaskId = taskId;
    this.openModal(task);
  }

  updateTask(taskId, taskData) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    task.text = taskData.text.trim();
    task.notes = taskData.notes?.trim() || '';
    task.priority = taskData.priority;
    task.category = taskData.category;
    task.dueDate = taskData.dueDate;
    task.recurring = taskData.recurring || null;
    
    this.saveTasks();
    this.renderTasks();
    this.updateCalendar();
    this.showToast('任务已更新', 'success');
  }

  deleteTask(taskId) {
    const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
    if (taskElement) {
      this.haptic('warning');
      this.cancelNotification(taskId);
      taskElement.classList.add('removing');
      setTimeout(() => {
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.saveTasks();
        this.renderTasks();
        this.updateCalendar();
        this.showToast('任务已删除', 'success');
      }, 300);
    }
  }

  duplicateTask(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    const newTask = {
      ...task,
      id: Date.now(),
      completed: false,
      createdAt: Date.now()
    };
    
    this.tasks.unshift(newTask);
    this.saveTasks();
    this.renderTasks();
    this.showToast('任务已复制', 'success');
  }

  togglePriority(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const priorities = ['low', 'medium', 'high'];
    const currentIndex = priorities.indexOf(task.priority);
    task.priority = priorities[(currentIndex + 1) % priorities.length];
    
    this.saveTasks();
    this.renderTasks();
    this.showToast(`优先级已改为 ${this.getPriorityLabel(task.priority)}`, 'success');
  }

  getPriorityLabel(priority) {
    const labels = { low: '低', medium: '中', high: '高' };
    return labels[priority] || '中';
  }

  clearCompleted() {
    const completedCount = this.tasks.filter(t => t.completed).length;
    if (completedCount === 0) {
      this.showToast('没有已完成的任务', 'warning');
      return;
    }
    
    this.tasks = this.tasks.filter(t => !t.completed);
    this.saveTasks();
    this.renderTasks();
    this.updateCalendar();
    this.showToast(`已清除 ${completedCount} 个任务`, 'success');
  }

  // ==================== RECURRING TASKS ====================

  handleRecurringTasks() {
    const today = this.getTodayString();
    const lastCheck = localStorage.getItem('lastRecurringCheck');
    
    if (lastCheck === today) return;
    
    localStorage.setItem('lastRecurringCheck', today);
  }

  createNextRecurringTask(task) {
    let nextDate = new Date(task.dueDate);
    
    switch (task.recurring) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
    }
    
    const newTask = {
      ...task,
      id: Date.now(),
      completed: false,
      dueDate: nextDate.toISOString().split('T')[0],
      createdAt: Date.now()
    };

    this.tasks.push(newTask);
  }

  // ==================== DRAG & DROP ====================

  handleDragStart(e, taskId) {
    e.dataTransfer.setData('text/plain', taskId);
    e.target.classList.add('dragging');
  }

  handleDragOver(e) {
    e.preventDefault();
    e.target.closest('.task-item')?.classList.add('drag-over');
  }

  handleDragLeave(e) {
    e.target.closest('.task-item')?.classList.remove('drag-over');
  }

  handleDrop(e, targetId) {
    e.preventDefault();
    const draggedId = parseInt(e.dataTransfer.getData('text/plain'));
    
    if (draggedId === targetId) return;
    
    const draggedIndex = this.tasks.findIndex(t => t.id === draggedId);
    const targetIndex = this.tasks.findIndex(t => t.id === targetId);
    
    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [draggedTask] = this.tasks.splice(draggedIndex, 1);
      this.tasks.splice(targetIndex, 0, draggedTask);
    this.saveTasks();
    this.renderTasks();
  }

    e.target.closest('.task-item')?.classList.remove('drag-over');
  }

  handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.task-item').forEach(el => {
      el.classList.remove('drag-over');
    });
  }

  // ==================== MODALS ====================

  openModal(task = null) {
    if (!this.elements.modalOverlay) return;
    
    this.elements.modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    if (task) {
      this.elements.modalTitle.textContent = '编辑任务';
      this.elements.taskInput.value = task.text;
      this.elements.taskNotes.value = task.notes || '';
      this.elements.taskPriority.value = task.priority;
      this.elements.taskDate.value = task.dueDate;
      this.elements.taskRecurring.checked = !!task.recurring;
      this.elements.recurringOptions.classList.toggle('show', !!task.recurring);
      if (task.recurring) {
        this.elements.recurringType.value = task.recurring;
      }
      this.elements.submitBtn.innerHTML = `
        <span class="material-icons-outlined">save</span>
        保存更改
      `;
      
      document.querySelectorAll('.category-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.category === task.category);
      });
    } else {
      this.elements.modalTitle.textContent = '添加新任务';
      this.elements.taskInput.value = '';
      this.elements.taskNotes.value = '';
      this.elements.taskPriority.value = 'medium';
      this.elements.taskDate.value = this.selectedDate || this.getTodayString();
      this.elements.taskRecurring.checked = false;
      this.elements.recurringOptions.classList.remove('show');
      this.elements.submitBtn.innerHTML = `
        <span class="material-icons-outlined">add_task</span>
        添加任务
      `;
      
      document.querySelectorAll('.category-chip').forEach((chip, index) => {
        chip.classList.toggle('active', index === 0);
      });
    }
    
    setTimeout(() => {
      this.elements.taskInput.focus();
    }, 100);
  }

  closeModal() {
    if (!this.elements.modalOverlay) return;
    
    this.elements.modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
    this.editingTaskId = null;
    this.elements.taskForm.reset();
  }

  // ==================== CONTEXT MENU ====================

  showContextMenu(e, taskId) {
    this.contextMenuTaskId = taskId;
    const menu = this.elements.contextMenu;
    if (!menu) return;
    
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.classList.add('active');
    
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${e.clientX - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${e.clientY - rect.height}px`;
    }
  }

  hideContextMenu() {
    if (this.elements.contextMenu) {
      this.elements.contextMenu.classList.remove('active');
    }
    this.contextMenuTaskId = null;
  }

  // ==================== SORT MENU ====================

  showSortMenu() {
    const menu = this.elements.sortMenu;
    const btn = this.elements.sortBtn;
    if (!menu || !btn) return;
    
    const rect = btn.getBoundingClientRect();
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 8}px`;
    menu.classList.add('active');
  }

  hideSortMenu() {
    if (this.elements.sortMenu) {
      this.elements.sortMenu.classList.remove('active');
    }
  }

  // ==================== SEARCH ====================

  toggleSearch() {
    const searchBar = this.elements.searchBar;
    if (!searchBar) return;
    
    searchBar.classList.toggle('active');
    
    if (searchBar.classList.contains('active')) {
      this.elements.searchInput.focus();
    } else {
      this.elements.searchInput.value = '';
      this.searchQuery = '';
      this.renderTasks();
    }
  }

  // ==================== FILTER ====================

  setFilter(filter) {
    this.currentFilter = filter;
    this.updateFilterTabs();
    this.renderTasks();
  }

  updateFilterTabs() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.filter === this.currentFilter);
    });
  }

  // ==================== CALENDAR ====================

  initCalendar() {
    this.updateCalendar();
  }

  updateCalendar() {
    if (!this.elements.calendarGrid) return;
    
    const year = this.calendarDate.getFullYear();
    const month = this.calendarDate.getMonth();
    
    // Update month display
    if (this.elements.currentMonth) {
      this.elements.currentMonth.textContent = `${year}年${month + 1}月`;
    }
    
    // Get first day of month and total days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    // Get today
    const today = new Date();
    const todayStr = this.getTodayString();
    
    // Get tasks by date
    const tasksByDate = {};
    this.tasks.forEach(task => {
      if (task.dueDate) {
        if (!tasksByDate[task.dueDate]) {
          tasksByDate[task.dueDate] = [];
        }
        tasksByDate[task.dueDate].push(task);
      }
    });
    
    let html = '';
    
    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      html += `<div class="calendar-day other-month">${day}</div>`;
    }
    
    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === this.selectedDate;
      const hasTasks = tasksByDate[dateStr] && tasksByDate[dateStr].length > 0;
      
      let classes = 'calendar-day';
      if (isToday) classes += ' today';
      if (isSelected) classes += ' selected';
      if (hasTasks) classes += ' has-tasks';
      
      html += `<div class="${classes}" data-date="${dateStr}">${day}</div>`;
    }
    
    // Next month days
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    const nextMonthDays = totalCells - (firstDay + daysInMonth);
    for (let day = 1; day <= nextMonthDays; day++) {
      html += `<div class="calendar-day other-month">${day}</div>`;
    }
    
    this.elements.calendarGrid.innerHTML = html;
    
    // Add click listeners
    this.elements.calendarGrid.querySelectorAll('.calendar-day:not(.other-month)').forEach(dayEl => {
      dayEl.addEventListener('click', () => {
        const date = dayEl.dataset.date;
        this.selectDate(date);
      });
    });
  }

  selectDate(dateStr) {
    this.selectedDate = dateStr;
    
    // Update selected state
    this.elements.calendarGrid.querySelectorAll('.calendar-day').forEach(el => {
      el.classList.toggle('selected', el.dataset.date === dateStr);
    });
    
    // Update title
    const date = new Date(dateStr);
    const options = { month: 'long', day: 'numeric', weekday: 'long' };
    if (this.elements.selectedDateTitle) {
      this.elements.selectedDateTitle.textContent = date.toLocaleDateString('zh-CN', options);
    }
    
    // Show tasks for selected date
    this.renderSelectedDateTasks(dateStr);
  }

  renderSelectedDateTasks(dateStr) {
    if (!this.elements.selectedDateTasks) return;
    
    const tasks = this.tasks.filter(t => t.dueDate === dateStr);
    
    if (tasks.length === 0) {
      this.elements.selectedDateTasks.innerHTML = `
        <div class="no-tasks-hint">
          <span class="material-icons-outlined">event_available</span>
          <p>这一天没有任务</p>
        </div>
      `;
      return;
    }
    
    this.elements.selectedDateTasks.innerHTML = tasks.map(task => `
      <div class="task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
        <div class="priority-indicator ${task.priority}"></div>
        <div class="task-checkbox" onclick="todoApp.toggleTask(${task.id})">
          <span class="material-icons-outlined check-icon">check</span>
        </div>
        <div class="task-content">
          <p class="task-text">${this.escapeHtml(task.text)}</p>
        </div>
      </div>
    `).join('');
  }

  // ==================== STATS PAGE ====================

  updateStatsPage() {
    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const overdue = this.tasks.filter(t => !t.completed && this.isOverdue(t.dueDate)).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    // Update stat cards
    if (this.elements.statsTotal) this.elements.statsTotal.textContent = total;
    if (this.elements.statsCompleted) this.elements.statsCompleted.textContent = completed;
    if (this.elements.statsPending) this.elements.statsPending.textContent = pending;
    if (this.elements.statsOverdue) this.elements.statsOverdue.textContent = overdue;
    
    // Update completion ring (r=60, circumference = 2*π*60 ≈ 377)
    if (this.elements.completionRing) {
      const circumference = 2 * Math.PI * 60;
      const offset = circumference - (percentage / 100) * circumference;
      this.elements.completionRing.style.strokeDasharray = circumference;
      this.elements.completionRing.style.strokeDashoffset = offset;
    }
    
    if (this.elements.completionPercent) {
      this.elements.completionPercent.textContent = `${percentage}%`;
    }
    if (this.elements.legendCompleted) {
      this.elements.legendCompleted.textContent = completed;
    }
    if (this.elements.legendPending) {
      this.elements.legendPending.textContent = pending;
    }
    
    // Update weekly chart
    this.updateWeeklyChart();
    
    // Update category stats
    this.updateCategoryStats();
    
    // Update productivity score
    this.updateProductivityScore(percentage, overdue, total);
  }

  updateWeeklyChart() {
    if (!this.elements.weeklyChart) return;
    
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    const today = new Date();
    const weekData = [];
    
    // Get completed tasks for each day of the week
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayIndex = date.getDay();
      
      const completedCount = this.tasks.filter(t => 
        t.completed && t.dueDate === dateStr
      ).length;
      
      weekData.push({
        day: days[dayIndex],
        count: completedCount,
        isToday: i === 0
      });
    }
    
    const maxCount = Math.max(...weekData.map(d => d.count), 1);
    
    this.elements.weeklyChart.innerHTML = weekData.map(d => `
      <div class="weekly-bar">
        <span class="bar-value">${d.count}</span>
        <div class="bar-container">
          <div class="bar" style="height: ${(d.count / maxCount) * 100}%;${d.isToday ? ' opacity: 1;' : ' opacity: 0.6;'}"></div>
        </div>
        <span class="bar-label">${d.day}</span>
      </div>
    `).join('');
  }

  updateCategoryStats() {
    if (!this.elements.categoryStats) return;
    
    const categories = {
      work: { name: '工作', icon: '💼', color: '#3b82f6', count: 0 },
      personal: { name: '个人', icon: '🏠', color: '#8b5cf6', count: 0 },
      study: { name: '学习', icon: '📚', color: '#06b6d4', count: 0 },
      health: { name: '健康', icon: '💪', color: '#10b981', count: 0 }
    };
    
    this.tasks.forEach(task => {
      if (categories[task.category]) {
        categories[task.category].count++;
      }
    });
    
    const total = this.tasks.length || 1;
    
    this.elements.categoryStats.innerHTML = Object.values(categories).map(cat => `
      <div class="category-stat-item">
        <span class="category-stat-icon">${cat.icon}</span>
        <div class="category-stat-info">
          <div class="category-stat-name">${cat.name}</div>
          <div class="category-stat-bar">
            <div class="category-stat-fill" style="width: ${(cat.count / total) * 100}%; background: ${cat.color};"></div>
          </div>
        </div>
        <span class="category-stat-value">${cat.count}</span>
      </div>
    `).join('');
  }

  updateProductivityScore(percentage, overdue, total) {
    // Calculate productivity score (0-100)
    let score = percentage;
    
    // Penalize for overdue tasks
    if (total > 0) {
      score -= (overdue / total) * 30;
    }
    
    // Bonus for completing today's tasks
    const todayCompleted = this.tasks.filter(t => 
      t.completed && t.dueDate === this.getTodayString()
    ).length;
    score += Math.min(todayCompleted * 5, 20);
    
    // Clamp to 0-100
    score = Math.max(0, Math.min(100, Math.round(score)));
    
    if (this.elements.productivityScore) {
      this.elements.productivityScore.textContent = score;
    }
    
    // Update badge
    let badge = '需努力';
    let badgeColor = '#ef4444';
    
    if (score >= 80) {
      badge = '优秀';
      badgeColor = '#10b981';
    } else if (score >= 60) {
      badge = '良好';
      badgeColor = '#3b82f6';
    } else if (score >= 40) {
      badge = '一般';
      badgeColor = '#f59e0b';
    }
    
    if (this.elements.productivityBadge) {
      this.elements.productivityBadge.textContent = badge;
      this.elements.productivityBadge.style.background = `${badgeColor}20`;
      this.elements.productivityBadge.style.color = badgeColor;
    }
    
    // Update tip
    const tips = {
      优秀: '继续保持！您的任务完成率很高。',
      良好: '做得不错！再接再厉，争取更好。',
      一般: '还有提升空间，尝试制定更具体的计划。',
      需努力: '加油！从小目标开始，逐步提高效率。'
    };
    
    if (this.elements.productivityTip) {
      this.elements.productivityTip.textContent = tips[badge];
    }
  }

  // ==================== POMODORO ====================

  openPomodoroModal(taskId = null) {
    if (!this.elements.pomodoroOverlay) return;
    
    if (taskId) {
      const task = this.tasks.find(t => t.id === taskId);
      if (task) {
        this.pomodoro.selectedTask = task;
        this.elements.pomodoroTaskName.textContent = task.text;
      }
    } else {
      const pendingTasks = this.tasks.filter(t => !t.completed);
      if (pendingTasks.length > 0) {
        this.pomodoro.selectedTask = pendingTasks[0];
        this.elements.pomodoroTaskName.textContent = pendingTasks[0].text;
      } else {
        this.pomodoro.selectedTask = null;
        this.elements.pomodoroTaskName.textContent = '无任务';
      }
    }
    
    this.elements.pomodoroOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    this.updatePomodoroDisplay();
  }

  closePomodoroModal() {
    if (!this.elements.pomodoroOverlay) return;
    
    this.elements.pomodoroOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  togglePomodoro() {
    if (this.pomodoro.isRunning) {
      this.pausePomodoro();
    } else {
      this.startPomodoro();
    }
  }

  startPomodoro() {
    this.pomodoro.isRunning = true;
    this.elements.pomodoroStartIcon.textContent = 'pause';
    this.elements.pomodoroStatus.textContent = this.pomodoro.isBreak ? '休息中...' : '专注中...';
    
    this.pomodoro.interval = setInterval(() => {
      this.pomodoro.timeLeft--;
      this.updatePomodoroDisplay();
      
      if (this.pomodoro.timeLeft <= 0) {
        this.completePomodoroPhase();
      }
    }, 1000);
  }

  pausePomodoro() {
    this.pomodoro.isRunning = false;
    this.elements.pomodoroStartIcon.textContent = 'play_arrow';
    this.elements.pomodoroStatus.textContent = '已暂停';
    
    if (this.pomodoro.interval) {
      clearInterval(this.pomodoro.interval);
      this.pomodoro.interval = null;
    }
  }

  resetPomodoro() {
    this.pausePomodoro();
    this.pomodoro.isBreak = false;
    this.pomodoro.timeLeft = this.settings.pomodoroWork * 60;
    this.elements.pomodoroStatus.textContent = '准备开始专注';
    this.updatePomodoroDisplay();
  }

  skipPomodoro() {
    this.completePomodoroPhase();
  }

  completePomodoroPhase() {
    this.pausePomodoro();
    
    if (!this.pomodoro.isBreak) {
      // Completed a work session
      this.pomodoro.sessions++;
      localStorage.setItem('pomodoroSessions', this.pomodoro.sessions);
      this.elements.pomodoroCount.textContent = this.pomodoro.sessions;
      
      if (this.settings.sounds) {
        this.playSound('pomodoro');
      }
      
      this.showToast('🍅 番茄完成！休息一下吧', 'success');
      
      // Start break
      this.pomodoro.isBreak = true;
      this.pomodoro.timeLeft = this.settings.pomodoroBreak * 60;
      this.elements.pomodoroStatus.textContent = '开始休息';
    } else {
      // Completed a break
      this.showToast('休息结束，继续加油！', 'success');
      
      // Start work
      this.pomodoro.isBreak = false;
      this.pomodoro.timeLeft = this.settings.pomodoroWork * 60;
      this.elements.pomodoroStatus.textContent = '准备开始专注';
    }
    
    this.updatePomodoroDisplay();
  }

  updatePomodoroDisplay() {
    const minutes = Math.floor(this.pomodoro.timeLeft / 60);
    const seconds = this.pomodoro.timeLeft % 60;
    
    if (this.elements.pomodoroTime) {
      this.elements.pomodoroTime.textContent = 
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    
    if (this.elements.pomodoroCount) {
      this.elements.pomodoroCount.textContent = this.pomodoro.sessions;
    }
    
    // Update ring (r=90, circumference = 2*π*90 ≈ 565.48)
    if (this.elements.pomodoroRing) {
      const totalTime = this.pomodoro.isBreak 
        ? this.settings.pomodoroBreak * 60 
        : this.settings.pomodoroWork * 60;
      const progress = this.pomodoro.timeLeft / totalTime;
      const circumference = 2 * Math.PI * 90;
      const offset = circumference * (1 - progress);
      
      this.elements.pomodoroRing.style.strokeDasharray = circumference;
      this.elements.pomodoroRing.style.strokeDashoffset = offset;
    }
  }

  // ==================== CONFIRM DIALOG ====================

  showConfirmDialog(title, message, onConfirm, isDanger = false) {
    if (!this.elements.confirmOverlay) return;
    
    this.elements.confirmTitle.textContent = title;
    this.elements.confirmMessage.textContent = message;
    this.elements.confirmIcon.classList.toggle('danger', isDanger);
    this.elements.confirmOk.classList.toggle('danger', isDanger);
    
    this.elements.confirmOverlay.classList.add('active');
    
    // Store callback
    this._confirmCallback = onConfirm;
  }

  hideConfirmDialog() {
    if (!this.elements.confirmOverlay) return;
    
    this.elements.confirmOverlay.classList.remove('active');
    this._confirmCallback = null;
  }

  // ==================== DATA MANAGEMENT ====================

  exportData() {
    const data = {
      tasks: this.tasks,
      settings: this.settings,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `todo-backup-${this.getTodayString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.showToast('数据已导出', 'success');
  }

  importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (data.tasks && Array.isArray(data.tasks)) {
          this.tasks = data.tasks;
          this.saveTasks();
        }
        
        if (data.settings) {
          this.settings = { ...this.settings, ...data.settings };
          this.saveSettings();
        }
        
        this.renderTasks();
        this.updateCalendar();
        this.showToast('数据已导入', 'success');
      } catch (err) {
        this.showToast('导入失败：文件格式错误', 'error');
      }
    };
    reader.readAsText(file);
  }

  clearAllData() {
    this.showConfirmDialog(
      '清除所有数据',
      '此操作将删除所有任务和设置，且不可恢复。确定要继续吗？',
      () => {
        localStorage.clear();
        this.tasks = [];
        this.settings = this.loadSettings();
        this.saveTasks();
        this.saveSettings();
        this.renderTasks();
        this.updateCalendar();
        this.hideConfirmDialog();
        this.showToast('所有数据已清除', 'success');
      },
      true
    );
  }
  
  // ==================== USER PROFILE & MEMORY ====================
  
  saveUserProfile() {
    const name = document.getElementById('profile-name')?.value?.trim() || '';
    const occupation = document.getElementById('profile-occupation')?.value?.trim() || '';
    const background = document.getElementById('profile-background')?.value?.trim() || '';
    const goals = document.getElementById('profile-goals')?.value?.trim() || '';
    const challenges = document.getElementById('profile-challenges')?.value?.trim() || '';
    
    const profile = { name, occupation, background, goals, challenges };
    
    if (this.agent) {
      this.agent.saveUserProfile(profile);
      // 更新系统提示
      this.agent.systemPrompt = this.agent.buildSystemPrompt();
    }
    
    // 显示保存状态
    const status = document.getElementById('profile-status');
    if (status) {
      status.textContent = '✅ 个人背景已保存！小助会更了解你了';
      status.classList.add('show');
      setTimeout(() => status.classList.remove('show'), 3000);
    }
    
    this.showToast('个人背景已保存', 'success');
  }
  
  loadUserProfileForm() {
    if (!this.agent) return;
    
    const profile = this.agent.userProfile;
    
    const nameInput = document.getElementById('profile-name');
    const occupationInput = document.getElementById('profile-occupation');
    const backgroundInput = document.getElementById('profile-background');
    const goalsInput = document.getElementById('profile-goals');
    const challengesInput = document.getElementById('profile-challenges');
    
    if (nameInput) nameInput.value = profile.name || '';
    if (occupationInput) occupationInput.value = profile.occupation || '';
    if (backgroundInput) backgroundInput.value = profile.background || '';
    if (goalsInput) goalsInput.value = profile.goals || '';
    if (challengesInput) challengesInput.value = profile.challenges || '';
    
    this.updateMemoryDisplay();
  }
  
  updateMemoryDisplay() {
    const display = document.getElementById('memory-display');
    if (!display || !this.agent) return;
    
    const memory = this.agent.memory;
    const parts = [];
    
    const categoryNames = {
      facts: '📋 个人情况',
      preferences: '💝 偏好',
      goals: '🎯 目标',
      habits: '🔄 习惯',
      relationships: '👥 重要的人',
      interests: '⭐ 兴趣爱好'
    };
    
    for (const [category, items] of Object.entries(memory)) {
      if (items.length > 0) {
        const categoryName = categoryNames[category] || category;
        const itemList = items.map(m => `• ${m.content}`).join('\n');
        parts.push(`${categoryName}\n${itemList}`);
      }
    }
    
    display.textContent = parts.length > 0 ? parts.join('\n\n') : '暂无记忆。和小助聊天时，她会记住关于你的重要信息。';
  }
  
  clearAIMemory() {
    this.showConfirmDialog(
      '清除 AI 记忆',
      '这将清除小助记住的所有关于你的信息。确定要继续吗？',
      () => {
        if (this.agent) {
          this.agent.clearMemory();
          this.updateMemoryDisplay();
        }
        this.hideConfirmDialog();
        this.showToast('AI 记忆已清除', 'success');
      },
      false
    );
  }
  
  // ==================== 同步 UI ====================
  
  initSyncUI() {
    const serverUrlInput = document.getElementById('sync-server-url');
    const emailInput = document.getElementById('sync-email');
    const passwordInput = document.getElementById('sync-password');
    const nameInput = document.getElementById('sync-name');
    const loginBtn = document.getElementById('sync-login-btn');
    const registerBtn = document.getElementById('sync-register-btn');
    const logoutBtn = document.getElementById('sync-logout-btn');
    const syncNowBtn = document.getElementById('sync-now-btn');
    const loginForm = document.getElementById('sync-login-form');
    const loggedInDiv = document.getElementById('sync-logged-in');
    
    // 设置服务器地址
    if (serverUrlInput) {
      serverUrlInput.value = this.syncService.serverUrl;
    }
    
    // 检查登录状态
    this.updateSyncUIState();
    
    // 登录按钮
    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        const email = emailInput?.value?.trim();
        const password = passwordInput?.value;
        const serverUrl = serverUrlInput?.value?.trim();
        
        if (!email || !password) {
          this.showSyncMessage('请输入邮箱和密码', 'error');
          return;
        }
        
        if (serverUrl) {
          this.syncService.setServerUrl(serverUrl);
        }
        
        loginBtn.disabled = true;
        loginBtn.textContent = '登录中...';
        
        const result = await this.syncService.login(email, password);
        
        loginBtn.disabled = false;
        loginBtn.textContent = '登录';
        
        if (result.success) {
          this.showSyncMessage('登录成功！', 'success');
          this.updateSyncUIState();
          // 立即同步
          this.syncService.fullSync();
        } else {
          this.showSyncMessage(result.error, 'error');
        }
      });
    }
    
    // 注册按钮
    if (registerBtn) {
      registerBtn.addEventListener('click', async () => {
        const email = emailInput?.value?.trim();
        const password = passwordInput?.value;
        const name = nameInput?.value?.trim();
        const serverUrl = serverUrlInput?.value?.trim();
        
        if (!email || !password) {
          this.showSyncMessage('请输入邮箱和密码', 'error');
          return;
        }
        
        if (serverUrl) {
          this.syncService.setServerUrl(serverUrl);
        }
        
        registerBtn.disabled = true;
        registerBtn.textContent = '注册中...';
        
        const result = await this.syncService.register(email, password, name);
        
        registerBtn.disabled = false;
        registerBtn.textContent = '注册';
        
        if (result.success) {
          this.showSyncMessage('注册成功！', 'success');
          this.updateSyncUIState();
          // 上传本地数据
          this.syncService.fullSync();
        } else {
          this.showSyncMessage(result.error, 'error');
        }
      });
    }
    
    // 登出按钮
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.syncService.logout();
        this.updateSyncUIState();
        this.showToast('已退出登录', 'success');
      });
    }
    
    // 立即同步按钮
    if (syncNowBtn) {
      syncNowBtn.addEventListener('click', async () => {
        syncNowBtn.disabled = true;
        const result = await this.syncService.fullSync();
        syncNowBtn.disabled = false;
        
        if (result.success) {
          this.showToast('同步完成！', 'success');
        } else {
          this.showToast(result.error, 'error');
        }
      });
    }
  }
  
  updateSyncUIState() {
    const loginForm = document.getElementById('sync-login-form');
    const loggedInDiv = document.getElementById('sync-logged-in');
    const userNameEl = document.getElementById('sync-user-name');
    const userEmailEl = document.getElementById('sync-user-email');
    
    if (this.syncService.isLoggedIn()) {
      if (loginForm) loginForm.style.display = 'none';
      if (loggedInDiv) loggedInDiv.style.display = 'block';
      if (userNameEl) userNameEl.textContent = this.syncService.user.name || '用户';
      if (userEmailEl) userEmailEl.textContent = this.syncService.user.email;
      this.syncService.updateSyncStatus('success');
    } else {
      if (loginForm) loginForm.style.display = 'block';
      if (loggedInDiv) loggedInDiv.style.display = 'none';
    }
  }
  
  showSyncMessage(message, type) {
    const msgEl = document.getElementById('sync-message');
    if (msgEl) {
      msgEl.textContent = message;
      msgEl.className = `sync-message show ${type}`;
      setTimeout(() => {
        msgEl.classList.remove('show');
      }, 3000);
    }
  }
  
  // 显示登录弹窗
  showLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) {
      modal.style.display = 'flex';
    }
  }
  
  // 隐藏登录弹窗
  hideLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }
  
  // 处理登录/注册（弹窗版）
  async handleAuth() {
    const email = document.getElementById('modal-email')?.value?.trim();
    const password = document.getElementById('modal-password')?.value;
    const authBtn = document.getElementById('modal-auth-btn');
    
    if (!email || !password) {
      this.showModalMessage('请输入邮箱和密码', 'error');
      return;
    }
    
    if (password.length < 6) {
      this.showModalMessage('密码至少需要6位', 'error');
      return;
    }
    
    if (authBtn) {
      authBtn.disabled = true;
      authBtn.innerHTML = '<span class="material-icons-outlined">hourglass_empty</span> 处理中...';
    }
    
    // 先尝试登录
    let result = await this.syncService.login(email, password);
    
    // 如果用户不存在，自动注册
    if (!result.success && result.error === '用户不存在') {
      this.showModalMessage('正在为您注册...', 'success');
      result = await this.syncService.register(email, password, '');
    }
    
    if (authBtn) {
      authBtn.disabled = false;
      authBtn.innerHTML = '<span class="material-icons-outlined">login</span> 登录 / 注册';
    }
    
    if (result.success) {
      this.showModalMessage('✅ 登录成功！', 'success');
      this.updateSyncIndicator();
      this.updateSyncUIState();
      setTimeout(() => {
        this.hideLoginModal();
        this.syncService.fullSync();
        this.showToast('同步数据中...', 'success');
      }, 800);
    } else {
      this.showModalMessage(result.error, 'error');
    }
  }
  
  // 处理登录/注册（设置页版）
  async handleSettingsAuth(forceRegister = false) {
    const email = document.getElementById('sync-email')?.value?.trim();
    const password = document.getElementById('sync-password')?.value;
    const authBtn = document.getElementById('sync-auth-btn');
    const messageEl = document.getElementById('sync-message');
    
    const showMsg = (msg, type, showReset = false) => {
      if (messageEl) {
        if (showReset) {
          messageEl.innerHTML = `${msg} <button class="reset-btn" onclick="window.todoApp.handleSettingsAuth(true)">重新注册此邮箱</button>`;
        } else {
          messageEl.textContent = msg;
        }
        messageEl.className = `sync-message ${type}`;
        messageEl.style.display = 'block';
      }
    };
    
    if (!email || !password) {
      showMsg('请输入邮箱和密码', 'error');
      return;
    }
    
    if (password.length < 6) {
      showMsg('密码至少需要6位', 'error');
      return;
    }
    
    if (authBtn) {
      authBtn.disabled = true;
      authBtn.innerHTML = '<span class="material-icons-outlined">hourglass_empty</span> 处理中...';
    }
    
    let result;
    
    if (forceRegister) {
      // 强制注册（会覆盖旧账户）
      showMsg('正在重新注册...', 'success');
      result = await this.syncService.forceRegister(email, password, '');
    } else {
      // 先尝试登录
      result = await this.syncService.login(email, password);
      
      // 如果用户不存在，自动注册
      if (!result.success && result.error === '用户不存在') {
        showMsg('正在为您注册...', 'success');
        result = await this.syncService.register(email, password, '');
      }
    }
    
    if (authBtn) {
      authBtn.disabled = false;
      authBtn.innerHTML = '<span class="material-icons-outlined">login</span> 登录 / 注册';
    }
    
    if (result.success) {
      showMsg('✅ 登录成功！', 'success');
      this.updateSyncIndicator();
      this.updateSyncUIState();
      this.showToast('同步数据中...', 'success');
      this.syncService.fullSync();
    } else if (result.error === '密码错误') {
      showMsg('密码错误，忘记密码？', 'error', true);
    } else {
      showMsg(result.error, 'error');
    }
  }
  
  // 初始化登录弹窗事件
  initLoginModal() {
    const syncIndicator = document.getElementById('sync-indicator');
    const closeBtn = document.getElementById('login-modal-close');
    const modalOverlay = document.getElementById('login-modal');
    
    // 点击同步指示器打开登录弹窗
    if (syncIndicator) {
      syncIndicator.addEventListener('click', () => {
        if (this.syncService.isLoggedIn()) {
          // 已登录，直接同步
          this.syncService.fullSync().then(result => {
            if (result.success) {
              this.showToast('同步完成！', 'success');
            }
          });
        } else {
          // 未登录，显示登录弹窗
          this.showLoginModal();
        }
      });
    }
    
    // 关闭按钮
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideLoginModal());
    }
    
    // 点击遮罩关闭
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          this.hideLoginModal();
        }
      });
    }
    
    // 登录/注册按钮（合并）
    const authBtn = document.getElementById('modal-auth-btn');
    if (authBtn) {
      authBtn.addEventListener('click', async () => {
        const email = document.getElementById('modal-email')?.value?.trim();
        const password = document.getElementById('modal-password')?.value;
        
        if (!email || !password) {
          this.showModalMessage('请输入邮箱和密码', 'error');
          return;
        }
        
        if (password.length < 6) {
          this.showModalMessage('密码至少需要6位', 'error');
          return;
        }
        
        authBtn.disabled = true;
        authBtn.innerHTML = '<span class="material-icons-outlined">hourglass_empty</span> 处理中...';
        
        // 先尝试登录
        let result = await this.syncService.login(email, password);
        
        // 如果用户不存在，自动注册
        if (!result.success && result.error === '用户不存在') {
          this.showModalMessage('正在为您注册...', 'success');
          result = await this.syncService.register(email, password, '');
        }
        
        authBtn.disabled = false;
        authBtn.innerHTML = '<span class="material-icons-outlined">login</span> 登录 / 注册';
        
        if (result.success) {
          this.showModalMessage('✅ 登录成功！', 'success');
          this.updateSyncIndicator();
          this.updateSyncUIState();
          setTimeout(() => {
            this.hideLoginModal();
            this.syncService.fullSync();
            this.showToast('同步数据中...', 'success');
          }, 800);
        } else {
          this.showModalMessage(result.error, 'error');
        }
      });
    }
    
    // 登录横幅按钮
    const loginBannerBtn = document.getElementById('login-banner-btn');
    if (loginBannerBtn) {
      loginBannerBtn.addEventListener('click', () => this.showLoginModal());
    }
    
    // 初始化同步指示器状态
    this.updateSyncIndicator();
  }
  
  // 显示弹窗消息
  showModalMessage(message, type) {
    const msgEl = document.getElementById('modal-message');
    if (msgEl) {
      msgEl.textContent = message;
      msgEl.className = `login-message show ${type}`;
    }
  }
  
  // 更新同步指示器
  updateSyncIndicator() {
    const indicator = document.getElementById('sync-indicator');
    const loginBanner = document.getElementById('login-banner');
    
    if (this.syncService.isLoggedIn()) {
      // 已登录
      if (indicator) {
        indicator.className = 'sync-indicator logged-in';
        indicator.title = '点击同步';
        const icon = indicator.querySelector('.material-icons-outlined');
        const text = indicator.querySelector('.sync-text');
        if (icon) icon.textContent = 'cloud_done';
        if (text) text.textContent = '已同步';
      }
      // 隐藏登录横幅
      if (loginBanner) {
        loginBanner.classList.add('hidden');
      }
    } else {
      // 未登录
      if (indicator) {
        indicator.className = 'sync-indicator not-logged-in';
        indicator.title = '点击登录同步';
        const icon = indicator.querySelector('.material-icons-outlined');
        const text = indicator.querySelector('.sync-text');
        if (icon) icon.textContent = 'cloud_off';
        if (text) text.textContent = '未登录';
      }
      // 显示登录横幅
      if (loginBanner) {
        loginBanner.classList.remove('hidden');
      }
    }
  }

  // ==================== PAGE NAVIGATION ====================

  navigateTo(page) {
    this.currentPage = page;
    this.haptic('selection');
    
    // Update pages
    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.id === `page-${page}`);
    });
    
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === page);
    });
    
    // Page-specific updates
    if (page === 'calendar') {
      this.updateCalendar();
    } else if (page === 'stats') {
      this.updateStatsPage();
    } else if (page === 'settings') {
      this.loadUserProfileForm();
    } else if (page === 'agent') {
      this.agent.initChat();
    } else if (page === 'settings') {
      this.loadSettingsPage();
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Load settings page with current values
  loadSettingsPage() {
    const aiApiKey = document.getElementById('ai-api-key');
    const aiProvider = document.getElementById('ai-provider');
    const apiKeyStatus = document.getElementById('api-key-status');
    
    if (aiProvider && this.agent) {
      aiProvider.value = this.agent.provider;
    }
    
    if (aiApiKey && this.agent) {
      aiApiKey.value = this.agent.apiKey || '';
    }
    
    // Show status if key is saved
    if (apiKeyStatus && this.agent && this.agent.apiKey) {
      apiKeyStatus.textContent = '✅ API Key 已配置';
      apiKeyStatus.className = 'api-key-status show';
    }
  }

  // ==================== CHAT INTERFACE ====================

  sendChatMessage() {
    console.log('sendChatMessage called');
    
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) {
      console.error('Chat input not found');
      this.showToast('找不到输入框', 'error');
      return;
    }
    
    const message = chatInput.value.trim();
    console.log('Message:', message);
    
    if (!message) {
      this.showToast('请输入消息', 'warning');
      return;
    }
    
    // Check if agent is ready
    if (!this.agent) {
      this.showToast('AI 助手未初始化，请刷新页面', 'error');
      return;
    }
    
    // Check API key
    if (!this.agent.apiKey) {
      this.showToast('请先在设置页面保存 API Key', 'warning');
      // Also add a message in the chat
      this.agent.addMessage('assistant', '⚠️ 请先去设置页面配置 API Key\n\n步骤：点击底部"设置" → 找到"AI助手" → 输入API Key → 点击保存');
      return;
    }
    
    console.log('API Key:', this.agent.apiKey.substring(0, 10) + '...');
    console.log('Provider:', this.agent.provider);
    
    // Clear input
    chatInput.value = '';
    
    // Process message with agent
    this.agent.processMessage(message);
  }

  // ==================== API KEY MANAGEMENT ====================

  async saveApiKey() {
    console.log('saveApiKey called');
    
    const aiApiKey = document.getElementById('ai-api-key');
    const apiKeyStatus = document.getElementById('api-key-status');
    const aiProvider = document.getElementById('ai-provider');
    
    if (!aiApiKey) {
      console.error('API Key input not found');
      this.showToast('找不到 API Key 输入框', 'error');
      return;
    }
    
    const apiKey = aiApiKey.value.trim();
    console.log('API Key length:', apiKey.length);
    
    if (!apiKey) {
      if (apiKeyStatus) {
        apiKeyStatus.textContent = '❌ 请输入 API Key';
        apiKeyStatus.className = 'api-key-status show error';
      }
      this.showToast('请输入 API Key', 'warning');
      return;
    }
    
    // Save provider
    const provider = aiProvider ? aiProvider.value : 'gemini';
    if (this.agent) {
      this.agent.provider = provider;
      this.agent.apiKey = apiKey;
    }
    localStorage.setItem('aiProvider', provider);
    localStorage.setItem('aiApiKey', apiKey);
    
    console.log('Saved provider:', provider);
    console.log('Saved API Key:', apiKey.substring(0, 10) + '...');
    
    // Show saving status
    if (apiKeyStatus) {
      apiKeyStatus.textContent = '⏳ 正在验证...';
      apiKeyStatus.className = 'api-key-status show';
    }
    
    this.showToast('正在验证 API Key...', 'warning');
    
    // Test the API key
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: '你好' }] }],
          generationConfig: { maxOutputTokens: 10 }
        })
      });
      
      const data = await response.json();
      console.log('API test response:', data);
      
      if (data.error) {
        if (apiKeyStatus) {
          apiKeyStatus.textContent = '❌ 验证失败：' + data.error.message;
          apiKeyStatus.className = 'api-key-status show error';
        }
        this.showToast('API Key 验证失败', 'error');
      } else {
        if (apiKeyStatus) {
          apiKeyStatus.textContent = '✅ API Key 保存成功！可以去 AI 页面聊天了';
          apiKeyStatus.className = 'api-key-status show';
        }
        this.showToast('✅ API Key 保存成功！', 'success');
      }
    } catch (e) {
      console.error('API test error:', e);
      if (apiKeyStatus) {
        apiKeyStatus.textContent = '⚠️ 已保存，但无法验证（网络问题）';
        apiKeyStatus.className = 'api-key-status show';
      }
      this.showToast('已保存，验证失败（网络问题）', 'warning');
    }
  }

  // ==================== UTILITIES ====================

  showToast(message, type = 'success') {
    if (!this.elements.toast) return;
    
    const icons = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning'
    };
    
    this.elements.toast.className = `toast ${type}`;
    this.elements.toastIcon.textContent = icons[type] || icons.success;
    this.elements.toastMessage.textContent = message;
    this.elements.toast.classList.add('show');
    
    setTimeout(() => {
      this.elements.toast.classList.remove('show');
    }, 3000);
  }

  playSound(type) {
    // Create simple audio feedback using Web Audio API
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      if (type === 'complete') {
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        oscillator.frequency.setValueAtTime(1320, ctx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
      } else if (type === 'pomodoro') {
        oscillator.frequency.setValueAtTime(523.25, ctx.currentTime);
        oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15);
        oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.5);
      }
    } catch (e) {
      // Audio not supported
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== EVENT LISTENERS ====================

  attachEventListeners() {
    // Navigation
    document.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.navigateTo(btn.dataset.page);
      });
    });

    // Add task button
    if (this.elements.addBtn) {
      this.elements.addBtn.addEventListener('click', () => this.openModal());
    }

    // Modal
    if (this.elements.modalClose) {
      this.elements.modalClose.addEventListener('click', () => this.closeModal());
    }
    if (this.elements.cancelBtn) {
      this.elements.cancelBtn.addEventListener('click', () => this.closeModal());
    }
    if (this.elements.modalOverlay) {
      this.elements.modalOverlay.addEventListener('click', (e) => {
        if (e.target === this.elements.modalOverlay) {
          this.closeModal();
        }
      });
    }

    // Form submit
    if (this.elements.taskForm) {
      this.elements.taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const taskData = {
          text: this.elements.taskInput.value,
          notes: this.elements.taskNotes.value,
          priority: this.elements.taskPriority.value,
          category: document.querySelector('.category-chip.active')?.dataset.category || 'work',
          dueDate: this.elements.taskDate.value,
          recurring: this.elements.taskRecurring.checked ? this.elements.recurringType.value : null
        };
        
        if (!taskData.text.trim()) {
          this.showToast('请输入任务内容', 'warning');
          return;
        }
        
        if (this.editingTaskId) {
          this.updateTask(this.editingTaskId, taskData);
        } else {
          this.addTask(taskData);
        }
        
        this.closeModal();
      });
    }

    // Recurring checkbox
    if (this.elements.taskRecurring) {
      this.elements.taskRecurring.addEventListener('change', () => {
        this.elements.recurringOptions.classList.toggle('show', this.elements.taskRecurring.checked);
      });
    }

    // Category chips
    document.querySelectorAll('.category-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });

    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.setFilter(tab.dataset.filter);
      });
    });

    // Clear completed
    if (this.elements.clearCompleted) {
      this.elements.clearCompleted.addEventListener('click', () => this.clearCompleted());
    }

    // Search
    if (this.elements.searchToggle) {
      this.elements.searchToggle.addEventListener('click', () => this.toggleSearch());
    }
    if (this.elements.searchClose) {
      this.elements.searchClose.addEventListener('click', () => this.toggleSearch());
    }
    if (this.elements.searchInput) {
      this.elements.searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderTasks();
      });
    }

    // Sort
    if (this.elements.sortBtn) {
      this.elements.sortBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showSortMenu();
      });
    }
    document.querySelectorAll('#sort-menu .dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        this.currentSort = item.dataset.sort;
        document.querySelectorAll('#sort-menu .dropdown-item').forEach(i => {
          i.classList.toggle('active', i.dataset.sort === this.currentSort);
        });
        this.renderTasks();
        this.hideSortMenu();
      });
    });

    // Context menu
    document.querySelectorAll('.context-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        if (this.contextMenuTaskId) {
          switch (action) {
            case 'edit':
              this.editTask(this.contextMenuTaskId);
              break;
            case 'duplicate':
              this.duplicateTask(this.contextMenuTaskId);
              break;
            case 'pomodoro':
              this.openPomodoroModal(this.contextMenuTaskId);
              break;
            case 'priority':
              this.togglePriority(this.contextMenuTaskId);
              break;
            case 'delete':
              this.deleteTask(this.contextMenuTaskId);
              break;
          }
        }
        this.hideContextMenu();
      });
    });

    // AI card collapse
    if (this.elements.aiCollapse) {
      this.elements.aiCollapse.addEventListener('click', () => {
        this.elements.aiCard.classList.toggle('collapsed');
      });
    }

    // Calendar navigation
    if (this.elements.prevMonth) {
      this.elements.prevMonth.addEventListener('click', () => {
        this.calendarDate.setMonth(this.calendarDate.getMonth() - 1);
        this.updateCalendar();
      });
    }
    if (this.elements.nextMonth) {
      this.elements.nextMonth.addEventListener('click', () => {
        this.calendarDate.setMonth(this.calendarDate.getMonth() + 1);
        this.updateCalendar();
      });
    }
    if (this.elements.addTaskDate) {
      this.elements.addTaskDate.addEventListener('click', () => {
        this.openModal();
      });
    }

    // Pomodoro
    if (this.elements.startPomodoro) {
      this.elements.startPomodoro.addEventListener('click', () => this.openPomodoroModal());
    }
    if (this.elements.pomodoroClose) {
      this.elements.pomodoroClose.addEventListener('click', () => this.closePomodoroModal());
    }
    if (this.elements.pomodoroStart) {
      this.elements.pomodoroStart.addEventListener('click', () => this.togglePomodoro());
    }
    if (this.elements.pomodoroReset) {
      this.elements.pomodoroReset.addEventListener('click', () => this.resetPomodoro());
    }
    if (this.elements.pomodoroSkip) {
      this.elements.pomodoroSkip.addEventListener('click', () => this.skipPomodoro());
    }
    if (this.elements.pomodoroOverlay) {
      this.elements.pomodoroOverlay.addEventListener('click', (e) => {
        if (e.target === this.elements.pomodoroOverlay) {
          this.closePomodoroModal();
        }
      });
    }

    // Settings
    if (this.elements.themeToggle) {
      this.elements.themeToggle.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.settings.theme = btn.dataset.theme;
          this.saveSettings();
        });
      });
    }
    if (this.elements.colorPicker) {
      this.elements.colorPicker.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.settings.colorScheme = btn.dataset.color;
          this.saveSettings();
        });
      });
    }
    if (this.elements.notificationToggle) {
      this.elements.notificationToggle.addEventListener('change', () => {
        this.settings.notifications = this.elements.notificationToggle.checked;
        this.saveSettings();
      });
    }
    if (this.elements.soundToggle) {
      this.elements.soundToggle.addEventListener('change', () => {
        this.settings.sounds = this.elements.soundToggle.checked;
        this.saveSettings();
      });
    }
    if (this.elements.pomodoroWorkSelect) {
      this.elements.pomodoroWorkSelect.addEventListener('change', () => {
        this.settings.pomodoroWork = parseInt(this.elements.pomodoroWorkSelect.value);
        this.saveSettings();
        if (!this.pomodoro.isRunning && !this.pomodoro.isBreak) {
          this.pomodoro.timeLeft = this.settings.pomodoroWork * 60;
          this.updatePomodoroDisplay();
        }
      });
    }
    if (this.elements.pomodoroBreakSelect) {
      this.elements.pomodoroBreakSelect.addEventListener('change', () => {
        this.settings.pomodoroBreak = parseInt(this.elements.pomodoroBreakSelect.value);
        this.saveSettings();
      });
    }
    if (this.elements.exportData) {
      this.elements.exportData.addEventListener('click', () => this.exportData());
    }
    if (this.elements.importData) {
      this.elements.importData.addEventListener('click', () => {
        this.elements.importFile.click();
      });
    }
    if (this.elements.importFile) {
      this.elements.importFile.addEventListener('change', (e) => {
        if (e.target.files[0]) {
          this.importData(e.target.files[0]);
          e.target.value = '';
        }
      });
    }
    if (this.elements.clearAllData) {
      this.elements.clearAllData.addEventListener('click', () => this.clearAllData());
    }
    
    // User Profile
    const saveProfileBtn = document.getElementById('save-profile-btn');
    if (saveProfileBtn) {
      saveProfileBtn.addEventListener('click', () => this.saveUserProfile());
    }
    
    const clearMemoryBtn = document.getElementById('clear-memory-btn');
    if (clearMemoryBtn) {
      clearMemoryBtn.addEventListener('click', () => this.clearAIMemory());
    }
    
    // Sync event listeners
    this.initSyncUI();
    this.initLoginModal();
    
    // Daily Plan Settings
    const dailyPlanToggle = document.getElementById('daily-plan-toggle');
    const dailyPlanTime = document.getElementById('daily-plan-time');
    
    if (dailyPlanToggle) {
      dailyPlanToggle.checked = localStorage.getItem('dailyPlanEnabled') !== 'false';
      dailyPlanToggle.addEventListener('change', () => {
        localStorage.setItem('dailyPlanEnabled', dailyPlanToggle.checked);
        this.showToast(dailyPlanToggle.checked ? '每日规划已开启' : '每日规划已关闭', 'success');
      });
    }
    
    if (dailyPlanTime) {
      dailyPlanTime.value = localStorage.getItem('dailyPlanTime') || '8';
      dailyPlanTime.addEventListener('change', () => {
        localStorage.setItem('dailyPlanTime', dailyPlanTime.value);
        this.showToast(`规划时间已设为 ${dailyPlanTime.value}:00`, 'success');
      });
    }

    // Confirm dialog
    if (this.elements.confirmCancel) {
      this.elements.confirmCancel.addEventListener('click', () => this.hideConfirmDialog());
    }
    if (this.elements.confirmOk) {
      this.elements.confirmOk.addEventListener('click', () => {
        if (this._confirmCallback) {
          this._confirmCallback();
        }
      });
    }
    if (this.elements.confirmOverlay) {
      this.elements.confirmOverlay.addEventListener('click', (e) => {
        if (e.target === this.elements.confirmOverlay) {
          this.hideConfirmDialog();
        }
      });
    }

    // Global click to close menus
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.context-menu') && !e.target.closest('.task-item')) {
        this.hideContextMenu();
      }
      if (!e.target.closest('#sort-menu') && !e.target.closest('#sort-btn')) {
        this.hideSortMenu();
      }
    });

    // AI Agent chat
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const voiceBtn = document.getElementById('voice-btn');
    
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.sendChatMessage();
        }
      });
    }
    
    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        console.log('Send button clicked');
        this.sendChatMessage();
      });
    }
    
    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => {
        if (this.agent) {
          this.agent.toggleRecording();
        }
      });
    }
    
    // Quick actions
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this.agent.handleQuickAction(action);
      });
    });

    // AI Settings
    const aiProvider = document.getElementById('ai-provider');
    const aiApiKey = document.getElementById('ai-api-key');
    const saveApiBtn = document.getElementById('save-api-btn');
    const apiKeyStatus = document.getElementById('api-key-status');
    
    if (aiProvider) {
      aiProvider.value = this.agent.provider;
      
      aiProvider.addEventListener('change', () => {
        this.agent.provider = aiProvider.value;
        localStorage.setItem('aiProvider', aiProvider.value);
        
        // Update placeholder based on provider
        const placeholders = {
          'gemini': 'AIzaSy...',
          'openai': 'sk-...',
          'claude': 'sk-ant-...',
          'deepseek': 'sk-...'
        };
        if (aiApiKey) {
          aiApiKey.placeholder = placeholders[aiProvider.value] || 'API Key';
        }
      });
    }
    
    if (aiApiKey) {
      // Show saved API key (masked)
      if (this.agent.apiKey) {
        aiApiKey.value = this.agent.apiKey;
      }
    }
    
    if (saveApiBtn) {
      saveApiBtn.addEventListener('click', async () => {
        const apiKey = aiApiKey.value.trim();
        
        if (!apiKey) {
          apiKeyStatus.textContent = '❌ 请输入 API Key';
          apiKeyStatus.className = 'api-key-status show error';
          return;
        }
        
        // Save the key
        this.agent.apiKey = apiKey;
        localStorage.setItem('aiApiKey', apiKey);
        
        // Test the API key
        apiKeyStatus.textContent = '⏳ 正在验证...';
        apiKeyStatus.className = 'api-key-status show';
        
        try {
          const testResult = await this.agent.testApiKey();
          if (testResult.success) {
            apiKeyStatus.textContent = '✅ API Key 已保存并验证成功！';
            apiKeyStatus.className = 'api-key-status show';
            this.showToast('API Key 保存成功', 'success');
          } else {
            apiKeyStatus.textContent = '⚠️ 已保存，但验证失败：' + testResult.error;
            apiKeyStatus.className = 'api-key-status show error';
          }
        } catch (e) {
          apiKeyStatus.textContent = '✅ API Key 已保存';
          apiKeyStatus.className = 'api-key-status show';
          this.showToast('API Key 已保存', 'success');
        }
        
        // Hide status after 5 seconds
        setTimeout(() => {
          apiKeyStatus.className = 'api-key-status';
        }, 5000);
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        this.closePomodoroModal();
        this.hideContextMenu();
        this.hideSortMenu();
        this.hideConfirmDialog();
        if (this.elements.searchBar?.classList.contains('active')) {
          this.toggleSearch();
        }
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        this.openModal();
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        this.toggleSearch();
      }
    });
  }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  window.todoApp = new TodoApp();
  console.log('App initialized, agent ready:', !!window.todoApp.agent);
});
