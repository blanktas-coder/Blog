/**
 * 博客后端：真实多用户登录 + 全站共享评论 + 审核后发布
 * 零第三方依赖：node:http + node:sqlite + node:crypto
 * 运行：node server.js
 * 环境变量（可选）：
 *   PORT           监听端口，默认 3000
 *   ADMIN_ACCOUNT  管理员账户，默认 admin
 *   ADMIN_PASSWORD 管理员初始密码，默认 admin123
 *   ADMIN_NICKNAME 管理员昵称，默认 站长
 * 要求：Node.js >= 22.5（内置 node:sqlite），推荐 24 LTS
 */
'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');

const PORT = parseInt(process.env.PORT || '3000', 10);
const ADMIN_ACCOUNT = process.env.ADMIN_ACCOUNT || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_NICKNAME = process.env.ADMIN_NICKNAME || '站长';
const TOKEN_DAYS = 30;

// ---------- 数据库 ----------
const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'blog.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account TEXT UNIQUE NOT NULL,
    nickname TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT NOT NULL,
    parent_id INTEGER,
    author_account TEXT NOT NULL,
    author_nickname TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, status, created_at);
  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    excerpt TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

// ---------- JWT 密钥（首次运行自动生成） ----------
const SECRET_PATH = path.join(DATA_DIR, '.secret');
let SECRET = '';
try { SECRET = fs.readFileSync(SECRET_PATH, 'utf8').trim(); } catch (e) {}
if (!SECRET) {
  SECRET = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_PATH, SECRET, { mode: 0o600 });
}

// ---------- 工具 ----------
function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}
function newSalt() {
  return crypto.randomBytes(16).toString('hex');
}
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
function now() { return Date.now(); }

function signToken(account) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ account, exp: now() + TOKEN_DAYS * 86400000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(header + '.' + body).digest('base64url');
  return header + '.' + body + '.' + sig;
}
function verifyToken(token) {
  if (!token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expect = crypto.createHmac('sha256', SECRET).update(header + '.' + body).digest('base64url');
  if (!safeEqual(expect, sig)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch (e) { return null; }
  if (!payload.account || !payload.exp || now() > payload.exp) return null;
  return payload;
}

// ---------- 管理员种子 ----------
(function seedAdmin() {
  const exists = db.prepare('SELECT id FROM users WHERE account = ?').get(ADMIN_ACCOUNT);
  if (!exists) {
    const salt = newSalt();
    db.prepare('INSERT INTO users (account, nickname, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(ADMIN_ACCOUNT, ADMIN_NICKNAME, hashPassword(ADMIN_PASSWORD, salt), salt, now());
    console.log('已创建管理员账号: ' + ADMIN_ACCOUNT + '（初始密码请登录后尽快修改）');
  }
})();

// ---------- 文章：首次启动从 posts.js 导入种子 ----------
function rowToPost(r) {
  let tags = [];
  try { tags = JSON.parse(r.tags || '[]'); } catch (e) { tags = []; }
  return { id: r.id, title: r.title, date: r.date, category: r.category || '', tags: tags, excerpt: r.excerpt || '', content: r.content || '' };
}
function rowToAnnouncement(r) {
  return { id: String(r.id), date: r.date, text: r.text };
}
(function seedPosts() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM posts').get().c;
  if (count > 0) return;
  try {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'posts.js'), 'utf8');
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    const posts = sandbox.window.POSTS || [];
    const ins = db.prepare('INSERT INTO posts (id, title, date, category, tags, excerpt, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    posts.forEach(function (p) {
      ins.run(p.id, p.title, p.date, p.category || '', JSON.stringify(p.tags || []), p.excerpt || '', p.content || '', now(), now());
    });
    console.log('已从 posts.js 导入 ' + posts.length + ' 篇初始文章');
  } catch (e) {
    console.error('导入初始文章失败（可忽略）: ' + e.message);
  }
})();

// ---------- 公告：首次启动从 config.js 导入种子 ----------
(function seedAnnouncements() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM announcements').get().c;
  if (count > 0) return;
  try {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'config.js'), 'utf8');
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    const anns = (sandbox.window.SITE && sandbox.window.SITE.announcements) || [];
    const ins = db.prepare('INSERT INTO announcements (date, text, created_at) VALUES (?, ?, ?)');
    anns.forEach(function (a) { ins.run(a.date, a.text, now()); });
    console.log('已从 config.js 导入 ' + anns.length + ' 条公告');
  } catch (e) {
    console.error('导入初始公告失败（可忽略）: ' + e.message);
  }
})();

