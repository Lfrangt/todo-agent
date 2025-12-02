/**
 * Todo Agent 后端同步服务
 * 使用 PostgreSQL 持久化存储
 */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { OAuth2Client } = require('google-auth-library');

// Google OAuth 客户端
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''; // 需要在 Google Cloud Console 创建
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'todo-agent-secret-key-change-in-production';

// PostgreSQL 连接
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 初始化数据库表
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      -- 用户表
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
      );
      
      -- 任务表
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        text TEXT NOT NULL,
        notes TEXT DEFAULT '',
        completed BOOLEAN DEFAULT FALSE,
        priority TEXT DEFAULT 'medium',
        category TEXT DEFAULT 'personal',
        due_date TEXT,
        recurring TEXT,
        created_at BIGINT,
        updated_at BIGINT,
        deleted BOOLEAN DEFAULT FALSE
      );
      
      -- 用户资料表
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id TEXT PRIMARY KEY REFERENCES users(id),
        name TEXT,
        occupation TEXT,
        background TEXT,
        goals TEXT,
        challenges TEXT,
        updated_at BIGINT
      );
      
      -- AI 记忆表
      CREATE TABLE IF NOT EXISTS memories (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at BIGINT
      );
      
      -- 设置表
      CREATE TABLE IF NOT EXISTS settings (
        user_id TEXT PRIMARY KEY REFERENCES users(id),
        data TEXT,
        updated_at BIGINT
      );
      
      -- 同步记录表
      CREATE TABLE IF NOT EXISTS sync_logs (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        device_id TEXT,
        action TEXT,
        timestamp BIGINT
      );
    `);
    console.log('✅ 数据库表初始化完成');
  } catch (err) {
    console.error('数据库初始化错误:', err);
  } finally {
    client.release();
  }
}

// 启动时初始化数据库
initDatabase();

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
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: '该邮箱已注册' });
    }
    
    // 创建用户
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await pool.query(
      'INSERT INTO users (id, email, password, name) VALUES ($1, $2, $3, $4)',
      [userId, email, hashedPassword, name || '']
    );
    
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
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      const oldUserId = existing.rows[0].id;
      // 删除相关数据
      await pool.query('DELETE FROM tasks WHERE user_id = $1', [oldUserId]);
      await pool.query('DELETE FROM memories WHERE user_id = $1', [oldUserId]);
      await pool.query('DELETE FROM user_profiles WHERE user_id = $1', [oldUserId]);
      await pool.query('DELETE FROM settings WHERE user_id = $1', [oldUserId]);
      await pool.query('DELETE FROM sync_logs WHERE user_id = $1', [oldUserId]);
      await pool.query('DELETE FROM users WHERE id = $1', [oldUserId]);
    }
    
    // 创建新用户
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await pool.query(
      'INSERT INTO users (id, email, password, name) VALUES ($1, $2, $3, $4)',
      [userId, email, hashedPassword, name || '']
    );
    
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
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: '用户不存在' });
    }
    
    const user = result.rows[0];
    
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

// Google OAuth 登录
app.post('/api/auth/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ error: '缺少 Google ID Token' });
    }
    
    // 验证 Google ID Token
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: idToken,
        audience: GOOGLE_CLIENT_ID
      });
      payload = ticket.getPayload();
    } catch (err) {
      console.error('Google token verification failed:', err);
      return res.status(400).json({ error: 'Google 登录验证失败' });
    }
    
    const { email, name, sub: googleId, picture } = payload;
    
    // 查找或创建用户
    let user;
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (existing.rows.length > 0) {
      user = existing.rows[0];
    } else {
      // 创建新用户（使用随机密码，因为是 OAuth 登录）
      const userId = uuidv4();
      const randomPassword = await bcrypt.hash(uuidv4(), 10);
      
      await pool.query(
        'INSERT INTO users (id, email, password, name) VALUES ($1, $2, $3, $4)',
        [userId, email, randomPassword, name || '']
      );
      
      user = { id: userId, email, name };
    }
    
    // 生成 token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name || name }
    });
  } catch (err) {
    console.error('Google login error:', err);
    res.status(500).json({ error: 'Google 登录失败' });
  }
});

// Google OAuth 登录 (使用授权码)
app.post('/api/auth/google-code', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: '缺少授权码' });
    }
    
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
    const redirectUri = 'com.smarttodo.app:/oauth2callback';
    
    // 用授权码换取 access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      return res.status(400).json({ error: 'Google 授权失败' });
    }
    
    // 获取用户信息
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    
    const googleUser = await userResponse.json();
    const { email, name } = googleUser;
    
    // 查找或创建用户
    let user;
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (existing.rows.length > 0) {
      user = existing.rows[0];
    } else {
      const userId = uuidv4();
      const randomPassword = await bcrypt.hash(uuidv4(), 10);
      
      await pool.query(
        'INSERT INTO users (id, email, password, name) VALUES ($1, $2, $3, $4)',
        [userId, email, randomPassword, name || '']
      );
      
      user = { id: userId, email, name };
    }
    
    // 生成 token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name || name }
    });
  } catch (err) {
    console.error('Google code login error:', err);
    res.status(500).json({ error: 'Google 登录失败' });
  }
});

// Google OAuth 登录 (使用 PKCE)
app.post('/api/auth/google-pkce', async (req, res) => {
  try {
    const { code, codeVerifier, redirectUri } = req.body;
    
    if (!code || !codeVerifier) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 用授权码 + code_verifier 换取 token (PKCE flow 不需要 client_secret)
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier
      })
    });
    
    const tokenData = await tokenResponse.json();
    console.log('Google PKCE token response:', tokenData);
    
    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error_description || 'Google 授权失败' });
    }
    
    if (!tokenData.access_token && !tokenData.id_token) {
      return res.status(400).json({ error: 'Google 授权失败' });
    }
    
    let email, name;
    
    // 如果有 id_token，解析它获取用户信息
    if (tokenData.id_token) {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: tokenData.id_token,
          audience: GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        email = payload.email;
        name = payload.name;
      } catch (err) {
        console.error('ID token verification failed:', err);
      }
    }
    
    // 如果没有从 id_token 获取到信息，用 access_token 获取用户信息
    if (!email && tokenData.access_token) {
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const googleUser = await userResponse.json();
      email = googleUser.email;
      name = googleUser.name;
    }
    
    if (!email) {
      return res.status(400).json({ error: '无法获取用户信息' });
    }
    
    // 查找或创建用户
    let user;
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (existing.rows.length > 0) {
      user = existing.rows[0];
    } else {
      const userId = uuidv4();
      const randomPassword = await bcrypt.hash(uuidv4(), 10);
      
      await pool.query(
        'INSERT INTO users (id, email, password, name) VALUES ($1, $2, $3, $4)',
        [userId, email, randomPassword, name || '']
      );
      
      user = { id: userId, email, name };
    }
    
    // 生成 token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name || name }
    });
  } catch (err) {
    console.error('Google PKCE login error:', err);
    res.status(500).json({ error: 'Google 登录失败' });
  }
});

// Apple OAuth 登录
app.post('/api/auth/apple', async (req, res) => {
  try {
    const { identityToken, email, name } = req.body;
    
    if (!identityToken) {
      return res.status(400).json({ error: '缺少 Apple Identity Token' });
    }
    
    // 解码 JWT（Apple 的 identityToken 是 JWT 格式）
    // 生产环境应该验证签名，这里简化处理
    const parts = identityToken.split('.');
    if (parts.length !== 3) {
      return res.status(400).json({ error: 'Invalid token format' });
    }
    
    let payload;
    try {
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
    } catch (err) {
      return res.status(400).json({ error: 'Token 解析失败' });
    }
    
    const appleUserId = payload.sub;
    const userEmail = email || payload.email || `${appleUserId}@privaterelay.appleid.com`;
    
    // 查找或创建用户
    let user;
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [userEmail]);
    
    if (existing.rows.length > 0) {
      user = existing.rows[0];
    } else {
      // 创建新用户
      const userId = uuidv4();
      const randomPassword = await bcrypt.hash(uuidv4(), 10);
      
      await pool.query(
        'INSERT INTO users (id, email, password, name) VALUES ($1, $2, $3, $4)',
        [userId, userEmail, randomPassword, name || '']
      );
      
      user = { id: userId, email: userEmail, name };
    }
    
    // 生成 token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name || name || '' }
    });
  } catch (err) {
    console.error('Apple login error:', err);
    res.status(500).json({ error: 'Apple 登录失败' });
  }
});

// 修改密码
app.post('/api/auth/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '请填写当前密码和新密码' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少需要6位' });
    }
    
    // 获取用户
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: '用户不存在' });
    }
    
    const user = result.rows[0];
    
    // 验证当前密码
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(400).json({ error: '当前密码错误' });
    }
    
    // 更新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.userId]);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: '修改密码失败' });
  }
});

// 验证 Token
app.get('/api/auth/verify', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: '用户不存在' });
    }
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: '验证失败' });
  }
});

// ==================== 任务 API ====================

// 获取所有任务
app.get('/api/tasks', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, text, notes, completed, priority, category, 
             due_date as "dueDate", recurring, created_at as "createdAt", updated_at as "updatedAt"
      FROM tasks 
      WHERE user_id = $1 AND deleted = FALSE
      ORDER BY created_at DESC
    `, [req.userId]);
    
    res.json({ success: true, tasks: result.rows });
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ error: '获取任务失败' });
  }
});

