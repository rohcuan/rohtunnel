"use strict";

const fs = require("fs");
const path = require("path");
const zip = require("./zip");

const DATA_DIR = path.dirname(
  process.env.DB_PATH || path.join(__dirname, "..", "data", "rohtunnel.db")
);
const FORMAT = "rohtunnel-backup";
const SUPPORTED_VERSION = 1;
const SKIP_TABLES = new Set([
  "login_sessions",
  "schema_migrations",
  "sqlite_sequence",
]);

function tableNameSafe(t) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(t) ? t : null;
}

function parseCell(v) {
  if (
    v &&
    typeof v === "object" &&
    Object.prototype.hasOwnProperty.call(v, "$blob")
  ) {
    return Buffer.from(String(v.$blob), "base64");
  }
  return v;
}

function readManifest(entries) {
  const raw = entries.get("manifest.json");
  if (!raw) throw new Error("manifest.json tidak ditemukan di dalam zip");
  let manifest;
  try {
    manifest = JSON.parse(raw.toString("utf8"));
  } catch (e) {
    throw new Error("manifest.json rusak");
  }
  if (manifest.format !== FORMAT)
    throw new Error("bukan backup rohtunnel-backup");
  if (manifest.version !== SUPPORTED_VERSION)
    throw new Error(`versi format backup tak didukung: ${manifest.version}`);
  if (!Array.isArray(manifest.tables))
    throw new Error("manifest tidak memuat daftar tabel");
  return manifest;
}

function validate(buffer) {
  const entries = zip.readZip(buffer);
  return readManifest(entries);
}

function buildInsertOrder(names, childMap) {
  const visited = new Set();
  const out = [];
  const visit = (t) => {
    if (visited.has(t)) return;
    visited.add(t);
    for (const p of childMap[t] || []) {
      if (names.includes(p)) visit(p);
    }
    out.push(t);
  };
  for (const n of names) visit(n);
  return out;
}

function importFromZip(db, buffer) {
  const entries = zip.readZip(buffer);
  const manifest = readManifest(entries);

  const live = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name);
  const targets = manifest.tables.filter(
    (t) => tableNameSafe(t) && live.includes(t) && !SKIP_TABLES.has(t)
  );

  const childMap = {};
  for (const t of targets) {
    childMap[t] = db
      .prepare(`PRAGMA foreign_key_list(${t})`)
      .all()
      .map((r) => r.table);
  }
  const insertOrder = buildInsertOrder(targets, childMap);
  const deleteOrder = insertOrder.slice().reverse();

  const trans = db.transaction(() => {
    for (const t of deleteOrder) db.exec(`DELETE FROM main.${t}`);

    for (const t of insertOrder) {
      const raw = entries.get(`data/${t}.json`);
      if (!raw) continue;
      let rows;
      try {
        rows = JSON.parse(raw.toString("utf8"));
      } catch (e) {
        throw new Error(`data/${t}.json rusak`);
      }
      if (!Array.isArray(rows)) throw new Error(`data/${t}.json bukan array`);

      const cols = db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
      const keys = [];
      const seen = new Set();
      for (const r of rows) {
        for (const k of Object.keys(r)) {
          if (cols.includes(k) && !seen.has(k)) {
            seen.add(k);
            keys.push(k);
          }
        }
      }
      const stmt = keys.length
        ? db.prepare(
            `INSERT INTO ${t} (${keys.map((k) => `"${k}"`).join(",")}) ` +
              `VALUES (${keys.map(() => "?").join(",")})`
          )
        : null;
      for (const r of rows) {
        if (stmt) stmt.run(keys.map((k) => parseCell(r[k])));
      }

      if (keys.includes("id")) {
        try {
          db.prepare("DELETE FROM sqlite_sequence WHERE name=?").run(t);
          const m = db.prepare(`SELECT MAX(id) AS m FROM ${t}`).get();
          if (m && m.m != null) {
            db.prepare("INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)").run(t, m.m);
          }
        } catch (e) {
          /* abaikan */
        }
      }
    }

    const fk = db.prepare("PRAGMA foreign_key_check").all();
    if (fk.length) throw new Error(`pelanggaran foreign key: ${JSON.stringify(fk[0])}`);
  });
  trans();

  for (const [name, data] of entries) {
    if (!name.startsWith("files/")) continue;
    const rel = name.slice("files/".length);
    const target = path.join(DATA_DIR, rel);
    if (!target.startsWith(DATA_DIR)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
    if (rel.startsWith("assets/")) {
      console.log(`[restore] aset ditulis: ${rel}`);
    }
  }

  console.log(
    `[restore] ${targets.length} tabel dipulihkan dari zip (backup ${manifest.appVersion || "?"})`
  );
  return { tableCount: targets.length, manifest };
}

module.exports = {
  validate,
  importFromZip,
  readManifest,
  DATA_DIR,
  FORMAT,
  SUPPORTED_VERSION,
};