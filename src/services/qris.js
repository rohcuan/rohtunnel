"use strict";

const { getSetting } = require("../config");

const TIMEOUT_MS = 10000;

function baseUrl() {
  return (getSetting("qris_endpoint") || "").replace(/\/+$/, "");
}

function apiKey() {
  return getSetting("qris_api_key");
}

function isConfigured() {
  return !!baseUrl() && !!apiKey();
}

async function request(path, params) {
  const qs = new URLSearchParams(params);
  qs.set("api_key", apiKey());
  const res = await fetch(`${baseUrl()}${path}?${qs.toString()}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return res.json();
}

async function createQris(amount) {
  const json = await request("/create-qris", { amount });
  if (!json.success) {
    throw new Error((json.message && json.message.message) || json.message || "Gagal membuat QRIS");
  }
  return json.data;
}

async function checkPayment(amount, trxId) {
  return request("/check-payment", { amount, trx_id: trxId });
}

async function tokenStatus() {
  return request("/token-status", {});
}

module.exports = { isConfigured, createQris, checkPayment, tokenStatus };