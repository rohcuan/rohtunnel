"use strict";

const qris = require("../services/qris");
const notifier = require("../services/notifier");

const QRIS_TTL_MS = 5 * 60 * 1000; // QRIS berlaku 5 menit
const POLL_INTERVAL_MS = 10000;

let timer = null;

function settleTopup(db, t) {
  return db.transaction((topup) => {
    const updated = db
      .prepare(
        "UPDATE topups SET status = 'paid', paid_at = ? WHERE id = ? AND status = 'pending'"
      )
      .run(new Date().toISOString(), topup.id);
    if (updated.changes === 0) return false;
    db.prepare("UPDATE users SET saldo = saldo + ? WHERE id = ?").run(
      topup.amount,
      topup.user_id
    );
    return true;
  })(t);
}

async function checkAndSettle(db, t) {
  const age = Date.now() - new Date(t.created_at).getTime();

  if (age > QRIS_TTL_MS) {
    db.prepare(
      "UPDATE topups SET status = 'expired' WHERE id = ? AND status = 'pending'"
    ).run(t.id);
    return { status: "expired" };
  }

  try {
    const total = t.total || t.amount + (t.fee || 0);
    const json = await qris.checkPayment(total, t.trx_id);
    if (json && json.paid) {
      const settled = settleTopup(db, t);
      if (settled) {
        const user = db
          .prepare("SELECT username, saldo FROM users WHERE id = ?")
          .get(t.user_id);
        console.log(
          `[topup] topup #${t.id} Rp${t.amount} lunas oleh ${user.username}`
        );
        notifier.topupPaid(user, t.amount, user.saldo).catch(() => {});
      }
      return { status: "paid" };
    }
    return { status: "pending" };
  } catch (e) {
    return { status: "error", message: e.message };
  }
}

function startPaymentWatcher(db) {
  if (timer) return timer;
  timer = setInterval(async () => {
    const pending = db
      .prepare("SELECT * FROM topups WHERE status = 'pending'")
      .all();
    for (const t of pending) {
      await checkAndSettle(db, t);
    }
  }, POLL_INTERVAL_MS);
  return timer;
}

module.exports = { startPaymentWatcher, checkAndSettle, QRIS_TTL_MS };