"use strict";

const express = require("express");
const { requireUser } = require("../middleware/auth");

module.exports = (db) => {
  const router = express.Router();

  const countAccounts = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active
    FROM vpn_accounts
    WHERE user_id = ? AND status != 'deleted'
  `);

  router.get("/dashboard", requireUser, (req, res) => {
    const stats = countAccounts.get(req.user.id);
    res.render("dashboard", {
      title: "Dashboard",
      user: req.user,
      stats: { total: stats.total || 0, active: stats.active || 0 },
    });
  });

  return router;
};