/**
 * Todo Agent 后端同步服务
 * 支持多设备数据同步
 */

const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'todo-agent-secret-key-change-in-production';

// 数据库路径（支持 Railway 的持久化存储）
const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, 'data.db');

// 初始化数据库
const db = new Database(DB_PATH);
console.log('Database path:', DB_PATH);

// 创建表
db.exec(`
  -- 用户表
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
  );
  
  -- 任务表
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    notes TEXT DEFAULT '',
    completed INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'medium',
    category TEXT DEFAULT 'personal',
    due_date TEXT,
    recurring TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    deleted INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  
  -- 用户资料表
  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY,
    name TEXT,
    occupation TEXT,
    background TEXT,
    goals TEXT,
    challenges TEXT,
    updated_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  
  -- AI 记忆表
  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  
  -- 设置表
  CREATE TABLE IF NOT EXISTS settings (
    user_id TEXT PRIMARY KEY,
    data TEXT,
    updated_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  
  -- 同步记录表
  CREATE TABLE IF NOT EXISTS sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    device_id TEXT,
    action TEXT,
    timestamp INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 认证中间件
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: '未授权访问' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token 无效或已过期' });
  }
};

// ==================== 认证 API ====================

// 注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码不能为空' });
    }
    
    // 检查邮箱是否已存在
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: '该邮箱已注册' });
    }
    
    // 创建用户
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.prepare('INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)')
      .run(userId, email, hashedPassword, name || '');
    
    // 生成 token
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({
      success: true,
      token,
      user: { id: userId, email, name }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: '注册失败' });
  }
});

// 强制注册（重置账户）
app.post('/api/auth/force-register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码不能为空' });
    }
    
    // 删除旧用户（如果存在）
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      // 删除相关数据
      db.prepare('DELETE FROM tasks WHERE user_id = ?').run(existing.id);
      db.prepare('DELETE FROM memories WHERE user_id = ?').run(existing.id);
      db.prepare('DELETE FROM user_profiles WHERE user_id = ?').run(existing.id);
      db.prepare('DELETE FROM settings WHERE user_id = ?').run(existing.id);
      db.prepare('DELETE FROM sync_logs WHERE user_id = ?').run(existing.id);
      db.prepare('DELETE FROM users WHERE id = ?').run(existing.id);
    }
    
    // 创建新用户
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.prepare('INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)')
      .run(userId, email, hashedPassword, name || '');
    
    // 生成 token
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({
      success: true,
      token,
      user: { id: userId, email, name }
    });
  } catch (err) {
    console.error('Force register error:', err);
    res.status(500).json({ error: '重置失败' });
  }
});

// 登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码不能为空' });
    }
    
    // 查找用户
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(400).json({ error: '用户不存在' });
    }
    
    // 验证密码
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ error: '密码错误' });
    }
    
    // 生成 token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: '登录失败' });
  }
});

// 验证 Token
app.get('/api/auth/verify', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.userId);
  if (!user) {
    return res.status(401).json({ error: '用户不存在' });
  }
  res.json({ success: true, user });
});

// ==================== 任务 API ====================

// 获取所有任务
app.get('/api/tasks', authenticate, (req, res) => {
  try {
    const tasks = db.prepare(`
      SELECT id, text, notes, completed, priority, category, 
             due_date as dueDate, recurring, created_at as createdAt, updated_at as updatedAt
      FROM tasks 
      WHERE user_id = ? AND deleted = 0
      ORDER BY created_at DESC
    `).all(req.userId);
    
    res.json({ success: true, tasks });
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ error: '获取任务失败' });
  }
});

// 同步任务（批量更新）
app.post('/api/tasks/sync', authenticate, (req, res) => {
  try {
    const { tasks, lastSyncTime, deviceId } = req.body;
    
    // 开始事务
    const syncTasks = db.transaction(() => {
      const updated = [];
      const created = [];
      
      for (const task of tasks) {
        const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?')
          .get(task.id, req.userId);
        
        if (existing) {
          // 更新任务（如果本地版本更新）
          if (!existing.updated_at || task.updatedAt > existing.updated_at) {
            db.prepare(`
              UPDATE tasks SET 
                text = ?, notes = ?, completed = ?, priority = ?, 
                category = ?, due_date = ?, recurring = ?, updated_at = ?
              WHERE id = ? AND user_id = ?
            `).run(
              task.text, task.notes || '', task.completed ? 1 : 0, task.priority,
              task.category, task.dueDate, task.recurring, Date.now(),
              task.id, req.userId
            );
            updated.push(task.id);
          }
        } else {
          // 创建新任务
          db.prepare(`
            INSERT INTO tasks (id, user_id, text, notes, completed, priority, category, due_date, recurring, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            task.id, req.userId, task.text, task.notes || '', task.completed ? 1 : 0,
            task.priority, task.category, task.dueDate, task.recurring,
            task.createdAt || Date.now(), Date.now()
          );
          created.push(task.id);
        }
      }
      
      // 获取服务器上的最新任务
      const serverTasks = db.prepare(`
        SELECT id, text, notes, completed, priority, category, 
               due_date as dueDate, recurring, created_at as createdAt, updated_at as updatedAt
        FROM tasks 
        WHERE user_id = ? AND deleted = 0
        ORDER BY created_at DESC
      `).all(req.userId);
      
      // 记录同步日志
      db.prepare('INSERT INTO sync_logs (user_id, device_id, action, timestamp) VALUES (?, ?, ?, ?)')
        .run(req.userId, deviceId || 'unknown', 'sync', Date.now());
      
      return { serverTasks, updated, created };
    });
    
    const result = syncTasks();
    
    res.json({
      success: true,
      tasks: result.serverTasks,
      updated: result.updated.length,
      created: result.created.length,
      syncTime: Date.now()
    });
  } catch (err) {
    console.error('Sync tasks error:', err);
    res.status(500).json({ error: '同步失败' });
  }
});

