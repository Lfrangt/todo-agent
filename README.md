# Smart Todo Agent

一款智能、美观的任务管理应用，支持 Web 和 iOS 原生平台。

![Smart Todo](icons/icon.svg)

## ✨ 功能特性

### 任务管理
- ✅ 创建、编辑、删除任务
- 🎯 三级优先级（高/中/低）
- 📂 四种分类（工作/个人/学习/健康）
- 📅 到期日期设置
- 🔄 重复任务（每天/每周/每月）
- 📝 任务备注
- 🔀 拖拽排序

### 智能功能
- 🤖 AI 智能建议
- 🔍 任务搜索
- 📊 统计分析
- 🍅 番茄钟计时器

### 界面特性
- 🌙 深色/浅色主题
- 🎨 五种主题色
- 📱 iOS 原生适配
- 🔔 本地通知提醒
- 📳 触感反馈

## 🚀 快速开始

### Web 版本

直接在浏览器中打开 `index.html` 即可使用：

```bash
open index.html
```

或启动本地服务器：

```bash
npx serve .
```

### iOS 版本

#### 环境要求

- macOS 系统
- Xcode 15+
- Node.js 18+
- CocoaPods

#### 安装步骤

1. **安装依赖**

```bash
npm install
```

2. **添加 iOS 平台**

```bash
npx cap add ios
```

3. **同步项目**

```bash
npx cap sync ios
```

4. **打开 Xcode**

```bash
npx cap open ios
```

5. **在 Xcode 中**
   - 选择开发团队（Signing & Capabilities）
   - 选择目标设备或模拟器
   - 点击运行按钮 ▶️

#### 生成应用图标

使用 `icons/icon.svg` 生成各种尺寸的图标：

```bash
# 安装 sharp-cli（如果需要）
npm install -g sharp-cli

# 生成图标（需要手动添加到 Xcode Assets）
sharp -i icons/icon.svg -o icons/icon-180.png resize 180 180
sharp -i icons/icon.svg -o icons/icon-120.png resize 120 120
sharp -i icons/icon.svg -o icons/icon-1024.png resize 1024 1024
```

## 📁 项目结构

```
todo agent/
├── index.html          # 主页面
├── style.css           # 样式文件
├── app.js              # 应用逻辑
├── manifest.json       # PWA 配置
├── package.json        # 项目配置
├── capacitor.config.ts # Capacitor 配置
├── icons/              # 应用图标
│   └── icon.svg
└── ios/                # iOS 项目（运行 cap add ios 后生成）
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `⌘ + N` | 新建任务 |
| `⌘ + F` | 搜索任务 |
| `Esc` | 关闭弹窗 |

## 🎨 主题色

- 💜 靛蓝（默认）
- 💗 玫红
- 💚 翠绿
- 🧡 琥珀
- 💟 紫罗兰

## 📱 iOS 特性

- 安全区域适配（刘海屏、底部指示条）
- 原生触感反馈
- 本地推送通知
- 键盘自适应
- 状态栏样式同步

## 🔧 开发

### 修改后同步到 iOS

```bash
npx cap sync ios
```

### 实时开发（Web）

```bash
npx serve .
```

## 📄 许可证

MIT License

---

Made with ❤️ using vanilla JavaScript and Capacitor

