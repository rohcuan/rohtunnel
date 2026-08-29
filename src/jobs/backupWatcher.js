"use strict";

const backup = require("../services/backup");

const CHECK_INTERVAL_MS = 30000;
let timer = null;

function pad(n) {
  return String(n).padStart(2, "0");
}

function slotKey(type, now) {
  if (type === "daily") {
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
  if (type === "weekly") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    const day = (d.getDay() + 6) % 7; // Senin = 0
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
  }
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

function isDue(type, value, now) {
  if (!value) return false;
  const parts = value.split(":");
  const hour = parseInt(parts[parts.length - 2], 10);
  const minute = parseInt(parts[parts.length - 1], 10);
  if (now.getHours() !== hour || now.getMinutes() !== minute) return false;

  if (type === "weekly") {
    const weekday = parseInt(parts[0], 10); // 0 = Minggu
    return now.getDay() === weekday;
  }
  if (type === "monthly") {
    const day = parseInt(parts[0], 10); // 1-30
    return now.getDate() === day;
  }
  return true;
}

async function checkSchedules(db) {
  const rows = db
    .prepare("SELECT * FROM backup_settings WHERE active = 1")
    .all();
  const now = new Date();

  for (const row of rows) {
    const slot = slotKey(row.type, now);
    if (row.last_slot === slot) continue;
    if (!isDue(row.type, row.value, now)) continue;

    try {
      const result = await backup.runBackup(db);
      db.prepare("UPDATE backup_settings SET last_slot = ? WHERE id = ?").run(
        slot,
        row.id
      );
      console.log(
        `[backup] ${row.type} selesai: ${result.name}` +
          (result.sentToTelegram ? " (terkirim ke Telegram)" : " (Telegram tidak terkirim)")
      );
    } catch (e) {
      console.log(`[backup] ${row.type} gagal: ${e.message}`);
    }
  }
}

function startBackupWatcher(db) {
  if (timer) return timer;
  checkSchedules(db);
  timer = setInterval(() => checkSchedules(db), CHECK_INTERVAL_MS);
  return timer;
}

module.exports = { startBackupWatcher, checkSchedules, isDue, slotKey };