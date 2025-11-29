# Todo Agent 同步服务器

这是 Todo Agent 的后端同步服务，支持多设备间数据同步。

## 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 启动服务器

```bash
npm start
```

服务器将运行在 `http://localhost:3001`

### 3. 在 App 中配置

1. 打开 Todo Agent App
2. 进入 **设置** → **云端同步**
3. 输入服务器地址（默认 `http://localhost:3001`）
4. 注册账号或登录
5. 点击 **立即同步**

## API 端点

### 认证
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `GET /api/auth/verify` - 验证 Token

### 任务
- `GET /api/tasks` - 获取所有任务
- `POST /api/tasks/sync` - 同步任务
- `DELETE /api/tasks/:id` - 删除任务

### 用户资料
- `GET /api/profile` - 获取资料
- `POST /api/profile` - 更新资料

### 记忆
- `GET /api/memories` - 获取记忆
- `POST /api/memories/sync` - 同步记忆

### 设置
- `GET /api/settings` - 获取设置
- `POST /api/settings` - 更新设置

### 完整同步
- `POST /api/sync/full` - 完整数据同步

## 数据库

使用 SQLite 数据库，数据文件位于 `server/data.db`

## 部署到云端

### 使用 Railway（推荐）

1. 在 [Railway](https://railway.app) 创建账号
2. 新建项目，选择 "Deploy from GitHub repo"
3. 连接你的 GitHub 仓库
4. 设置环境变量：
   - `JWT_SECRET` = 你的密钥（随机字符串）
   - `PORT` = 3001
5. 部署完成后获取域名，如 `https://your-app.railway.app`

### 使用 Render

1. 在 [Render](https://render.com) 创建账号
2. 新建 Web Service
3. 连接 GitHub 仓库
4. 设置：
   - Build Command: `cd server && npm install`
   - Start Command: `cd server && npm start`
5. 部署完成后获取域名

## 注意事项

1. 生产环境请务必修改 `JWT_SECRET`
2. 建议使用 HTTPS
3. 可以升级到 PostgreSQL 或 MySQL 获得更好的性能

## 技术栈

- Express.js
- SQLite (better-sqlite3)
- JWT 认证
- bcrypt 密码加密