// ---------- 查询辅助 ----------
function getUserByAccount(account) {
  return db.prepare('SELECT account, nickname, created_at FROM users WHERE account = ?').get(account) || null;
}
function buildTree(rows) {
  const map = {};
  const roots = [];
  rows.forEach(function (r) {
    map[r.id] = {
      id: String(r.id),
      user: r.author_nickname,
      author: r.author_account,
      content: r.content,
      time: r.created_at,
      status: r.status,
      replies: []
    };
  });
  rows.forEach(function (r) {
    if (r.parent_id && map[r.parent_id]) {
      map[r.parent_id].replies.push(map[r.id]);
    } else {
      roots.push(map[r.id]);
    }
  });
  return roots;
}
function publicComments(postId) {
  const rows = db.prepare(
    "SELECT id, parent_id, author_account, author_nickname, content, status, created_at FROM comments WHERE post_id = ? AND status = 'approved' ORDER BY created_at ASC, id ASC"
  ).all(String(postId));
  return buildTree(rows);
}
function myComments(account) {
  const mine = db.prepare('SELECT id, post_id, author_account, author_nickname, content, status, created_at FROM comments WHERE author_account = ? ORDER BY created_at DESC, id DESC').all(account);
  const ids = mine.map(function (r) { return r.id; });
  let replyMap = {};
  if (ids.length) {
    const placeholders = ids.map(function () { return '?'; }).join(',');
    const replies = db.prepare(
      "SELECT id, parent_id, author_account, author_nickname, content, created_at FROM comments WHERE parent_id IN (" + placeholders + ") AND status = 'approved' ORDER BY created_at ASC, id ASC"
    ).all.apply(null, [].concat(ids));
    replies.forEach(function (r) { (replyMap[r.parent_id] = replyMap[r.parent_id] || []).push(r); });
  }
  return mine.map(function (r) {
    return {
      id: String(r.id),
      post_id: r.post_id,
      user: r.author_nickname,
      author: r.author_account,
      content: r.content,
      status: r.status,
      time: r.created_at,
      replies: (replyMap[r.id] || []).map(function (x) {
        return { id: String(x.id), user: x.author_nickname, author: x.author_account, content: x.content, time: x.created_at };
      })
    };
  });
}
function pendingComments() {
  return db.prepare(
    "SELECT id, post_id, author_account, author_nickname, content, created_at FROM comments WHERE status = 'pending' ORDER BY created_at ASC, id ASC"
  ).all().map(function (r) {
    return { id: String(r.id), post_id: r.post_id, user: r.author_nickname, author: r.author_account, content: r.content, time: r.created_at };
  });
}
function deleteCommentTree(id) {
  const cid = Number(id);
  db.prepare('DELETE FROM comments WHERE id = ?').run(cid);
  db.prepare('DELETE FROM comments WHERE parent_id = ?').run(cid);
}

