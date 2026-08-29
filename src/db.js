"use strict";

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, "..", "data", "rohtunnel.db");

function applyPendingRestore() {
  const dataDir = path.dirname(DB_PATH);
  const pending = path.join(dataDir, "restore-pending.db");
  const marker = path.join(dataDir, ".restore-pending");

  if (fs.existsSync(marker) && fs.existsSync(pending)) {
    fs.copyFileSync(
      DB_PATH,
      path.join(dataDir, `pre-restore-${Date.now()}.db`)
    );
    fs.rmSync(DB_PATH, { force: true });
    fs.rmSync(DB_PATH + "-wal", { force: true });
    fs.rmSync(DB_PATH + "-shm", { force: true });
    fs.copyFileSync(pending, DB_PATH);
    fs.rmSync(marker);
    fs.rmSync(pending);
    console.log("[restore] DB dipulihkan dari restore-pending.db");
  }
}

function initDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  applyPendingRestore();

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const migrationsDir = path.join(__dirname, "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = new Set(
    db.prepare("SELECT version FROM schema_migrations").all().map((r) => r.version)
  );

  const apply = db.transaction((version, file, sql) => {
    db.exec(sql);
    db.prepare("INSERT INTO schema_migrations (version, name) VALUES (?, ?)").run(
      version,
      file
    );
  });

  for (const file of files) {
    const version = parseInt(file.split("_")[0], 10);
    if (applied.has(version)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    apply(version, file, sql);
    console.log(`[db] migrasi diterapkan: ${file}`);
  }

  return db;
}

module.exports = { initDb, DB_PATH, applyPendingRestore };
