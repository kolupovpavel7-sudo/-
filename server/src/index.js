const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, initDB } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'messenger-secret-key-change-in-production';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

const uploadsPath = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// Serve frontend in production
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));

// --- File Upload ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsPath),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// --- Auth Middleware ---
async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    const ban = await db.get('SELECT id FROM bans WHERE user_id = ?', [req.user.id]);
    if (ban) return res.status(403).json({ error: 'Ваш аккаунт заблокирован' });
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// --- Ban Check (optional, for socket) ---
async function checkBan(req, res, next) {
  const ban = await db.get('SELECT id FROM bans WHERE user_id = ?', [req.user.id]);
  if (ban) return res.status(403).json({ error: 'Ваш аккаунт заблокирован' });
  next();
}

// --- Auth Routes ---
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, handle } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'All fields are required' });
  if (username.length < 2 || username.length > 30) return res.status(400).json({ error: 'Имя: от 2 до 30 символов' });
  if (!/^[a-zA-Z0-9 _-]+$/.test(username)) return res.status(400).json({ error: 'Имя: только латиница, цифры, пробел, _ и -' });
  const cleanHandle = handle ? handle.replace('@', '').toLowerCase() : null;
  if (cleanHandle && cleanHandle.length < 3) return res.status(400).json({ error: '@username минимум 3 символа' });
  if (cleanHandle && !/^[a-z0-9_]+$/.test(cleanHandle)) return res.status(400).json({ error: '@username: только латиница, цифры и _' });
  try {
    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    if (cleanHandle) {
      const handleTaken = await db.get('SELECT id FROM users WHERE handle = ?', [cleanHandle]);
      if (handleTaken) return res.status(400).json({ error: 'Этот @username уже занят' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const userCount = await db.get('SELECT COUNT(*) as cnt FROM users');
    const isAdmin = (userCount?.cnt || 0) === 0 ? 1 : 0;
    const result = await db.run('INSERT INTO users (username, email, password_hash, handle, is_admin) VALUES (?, ?, ?, ?, ?)', [username, email, hash, cleanHandle, isAdmin]);
    const user = await db.get('SELECT id, username, handle, email, avatar, avatar_emoji, avatar_color, is_admin, created_at FROM users WHERE id = ?', [result.lastInsertRowid]);
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  try {
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Неверный email или пароль' });
    if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Неверный email или пароль' });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const user = await db.get('SELECT id, username, handle, email, avatar, avatar_emoji, avatar_color, is_admin, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const userFields = 'id, username, handle, email, avatar, avatar_emoji, avatar_color, is_admin, created_at';

// --- Handle Check ---
app.get('/api/users/check-handle/:handle', auth, async (req, res) => {
  const handle = req.params.handle.replace('@', '').toLowerCase();
  if (handle.length < 3) return res.json({ available: false, error: 'Минимум 3 символа' });
  if (!/^[a-z0-9_]+$/.test(handle)) return res.json({ available: false, error: 'Только латиница, цифры и _' });
  try {
    const existing = await db.get('SELECT id FROM users WHERE handle = ?', [handle]);
    res.json({ available: !existing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/set-handle', auth, async (req, res) => {
  const { handle } = req.body;
  const clean = handle.replace('@', '').toLowerCase();
  if (!clean || clean.length < 3) return res.status(400).json({ error: 'Минимум 3 символа' });
  if (!/^[a-z0-9_]+$/.test(clean)) return res.status(400).json({ error: 'Только латиница, цифры и _' });
  try {
    const existing = await db.get('SELECT id FROM users WHERE handle = ? AND id != ?', [clean, req.user.id]);
    if (existing) return res.status(400).json({ error: 'Этот @username уже занят' });
    await db.run('UPDATE users SET handle = ? WHERE id = ?', [clean, req.user.id]);
    const user = await db.get('SELECT id, username, handle, email, avatar, avatar_emoji, avatar_color, is_admin, created_at FROM users WHERE id = ?', [req.user.id]);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Avatar Upload ---
app.post('/api/users/avatar', auth, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const avatarUrl = `/uploads/${req.file.filename}`;
  try {
    await db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, req.user.id]);
    res.json({ avatar: avatarUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Avatar Emoji/Color ---
app.post('/api/users/avatar-emoji', auth, async (req, res) => {
  const { emoji, color } = req.body;
  try {
    if (emoji !== undefined) await db.run('UPDATE users SET avatar_emoji = ? WHERE id = ?', [emoji || null, req.user.id]);
    if (color !== undefined) await db.run('UPDATE users SET avatar_color = ? WHERE id = ?', [color || null, req.user.id]);
    const user = await db.get('SELECT id, username, handle, email, avatar, avatar_emoji, avatar_color, is_admin, created_at FROM users WHERE id = ?', [req.user.id]);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Update Username ---
app.post('/api/users/update-username', auth, async (req, res) => {
  const { username } = req.body;
  if (!username || username.length < 2 || username.length > 30) return res.status(400).json({ error: 'Имя: от 2 до 30 символов' });
  if (!/^[a-zA-Z0-9 _-]+$/.test(username)) return res.status(400).json({ error: 'Только латиница, цифры, пробел, _ и -' });
  try {
    await db.run('UPDATE users SET username = ? WHERE id = ?', [username, req.user.id]);
    const user = await db.get('SELECT id, username, handle, email, avatar, avatar_emoji, avatar_color, is_admin, created_at FROM users WHERE id = ?', [req.user.id]);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Edit Message ---
app.put('/api/messages/:id', auth, async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });
  try {
    const msg = await db.get('SELECT * FROM messages WHERE id = ?', [req.params.id]);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    if (msg.sender_id !== req.user.id) return res.status(403).json({ error: 'Not your message' });
    await db.run('UPDATE messages SET content = ? WHERE id = ?', [content.trim(), req.params.id]);
    const updated = await db.get(`
      SELECT m.*, u.username as sender_name, u.avatar as sender_avatar, u.avatar_emoji as sender_avatar_emoji, u.avatar_color as sender_avatar_color
      FROM messages m LEFT JOIN users u ON m.sender_id = u.id WHERE m.id = ?
    `, [req.params.id]);
    io.to(`conv:${msg.conversation_id}`).emit('message:edited', { message: updated });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Delete Message ---
app.delete('/api/messages/:id', auth, async (req, res) => {
  try {
    const msg = await db.get('SELECT * FROM messages WHERE id = ?', [req.params.id]);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    if (msg.sender_id !== req.user.id) return res.status(403).json({ error: 'Not your message' });
    await db.run('DELETE FROM reactions WHERE message_id = ?', [req.params.id]);
    await db.run('DELETE FROM messages WHERE id = ?', [req.params.id]);
    io.to(`conv:${msg.conversation_id}`).emit('message:deleted', { messageId: msg.id, conversationId: msg.conversation_id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Forward Message ---
app.post('/api/messages/:id/forward', auth, async (req, res) => {
  const { conversationId } = req.body;
  try {
    const original = await db.get('SELECT * FROM messages WHERE id = ?', [req.params.id]);
    if (!original) return res.status(404).json({ error: 'Message not found' });
    const participant = await db.get('SELECT 1 FROM participants WHERE conversation_id = ? AND user_id = ?', [conversationId, req.user.id]);
    if (!participant) return res.status(403).json({ error: 'Not a participant' });
    const info = await db.run(
      'INSERT INTO messages (conversation_id, sender_id, content, type, file_url) VALUES (?, ?, ?, ?, ?)',
      [conversationId, req.user.id, original.content, original.type, original.file_url]
    );
    const message = await db.get(`
      SELECT m.*, u.username as sender_name, u.avatar as sender_avatar, u.avatar_emoji as sender_avatar_emoji, u.avatar_color as sender_avatar_color
      FROM messages m LEFT JOIN users u ON m.sender_id = u.id WHERE m.id = ?
    `, [info.lastInsertRowid]);
    io.to(`conv:${conversationId}`).emit('message:new', message);
    res.json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Pin Message ---
app.post('/api/conversations/:id/pin', auth, async (req, res) => {
  const { messageId } = req.body;
  try {
    if (messageId) {
      const msg = await db.get('SELECT id FROM messages WHERE id = ? AND conversation_id = ?', [messageId, req.params.id]);
      if (!msg) return res.status(404).json({ error: 'Message not found' });
    }
    await db.run('UPDATE conversations SET pinned_message_id = ? WHERE id = ?', [messageId || null, req.params.id]);
    let pinnedMessage = null;
    if (messageId) {
      pinnedMessage = await db.get(`
        SELECT m.*, u.username as sender_name
        FROM messages m LEFT JOIN users u ON m.sender_id = u.id WHERE m.id = ?
      `, [messageId]);
    }
    io.to(`conv:${req.params.id}`).emit('conversation:pinned', { conversationId: Number(req.params.id), pinnedMessage });
    res.json({ pinnedMessage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/conversations/:id/pinned', auth, async (req, res) => {
  try {
    const conv = await db.get('SELECT pinned_message_id FROM conversations WHERE id = ?', [req.params.id]);
    if (!conv || !conv.pinned_message_id) return res.json({ pinnedMessage: null });
    const msg = await db.get(`
      SELECT m.*, u.username as sender_name
      FROM messages m LEFT JOIN users u ON m.sender_id = u.id WHERE m.id = ?
    `, [conv.pinned_message_id]);
    res.json({ pinnedMessage: msg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Read Receipts ---
app.post('/api/messages/:id/read', auth, async (req, res) => {
  try {
    await db.run(
      'INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)',
      [req.params.id, req.user.id]
    );
    const msg = await db.get('SELECT conversation_id FROM messages WHERE id = ?', [req.params.id]);
    if (msg) {
      const readBy = await db.all(
        'SELECT user_id FROM message_reads WHERE message_id = ?', [req.params.id]
      );
      io.to(`conv:${msg.conversation_id}`).emit('message:read', {
        messageId: Number(req.params.id),
        readBy: readBy.map(r => r.user_id)
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/conversations/:id/read-status', auth, async (req, res) => {
  try {
    const myMsgs = await db.all(
      'SELECT id FROM messages WHERE conversation_id = ? AND sender_id = ?', [req.params.id, req.user.id]
    );
    const result = {};
    for (const msg of myMsgs) {
      const reads = await db.all('SELECT user_id FROM message_reads WHERE message_id = ?', [msg.id]);
      result[msg.id] = reads.map(r => r.user_id);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Users ---
app.get('/api/users', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, username, email, avatar FROM users ORDER BY username');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/search', auth, async (req, res) => {
  const q = req.query.q;
  if (!q || q.length < 1) return res.json([]);
  try {
    const users = await db.all(
      "SELECT id, username, handle, avatar, avatar_emoji, avatar_color FROM users WHERE id != ? AND (username LIKE ? OR handle LIKE ?) LIMIT 20",
      [req.user.id, `%${q}%`, `%${q}%`]
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/:id', auth, async (req, res) => {
  try {
    const user = await db.get('SELECT id, username, email, avatar, avatar_emoji, avatar_color, created_at FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Conversations ---
app.post('/api/conversations', auth, async (req, res) => {
  const { name, type, participantIds } = req.body;
  try {
    const convType = type || 'private';
    let convName = name || null;

    if (convType === 'private' && participantIds && participantIds.length === 2) {
      const existing = await db.get(`
        SELECT c.id FROM conversations c
        WHERE c.type = 'private'
          AND EXISTS (SELECT 1 FROM participants WHERE conversation_id = c.id AND user_id = ?)
          AND EXISTS (SELECT 1 FROM participants WHERE conversation_id = c.id AND user_id = ?)
      `, [participantIds[0], participantIds[1]]);
      if (existing) {
        const conv = await db.get('SELECT * FROM conversations WHERE id = ?', [existing.id]);
        return res.json(conv);
      }
      const otherUserId = participantIds.find(id => id !== req.user.id) || participantIds[0];
      const otherUser = await db.get('SELECT username FROM users WHERE id = ?', [otherUserId]);
      if (otherUser) convName = otherUser.username;
    }

    const conv = await db.transaction(async (trx) => {
      const info = await trx.run('INSERT INTO conversations (name, type) VALUES (?, ?)', [convName, convType]);
      const convId = info.lastInsertRowid || (await trx.get('SELECT last_value FROM conversations_id_seq'))?.last_value;
      const newConv = await trx.get('SELECT * FROM conversations WHERE id = ?', [convId]);
      if (participantIds && participantIds.length) {
        for (const uid of participantIds) {
          await trx.run('INSERT INTO participants (conversation_id, user_id) VALUES (?, ?)', [newConv.id, uid]);
        }
      }
      return newConv;
    });

    if (convType === 'private') {
      const otherUserId = participantIds.find(id => id !== req.user.id) || participantIds[0];
      const other = await db.get('SELECT id, username, handle, avatar, avatar_emoji, avatar_color FROM users WHERE id = ?', [otherUserId]);
      if (other) {
        conv.avatar = other.avatar;
        conv.avatar_emoji = other.avatar_emoji;
        conv.avatar_color = other.avatar_color;
        conv.other_user_id = other.id;
        conv.other_username = other.username;
        conv.other_handle = other.handle;
        conv.name = conv.name || other.username;
      }
    }

    res.json(conv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/conversations/:userId', auth, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const convs = await db.all(`
      SELECT c.*,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT type FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_type,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at
      FROM conversations c
      JOIN participants p ON c.id = p.conversation_id
      WHERE p.user_id = ?
      ORDER BY last_message_at DESC NULLS LAST
    `, [userId]);

    const enriched = await Promise.all(convs.map(async (conv) => {
      if (conv.type === 'private') {
        const other = await db.get(`
          SELECT u.id, u.username, u.handle, u.avatar, u.avatar_emoji, u.avatar_color
          FROM users u JOIN participants p ON u.id = p.user_id
          WHERE p.conversation_id = ? AND u.id != ?
        `, [conv.id, userId]);
        if (other) {
          conv.avatar = other.avatar;
          conv.avatar_emoji = other.avatar_emoji;
          conv.avatar_color = other.avatar_color;
          conv.other_user_id = other.id;
          conv.other_username = other.username;
          conv.other_handle = other.handle;
          conv.name = conv.name || other.username;
        }
      }
      return conv;
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Delete Conversation ---
app.delete('/api/conversations/:id', auth, async (req, res) => {
  try {
    const conv = await db.get('SELECT * FROM conversations WHERE id = ?', [req.params.id]);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    const participant = await db.get('SELECT 1 FROM participants WHERE conversation_id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!participant) return res.status(403).json({ error: 'Not a participant' });
    const convId = Number(req.params.id);
    io.to(`conv:${convId}`).emit('conversation:deleted', { conversationId: convId });
    await db.run('DELETE FROM reactions WHERE message_id IN (SELECT id FROM messages WHERE conversation_id = ?)', [convId]);
    await db.run('DELETE FROM messages WHERE conversation_id = ?', [convId]);
    await db.run('DELETE FROM participants WHERE conversation_id = ?', [convId]);
    await db.run('DELETE FROM conversations WHERE id = ?', [convId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Check existing private conversation ---
app.get('/api/conversations/check/:userId', auth, async (req, res) => {
  try {
    const conv = await db.get(`
      SELECT c.id FROM conversations c
      WHERE c.type = 'private'
        AND EXISTS (SELECT 1 FROM participants WHERE conversation_id = c.id AND user_id = ?)
        AND EXISTS (SELECT 1 FROM participants WHERE conversation_id = c.id AND user_id = ?)
    `, [req.user.id, req.params.userId]);
    res.json({ exists: !!conv, conversationId: conv ? conv.id : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/conversations/:id/participants', auth, async (req, res) => {
  try {
    const users = await db.all(`
      SELECT u.id, u.username, u.avatar, u.avatar_emoji, u.avatar_color FROM users u
      JOIN participants p ON u.id = p.user_id WHERE p.conversation_id = ?
    `, [req.params.id]);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Messages ---
app.get('/api/messages/:conversationId', auth, async (req, res) => {
  try {
    const msgs = await db.all(`
      SELECT m.*, u.username as sender_name, u.avatar as sender_avatar, u.avatar_emoji as sender_avatar_emoji, u.avatar_color as sender_avatar_color,
        rm.content as reply_content, rm.sender_id as reply_sender_id,
        ru.username as reply_sender_name, rm.type as reply_type, rm.file_url as reply_file_url
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN messages rm ON m.reply_to = rm.id
      LEFT JOIN users ru ON rm.sender_id = ru.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
      LIMIT 200
    `, [req.params.conversationId]);

    const msgIds = msgs.map(m => m.id);
    if (msgIds.length) {
      const placeholders = msgIds.map(() => '?').join(',');
      const reactions = await db.all(
        `SELECT r.message_id, r.user_id, r.emoji, u.username
         FROM reactions r LEFT JOIN users u ON r.user_id = u.id
         WHERE r.message_id IN (${placeholders})`,
        msgIds
      );
      const grouped = {};
      for (const r of reactions) {
        if (!grouped[r.message_id]) grouped[r.message_id] = [];
        grouped[r.message_id].push(r);
      }
      for (const msg of msgs) msg.reactions = grouped[msg.id] || [];
    }
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Reactions ---
app.post('/api/reactions', auth, async (req, res) => {
  const { messageId, emoji } = req.body;
  if (!messageId || !emoji) return res.status(400).json({ error: 'messageId and emoji required' });
  try {
    const existing = await db.get('SELECT id FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?', [messageId, req.user.id, emoji]);
    if (existing) {
      await db.run('DELETE FROM reactions WHERE id = ?', [existing.id]);
      return res.json({ removed: true });
    }
    await db.run('INSERT INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)', [messageId, req.user.id, emoji]);
    res.json({ added: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- File Upload for messages ---
app.post('/api/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `/uploads/${req.file.filename}`;
  const type = req.file.mimetype.startsWith('image/') ? 'image'
    : req.file.mimetype.startsWith('video/') ? 'video'
    : req.file.mimetype.startsWith('audio/') ? 'audio' : 'file';
  res.json({ fileUrl, type, originalName: req.file.originalname });
});

// --- Admin: Ban User ---
app.post('/api/admin/ban', auth, async (req, res) => {
  try {
    const admin = await db.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id]);
    if (!admin || !admin.is_admin) return res.status(403).json({ error: 'Только админ может банить' });
    const { userId, reason } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (userId === req.user.id) return res.status(400).json({ error: 'Нельзя забанить себя' });
    const existing = await db.get('SELECT id FROM bans WHERE user_id = ?', [userId]);
    if (existing) return res.status(400).json({ error: 'Уже забанен' });
    await db.run('INSERT INTO bans (user_id, banned_by, reason) VALUES (?, ?, ?)', [userId, req.user.id, reason || '']);
    io.emit('user:banned', { userId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/unban', auth, async (req, res) => {
  try {
    const admin = await db.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id]);
    if (!admin || !admin.is_admin) return res.status(403).json({ error: 'Только админ может разбанить' });
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    await db.run('DELETE FROM bans WHERE user_id = ?', [userId]);
    io.emit('user:unbanned', { userId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/bans', auth, async (req, res) => {
  try {
    const admin = await db.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id]);
    if (!admin || !admin.is_admin) return res.status(403).json({ error: 'Только админ' });
    const bans = await db.all(`
      SELECT b.*, u.username as banned_username, a.username as admin_username
      FROM bans b LEFT JOIN users u ON b.user_id = u.id LEFT JOIN users a ON b.banned_by = a.id
    `);
    res.json(bans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users', auth, async (req, res) => {
  try {
    const admin = await db.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id]);
    if (!admin || !admin.is_admin) return res.status(403).json({ error: 'Только админ' });
    const users = await db.all('SELECT id, username, handle, avatar, avatar_emoji, avatar_color, is_admin, created_at FROM users');
    const bans = await db.all('SELECT user_id FROM bans');
    const bannedIds = new Set(bans.map(b => b.user_id));
    res.json(users.map(u => ({ ...u, is_banned: bannedIds.has(u.id) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- WebSocket ---
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('user:online', (userId) => {
    socket.userId = userId;
    onlineUsers.set(userId, socket.id);
    io.emit('users:online', Array.from(onlineUsers.keys()));
  });

  socket.on('conversation:join', (conversationId) => socket.join(`conv:${conversationId}`));
  socket.on('conversation:leave', (conversationId) => socket.leave(`conv:${conversationId}`));

  socket.on('message:send', async (data) => {
    const { conversationId, senderId, content, type, fileUrl, replyTo } = data;
    try {
      const info = await db.run(
        'INSERT INTO messages (conversation_id, sender_id, content, type, file_url, reply_to) VALUES (?, ?, ?, ?, ?, ?)',
        [conversationId, senderId, content, type || 'text', fileUrl || null, replyTo || null]
      );
      const message = await db.get(`
        SELECT m.*, u.username as sender_name, u.avatar as sender_avatar, u.avatar_emoji as sender_avatar_emoji, u.avatar_color as sender_avatar_color,
          rm.content as reply_content, rm.sender_id as reply_sender_id,
          ru.username as reply_sender_name, rm.type as reply_type, rm.file_url as reply_file_url
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        LEFT JOIN messages rm ON m.reply_to = rm.id
        LEFT JOIN users ru ON rm.sender_id = ru.id
        WHERE m.id = ?
      `, [info.lastInsertRowid]);
      io.to(`conv:${conversationId}`).emit('message:new', message);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('typing:start', ({ conversationId, userId }) => {
    socket.to(`conv:${conversationId}`).emit('typing:start', { conversationId, userId });
  });

  socket.on('typing:stop', ({ conversationId, userId }) => {
    socket.to(`conv:${conversationId}`).emit('typing:stop', { conversationId, userId });
  });

  socket.on('reaction:toggle', async ({ messageId, emoji, conversationId }) => {
    try {
      const userId = socket.userId;
      if (!userId) return;
      const existing = await db.get('SELECT id FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?', [messageId, userId, emoji]);
      if (existing) {
        await db.run('DELETE FROM reactions WHERE id = ?', [existing.id]);
      } else {
        await db.run('INSERT INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)', [messageId, userId, emoji]);
      }
      const reactions = await db.all(`
        SELECT r.message_id, r.user_id, r.emoji, u.username
        FROM reactions r LEFT JOIN users u ON r.user_id = u.id WHERE r.message_id = ?
      `, [messageId]);
      io.to(`conv:${conversationId}`).emit('message:reactions', { messageId, reactions });
    } catch (err) {
      console.error('Reaction error:', err.message);
    }
  });

  socket.on('disconnect', () => {
    for (const [userId, socketId] of onlineUsers) {
      if (socketId === socket.id) { onlineUsers.delete(userId); break; }
    }
    io.emit('users:online', Array.from(onlineUsers.keys()));
    console.log('User disconnected:', socket.id);
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3001;

initDB().then(() => {
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('Failed to init DB:', err);
  process.exit(1);
});
