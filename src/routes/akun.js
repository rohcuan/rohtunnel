"use strict";

const express = require("express");
const { requireUser } = require("../middleware/auth");
const vpnApi = require("../services/vpnApi");
const { renderTemplate } = require("../services/templateRenderer");
const notifier = require("../services/notifier");

module.exports = (db) => {
  const router = express.Router();

  const listAccounts = db.prepare(
    `SELECT a.*, s.name AS server_name, s.country AS server_country
     FROM vpn_accounts a JOIN servers s ON s.id = a.server_id
     WHERE a.user_id = ? AND a.status != 'deleted' ORDER BY a.id DESC`
  );
  const getAccount = db.prepare(
    "SELECT * FROM vpn_accounts WHERE id = ? AND user_id = ?"
  );
  const getServer = db.prepare("SELECT * FROM servers WHERE id = ?");
  const listTemplates = db.prepare(
    "SELECT * FROM config_templates WHERE active = 1 ORDER BY id"
  );
  const getTemplate = db.prepare(
    "SELECT * FROM config_templates WHERE id = ? AND active = 1"
  );
  const getUserSaldo = db.prepare("SELECT saldo FROM users WHERE id = ?");

  const redirectMsg = (res, msg) =>
    res.redirect("/akun?msg=" + encodeURIComponent(msg));
  const redirectErr = (res, err) =>
    res.redirect("/akun?error=" + encodeURIComponent(err));

  const charge = db.transaction((userId, amount, type, detail, accountId, updater) => {
    db.prepare("UPDATE users SET saldo = saldo - ? WHERE id = ?").run(
      amount,
      userId
    );
    db.prepare(
      "INSERT INTO transactions (user_id, type, amount, detail) VALUES (?, ?, ?, ?)"
    ).run(userId, type, -amount, detail);
    if (updater) updater(accountId);
  });

  const withAccount = (req, res, fn) => {
    const account = getAccount.get(req.params.id, req.user.id);
    if (!account) return res.status(404).render("404", { title: "Tidak ditemukan" });
    const server = getServer.get(account.server_id);
    if (!server) return redirectErr(res, "Server akun sudah tidak ada");
    return fn(account, server);
  };

  router.get("/akun", requireUser, (req, res) => {
    res.render("akun", {
      title: "Akun VPN Saya",
      user: req.user,
      accounts: listAccounts.all(req.user.id),
      msg: req.query.msg || null,
      error: req.query.error || null,
    });
  });

  router.post("/akun/:id/renew", requireUser, (req, res) => {
    withAccount(req, res, async (account, server) => {
      const price = account.price;
      if (!Number.isInteger(price) || price <= 0) {
        return redirectErr(res, "Harga akun tidak diketahui, hubungi admin");
      }
      const saldo = getUserSaldo.get(req.user.id).saldo;
      if (saldo < price) {
        return redirectErr(res, "Saldo tidak cukup untuk renew");
      }

      const baseExpired = Math.max(
        Date.now(),
        new Date(account.expired_at || Date.now()).getTime()
      );
      const newExpired = new Date(
        baseExpired + (account.days || 30) * 86400000
      ).toISOString();

      try {
        await vpnApi.renewAccount(
          server,
          account.protocol,
          account.username,
          account.days || 30,
          account.kuota_gb
        );
        charge(
          req.user.id,
          price,
          "renew",
          `renew ${account.protocol} ${account.username}`,
          account.id,
          (id) =>
            db
              .prepare("UPDATE vpn_accounts SET expired_at = ? WHERE id = ?")
              .run(newExpired, id)
        );
        redirectMsg(res, "Akun berhasil diperpanjang");
        notifier
          .purchase(
            { username: req.user.username },
            "renew akun",
            `${account.protocol} ${account.username}`,
            price
          )
          .catch(() => {});
      } catch (e) {
        redirectErr(res, `Renew gagal: ${e.message}`);
      }
    });
  });

  router.post("/akun/:id/add-bw", requireUser, (req, res) => {
    withAccount(req, res, async (account, server) => {
      const price = account.price;
      if (!Number.isInteger(price) || price <= 0) {
        return redirectErr(res, "Harga akun tidak diketahui, hubungi admin");
      }
      const saldo = getUserSaldo.get(req.user.id).saldo;
      if (saldo < price) {
        return redirectErr(res, "Saldo tidak cukup untuk tambah bandwidth");
      }

      const newKuota = account.kuota_gb + account.kuota_gb;
      try {
        await vpnApi.changeBandwidth(
          server,
          account.protocol,
          account.username,
          newKuota,
          false
        );
        charge(
          req.user.id,
          price,
          "add_bw",
          `tambah bandwidth ${account.protocol} ${account.username}`,
          account.id,
          (id) =>
            db
              .prepare("UPDATE vpn_accounts SET kuota_gb = ? WHERE id = ?")
              .run(newKuota, id)
        );
        redirectMsg(res, "Bandwidth ditambahkan");
        notifier
          .purchase(
            { username: req.user.username },
            "tambah bandwidth",
            `${account.protocol} ${account.username}`,
            price
          )
          .catch(() => {});
      } catch (e) {
        redirectErr(res, `Tambah bandwidth gagal: ${e.message}`);
      }
    });
  });

  router.post("/akun/:id/add-ip", requireUser, (req, res) => {
    withAccount(req, res, async (account, server) => {
      const price = account.price;
      if (!Number.isInteger(price) || price <= 0) {
        return redirectErr(res, "Harga akun tidak diketahui, hubungi admin");
      }
      const saldo = getUserSaldo.get(req.user.id).saldo;
      if (saldo < price) {
        return redirectErr(res, "Saldo tidak cukup untuk tambah IP");
      }

      const newLimitIp = account.limit_ip + 1;
      try {
        await vpnApi.changeIpLimit(
          server,
          account.protocol,
          account.username,
          newLimitIp
        );
        charge(
          req.user.id,
          price,
          "add_ip",
          `tambah IP ${account.protocol} ${account.username}`,
          account.id,
          (id) =>
            db
              .prepare("UPDATE vpn_accounts SET limit_ip = ? WHERE id = ?")
              .run(newLimitIp, id)
        );
        redirectMsg(res, "Limit IP ditambahkan");
        notifier
          .purchase(
            { username: req.user.username },
            "tambah IP",
            `${account.protocol} ${account.username}`,
            price
          )
          .catch(() => {});
      } catch (e) {
        redirectErr(res, `Tambah IP gagal: ${e.message}`);
      }
    });
  });

  router.post("/akun/:id/lock", requireUser, (req, res) => {
    withAccount(req, res, async (account, server) => {
      try {
        await vpnApi.lockAccount(server, account.protocol, account.username);
        db.prepare("UPDATE vpn_accounts SET status = 'locked' WHERE id = ?").run(
          account.id
        );
        redirectMsg(res, "Akun dikunci");
      } catch (e) {
        redirectErr(res, `Lock gagal: ${e.message}`);
      }
    });
  });

  router.post("/akun/:id/unlock", requireUser, (req, res) => {
    withAccount(req, res, async (account, server) => {
      if (account.status === "admin_locked") {
        return redirectErr(
          res,
          "Akun dikunci admin, tidak bisa dibuka oleh user. Hubungi admin."
        );
      }
      try {
        await vpnApi.unlockAccount(
          server,
          account.protocol,
          account.username,
          account.password || ""
        );
        db.prepare("UPDATE vpn_accounts SET status = 'active' WHERE id = ?").run(
          account.id
        );
        redirectMsg(res, "Akun dibuka kembali");
      } catch (e) {
        redirectErr(res, `Unlock gagal: ${e.message}`);
      }
    });
  });

  router.post("/akun/:id/delete", requireUser, (req, res) => {
    withAccount(req, res, async (account, server) => {
      try {
        await vpnApi.deleteAccount(server, account.protocol, account.username);
        db.prepare(
          "UPDATE vpn_accounts SET status = 'deleted', deleted_at = ? WHERE id = ?"
        ).run(new Date().toISOString(), account.id);
        redirectMsg(res, "Akun dihapus");
      } catch (e) {
        redirectErr(res, `Hapus gagal: ${e.message}`);
      }
    });
  });

  router.post("/akun/:id/refresh", requireUser, (req, res) => {
    withAccount(req, res, async (account, server) => {
      try {
        const cfg = await vpnApi.checkConfig(
          server,
          account.protocol,
          account.username
        );
        db.prepare("UPDATE vpn_accounts SET raw_config = ? WHERE id = ?").run(
          JSON.stringify(cfg),
          account.id
        );
        redirectMsg(res, "Config diperbarui dari server");
      } catch (e) {
        redirectErr(res, `Refresh config gagal: ${e.message}`);
      }
    });
  });

  router.get("/akun/:id/config", requireUser, (req, res) => {
    withAccount(req, res, (account) => {
      res.render("akun-config", {
        title: "Config Siap Pakai",
        user: req.user,
        account,
        templates: listTemplates.all(),
      });
    });
  });

  router.get("/akun/:id/config/:templateId", requireUser, (req, res) => {
    withAccount(req, res, (account) => {
      const template = getTemplate.get(req.params.templateId);
      if (!template) return res.status(404).render("404", { title: "Tidak ditemukan" });
      res.render("akun-config-detail", {
        title: template.name,
        user: req.user,
        account,
        template,
        fields: renderTemplate(account, template),
      });
    });
  });

  return router;
};