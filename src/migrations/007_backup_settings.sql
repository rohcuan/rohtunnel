CREATE TABLE IF NOT EXISTS backup_settings (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  type      TEXT NOT NULL UNIQUE,
  value     TEXT,
  active    INTEGER NOT NULL DEFAULT 0,
  last_slot TEXT
);

INSERT OR IGNORE INTO backup_settings (type, value, active) VALUES ('daily', '02:00', 0);
INSERT OR IGNORE INTO backup_settings (type, value, active) VALUES ('weekly', '1:02:00', 0);
INSERT OR IGNORE INTO backup_settings (type, value, active) VALUES ('monthly', '1:02:00', 0);