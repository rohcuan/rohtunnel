"use strict";

const express = require("express");
const { requireAdmin } = require("../middleware/admin");

const PROTOCOLS = ["ssh", "vmess", "vless", "trojan"];
const STATUSES = ["active", "locked", "admin_locked", "deleted"];

module.exports = (db) => {
  const router = express.Router();

  const listServers = db.prepare("SELECT * FROM servers ORDER BY id");

  router.get("/admin/akun", requireAdmin, (req, res) => {
    const q = (req.query.q || "").trim();
    const protocol = PROTOCOLS.includes(req.query.protocol) ? req.query.protocol : "";
    const serverId = parseInt(req.query.server_id, 10) || 0;
    const status = STATUSES.includes(req.query.status) ? req.query.status : "";

    const clauses = [];
    const params = [];
    if (q) {
      clauses.push("(a.username LIKE ? OR u.username LIKE ?)");
      params.push(`%${q}%`, `%${q}%`);
    }
    if (protocol) {
      clauses.push("a.protocol = ?");
      params.push(protocol);
    }
    if (serverId) {
      clauses.push("a.server_id = ?");
      params.push(serverId);
    }
    if (status) {
      clauses.push("a.status = ?");
      params.push(status);
    }
    const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";

    const accounts = db
      .prepare(
        `SELECT a.*, s.label AS server_name, s.country AS server_country, u.username AS owner_name
         FROM vpn_accounts a
         JOIN servers s ON s.id = a.server_id
         JOIN users u ON u.id = a.user_id
         ${where}
         ORDER BY a.id DESC
         LIMIT 200`
      )
      .all(...params);

    res.render("admin/akun", {
      title: "Manager Akun VPN",
      user: req.user,
      accounts,
      servers: listServers.all(),
      filters: { q, protocol, serverId, status },
      protocols: PROTOCOLS,
      statuses: STATUSES,
      msg: req.query.msg || null,
      error: req.query.error || null,
    });
  });

  return router;
};