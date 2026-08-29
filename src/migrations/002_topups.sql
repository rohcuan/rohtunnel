CREATE TABLE IF NOT EXISTS topups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     INTEGER NOT NULL,
  qris_id    TEXT,
  trx_id     TEXT,
  qris_url   TEXT,
  status     TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  paid_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_topups_user ON topups(user_id);
CREATE INDEX IF NOT EXISTS idx_topups_status ON topups(status);