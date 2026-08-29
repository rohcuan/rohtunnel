"use strict";

const fs = require("fs");
const path = require("path");
const telegram = require("./telegram");
const zip = require("./zip");
const { FORMAT, SUPPORTED_VERSION } = require("./restore");

const DATA_DIR = path.dirname(
  process.env.DB_PATH || path.join(__dirname, "..", "data", "rohtunnel.db")
);

function backupDir() {
  const dir = process.env.BACKUP_DIR || path.join(__dirname, "..", "..", "data", "backup");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function stamp(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}` +
    `-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
  );
}

function appVersion() {
  try {
    return require("../../package.json").version;
  } catch (e) {
    return "0.0.0";
  }
}

function schemaVersion(db) {
  try {
    return (
      db.prepare("SELECT MAX(version) AS m FROM schema_migrations").get().m || 0
    );
  } catch (e) {
    return 0;
  }
}

function walkDir(dir, base, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const rel = path.relative(base, p);
    if (e.isDirectory()) walkDir(p, base, out);
    else out.push(rel);
  }
  return out;
}

function exportZip(db) {
  const entries = new Map();

  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('login_sessions','schema_migrations','sqlite_sequence')"
    )
    .all()
    .map((r) => r.name)
    .sort();
  const manifestTables = [];

  for (const t of tables) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) continue;
    const cols = db.prepare(`PRAGMA table_info(${t})`).all();
    const rows = db.prepare(`SELECT * FROM "${t}"`).all();
    const encoded = rows.map((row) => {
      const o = {};
      for (const c of cols) {
        o[c.name] =
          row[c.name] instanceof Buffer
            ? { $blob: row[c.name].toString("base64") }
            : row[c.name];
      }
      return o;
    });
    entries.set(`data/${t}.json`, Buffer.from(JSON.stringify(encoded)));
    manifestTables.push(t);
  }

  const manifestFiles = [];
  const assetsDir = path.join(DATA_DIR, "assets");
  if (fs.existsSync(assetsDir)) {
    for (const rel of walkDir(assetsDir, assetsDir, [])) {
      entries.set(`files/assets/${rel}`, fs.readFileSync(path.join(assetsDir, rel)));
      manifestFiles.push(`assets/${rel}`);
    }
  }

  const manifest = {
    format: FORMAT,
    version: SUPPORTED_VERSION,
    created: new Date().toISOString(),
    appVersion: appVersion(),
    schemaVersion: schemaVersion(db),
    tables: manifestTables,
    files: manifestFiles,
  };
  entries.set("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2)));

  return zip.writeZip(Array.from(entries, ([name, data]) => ({ name, data })));
}

async function createBackupFile(db) {
  const name = `rohtunnel-${stamp()}.zip`;
  const filePath = path.join(backupDir(), name);
  fs.writeFileSync(filePath, exportZip(db));
  return { name, filePath };
}

function listBackups() {
  const dir = backupDir();
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".zip"))
    .sort()
    .reverse()
    .map((name) => ({
      name,
      filePath: path.join(dir, name),
      size: fs.statSync(path.join(dir, name)).size,
    }));
}

async function runBackup(db) {
  const { name, filePath } = await createBackupFile(db);
  const sent = await telegram.sendDocument(
    filePath,
    name,
    `Backup RohTunnel: ${name}`
  );
  return { name, filePath, sentToTelegram: sent };
}

module.exports = {
  backupDir,
  createBackupFile,
  listBackups,
  runBackup,
  stamp,
  exportZip,
};