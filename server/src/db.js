const path = require('path');

let pool = null;
let sqliteDb = null;
const isPg = !!process.env.DATABASE_URL;

async function initDB() {
  if (isPg) {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT,
        handle TEXT DEFAULT NULL,
        avatar TEXT DEFAULT NULL,
        avatar_emoji TEXT DEFAULT NULL,
        avatar_color TEXT DEFAULT NULL,
        is_admin INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle ON users(handle) WHERE handle IS NOT NULL;

      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        name TEXT DEFAULT NULL,
        type TEXT DEFAULT 'private',
        pinned_message_id INTEGER DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS participants (
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (conversation_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id INTEGER REFERENCES users(id),
        content TEXT,
        type TEXT DEFAULT 'text',
        file_url TEXT DEFAULT NULL,
        reply_to INTEGER DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reactions (
        id SERIAL PRIMARY KEY,
        message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        emoji TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(message_id, user_id, emoji)
      );
      CREATE TABLE IF NOT EXISTS message_reads (
        message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        read_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (message_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS bans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        banned_by INTEGER REFERENCES users(id),
        reason TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('PostgreSQL initialized');
  } else {
    const Database = require('better-sqlite3');
    sqliteDb = new Database(path.join(__dirname, '..', 'messenger.db'));
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('foreign_keys = ON');
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT,
        handle TEXT DEFAULT NULL,
        avatar TEXT DEFAULT NULL,
        avatar_emoji TEXT DEFAULT NULL,
        avatar_color TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle ON users(handle) WHERE handle IS NOT NULL;

      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT DEFAULT NULL,
        type TEXT DEFAULT 'private',
        pinned_message_id INTEGER DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS participants (
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (conversation_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id INTEGER REFERENCES users(id),
        content TEXT,
        type TEXT DEFAULT 'text',
        file_url TEXT DEFAULT NULL,
        reply_to INTEGER DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        emoji TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, user_id, emoji)
      );

      CREATE TABLE IF NOT EXISTS message_reads (
        message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (message_id, user_id)
      );
    `);
    const columns = sqliteDb.prepare("PRAGMA table_info(users)").all().map(c => c.name);
    if (!columns.includes('avatar_emoji')) sqliteDb.exec("ALTER TABLE users ADD COLUMN avatar_emoji TEXT DEFAULT NULL");
    if (!columns.includes('avatar_color')) sqliteDb.exec("ALTER TABLE users ADD COLUMN avatar_color TEXT DEFAULT NULL");
    const convColumns = sqliteDb.prepare("PRAGMA table_info(conversations)").all().map(c => c.name);
    if (!convColumns.includes('pinned_message_id')) sqliteDb.exec("ALTER TABLE conversations ADD COLUMN pinned_message_id INTEGER DEFAULT NULL");
    const userColumns = sqliteDb.prepare("PRAGMA table_info(users)").all().map(c => c.name);
    if (!userColumns.includes('is_admin')) sqliteDb.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0");
    sqliteDb.exec(`CREATE TABLE IF NOT EXISTS message_reads (
      message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (message_id, user_id)
    )`);
    sqliteDb.exec(`CREATE TABLE IF NOT EXISTS bans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      banned_by INTEGER REFERENCES users(id),
      reason TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('SQLite initialized');
  }
}

function toPgParams(sql, params) {
  let i = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++i}`);
  return { sql: pgSql, params: params || [] };
}

async function query(sql, params = []) {
  if (isPg) {
    const p = toPgParams(sql, params);
    return pool.query(p.sql, p.params);
  }
  return { rows: sqliteDb.prepare(sql).all(...params) };
}

async function get(sql, params = []) {
  if (isPg) {
    const p = toPgParams(sql, params);
    const res = await pool.query(p.sql, p.params);
    return res.rows[0] || null;
  }
  return sqliteDb.prepare(sql).get(...params) || null;
}

async function all(sql, params = []) {
  if (isPg) {
    const p = toPgParams(sql, params);
    const res = await pool.query(p.sql, p.params);
    return res.rows;
  }
  return sqliteDb.prepare(sql).all(...params);
}

async function run(sql, params = []) {
  if (isPg) {
    const p = toPgParams(sql, params);
    const res = await pool.query(p.sql, p.params);
    return { changes: res.rowCount, lastInsertRowid: res.rows[0]?.id || null };
  }
  const info = sqliteDb.prepare(sql).run(...params);
  return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
}

async function runReturning(sql, params = []) {
  if (isPg) {
    const p = toPgParams(sql, params);
    const res = await pool.query(p.sql + ' RETURNING *', p.params);
    return res.rows[0];
  }
  const info = sqliteDb.prepare(sql).run(...params);
  return sqliteDb.prepare('SELECT * FROM ' + getTableName(sql) + ' WHERE rowid = ?').get(info.lastInsertRowid);
}

function getTableName(sql) {
  const m = sql.match(/INTO\s+(\w+)/i);
  return m ? m[1] : '';
}

async function transaction(fn) {
  if (isPg) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn({
        query: async (sql, params = []) => {
          const p = toPgParams(sql, params);
          return client.query(p.sql, p.params);
        },
        get: async (sql, params = []) => {
          const p = toPgParams(sql, params);
          const res = await client.query(p.sql, p.params);
          return res.rows[0] || null;
        },
        all: async (sql, params = []) => {
          const p = toPgParams(sql, params);
          const res = await client.query(p.sql, p.params);
          return res.rows;
        },
        run: async (sql, params = []) => {
          const p = toPgParams(sql, params);
          const res = await client.query(p.sql, p.params);
          return { changes: res.rowCount, lastInsertRowid: res.rows[0]?.id || null };
        }
      });
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  return sqliteDb.transaction(() => fn({
    query: (sql, params = []) => ({ rows: sqliteDb.prepare(sql).all(...params) }),
    get: (sql, params = []) => sqliteDb.prepare(sql).get(...params) || null,
    all: (sql, params = []) => sqliteDb.prepare(sql).all(...params),
    run: (sql, params = []) => {
      const info = sqliteDb.prepare(sql).run(...params);
      return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
    }
  }))();
}

module.exports = { db: { query, get, all, run, runReturning, transaction }, initDB, isPg };
