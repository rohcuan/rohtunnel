"use strict";

const express = require("express");
const { requireAuth } = require("../middleware/auth");
const qris = require("../services/qris");
const { checkAndSettle } = require("../jobs/paymentWatcher");

const MIN_TOPUP = 5000;
const MAX_TOPUP = 10000000;

module.exports = (db) => {
  const router = express.Router();

  const listRiwayat = db.prepare(
    "SELECT * FROM topups WHERE user_id = ? ORDER BY id DESC LIMIT 20"
  );

  const getTopup = db.prepare(
    "SELECT * FROM topups WHERE id = ? AND user_id = ?"
  );

  router.get("/topup", requireAuth, (req, res) => {
    res.render("topup", {
      title: "Topup Saldo",
      user: req.user,
      riwayat: listRiwayat.all(req.user.id),
      error: null,
    });
  });

  router.post("/topup", requireAuth, async (req, res) => {
    const renderError = (error, status = 400) =>
      res.status(status).render("topup", {
        title: "Topup Saldo",
        user: req.user,
        riwayat: listRiwayat.all(req.user.id),
        error,
      });

    const amount = parseInt(req.body.amount, 10);
    if (
      !Number.isInteger(amount) ||
      amount < MIN_TOPUP ||
      amount > MAX_TOPUP
    ) {
      return renderError(
        `Nominal harus antara Rp${MIN_TOPUP.toLocaleString("id-ID")} - Rp${MAX_TOPUP.toLocaleString("id-ID")}`
      );
    }

    if (!qris.isConfigured()) {
      return renderError(
        "Pembayaran QRIS belum dikonfigurasi oleh admin. Silakan hubungi admin."
      );
    }

    try {
      const data = await qris.createQris(amount);
      const info = db
        .prepare(
          `INSERT INTO topups (user_id, amount, qris_id, trx_id, qris_url, status, created_at)
           VALUES (?, ?, ?, ?, ?, 'pending', ?)`
        )
        .run(
          req.user.id,
          amount,
          data.qris_id,
          data.trx_id,
          data.qris_url,
          new Date().toISOString()
        );
      res.redirect(`/topup/${info.lastInsertRowid}`);
    } catch (e) {
      return renderError(`Gagal membuat QRIS: ${e.message}`, 502);
    }
  });

  router.get("/topup/check/:id", requireAuth, async (req, res) => {
    const t = getTopup.get(req.params.id, req.user.id);
    if (!t) return res.status(404).json({ status: "notfound" });
    const result = await checkAndSettle(db, t);
    res.json(result);
  });

  router.get("/topup/:id", requireAuth, (req, res) => {
    const t = getTopup.get(req.params.id, req.user.id);
    if (!t) return res.status(404).render("404", { title: "Tidak ditemukan" });
    res.render("topup-qr", { title: "Pembayaran Topup", user: req.user, topup: t });
  });

  return router;
};