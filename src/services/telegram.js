"use strict";

const fs = require("fs");
const { getSetting } = require("../config");

const TIMEOUT_MS = 30000;

const API_BASE = process.env.TELEGRAM_API_BASE || "https://api.telegram.org";

function isConfigured() {
  return !!(getSetting("telegram_bot_token") && getSetting("telegram_chat_id"));
}

function apiUrl(method) {
  return `${API_BASE}/bot${getSetting("telegram_bot_token")}/${method}`;
}

async function sendMessage(text) {
  if (!isConfigured()) return false;
  try {
    const res = await fetch(apiUrl("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: getSetting("telegram_chat_id"),
        text,
        parse_mode: "HTML",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendDocument(filePath, filename, caption) {
  if (!isConfigured()) return false;
  try {
    const form = new FormData();
    form.append("chat_id", getSetting("telegram_chat_id"));
    if (caption) form.append("caption", caption);
    form.append("document", new Blob([fs.readFileSync(filePath)]), filename);
    const res = await fetch(apiUrl("sendDocument"), {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

module.exports = { isConfigured, sendMessage, sendDocument };