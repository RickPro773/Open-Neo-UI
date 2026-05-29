import { Database } from "bun:sqlite"
import { mkdirSync } from "fs"

const DB_PATH = process.env.DB_PATH ?? "./data/open-neo-ui.db"

// Garante que a pasta existe
mkdirSync(DB_PATH.replace(/\/[^/]+$/, ""), { recursive: true })

export const db = new Database(DB_PATH, { create: true })

// Habilita WAL mode para melhor performance
db.exec("PRAGMA journal_mode = WAL;")
db.exec("PRAGMA foreign_keys = ON;")

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    discord_id    TEXT UNIQUE NOT NULL,
    username      TEXT NOT NULL,
    avatar        TEXT,
    email         TEXT,
    role          TEXT NOT NULL DEFAULT 'user',  -- 'admin' | 'user'
    created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    last_login    INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    provider      TEXT NOT NULL,  -- 'deepseek' | 'openai' | 'anthropic' | 'ollama'
    key_value     TEXT NOT NULL,
    base_url      TEXT,           -- para providers customizados / Ollama
    model_default TEXT,
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title         TEXT NOT NULL DEFAULT 'Nova conversa',
    model         TEXT NOT NULL,
    provider      TEXT NOT NULL,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS messages (
    id            TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role          TEXT NOT NULL,  -- 'user' | 'assistant' | 'system'
    content       TEXT NOT NULL,
    tokens        INTEGER DEFAULT 0,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS usage_stats (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider      TEXT NOT NULL,
    model         TEXT NOT NULL,
    tokens_in     INTEGER NOT NULL DEFAULT 0,
    tokens_out    INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
  CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
  CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_stats(user_id);
`)

console.log(`[db] SQLite iniciado em ${DB_PATH}`)

// ── Queries helpers ───────────────────────────────────────────────────────────
export const queries = {
  // Users
  getUserByDiscordId: db.prepare(`SELECT * FROM users WHERE discord_id = ?`),
  getUserById:        db.prepare(`SELECT * FROM users WHERE id = ?`),
  createUser:         db.prepare(`INSERT INTO users (id, discord_id, username, avatar, email, role) VALUES (?, ?, ?, ?, ?, ?)`),
  updateUserLogin:    db.prepare(`UPDATE users SET last_login = unixepoch(), username = ?, avatar = ? WHERE id = ?`),

  // API Keys
  getKeysByUser:      db.prepare(`SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`),
  getActiveKey:       db.prepare(`SELECT * FROM api_keys WHERE user_id = ? AND provider = ? AND is_active = 1 LIMIT 1`),
  getKeyById:         db.prepare(`SELECT * FROM api_keys WHERE id = ? AND user_id = ?`),
  createKey:          db.prepare(`INSERT INTO api_keys (id, user_id, name, provider, key_value, base_url, model_default) VALUES (?, ?, ?, ?, ?, ?, ?)`),
  deleteKey:          db.prepare(`DELETE FROM api_keys WHERE id = ? AND user_id = ?`),
  toggleKey:          db.prepare(`UPDATE api_keys SET is_active = ? WHERE id = ? AND user_id = ?`),

  // Conversations
  getConversations:   db.prepare(`SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC`),
  getConversation:    db.prepare(`SELECT * FROM conversations WHERE id = ? AND user_id = ?`),
  createConversation: db.prepare(`INSERT INTO conversations (id, user_id, title, model, provider) VALUES (?, ?, ?, ?, ?)`),
  updateConvTitle:    db.prepare(`UPDATE conversations SET title = ?, updated_at = unixepoch() WHERE id = ?`),
  updateConvTime:     db.prepare(`UPDATE conversations SET updated_at = unixepoch() WHERE id = ?`),
  deleteConversation: db.prepare(`DELETE FROM conversations WHERE id = ? AND user_id = ?`),

  // Messages
  getMessages:        db.prepare(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`),
  createMessage:      db.prepare(`INSERT INTO messages (id, conversation_id, role, content, tokens) VALUES (?, ?, ?, ?, ?)`),

  // Stats
  createStat:         db.prepare(`INSERT INTO usage_stats (id, user_id, provider, model, tokens_in, tokens_out) VALUES (?, ?, ?, ?, ?, ?)`),
  getStatsByUser:     db.prepare(`
    SELECT provider, model,
           SUM(tokens_in) as total_in,
           SUM(tokens_out) as total_out,
           COUNT(*) as requests
    FROM usage_stats WHERE user_id = ?
    GROUP BY provider, model
    ORDER BY total_out DESC
  `),
}
