"use strict";

const express = require("express");
const { requireAdmin } = require("../middleware/admin");
const { getSetting, setSetting } = require("../config");
const qris = require("../services/qris");

module.exports = (db) => {
  const router = express.Router();

  router.get("/admin", requireAdmin, (req, res) => {
    const stats = {
      users: db.prepare("SELECT COUNT(*) AS c FROM users WHERE is_admin = 0").get().c,
      servers: db.prepare("SELECT COUNT(*) AS c FROM servers").get().c,
      accounts: db
        .prepare("SELECT COUNT(*) AS c FROM vpn_accounts WHERE status != 'deleted'")
        .get().c,
    };
    res.render("admin/dashboard", { title: "Admin Dashboard", user: req.user, stats });
  });

  router.get("/admin/setup-qris", requireAdmin, (req, res) => {
    res.render("admin/setup-qris", {
      title: "Setup QRIS",
      user: req.user,
      endpoint: getSetting("qris_endpoint"),
      apiKey: getSetting("qris_api_key"),
      testResult: null,
    });
  });

  router.post("/admin/setup-qris", requireAdmin, (req, res) => {
    setSetting("qris_endpoint", (req.body.endpoint || "").trim());
    setSetting("qris_api_key", (req.body.api_key || "").trim());
    res.redirect("/admin/setup-qris");
  });

  router.post("/admin/test-qris", requireAdmin, async (req, res) => {
    let testResult;
    try {
      const json = await qris.tokenStatus();
      testResult = {
        ok: !!(json && json.success),
        message: JSON.stringify(json),
      };
    } catch (e) {
      testResult = { ok: false, message: e.message };
    }
    res.render("admin/setup-qris", {
      title: "Setup QRIS",
      user: req.user,
      endpoint: getSetting("qris_endpoint"),
      apiKey: getSetting("qris_api_key"),
      testResult,
    });
  });

  return router;
};