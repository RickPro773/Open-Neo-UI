import { Database } from "bun:sqlite"
import { mkdirSync } from "fs"

const PATH = process.env["DB_PATH"] ?? "./data/neo.db"
mkdirSync(PATH.replace(/\/[^/]+$/, ""), { recursive: true })

export const db = new Database(PATH, { create: true })
db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL;")

db.exec(`
  CREATE TABLE IF NOT EXISTS users(
    id          TEXT PRIMARY KEY,
    provider    TEXT NOT NULL DEFAULT 'email',
    provider_id TEXT NOT NULL,
    username    TEXT NOT NULL,
    email       TEXT,
    avatar      TEXT,
    password_hash TEXT,
    email_verified INTEGER DEFAULT 0,
    role        TEXT NOT NULL DEFAULT 'user',
    created_at  INTEGER DEFAULT(unixepoch()),
    last_login  INTEGER DEFAULT(unixepoch()),
    UNIQUE(provider, provider_id)
  );
  CREATE TABLE IF NOT EXISTS email_verifications(
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT UNIQUE NOT NULL,
    expires_at INTEGER NOT NULL,
    used       INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS password_resets(
    id         TEXT PRIMARY KEY,
    email      TEXT NOT NULL,
    token      TEXT UNIQUE NOT NULL,
    expires_at INTEGER NOT NULL,
    used       INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS api_keys(
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL, provider TEXT NOT NULL, key_value TEXT NOT NULL,
    base_url TEXT, model_default TEXT, is_active INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT(unixepoch()));
  CREATE TABLE IF NOT EXISTS conversations(
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Nova conversa', model TEXT NOT NULL, provider TEXT NOT NULL,
    created_at INTEGER DEFAULT(unixepoch()), updated_at INTEGER DEFAULT(unixepoch()));
  CREATE TABLE IF NOT EXISTS messages(
    id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL, content TEXT NOT NULL, tokens INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT(unixepoch()));
  CREATE TABLE IF NOT EXISTS usage_stats(
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, model TEXT NOT NULL,
    tokens_in INTEGER DEFAULT 0, tokens_out INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT(unixepoch()));
  CREATE TABLE IF NOT EXISTS remote_tokens(
    id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, label TEXT NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id),
    is_active INTEGER DEFAULT 1, last_used INTEGER, requests INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT(unixepoch()));
  CREATE INDEX IF NOT EXISTS idx_msgs   ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_convs  ON conversations(user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_keys   ON api_keys(user_id);
  CREATE INDEX IF NOT EXISTS idx_ev     ON email_verifications(token);
  CREATE INDEX IF NOT EXISTS idx_pr     ON password_resets(token);
`)

export const q = {
  upsertUser:      db.prepare(`INSERT INTO users(id,provider,provider_id,username,email,avatar,role) VALUES(?,?,?,?,?,?,?) ON CONFLICT(provider,provider_id) DO UPDATE SET username=excluded.username,email=excluded.email,avatar=excluded.avatar,last_login=unixepoch() RETURNING *`),
  getUserById:     db.prepare(`SELECT * FROM users WHERE id=?`),
  getUserByEmail:  db.prepare(`SELECT * FROM users WHERE email=? AND provider='email' LIMIT 1`),
  countUsers:      db.prepare(`SELECT COUNT(*) as n FROM users`),
  createEmailUser: db.prepare(`INSERT INTO users(id,provider,provider_id,username,email,password_hash,email_verified,role) VALUES(?,?,?,?,?,?,?,?)`),
  updatePassword:  db.prepare(`UPDATE users SET password_hash=? WHERE id=?`),
  verifyEmail:     db.prepare(`UPDATE users SET email_verified=1 WHERE id=?`),
  updateLogin:     db.prepare(`UPDATE users SET last_login=unixepoch() WHERE id=?`),

  // email verification tokens
  insertVerifToken: db.prepare(`INSERT INTO email_verifications(id,user_id,token,expires_at) VALUES(?,?,?,?)`),
  getVerifToken:    db.prepare(`SELECT * FROM email_verifications WHERE token=? AND used=0 AND expires_at>unixepoch() LIMIT 1`),
  useVerifToken:    db.prepare(`UPDATE email_verifications SET used=1 WHERE id=?`),

  // password reset tokens
  insertResetToken: db.prepare(`INSERT INTO password_resets(id,email,token,expires_at) VALUES(?,?,?,?)`),
  getResetToken:    db.prepare(`SELECT * FROM password_resets WHERE token=? AND used=0 AND expires_at>unixepoch() LIMIT 1`),
  useResetToken:    db.prepare(`UPDATE password_resets SET used=1 WHERE id=?`),

  getKeys:      db.prepare(`SELECT * FROM api_keys WHERE user_id=? ORDER BY created_at DESC`),
  getActiveKey: db.prepare(`SELECT * FROM api_keys WHERE user_id=? AND provider=? AND is_active=1 LIMIT 1`),
  getKeyById:   db.prepare(`SELECT * FROM api_keys WHERE id=? AND user_id=?`),
  insertKey:    db.prepare(`INSERT INTO api_keys(id,user_id,name,provider,key_value,base_url,model_default) VALUES(?,?,?,?,?,?,?)`),
  deleteKey:    db.prepare(`DELETE FROM api_keys WHERE id=? AND user_id=?`),
  toggleKey:    db.prepare(`UPDATE api_keys SET is_active=? WHERE id=? AND user_id=?`),
  getConvs:     db.prepare(`SELECT * FROM conversations WHERE user_id=? ORDER BY updated_at DESC`),
  getConv:      db.prepare(`SELECT * FROM conversations WHERE id=? AND user_id=?`),
  insertConv:   db.prepare(`INSERT INTO conversations(id,user_id,title,model,provider) VALUES(?,?,?,?,?)`),
  touchConv:    db.prepare(`UPDATE conversations SET updated_at=unixepoch() WHERE id=?`),
  deleteConv:   db.prepare(`DELETE FROM conversations WHERE id=? AND user_id=?`),
  getMessages:  db.prepare(`SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at ASC`),
  insertMsg:    db.prepare(`INSERT INTO messages(id,conversation_id,role,content,tokens) VALUES(?,?,?,?,?)`),
  insertStat:   db.prepare(`INSERT INTO usage_stats(id,user_id,provider,model,tokens_in,tokens_out) VALUES(?,?,?,?,?,?)`),
  getStats:     db.prepare(`SELECT provider,model,SUM(tokens_in) tin,SUM(tokens_out) tout,COUNT(*) reqs FROM usage_stats WHERE user_id=? GROUP BY provider,model ORDER BY tout DESC`),
  insertToken:  db.prepare(`INSERT INTO remote_tokens(id,token_hash,label,created_by) VALUES(?,?,?,?)`),
  getTokens:    db.prepare(`SELECT id,label,is_active,last_used,requests,created_at FROM remote_tokens WHERE created_by=?`),
  allTokens:    db.prepare(`SELECT * FROM remote_tokens WHERE is_active=1`),
  revokeToken:  db.prepare(`UPDATE remote_tokens SET is_active=0 WHERE id=? AND created_by=?`),
  touchToken:   db.prepare(`UPDATE remote_tokens SET last_used=unixepoch(),requests=requests+1 WHERE id=?`),
}

console.log(`[db] ${PATH}`)
