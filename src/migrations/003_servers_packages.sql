CREATE TABLE IF NOT EXISTS servers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  endpoint   TEXT NOT NULL,
  api_key    TEXT NOT NULL,
  country    TEXT NOT NULL DEFAULT 'id',
  limit_vpn  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS packages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id  INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  protocol   TEXT NOT NULL,
  name       TEXT NOT NULL,
  price      INTEGER NOT NULL,
  kuota_gb   INTEGER NOT NULL,
  limit_ip   INTEGER NOT NULL,
  days       INTEGER NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_packages_server ON packages(server_id);