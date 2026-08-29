"use strict";

const express = require("express");
const { requireAdmin } = require("../middleware/admin");
const actions = require("../services/adminAccountActions");

const appendParam = (url, key, value) =>
  (url.includes("?") ? url + "&" : url + "?") +
  `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;

module.exports = (db) => {
  const router = express.Router();

  const getAccount = db.prepare("SELECT * FROM vpn_accounts WHERE id = ?");
  const getServer = db.prepare("SELECT * FROM servers WHERE id = ?");

  const withAccount = (req, res, fn) => {
    const account = getAccount.get(req.params.id);
    if (!account) {
      return res.redirect(appendParam(req.body.back || "/admin/akun", "error", "Akun tidak ditemukan"));
    }
    const server = getServer.get(account.server_id);
    if (!server) {
      return res.redirect(appendParam(req.body.back || "/admin/akun", "error", "Server akun sudah tidak ada"));
    }
    fn(account, server);
  };

  const finish = (req, res, msg, error = null) => {
    const back = (req.body.back || "/admin/akun").startsWith("/")
      ? req.body.back
      : "/admin/akun";
    if (error) return res.redirect(appendParam(back, "error", error));
    res.redirect(appendParam(back, "msg", msg));
  };

  router.post("/admin/akun/:id/lock", requireAdmin, (req, res) => {
    withAccount(req, res, async (account, server) => {
      try {
        await actions.lock(db, account, server);
        finish(req, res, `Akun ${account.username} dikunci admin`);
      } catch (e) {
        finish(req, res, null, `Lock gagal: ${e.message}`);
      }
    });
  });

  router.post("/admin/akun/:id/unlock", requireAdmin, (req, res) => {
    withAccount(req, res, async (account, server) => {
      try {
        await actions.unlock(db, account, server);
        finish(req, res, `Akun ${account.username} dibuka`);
      } catch (e) {
        finish(req, res, null, `Unlock gagal: ${e.message}`);
      }
    });
  });

  router.post("/admin/akun/:id/bandwidth", requireAdmin, (req, res) => {
    withAccount(req, res, async (account, server) => {
      const kuota = parseInt(req.body.kuota, 10);
      if (!Number.isInteger(kuota) || kuota < 1 || kuota > 10000) {
        return finish(req, res, null, "Kuota harus 1 - 10.000 GB");
      }
      try {
        await actions.setBandwidth(db, account, server, kuota, req.body.reset_bw === "1");
        finish(req, res, `Kuota ${account.username} diset ${kuota} GB`);
      } catch (e) {
        finish(req, res, null, `Set bandwidth gagal: ${e.message}`);
      }
    });
  });

  router.post("/admin/akun/:id/ip", requireAdmin, (req, res) => {
    withAccount(req, res, async (account, server) => {
      const limitip = parseInt(req.body.limitip, 10);
      if (!Number.isInteger(limitip) || limitip < 1 || limitip > 100) {
        return finish(req, res, null, "Limit IP harus 1 - 100");
      }
      try {
        await actions.setIp(db, account, server, limitip);
        finish(req, res, `Limit IP ${account.username} diset ${limitip}`);
      } catch (e) {
        finish(req, res, null, `Set IP gagal: ${e.message}`);
      }
    });
  });

  router.post("/admin/akun/:id/delete", requireAdmin, (req, res) => {
    withAccount(req, res, async (account, server) => {
      try {
        await actions.remove(db, account, server);
        finish(req, res, `Akun ${account.username} dihapus`);
      } catch (e) {
        finish(req, res, null, `Hapus gagal: ${e.message}`);
      }
    });
  });

  return router;
};