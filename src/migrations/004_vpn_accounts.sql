CREATE TABLE IF NOT EXISTS vpn_accounts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_id  INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  protocol   TEXT NOT NULL,
  username   TEXT NOT NULL,
  uuid       TEXT,
  password   TEXT,
  kuota_gb   INTEGER NOT NULL,
  limit_ip   INTEGER NOT NULL,
  expired_at TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active',
  raw_config TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(server_id, protocol, username)
);

CREATE INDEX IF NOT EXISTS idx_vpn_accounts_user ON vpn_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_vpn_accounts_server ON vpn_accounts(server_id);

CREATE TABLE IF NOT EXISTS transactions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  detail     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);