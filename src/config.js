"use strict";

let db = null;

function setDb(instance) {
  db = instance;
}

function getSetting(key, fallback = "") {
  if (!db) return fallback;
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  if (!db) return;
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

module.exports = { setDb, getSetting, setSetting };
