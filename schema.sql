-- NextAuth.js required tables for D1
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  providerAccountId TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  sessionToken TEXT NOT NULL UNIQUE,
  userId TEXT NOT NULL,
  expires TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  email TEXT UNIQUE,
  emailVerified TEXT,
  image TEXT
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires TEXT NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- MCP Server configs per user
CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  authType TEXT DEFAULT 'none',
  authConfig TEXT, -- JSON stored as text
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mcp_servers_userId ON mcp_servers(userId);
