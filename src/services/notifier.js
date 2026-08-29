"use strict";

const { getSetting } = require("../config");
const telegram = require("./telegram");

function isEnabled(key) {
  return getSetting(key) === "1";
}

function rupiah(n) {
  return "Rp" + Number(n || 0).toLocaleString("id-ID");
}

async function topupPaid(user, amount, saldoBaru) {
  if (!isEnabled("notif_topup")) return;
  await telegram.sendMessage(
    `[RohTunnel] Topup lunas: @${user.username} +${rupiah(amount)}\nSaldo sekarang: ${rupiah(saldoBaru)}`
  );
}

async function adjustSaldo(user, delta, saldoBaru, ket) {
  if (!isEnabled("notif_adjust")) return;
  const tanda = delta > 0 ? "+" : "";
  await telegram.sendMessage(
    `[RohTunnel] Saldo @${user.username} ${ket}: ${tanda}${rupiah(delta)} — Saldo sekarang: ${rupiah(saldoBaru)}`
  );
}

async function purchase(user, type, detail, amount) {
  if (!isEnabled("notif_purchase")) return;
  await telegram.sendMessage(
    `[RohTunnel] @${user.username} ${type}: ${detail} (-${rupiah(amount)})`
  );
}

module.exports = { isEnabled, topupPaid, adjustSaldo, purchase };