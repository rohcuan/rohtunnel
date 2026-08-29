"use strict";

const express = require("express");
const crypto = require("crypto");
const { requireUser } = require("../middleware/auth");
const vpnApi = require("../services/vpnApi");
const notifier = require("../services/notifier");

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;

module.exports = (db) => {
  const router = express.Router();

  const listRecoverable = db.prepare(
    `SELECT a.*, s.label AS server_name, s.country AS server_country
     FROM vpn_accounts a JOIN servers s ON s.id = a.server_id
     WHERE a.user_id = ? AND (a.status = 'deleted' OR a.expired_at < ?)
     ORDER BY a.id DESC`
  );
  const getRecoverable = db.prepare(
    `SELECT a.*, s.label AS server_name, s.country AS server_country
     FROM vpn_accounts a JOIN servers s ON s.id = a.server_id
     WHERE a.id = ? AND a.user_id = ?
       AND (a.status = 'deleted' OR a.expired_at < ?)`
  );
  const getServer = db.prepare("SELECT * FROM servers WHERE id = ?");
  const getUserSaldo = db.prepare("SELECT saldo FROM users WHERE id = ?");

  const randomPassword = () => crypto.randomBytes(8).toString("base64url");

  router.get("/recovery", requireUser, (req, res) => {
    res.render("recovery", {
      title: "Recovery Akun",
      user: req.user,
      accounts: listRecoverable.all(req.user.id, new Date().toISOString()),
    });
  });

  router.get("/recovery/:id", requireUser, (req, res) => {
    const account = getRecoverable.get(
      req.params.id,
      req.user.id,
      new Date().toISOString()
    );
    if (!account) return res.status(404).render("404", { title: "Tidak ditemukan" });
    res.render("recovery-form", {
      title: "Recovery Akun",
      user: req.user,
      account,
      error: null,
      values: {
        username: account.username,
        kuota_gb: account.kuota_gb,
        limit_ip: account.limit_ip,
      },
    });
  });

  router.post("/recovery/:id", requireUser, async (req, res) => {
    const account = getRecoverable.get(
      req.params.id,
      req.user.id,
      new Date().toISOString()
    );
    if (!account) return res.status(404).render("404", { title: "Tidak ditemukan" });

    const server = getServer.get(account.server_id);
    const values = {
      username: (req.body.username || account.username).trim(),
      kuota_gb: parseInt(req.body.kuota_gb, 10),
      limit_ip: parseInt(req.body.limit_ip, 10),
    };

    const renderError = (error, status = 400) =>
      res.status(status).render("recovery-form", {
        title: "Recovery Akun",
        user: req.user,
        account,
        error,
        values,
      });

    if (!server) return renderError("Server akun sudah tidak ada");

    const price = account.price;
    if (!Number.isInteger(price) || price <= 0) {
      return renderError("Harga akun tidak diketahui, hubungi admin");
    }
    if (!USERNAME_RE.test(values.username)) {
      return renderError("Username 3-20 karakter (huruf, angka, _ atau -)");
    }
    if (
      !Number.isInteger(values.kuota_gb) ||
      values.kuota_gb < 1 ||
      values.kuota_gb > 10000
    ) {
      return renderError("Kuota harus 1 - 10.000 GB");
    }
    if (
      !Number.isInteger(values.limit_ip) ||
      values.limit_ip < 1 ||
      values.limit_ip > 100
    ) {
      return renderError("Limit IP harus 1 - 100");
    }

    const saldo = getUserSaldo.get(req.user.id).saldo;
    if (saldo < price) {
      return renderError(
        `Saldo tidak cukup. Butuh ${price.toLocaleString("id-ID")} rupiah, saldo Anda ${saldo.toLocaleString("id-ID")}`
      );
    }

    const usernameTaken = db
      .prepare(
        `SELECT COUNT(*) AS c FROM vpn_accounts
         WHERE server_id = ? AND protocol = ? AND username = ? AND id != ?`
      )
      .get(server.id, account.protocol, values.username, account.id).c;
    if (usernameTaken > 0) {
      return renderError(
        "Username sudah dipakai oleh akun lain (aktif/dihapus). Pilih username lain."
      );
    }

    const password =
      account.protocol === "ssh" ? randomPassword() : null;
    const expiredAt = new Date(
      Date.now() + (account.days || 30) * 86400000
    ).toISOString();

    let rawConfig = null;
    try {
      const createRes = await vpnApi.createAccount(server, account.protocol, {
        username: values.username,
        password,
        kuota: values.kuota_gb,
        expired: account.days || 30,
        limitip: values.limit_ip,
        uuid: undefined,
      });
      rawConfig = JSON.stringify(createRes);
      try {
        const cfg = await vpnApi.checkConfig(
          server,
          account.protocol,
          values.username
        );
        rawConfig = JSON.stringify(cfg);
      } catch (e) {
        console.log(
          `[recovery] checkconfig gagal untuk ${values.username}: ${e.message}`
        );
      }
    } catch (e) {
      return renderError(
        `Gagal membuat akun di server: ${e.message}. Jika username sudah dipakai di server, gunakan username lain.`,
        502
      );
    }

    const finalize = db.transaction(() => {
      db.prepare(
        `UPDATE vpn_accounts SET
           status = 'active', deleted_at = NULL,
           username = ?, uuid = NULL, password = ?,
           kuota_gb = ?, limit_ip = ?, expired_at = ?, raw_config = ?
         WHERE id = ?`
      ).run(
        values.username,
        password,
        values.kuota_gb,
        values.limit_ip,
        expiredAt,
        rawConfig,
        account.id
      );

      db.prepare("UPDATE users SET saldo = saldo - ? WHERE id = ?").run(
        price,
        req.user.id
      );
      db.prepare(
        "INSERT INTO transactions (user_id, type, amount, detail) VALUES (?, 'recovery', ?, ?)"
      ).run(
        req.user.id,
        -price,
        `recovery ${account.protocol} ${values.username} (dari ${account.username})`
      );
    });

    finalize();
    req.user.saldo = getUserSaldo.get(req.user.id).saldo;
    notifier
      .purchase(
        { username: req.user.username },
        "recovery akun",
        `${account.protocol} ${values.username}`,
        price
      )
      .catch(() => {});
    res.redirect("/akun?msg=" + encodeURIComponent("Akun berhasil di-recovery"));
  });

  return router;
};