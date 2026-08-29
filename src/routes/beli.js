"use strict";

const express = require("express");
const crypto = require("crypto");
const { requireUser } = require("../middleware/auth");
const vpnApi = require("../services/vpnApi");
const { parseAccountConfig } = require("../services/configBuilder");
const notifier = require("../services/notifier");

const PROTOCOLS = ["ssh", "vmess", "vless", "trojan"];
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = (db) => {
  const router = express.Router();

  const listServers = db.prepare("SELECT * FROM servers ORDER BY country, label");
  const listActivePackages = db.prepare(
    "SELECT * FROM packages WHERE active = 1 ORDER BY id"
  );
  const getPackage = db.prepare(
    "SELECT * FROM packages WHERE id = ? AND active = 1"
  );
  const getServer = db.prepare("SELECT * FROM servers WHERE id = ?");
  const countServerAccounts = db.prepare(
    "SELECT COUNT(*) AS c FROM vpn_accounts WHERE server_id = ?"
  );
  const getAccount = db.prepare(
    "SELECT * FROM vpn_accounts WHERE id = ? AND user_id = ?"
  );

  const randomUsername = () => "u" + crypto.randomBytes(4).toString("hex");
  const randomPassword = () => crypto.randomBytes(8).toString("base64url");

  const renderBeli = (req, res, error, status = 200) =>
    res.status(status).render("beli", {
      title: "Beli VPN",
      user: req.user,
      servers: listServers.all(),
      packages: listActivePackages.all(),
      error,
    });

  router.get("/beli", requireUser, (req, res) => {
    renderBeli(req, res, null);
  });

  router.post("/beli", requireUser, async (req, res) => {
    const serverId = parseInt(req.body.server_id, 10);
    const protocol = (req.body.protocol || "").trim();
    const packageId = parseInt(req.body.package_id, 10);
    const username = (req.body.username || "").trim();
    const uuid = (req.body.uuid || "").trim();

    const server = getServer.get(serverId);
    if (!server) return renderBeli(req, res, "Server tidak valid", 400);

    if (!PROTOCOLS.includes(protocol)) {
      return renderBeli(req, res, "Protocol tidak valid", 400);
    }

    const pkg = getPackage.get(packageId);
    if (!pkg || pkg.server_id !== server.id || pkg.protocol !== protocol) {
      return renderBeli(req, res, "Package tidak valid untuk server/protocol ini", 400);
    }

    if (req.user.saldo < pkg.price) {
      return renderBeli(
        req,
        res,
        `Saldo tidak cukup. Butuh ${pkg.price.toLocaleString("id-ID")} rupiah, saldo Anda ${req.user.saldo.toLocaleString("id-ID")}`,
        400
      );
    }

    if (
      server.limit_vpn > 0 &&
      countServerAccounts.get(server.id).c >= server.limit_vpn
    ) {
      return renderBeli(req, res, "Kuota akun di server ini sudah penuh", 400);
    }

    if (username && !USERNAME_RE.test(username)) {
      return renderBeli(
        req,
        res,
        "Username 3-20 karakter (huruf, angka, _ atau -)",
        400
      );
    }
    if (uuid && !UUID_RE.test(uuid)) {
      return renderBeli(req, res, "UUID tidak valid", 400);
    }

    const finalUsername = username || randomUsername();
    const password =
      protocol === "ssh" ? (req.body.password || randomPassword()) : null;
    const expiredAt = new Date(Date.now() + pkg.days * 86400000).toISOString();

    let rawConfig = null;
    try {
      const createRes = await vpnApi.createAccount(server, protocol, {
        username: finalUsername,
        password,
        kuota: pkg.kuota_gb,
        expired: pkg.days,
        limitip: pkg.limit_ip,
        uuid: uuid || undefined,
      });
      rawConfig = JSON.stringify(createRes);

      try {
        const cfg = await vpnApi.checkConfig(server, protocol, finalUsername);
        rawConfig = JSON.stringify(cfg);
      } catch (e) {
        console.log(
          `[beli] checkconfig gagal untuk ${finalUsername}: ${e.message}`
        );
      }
    } catch (e) {
      return renderBeli(
        req,
        res,
        `Gagal membuat akun di server: ${e.message}`,
        502
      );
    }

    const finalize = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO vpn_accounts
             (user_id, server_id, protocol, username, uuid, password,
              kuota_gb, limit_ip, days, price, expired_at, status, raw_config, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
        )
        .run(
          req.user.id,
          server.id,
          protocol,
          finalUsername,
          uuid || null,
          password,
          pkg.kuota_gb,
          pkg.limit_ip,
          pkg.days,
          pkg.price,
          expiredAt,
          rawConfig,
          new Date().toISOString()
        );

      db.prepare("UPDATE users SET saldo = saldo - ? WHERE id = ?").run(
        pkg.price,
        req.user.id
      );
      db.prepare(
        "INSERT INTO transactions (user_id, type, amount, detail) VALUES (?, 'beli', ?, ?)"
      ).run(
        req.user.id,
        -pkg.price,
        `${protocol} ${pkg.name} di ${server.label}`
      );

      return info.lastInsertRowid;
    });

    const accountId = finalize();
    req.user.saldo = db
      .prepare("SELECT saldo FROM users WHERE id = ?")
      .get(req.user.id).saldo;

    notifier
      .purchase(
        { username: req.user.username },
        "membeli akun",
        `${protocol} ${finalUsername} (${server.label})`,
        pkg.price
      )
      .catch(() => {});

    res.redirect(`/beli/hasil/${accountId}`);
  });

  router.get("/beli/hasil/:id", requireUser, (req, res) => {
    const account = getAccount.get(req.params.id, req.user.id);
    if (!account) return res.status(404).render("404", { title: "Tidak ditemukan" });
    res.render("beli-hasil", {
      title: "Akun Berhasil Dibuat",
      user: req.user,
      account,
      configItems: parseAccountConfig(account),
    });
  });

  return router;
};