// 删除任务
app.delete('/api/tasks/:id', authenticate, (req, res) => {
  try {
    db.prepare('UPDATE tasks SET deleted = 1, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(Date.now(), req.params.id, req.userId);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: '删除失败' });
  }
});

// ==================== 用户资料 API ====================

// 获取用户资料
app.get('/api/profile', authenticate, (req, res) => {
  try {
    const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.userId);
    res.json({ success: true, profile: profile || {} });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: '获取资料失败' });
  }
});

// 更新用户资料
app.post('/api/profile', authenticate, (req, res) => {
  try {
    const { name, occupation, background, goals, challenges } = req.body;
    
    db.prepare(`
      INSERT OR REPLACE INTO user_profiles (user_id, name, occupation, background, goals, challenges, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.userId, name, occupation, background, goals, challenges, Date.now());
    
    res.json({ success: true });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: '更新资料失败' });
  }
});

// ==================== 记忆 API ====================

// 获取记忆
app.get('/api/memories', authenticate, (req, res) => {
  try {
    const memories = db.prepare('SELECT * FROM memories WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.userId);
    
    // 按类别分组
    const grouped = {};
    for (const m of memories) {
      if (!grouped[m.category]) {
        grouped[m.category] = [];
      }
      grouped[m.category].push({
        content: m.content,
        timestamp: m.created_at,
        source: 'server'
      });
    }
    
    res.json({ success: true, memories: grouped });
  } catch (err) {
    console.error('Get memories error:', err);
    res.status(500).json({ error: '获取记忆失败' });
  }
});

// 同步记忆
app.post('/api/memories/sync', authenticate, (req, res) => {
  try {
    const { memories } = req.body;
    
    // 清除旧记忆并插入新的
    db.prepare('DELETE FROM memories WHERE user_id = ?').run(req.userId);
    
    const insert = db.prepare('INSERT INTO memories (user_id, category, content, created_at) VALUES (?, ?, ?, ?)');
    
    for (const [category, items] of Object.entries(memories)) {
      for (const item of items) {
        insert.run(req.userId, category, item.content, item.timestamp || Date.now());
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Sync memories error:', err);
    res.status(500).json({ error: '同步记忆失败' });
  }
});

// ==================== 设置 API ====================

// 获取设置
app.get('/api/settings', authenticate, (req, res) => {
  try {
    const settings = db.prepare('SELECT data FROM settings WHERE user_id = ?').get(req.userId);
    res.json({ success: true, settings: settings ? JSON.parse(settings.data) : {} });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: '获取设置失败' });
  }
});

// 更新设置
app.post('/api/settings', authenticate, (req, res) => {
  try {
    const { settings } = req.body;
    
    db.prepare(`
      INSERT OR REPLACE INTO settings (user_id, data, updated_at)
      VALUES (?, ?, ?)
    `).run(req.userId, JSON.stringify(settings), Date.now());
    
    res.json({ success: true });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: '更新设置失败' });
  }
});

// ==================== 完整同步 API ====================

// 完整数据同步
app.post('/api/sync/full', authenticate, (req, res) => {
  try {
    const { tasks, profile, memories, settings, lastSyncTime, deviceId } = req.body;
    
    const fullSync = db.transaction(() => {
      // 同步任务
      if (tasks && tasks.length > 0) {
        for (const task of tasks) {
          const existing = db.prepare('SELECT updated_at FROM tasks WHERE id = ? AND user_id = ?')
            .get(task.id, req.userId);
          
          if (existing) {
            if (!existing.updated_at || task.updatedAt > existing.updated_at) {
              db.prepare(`
                UPDATE tasks SET 
                  text = ?, notes = ?, completed = ?, priority = ?, 
                  category = ?, due_date = ?, recurring = ?, updated_at = ?
                WHERE id = ? AND user_id = ?
              `).run(
                task.text, task.notes || '', task.completed ? 1 : 0, task.priority,
                task.category, task.dueDate, task.recurring, Date.now(),
                task.id, req.userId
              );
            }
          } else {
            db.prepare(`
              INSERT INTO tasks (id, user_id, text, notes, completed, priority, category, due_date, recurring, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              task.id, req.userId, task.text, task.notes || '', task.completed ? 1 : 0,
              task.priority, task.category, task.dueDate, task.recurring,
              task.createdAt || Date.now(), Date.now()
            );
          }
        }
      }
      
      // 同步资料
      if (profile) {
        db.prepare(`
          INSERT OR REPLACE INTO user_profiles (user_id, name, occupation, background, goals, challenges, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(req.userId, profile.name, profile.occupation, profile.background, profile.goals, profile.challenges, Date.now());
      }
      
      // 同步记忆
      if (memories) {
        db.prepare('DELETE FROM memories WHERE user_id = ?').run(req.userId);
        const insertMemory = db.prepare('INSERT INTO memories (user_id, category, content, created_at) VALUES (?, ?, ?, ?)');
        for (const [category, items] of Object.entries(memories)) {
          for (const item of items) {
            insertMemory.run(req.userId, category, item.content, item.timestamp || Date.now());
          }
        }
      }
      
      // 同步设置
      if (settings) {
        db.prepare(`
          INSERT OR REPLACE INTO settings (user_id, data, updated_at)
          VALUES (?, ?, ?)
        `).run(req.userId, JSON.stringify(settings), Date.now());
      }
      
      // 记录同步
      db.prepare('INSERT INTO sync_logs (user_id, device_id, action, timestamp) VALUES (?, ?, ?, ?)')
        .run(req.userId, deviceId || 'unknown', 'full_sync', Date.now());
      
      // 获取服务器最新数据
      const serverTasks = db.prepare(`
        SELECT id, text, notes, completed, priority, category, 
               due_date as dueDate, recurring, created_at as createdAt, updated_at as updatedAt
        FROM tasks WHERE user_id = ? AND deleted = 0 ORDER BY created_at DESC
      `).all(req.userId);
      
      const serverProfile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.userId);
      
      const serverMemories = db.prepare('SELECT * FROM memories WHERE user_id = ?').all(req.userId);
      const groupedMemories = {};
      for (const m of serverMemories) {
        if (!groupedMemories[m.category]) groupedMemories[m.category] = [];
        groupedMemories[m.category].push({ content: m.content, timestamp: m.created_at });
      }
      
      const serverSettings = db.prepare('SELECT data FROM settings WHERE user_id = ?').get(req.userId);
      
      return {
        tasks: serverTasks,
        profile: serverProfile || {},
        memories: groupedMemories,
        settings: serverSettings ? JSON.parse(serverSettings.data) : {}
      };
    });
    
    const result = fullSync();
    
    res.json({
      success: true,
      data: result,
      syncTime: Date.now()
    });
  } catch (err) {
    console.error('Full sync error:', err);
    res.status(500).json({ error: '完整同步失败' });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Todo Agent 同步服务器运行在 http://localhost:${PORT}`);
  console.log(`📊 数据库位置: ${path.join(__dirname, 'data.db')}`);
});

