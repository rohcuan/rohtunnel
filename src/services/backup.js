"use strict";

const fs = require("fs");
const path = require("path");
const telegram = require("./telegram");

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

async function createBackupFile(db) {
  const name = `rohtunnel-${stamp()}.db`;
  const filePath = path.join(backupDir(), name);
  await db.backup(filePath);
  return { name, filePath };
}

function listBackups() {
  const dir = backupDir();
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".db"))
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

module.exports = { backupDir, createBackupFile, listBackups, runBackup, stamp };