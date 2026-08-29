"use strict";

const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const { requireAdmin } = require("../middleware/admin");
const { getSetting, setSetting } = require("../config");
const { DB_PATH } = require("../db");
const telegram = require("../services/telegram");
const backup = require("../services/backup");

const DATA_DIR = path.dirname(DB_PATH);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

module.exports = (db) => {
  const router = express.Router();

  const listTemplates = db.prepare(
    "SELECT * FROM config_templates ORDER BY id"
  );
  const getTemplate = db.prepare("SELECT * FROM config_templates WHERE id = ?");

  // ============ Hub ============
  router.get("/admin/setup", requireAdmin, (req, res) => {
    res.render("admin/setup", { title: "Setup", user: req.user });
  });

  // ============ Telegram ============
  router.get("/admin/setup-telegram", requireAdmin, (req, res) => {
    res.render("admin/setup-telegram", {
      title: "Setup Telegram Bot",
      user: req.user,
      botToken: getSetting("telegram_bot_token"),
      chatId: getSetting("telegram_chat_id"),
      testResult: null,
    });
  });

  router.post("/admin/setup-telegram", requireAdmin, (req, res) => {
    setSetting("telegram_bot_token", (req.body.bot_token || "").trim());
    setSetting("telegram_chat_id", (req.body.chat_id || "").trim());
    res.redirect("/admin/setup-telegram?msg=" + encodeURIComponent("Tersimpan"));
  });

  router.post("/admin/test-telegram", requireAdmin, async (req, res) => {
    setSetting("telegram_bot_token", (req.body.bot_token || "").trim());
    setSetting("telegram_chat_id", (req.body.chat_id || "").trim());
    const ok = await telegram.sendMessage("[RohTunnel] Test notifikasi OK");
    res.render("admin/setup-telegram", {
      title: "Setup Telegram Bot",
      user: req.user,
      botToken: getSetting("telegram_bot_token"),
      chatId: getSetting("telegram_chat_id"),
      testResult: ok
        ? { ok: true, message: "Test terkirim ke Telegram" }
        : { ok: false, message: "Gagal mengirim (cek token & chat id)" },
    });
  });

  // ============ Notifikasi ============
  router.get("/admin/setup-notif", requireAdmin, (req, res) => {
    res.render("admin/setup-notif", {
      title: "Setup Notifikasi",
      user: req.user,
      notif: {
        topup: getSetting("notif_topup") === "1",
        adjust: getSetting("notif_adjust") === "1",
        purchase: getSetting("notif_purchase") === "1",
      },
      botConfigured: !!getSetting("telegram_bot_token"),
      msg: req.query.msg || null,
    });
  });

  router.post("/admin/setup-notif", requireAdmin, (req, res) => {
    setSetting("notif_topup", req.body.notif_topup ? "1" : "0");
    setSetting("notif_adjust", req.body.notif_adjust ? "1" : "0");
    setSetting("notif_purchase", req.body.notif_purchase ? "1" : "0");
    res.redirect(
      "/admin/setup-notif?msg=" + encodeURIComponent("Preferensi notifikasi tersimpan")
    );
  });

  // ============ Autobackup ============
  router.get("/admin/setup-backup", requireAdmin, (req, res) => {
    const rows = db.prepare("SELECT * FROM backup_settings").all();
    const parsed = {};
    for (const r of rows) {
      const parts = (r.value || "").split(":");
      parsed[r.type] = {
        active: !!r.active,
        hour: parts[parts.length - 2] || "00",
        minute: parts[parts.length - 1] || "00",
        day: parts.length === 3 ? parts[0] : "",
      };
    }
    res.render("admin/setup-backup", {
      title: "Setup Autobackup",
      user: req.user,
      parsed,
      backups: backup.listBackups(),
      msg: req.query.msg || null,
      error: req.query.error || null,
    });
  });

  const saveSchedule = (req, res, type) => {
    const active = req.body.active ? 1 : 0;
    const hour = (req.body[`${type}_hour`] || "00").padStart(2, "0");
    const minute = (req.body[`${type}_minute`] || "00").padStart(2, "0");
    let value;
    if (type === "daily") value = `${hour}:${minute}`;
    else {
      const day = req.body[`${type}_day`];
      value = `${day}:${hour}:${minute}`;
    }
    db.prepare(
      "UPDATE backup_settings SET value = ?, active = ? WHERE type = ?"
    ).run(value, active, type);
    res.redirect(
      "/admin/setup-backup?msg=" +
        encodeURIComponent(`Jadwal ${type} ${active ? "diaktifkan" : "dinonaktifkan"}`)
    );
  };

  router.post("/admin/setup-backup/daily", requireAdmin, (req, res) =>
    saveSchedule(req, res, "daily")
  );
  router.post("/admin/setup-backup/weekly", requireAdmin, (req, res) =>
    saveSchedule(req, res, "weekly")
  );
  router.post("/admin/setup-backup/monthly", requireAdmin, (req, res) =>
    saveSchedule(req, res, "monthly")
  );

  router.post("/admin/backup/run", requireAdmin, async (req, res) => {
    try {
      const result = await backup.runBackup(db);
      res.redirect(
        "/admin/setup-backup?msg=" +
          encodeURIComponent(
            `Backup dibuat: ${result.name}` +
              (result.sentToTelegram ? " (terkirim ke Telegram)" : "")
          )
      );
    } catch (e) {
      res.redirect(
        "/admin/setup-backup?error=" + encodeURIComponent(`Backup gagal: ${e.message}`)
      );
    }
  });

  // ============ Restore ============
  router.get("/admin/restore", requireAdmin, (req, res) => {
    res.render("admin/restore", {
      title: "Restore Backup",
      user: req.user,
      backups: backup.listBackups(),
      msg: req.query.msg || null,
      error: req.query.error || null,
    });
  });

  router.post("/admin/restore", requireAdmin, upload.single("backup_file"), (req, res) => {
    if (!req.file) {
      return res.redirect("/admin/restore?error=" + encodeURIComponent("Pilih file backup .db"));
    }
    fs.writeFileSync(path.join(DATA_DIR, "restore-pending.db"), req.file.buffer);
    fs.writeFileSync(path.join(DATA_DIR, ".restore-pending"), new Date().toISOString());
    res.redirect(
      "/admin/restore?msg=" +
        encodeURIComponent(
          "File diterima. Database akan dipulihkan otomatis saat container restart berikutnya."
        )
    );
  });

  // ============ Template Config ============
  router.get("/admin/setup-templates", requireAdmin, (req, res) => {
    const editing = req.query.id ? getTemplate.get(req.query.id) : null;
    res.render("admin/setup-templates", {
      title: "Setup Config Siap Pakai",
      user: req.user,
      templates: listTemplates.all(),
      editing,
      error: req.query.error || null,
    });
  });

  router.post("/admin/setup-templates/save", requireAdmin, (req, res) => {
    const id = parseInt(req.body.id, 10) || null;
    const name = (req.body.name || "").trim();
    let fields;
    try {
      fields = JSON.parse(req.body.fields || "[]");
      if (!Array.isArray(fields)) throw new Error("bukan array");
    } catch {
      return res.redirect(
        `/admin/setup-templates${id ? "?id=" + id : ""}` +
          "&error=" +
          encodeURIComponent("Fields harus JSON array, contoh: [{\"label\":\"A\",\"tpl\":\"{{username}}\"}]")
      );
    }

    if (!name) {
      return res.redirect(
        `/admin/setup-templates${id ? "?id=" + id : ""}` +
          "&error=" +
          encodeURIComponent("Nama template wajib diisi")
      );
    }

    if (id) {
      db.prepare("UPDATE config_templates SET name = ?, fields = ? WHERE id = ?").run(
        name,
        JSON.stringify(fields),
        id
      );
    } else {
      db.prepare("INSERT INTO config_templates (name, fields) VALUES (?, ?)").run(
        name,
        JSON.stringify(fields)
      );
    }
    res.redirect("/admin/setup-templates?msg=" + encodeURIComponent("Template tersimpan"));
  });

  router.post("/admin/setup-templates/delete", requireAdmin, (req, res) => {
    db.prepare("DELETE FROM config_templates WHERE id = ?").run(req.body.id);
    res.redirect("/admin/setup-templates");
  });

  return router;
};