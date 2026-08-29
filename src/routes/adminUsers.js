"use strict";

const express = require("express");
const { requireAdmin } = require("../middleware/admin");
const notifier = require("../services/notifier");

const PROTOCOLS = ["ssh", "vmess", "vless", "trojan"];

module.exports = (db) => {
  const router = express.Router();

  const listUsers = db.prepare(`
    SELECT u.*,
      (SELECT COUNT(*) FROM vpn_accounts a WHERE a.user_id = u.id AND a.status != 'deleted') AS account_count
    FROM users u
    WHERE u.is_admin = 0
    ORDER BY u.id
  `);
  const getUser = db.prepare(
    "SELECT * FROM users WHERE id = ? AND is_admin = 0"
  );
  const listUserAccounts = db.prepare(`
    SELECT a.*, s.label AS server_name, s.country AS server_country
    FROM vpn_accounts a JOIN servers s ON s.id = a.server_id
    WHERE a.user_id = ? AND a.status != 'deleted'
      AND (? = '' OR a.protocol = ?)
    ORDER BY a.id DESC
  `);
  const accountsOf = (userId, protocol) =>
    listUserAccounts.all(userId, protocol, protocol);
  const listUserTransactions = db.prepare(
    "SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 20"
  );

  router.get("/admin/users", requireAdmin, (req, res) => {
    res.render("admin/users", {
      title: "User Manager",
      user: req.user,
      users: listUsers.all(),
    });
  });

  router.get("/admin/users/:id", requireAdmin, (req, res) => {
    const target = getUser.get(req.params.id);
    if (!target) return res.status(404).render("404", { title: "Tidak ditemukan" });

    const protocol = PROTOCOLS.includes(req.query.protocol)
      ? req.query.protocol
      : "";

    res.render("admin/user-detail", {
      title: `User: ${target.username}`,
      user: req.user,
      target,
      protocol,
      protocols: PROTOCOLS,
      accounts: accountsOf(target.id, protocol),
      transactions: listUserTransactions.all(target.id),
      msg: req.query.msg || null,
      error: req.query.error || null,
    });
  });

  const adjustSaldo = (req, res, kind) => {
    const target = getUser.get(req.params.id);
    if (!target) return res.status(404).render("404", { title: "Tidak ditemukan" });

    const back = `/admin/users/${target.id}`;
    const renderError = (error) =>
      res.status(400).render("admin/user-detail", {
        title: `User: ${target.username}`,
        user: req.user,
        target: getUser.get(target.id),
        protocol: "",
        protocols: PROTOCOLS,
        accounts: accountsOf(target.id, ""),
        transactions: listUserTransactions.all(target.id),
        msg: null,
        error,
      });

    let amount, saldoBaru;
    if (kind === "set") {
      amount = parseInt(req.body.saldo, 10);
      if (!Number.isInteger(amount) || amount < 0) {
        return renderError("Set saldo harus angka >= 0");
      }
      saldoBaru = amount;
    } else {
      amount = parseInt(req.body.amount, 10);
      if (!Number.isInteger(amount) || amount < 1000) {
        return renderError("Nominal minimal 1.000 rupiah");
      }
      if (kind === "topup") saldoBaru = target.saldo + amount;
      else {
        if (amount > target.saldo) {
          return renderError("Nominal kurangi melebihi saldo user");
        }
        saldoBaru = target.saldo - amount;
      }
    }

    const delta = kind === "set" ? saldoBaru - target.saldo : (kind === "topup" ? amount : -amount);

    db.transaction(() => {
      db.prepare("UPDATE users SET saldo = ? WHERE id = ?").run(saldoBaru, target.id);
      db.prepare(
        "INSERT INTO transactions (user_id, type, amount, detail) VALUES (?, 'adjust', ?, ?)"
      ).run(
        target.id,
        delta,
        `${kind === "topup" ? "Topup" : kind === "kurangi" ? "Kurangi" : "Set"} saldo oleh admin`
      );
    })();

    notifier
      .adjustSaldo(
        target,
        delta,
        saldoBaru,
        kind === "topup" ? "di-topup admin" : kind === "kurangi" ? "dikurangi admin" : "diset admin"
      )
      .catch(() => {});

    res.redirect(back + "?msg=" + encodeURIComponent(`Saldo ${target.username} sekarang ${saldoBaru.toLocaleString("id-ID")}`));
  };

  router.post("/admin/users/:id/topup", requireAdmin, (req, res) => {
    adjustSaldo(req, res, "topup");
  });
  router.post("/admin/users/:id/kurangi", requireAdmin, (req, res) => {
    adjustSaldo(req, res, "kurangi");
  });
  router.post("/admin/users/:id/set", requireAdmin, (req, res) => {
    adjustSaldo(req, res, "set");
  });

  return router;
};