// 同步任务（批量更新）
app.post('/api/tasks/sync', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const { tasks, deviceId } = req.body;
    
    await client.query('BEGIN');
    
    const updated = [];
    const created = [];
    
    for (const task of tasks) {
      const existing = await client.query(
        'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
        [task.id, req.userId]
      );
      
      if (existing.rows.length > 0) {
        // 更新任务（如果本地版本更新）
        if (!existing.rows[0].updated_at || task.updatedAt > existing.rows[0].updated_at) {
          await client.query(`
            UPDATE tasks SET 
              text = $1, notes = $2, completed = $3, priority = $4, 
              category = $5, due_date = $6, recurring = $7, updated_at = $8
            WHERE id = $9 AND user_id = $10
          `, [
            task.text, task.notes || '', task.completed, task.priority,
            task.category, task.dueDate, task.recurring, Date.now(),
            task.id, req.userId
          ]);
          updated.push(task.id);
        }
      } else {
        // 创建新任务
        await client.query(`
          INSERT INTO tasks (id, user_id, text, notes, completed, priority, category, due_date, recurring, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          task.id, req.userId, task.text, task.notes || '', task.completed,
          task.priority, task.category, task.dueDate, task.recurring,
          task.createdAt || Date.now(), Date.now()
        ]);
        created.push(task.id);
      }
    }
    
    // 获取服务器上的最新任务
    const serverTasks = await client.query(`
      SELECT id, text, notes, completed, priority, category, 
             due_date as "dueDate", recurring, created_at as "createdAt", updated_at as "updatedAt"
      FROM tasks 
      WHERE user_id = $1 AND deleted = FALSE
      ORDER BY created_at DESC
    `, [req.userId]);
    
    // 记录同步日志
    await client.query(
      'INSERT INTO sync_logs (user_id, device_id, action, timestamp) VALUES ($1, $2, $3, $4)',
      [req.userId, deviceId || 'unknown', 'sync', Date.now()]
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      tasks: serverTasks.rows,
      updated: updated.length,
      created: created.length,
      syncTime: Date.now()
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Sync tasks error:', err);
    res.status(500).json({ error: '同步失败' });
  } finally {
    client.release();
  }
});

// 删除任务
app.delete('/api/tasks/:id', authenticate, async (req, res) => {
  try {
    await pool.query(
      'UPDATE tasks SET deleted = TRUE, updated_at = $1 WHERE id = $2 AND user_id = $3',
      [Date.now(), req.params.id, req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: '删除失败' });
  }
});

// ==================== 用户资料 API ====================

// 获取用户资料
app.get('/api/profile', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1', [req.userId]);
    res.json({ success: true, profile: result.rows[0] || {} });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: '获取资料失败' });
  }
});

// 更新用户资料
app.post('/api/profile', authenticate, async (req, res) => {
  try {
    const { name, occupation, background, goals, challenges } = req.body;
    
    await pool.query(`
      INSERT INTO user_profiles (user_id, name, occupation, background, goals, challenges, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id) DO UPDATE SET
        name = $2, occupation = $3, background = $4, goals = $5, challenges = $6, updated_at = $7
    `, [req.userId, name, occupation, background, goals, challenges, Date.now()]);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: '更新资料失败' });
  }
});

// ==================== 记忆 API ====================

// 获取记忆
app.get('/api/memories', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM memories WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    
    // 按类别分组
    const grouped = {};
    for (const m of result.rows) {
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
app.post('/api/memories/sync', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const { memories } = req.body;
    
    await client.query('BEGIN');
    
    // 清除旧记忆并插入新的
    await client.query('DELETE FROM memories WHERE user_id = $1', [req.userId]);
    
    for (const [category, items] of Object.entries(memories)) {
      for (const item of items) {
        await client.query(
          'INSERT INTO memories (user_id, category, content, created_at) VALUES ($1, $2, $3, $4)',
          [req.userId, category, item.content, item.timestamp || Date.now()]
        );
      }
    }
    
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Sync memories error:', err);
    res.status(500).json({ error: '同步记忆失败' });
  } finally {
    client.release();
  }
});

// ==================== 设置 API ====================

// 获取设置
app.get('/api/settings', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM settings WHERE user_id = $1', [req.userId]);
    const settings = result.rows[0] ? JSON.parse(result.rows[0].data) : {};
    res.json({ success: true, settings });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: '获取设置失败' });
  }
});

// 更新设置
app.post('/api/settings', authenticate, async (req, res) => {
  try {
    const { settings } = req.body;
    
    await pool.query(`
      INSERT INTO settings (user_id, data, updated_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE SET data = $2, updated_at = $3
    `, [req.userId, JSON.stringify(settings), Date.now()]);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: '更新设置失败' });
  }
});

// ==================== 完整同步 API ====================

// 完整数据同步
app.post('/api/sync/full', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const { tasks, profile, memories, settings, deviceId } = req.body;
    
    await client.query('BEGIN');
    
    // 同步任务
    if (tasks && tasks.length > 0) {
      for (const task of tasks) {
        const existing = await client.query(
          'SELECT updated_at FROM tasks WHERE id = $1 AND user_id = $2',
          [task.id, req.userId]
        );
        
        if (existing.rows.length > 0) {
          if (!existing.rows[0].updated_at || task.updatedAt > existing.rows[0].updated_at) {
            await client.query(`
              UPDATE tasks SET 
                text = $1, notes = $2, completed = $3, priority = $4, 
                category = $5, due_date = $6, recurring = $7, updated_at = $8
              WHERE id = $9 AND user_id = $10
            `, [
              task.text, task.notes || '', task.completed, task.priority,
              task.category, task.dueDate, task.recurring, Date.now(),
              task.id, req.userId
            ]);
          }
        } else {
          await client.query(`
            INSERT INTO tasks (id, user_id, text, notes, completed, priority, category, due_date, recurring, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [
            task.id, req.userId, task.text, task.notes || '', task.completed,
            task.priority, task.category, task.dueDate, task.recurring,
            task.createdAt || Date.now(), Date.now()
          ]);
        }
      }
    }
    
    // 同步资料
    if (profile) {
      await client.query(`
        INSERT INTO user_profiles (user_id, name, occupation, background, goals, challenges, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id) DO UPDATE SET
          name = $2, occupation = $3, background = $4, goals = $5, challenges = $6, updated_at = $7
      `, [req.userId, profile.name, profile.occupation, profile.background, profile.goals, profile.challenges, Date.now()]);
    }
    
    // 同步记忆
    if (memories) {
      await client.query('DELETE FROM memories WHERE user_id = $1', [req.userId]);
      for (const [category, items] of Object.entries(memories)) {
        for (const item of items) {
          await client.query(
            'INSERT INTO memories (user_id, category, content, created_at) VALUES ($1, $2, $3, $4)',
            [req.userId, category, item.content, item.timestamp || Date.now()]
          );
        }
      }
    }
    
    // 同步设置
    if (settings) {
      await client.query(`
        INSERT INTO settings (user_id, data, updated_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET data = $2, updated_at = $3
      `, [req.userId, JSON.stringify(settings), Date.now()]);
    }
    
    // 记录同步
    await client.query(
      'INSERT INTO sync_logs (user_id, device_id, action, timestamp) VALUES ($1, $2, $3, $4)',
      [req.userId, deviceId || 'unknown', 'full_sync', Date.now()]
    );
    
    // 获取服务器最新数据
    const serverTasks = await client.query(`
      SELECT id, text, notes, completed, priority, category, 
             due_date as "dueDate", recurring, created_at as "createdAt", updated_at as "updatedAt"
      FROM tasks WHERE user_id = $1 AND deleted = FALSE ORDER BY created_at DESC
    `, [req.userId]);
    
    const serverProfile = await client.query('SELECT * FROM user_profiles WHERE user_id = $1', [req.userId]);
    
    const serverMemories = await client.query('SELECT * FROM memories WHERE user_id = $1', [req.userId]);
    const groupedMemories = {};
    for (const m of serverMemories.rows) {
      if (!groupedMemories[m.category]) groupedMemories[m.category] = [];
      groupedMemories[m.category].push({ content: m.content, timestamp: m.created_at });
    }
    
    const serverSettings = await client.query('SELECT data FROM settings WHERE user_id = $1', [req.userId]);
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      data: {
        tasks: serverTasks.rows,
        profile: serverProfile.rows[0] || {},
        memories: groupedMemories,
        settings: serverSettings.rows[0] ? JSON.parse(serverSettings.rows[0].data) : {}
      },
      syncTime: Date.now()
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Full sync error:', err);
    res.status(500).json({ error: '完整同步失败' });
  } finally {
    client.release();
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Todo Agent 同步服务器运行在端口 ${PORT}`);
  console.log(`📊 使用 PostgreSQL 数据库`);
});