// ---------- HTTP 辅助 ----------
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
};
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }, CORS));
  res.end(body);
}
function readJson(req) {
  return new Promise(function (resolve, reject) {
    let data = '';
    req.on('data', function (c) {
      data += c;
      if (data.length > 1e6) { req.destroy(); reject(new Error('body too large')); }
    });
    req.on('end', function () {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}
function authAccount(req) {
  const h = req.headers['authorization'] || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const p = verifyToken(token);
  return p ? p.account : null;
}
function isAdmin(account) { return account === ADMIN_ACCOUNT; }

// ---------- 路由 ----------
const server = http.createServer(async function (req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const method = req.method;

  try {
    // 注册
    if (p === '/api/register' && method === 'POST') {
      const b = await readJson(req);
      const account = String(b.account || '').trim();
      const password = String(b.password || '');
      const nickname = String(b.nickname || '').trim() || account;
      if (!/^[a-zA-Z0-9_.-]{2,20}$/.test(account)) return sendJson(res, 400, { error: '账户名 2–20 位，仅限英文、数字、下划线、点、短横线' });
      if (password.length < 6) return sendJson(res, 400, { error: '密码至少 6 位' });
      if (nickname.length > 20) return sendJson(res, 400, { error: '用户名（昵称）不超过 20 字' });
      if (getUserByAccount(account)) return sendJson(res, 409, { error: '账户名已存在' });
      const salt = newSalt();
      const info = db.prepare('INSERT INTO users (account, nickname, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(account, nickname, hashPassword(password, salt), salt, now());
      const token = signToken(account);
      return sendJson(res, 200, { token, user: { account, nickname, createdAt: now() } });
    }

    // 登录
    if (p === '/api/login' && method === 'POST') {
      const b = await readJson(req);
      const account = String(b.account || '').trim();
      const password = String(b.password || '');
      const u = db.prepare('SELECT account, nickname, password_hash, salt, created_at FROM users WHERE account = ?').get(account);
      if (!u) return sendJson(res, 401, { error: '账户不存在，请先注册' });
      if (!safeEqual(hashPassword(password, u.salt), u.password_hash)) return sendJson(res, 401, { error: '密码错误' });
      const token = signToken(account);
      return sendJson(res, 200, { token, user: { account: u.account, nickname: u.nickname, createdAt: u.created_at } });
    }

    // 当前用户
    if (p === '/api/me' && method === 'GET') {
      const account = authAccount(req);
      if (!account) return sendJson(res, 401, { error: '未登录' });
      const u = getUserByAccount(account);
      if (!u) return sendJson(res, 401, { error: '未登录' });
      return sendJson(res, 200, { user: { account: u.account, nickname: u.nickname, createdAt: u.created_at, isAdmin: isAdmin(account) } });
    }

    // 修改密码
    if (p === '/api/change-password' && method === 'POST') {
      const account = authAccount(req);
      if (!account) return sendJson(res, 401, { error: '未登录' });
      const b = await readJson(req);
      const oldPw = String(b.oldPassword || '');
      const newPw = String(b.newPassword || '');
      if (newPw.length < 6) return sendJson(res, 400, { error: '新密码至少 6 位' });
      const u = db.prepare('SELECT * FROM users WHERE account = ?').get(account);
      if (!u) return sendJson(res, 401, { error: '未登录' });
      if (!safeEqual(hashPassword(oldPw, u.salt), u.password_hash)) return sendJson(res, 400, { error: '原密码错误' });
      const salt = newSalt();
      db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE account = ?').run(hashPassword(newPw, salt), salt, account);
      return sendJson(res, 200, { ok: true });
    }

    // 修改昵称
    if (p === '/api/change-nickname' && method === 'POST') {
      const account = authAccount(req);
      if (!account) return sendJson(res, 401, { error: '未登录' });
      const b = await readJson(req);
      const nickname = String(b.nickname || '').trim();
      if (!nickname) return sendJson(res, 400, { error: '请输入用户名（昵称）' });
      if (nickname.length > 20) return sendJson(res, 400, { error: '昵称不超过 20 字' });
      db.prepare('UPDATE users SET nickname = ? WHERE account = ?').run(nickname, account);
      return sendJson(res, 200, { ok: true, nickname });
    }

    // 公开评论（只返回已通过）
    if (p === '/api/comments' && method === 'GET') {
      const post = url.searchParams.get('post') || '';
      if (!post) return sendJson(res, 400, { error: '缺少 post 参数' });
      return sendJson(res, 200, { comments: publicComments(post) });
    }

    // 发评论/回复（存为待审核）
    if (p === '/api/comments' && method === 'POST') {
      const account = authAccount(req);
      if (!account) return sendJson(res, 401, { error: '请先登录' });
      const u = getUserByAccount(account);
      const b = await readJson(req);
      const post = String(b.post || '').trim();
      const content = String(b.content || '').trim();
      const parent = b.parent ? Number(b.parent) : null;
      if (!post) return sendJson(res, 400, { error: '缺少文章标识' });
      if (!content) return sendJson(res, 400, { error: '请输入内容' });
      if (parent != null) {
        const parentRow = db.prepare('SELECT id FROM comments WHERE id = ?').get(parent);
        if (!parentRow) return sendJson(res, 400, { error: '回复的评论不存在' });
      }
      const info = db.prepare('INSERT INTO comments (post_id, parent_id, author_account, author_nickname, content, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(post, parent, account, u.nickname, content, 'pending', now());
      return sendJson(res, 200, { ok: true, id: String(Number(info.lastInsertRowid)), status: 'pending' });
    }

    // 我的评论（含回复）
    if (p === '/api/my-comments' && method === 'GET') {
      const account = authAccount(req);
      if (!account) return sendJson(res, 401, { error: '未登录' });
      return sendJson(res, 200, { comments: myComments(account) });
    }

    // 待审核列表（管理员）
    if (p === '/api/pending' && method === 'GET') {
      const account = authAccount(req);
      if (!account || !isAdmin(account)) return sendJson(res, 403, { error: '无权限' });
      return sendJson(res, 200, { comments: pendingComments() });
    }

    // 审核通过（管理员）
    if (p === '/api/approve' && method === 'POST') {
      const account = authAccount(req);
      if (!account || !isAdmin(account)) return sendJson(res, 403, { error: '无权限' });
      const b = await readJson(req);
      const id = Number(b.id);
      if (!id) return sendJson(res, 400, { error: '缺少 id' });
      db.prepare("UPDATE comments SET status = 'approved' WHERE id = ?").run(id);
      return sendJson(res, 200, { ok: true });
    }

    // 驳回（删除）（管理员）
    if (p === '/api/reject' && method === 'POST') {
      const account = authAccount(req);
      if (!account || !isAdmin(account)) return sendJson(res, 403, { error: '无权限' });
      const b = await readJson(req);
      const id = Number(b.id);
      if (!id) return sendJson(res, 400, { error: '缺少 id' });
      deleteCommentTree(id);
      return sendJson(res, 200, { ok: true });
    }

    // 删除评论（自己或管理员）
    if (p.startsWith('/api/comments/') && method === 'DELETE') {
      const account = authAccount(req);
      if (!account) return sendJson(res, 401, { error: '未登录' });
      const id = Number(p.slice('/api/comments/'.length));
      if (!id) return sendJson(res, 400, { error: '缺少 id' });
      const c = db.prepare('SELECT author_account FROM comments WHERE id = ?').get(id);
      if (!c) return sendJson(res, 404, { error: '评论不存在' });
      if (c.author_account !== account && !isAdmin(account)) return sendJson(res, 403, { error: '无权限' });
      deleteCommentTree(id);
      return sendJson(res, 200, { ok: true });
    }

    // 文章列表（公开）
    if (p === '/api/posts' && method === 'GET') {
      const rows = db.prepare('SELECT * FROM posts ORDER BY date DESC, updated_at DESC').all();
      return sendJson(res, 200, { posts: rows.map(rowToPost) });
    }

    // 新建/更新文章（管理员）
    if (p === '/api/posts' && method === 'POST') {
      const account = authAccount(req);
      if (!account || !isAdmin(account)) return sendJson(res, 403, { error: '无权限' });
      const b = await readJson(req);
      const id = String(b.id || '').trim();
      const title = String(b.title || '').trim();
      const date = String(b.date || '').trim();
      const category = String(b.category || '').trim();
      const tagsRaw = b.tags;
      const tags = Array.isArray(tagsRaw)
        ? tagsRaw.map(function (s) { return String(s).trim(); }).filter(Boolean)
        : String(tagsRaw || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      const excerpt = String(b.excerpt || '').trim();
      const content = String(b.content || '');
      if (!id || !title || !date || !content) return sendJson(res, 400, { error: '请填写 id、标题、日期、正文' });
      if (!/^[a-z0-9-]{1,60}$/.test(id)) return sendJson(res, 400, { error: 'id 仅限小写英文、数字、短横线' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return sendJson(res, 400, { error: '日期格式应为 YYYY-MM-DD' });
      const tagsJson = JSON.stringify(tags);
      const exists = db.prepare('SELECT id FROM posts WHERE id = ?').get(id);
      if (exists) {
        db.prepare('UPDATE posts SET title = ?, date = ?, category = ?, tags = ?, excerpt = ?, content = ?, updated_at = ? WHERE id = ?')
          .run(title, date, category, tagsJson, excerpt, content, now(), id);
      } else {
        db.prepare('INSERT INTO posts (id, title, date, category, tags, excerpt, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, title, date, category, tagsJson, excerpt, content, now(), now());
      }
      return sendJson(res, 200, { ok: true, id: id });
    }

    // 删除文章（管理员）
    if (p.startsWith('/api/posts/') && method === 'DELETE') {
      const account = authAccount(req);
      if (!account || !isAdmin(account)) return sendJson(res, 403, { error: '无权限' });
      const id = p.slice('/api/posts/'.length);
      db.prepare('DELETE FROM posts WHERE id = ?').run(id);
      db.prepare('DELETE FROM comments WHERE post_id = ?').run(id);
      return sendJson(res, 200, { ok: true });
    }

    // 公告列表（公开）
    if (p === '/api/announcements' && method === 'GET') {
      const rows = db.prepare('SELECT * FROM announcements ORDER BY date DESC, id DESC').all();
      return sendJson(res, 200, { announcements: rows.map(rowToAnnouncement) });
    }

    // 新建/更新公告（管理员）
    if (p === '/api/announcements' && method === 'POST') {
      const account = authAccount(req);
      if (!account || !isAdmin(account)) return sendJson(res, 403, { error: '无权限' });
      const b = await readJson(req);
      const id = b.id ? Number(b.id) : null;
      const date = String(b.date || '').trim();
      const text = String(b.text || '').trim();
      if (!date || !text) return sendJson(res, 400, { error: '请填写日期和内容' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return sendJson(res, 400, { error: '日期格式应为 YYYY-MM-DD' });
      if (id) {
        const exists = db.prepare('SELECT id FROM announcements WHERE id = ?').get(id);
        if (!exists) return sendJson(res, 404, { error: '公告不存在' });
        db.prepare('UPDATE announcements SET date = ?, text = ? WHERE id = ?').run(date, text, id);
      } else {
        db.prepare('INSERT INTO announcements (date, text, created_at) VALUES (?, ?, ?)').run(date, text, now());
      }
      return sendJson(res, 200, { ok: true });
    }

    // 删除公告（管理员）
    if (p.startsWith('/api/announcements/') && method === 'DELETE') {
      const account = authAccount(req);
      if (!account || !isAdmin(account)) return sendJson(res, 403, { error: '无权限' });
      const id = Number(p.slice('/api/announcements/'.length));
      if (!id) return sendJson(res, 400, { error: '缺少 id' });
      db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
      return sendJson(res, 200, { ok: true });
    }

    // 账号列表（管理员）
    if (p === '/api/users' && method === 'GET') {
      const account = authAccount(req);
      if (!account || !isAdmin(account)) return sendJson(res, 403, { error: '无权限' });
      const rows = db.prepare('SELECT account, nickname, created_at FROM users ORDER BY created_at ASC').all();
      return sendJson(res, 200, { users: rows.map(function (r) {
        return { account: r.account, nickname: r.nickname, createdAt: r.created_at, isAdmin: r.account === ADMIN_ACCOUNT };
      })});
    }

    // 重置某账号密码（管理员）
    if (p === '/api/users/reset-password' && method === 'POST') {
      const account = authAccount(req);
      if (!account || !isAdmin(account)) return sendJson(res, 403, { error: '无权限' });
      const b = await readJson(req);
      const target = String(b.account || '').trim();
      const newPassword = String(b.newPassword || '');
      if (!target || newPassword.length < 6) return sendJson(res, 400, { error: '请输入账户名和新密码（至少 6 位）' });
      const u = db.prepare('SELECT account FROM users WHERE account = ?').get(target);
      if (!u) return sendJson(res, 404, { error: '账户不存在' });
      const salt = newSalt();
      db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE account = ?').run(hashPassword(newPassword, salt), salt, target);
      return sendJson(res, 200, { ok: true });
    }

    // 删除账号（管理员；不能删除管理员自己）
    if (p.startsWith('/api/users/') && method === 'DELETE') {
      const account = authAccount(req);
      if (!account || !isAdmin(account)) return sendJson(res, 403, { error: '无权限' });
      let target = p.slice('/api/users/'.length);
      try { target = decodeURIComponent(target); } catch (e) {}
      if (target === ADMIN_ACCOUNT) return sendJson(res, 400, { error: '不能删除管理员账户' });
      const u = db.prepare('SELECT account FROM users WHERE account = ?').get(target);
      if (!u) return sendJson(res, 404, { error: '账户不存在' });
      db.prepare('DELETE FROM comments WHERE author_account = ?').run(target);
      db.prepare('DELETE FROM users WHERE account = ?').run(target);
      return sendJson(res, 200, { ok: true });
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: '服务器错误' });
  }
});

server.listen(PORT, function () {
  console.log('博客后端已启动: http://0.0.0.0:' + PORT);
  console.log('管理员账户: ' + ADMIN_ACCOUNT + '（首次启动已自动创建）');
});
