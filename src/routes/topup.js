"use strict";

const express = require("express");
const { requireUser } = require("../middleware/auth");
const qris = require("../services/qris");
const { checkAndSettle, QRIS_TTL_MS } = require("../jobs/paymentWatcher");

const MIN_TOPUP = 5000;
const MAX_TOPUP = 10000000;
const CHECK_COOLDOWN = 10; // detik antar pengecekan manual

module.exports = (db) => {
  const router = express.Router();

  const getTopup = db.prepare(
    "SELECT * FROM topups WHERE id = ? AND user_id = ?"
  );

  function historyRows(userId) {
    const topups = db
      .prepare("SELECT * FROM topups WHERE user_id = ? ORDER BY id DESC LIMIT 50")
      .all(userId)
      .map((t) => {
        const age = Date.now() - new Date(t.created_at).getTime();
        const left = Math.max(0, Math.round((QRIS_TTL_MS - age) / 1000));
        return {
          kind: "topup",
          id: t.id,
          amount: t.amount,
          fee: 0,
          total: t.amount,
          status: t.status,
          desc: "Topup QRIS",
          ts: t.created_at,
          show_qris_link: t.status === "pending" && left > 0,
          show_check: t.status === "pending" && left <= 0,
          check_left: 0,
        };
      });
    const txns = db
      .prepare("SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 50")
      .all(userId)
      .map((t) => ({
        kind: "txn",
        id: t.id,
        amount: t.amount,
        desc: t.detail,
        ts: t.created_at,
        label:
          t.type === "adjust"
            ? "Penyesuaian Saldo"
            : t.type === "recovery"
              ? "Pengembalian Saldo"
              : t.type === "renew"
                ? "Renew Akun"
                : "Pembelian Paket",
      }));
    return topups
      .concat(txns)
      .sort((a, b) => (a.ts < b.ts ? 1 : -1))
      .slice(0, 50);
  }

  router.get("/topup", requireUser, (req, res) => {
    res.render("topup", {
      title: "Topup Saldo Panel",
      user: req.user,
      qrisReady: qris.isConfigured(),
      min: MIN_TOPUP,
      max: MAX_TOPUP,
      error: null,
    });
  });

  router.get("/topup/riwayat", requireUser, (req, res) => {
    res.render("topup-riwayat", {
      title: "Riwayat Saldo Panel",
      user: req.user,
      balance: req.user.saldo,
      history: historyRows(req.user.id),
      cooldown: CHECK_COOLDOWN,
      ttl: Math.round(QRIS_TTL_MS / 1000),
    });
  });

  // JSON: buat topup → { ok, id, amount, fee, total }
  router.post("/topup/create", requireUser, async (req, res) => {
    const amount = parseInt(req.body.amount, 10);
    if (!Number.isInteger(amount) || amount < MIN_TOPUP || amount > MAX_TOPUP) {
      return res.json({
        ok: false,
        message: `Nominal harus antara Rp${MIN_TOPUP.toLocaleString("id-ID")} - Rp${MAX_TOPUP.toLocaleString("id-ID")}`,
      });
    }
    if (!qris.isConfigured()) {
      return res.json({
        ok: false,
        message: "Pembayaran QRIS belum dikonfigurasi oleh admin.",
      });
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
      res.json({ ok: true, id: info.lastInsertRowid, amount, fee: 0, total: amount });
    } catch (e) {
      res.json({ ok: false, message: `Gagal membuat QRIS: ${e.message}` });
    }
  });

  // JSON: gambar QR → { ok, qr_img, expires_ts }
  router.get("/topup/qr/:id", requireUser, (req, res) => {
    const t = getTopup.get(req.params.id, req.user.id);
    if (!t) return res.json({ ok: false, message: "Topup tidak ditemukan." });
    if (t.status === "paid") {
      return res.json({ ok: false, message: "Topup ini sudah dibayar." });
    }
    if (t.status === "expired") {
      return res.json({ ok: false, message: "QRIS sudah kedaluwarsa." });
    }
    const expiresTs = Math.floor(
      (new Date(t.created_at).getTime() + QRIS_TTL_MS) / 1000
    );
    return res.json({ ok: true, qr_img: t.qris_url, expires_ts: expiresTs });
  });

  // JSON: cek status → { ok, status, credited, new_balance, cooldown }
  router.post("/topup/check", requireUser, async (req, res) => {
    const t = getTopup.get(req.body.topup_id, req.user.id);
    if (!t) return res.json({ ok: false, message: "Topup tidak ditemukan." });

    const result = await checkAndSettle(db, t);
    if (result.status === "paid") {
      const user = db.prepare("SELECT saldo FROM users WHERE id = ?").get(req.user.id);
      return res.json({
        ok: true,
        status: "paid",
        credited: t.amount,
        new_balance: user.saldo,
        cooldown: 0,
      });
    }
    if (result.status === "error") {
      return res.json({
        ok: false,
        message: `Gagal mengecek: ${result.message || "gateway tidak merespons"}`,
        cooldown: CHECK_COOLDOWN,
      });
    }
    res.json({
      ok: true,
      status: result.status,
      message:
        result.status === "expired"
          ? "QRIS kedaluwarsa dan tidak ada pembayaran masuk."
          : "Belum ada pembayaran terdeteksi.",
      cooldown: CHECK_COOLDOWN,
    });
  });

  // Halaman lama (fallback link lama): QR di halaman sendiri + auto-poll
  router.get("/topup/:id(\\d+)", requireUser, (req, res) => {
    const t = getTopup.get(req.params.id, req.user.id);
    if (!t) return res.status(404).render("404", { title: "Tidak ditemukan" });
    res.render("topup-qr", { title: "Pembayaran Topup", user: req.user, topup: t });
  });

  router.get("/topup/check/:id(\\d+)", requireUser, async (req, res) => {
    const t = getTopup.get(req.params.id, req.user.id);
    if (!t) return res.status(404).json({ status: "notfound" });
    const result = await checkAndSettle(db, t);
    res.json(result);
  });

  return router;
};