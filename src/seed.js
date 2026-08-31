"use strict";

const DEFAULT_SETTINGS = {
  site_name: "RohTunnel",
  contact_admin: "https://t.me/your_admin_here",
  qris_endpoint: "",
  qris_api_key: "",
  telegram_bot_token: "",
  telegram_chat_id: "",
  notif_topup: "0",
  notif_adjust: "0",
  notif_purchase: "0",
};

const TEMPLATE_PLACEHOLDER =
  "Catatan: isi template ini sementara (placeholder). Admin dapat mengeditnya lewat Setup Config Siap Pakai.";

const DEFAULT_TEMPLATES = [
  {
    name: "XL Edu",
    fields: [
      { label: "Catatan", tpl: TEMPLATE_PLACEHOLDER },
      { label: "Username", tpl: "{{username}}" },
      { label: "Password / UUID", tpl: "{{password}}{{uuid}}" },
      { label: "Host / SNI", tpl: "{{hostname}}" },
      { label: "Port", tpl: "{{port_tls}}" },
      { label: "Payload", tpl: "GET / HTTP/1.1[crlf]Host: {{hostname}}[crlf]Upgrade: websocket[crlf][crlf]" },
      { label: "Link Config", tpl: "{{link_tls}}" },
    ],
  },
  {
    name: "XL Conference",
    fields: [
      { label: "Catatan", tpl: TEMPLATE_PLACEHOLDER },
      { label: "Username", tpl: "{{username}}" },
      { label: "Password / UUID", tpl: "{{password}}{{uuid}}" },
      { label: "Host / SNI", tpl: "{{hostname}}" },
      { label: "Port", tpl: "{{port_any}}" },
      { label: "Payload", tpl: "CONNECT [host]:443 HTTP/1.1[crlf]Host: {{hostname}}[crlf][crlf]" },
      { label: "Link Config", tpl: "{{link_grpc}}" },
    ],
  },
  {
    name: "XL Addon XCP (IG/Tiktok/WA/FB)",
    fields: [
      { label: "Catatan", tpl: TEMPLATE_PLACEHOLDER },
      { label: "Username", tpl: "{{username}}" },
      { label: "Password / UUID", tpl: "{{password}}{{uuid}}" },
      { label: "Host / SNI", tpl: "{{hostname}}" },
      { label: "Port", tpl: "{{port_tls}}" },
      { label: "Payload", tpl: "GET /xcp HTTP/1.1[crlf]Host: {{hostname}}[crlf][crlf]" },
      { label: "Link Config", tpl: "{{link_up}}" },
    ],
  },
  {
    name: "Tsel Ilmupedia / Kuota Belajar",
    fields: [
      { label: "Catatan", tpl: TEMPLATE_PLACEHOLDER },
      { label: "Username", tpl: "{{username}}" },
      { label: "Password / UUID", tpl: "{{password}}{{uuid}}" },
      { label: "Host / SNI", tpl: "{{hostname}}" },
      { label: "Port", tpl: "{{port_tls}}" },
      { label: "Payload", tpl: "GET /ilmupedia HTTP/1.1[crlf]Host: {{hostname}}[crlf][crlf]" },
      { label: "Link Config", tpl: "{{link_tls}}" },
    ],
  },
  {
    name: "Tsel Halo Flexy+",
    fields: [
      { label: "Catatan", tpl: TEMPLATE_PLACEHOLDER },
      { label: "Username", tpl: "{{username}}" },
      { label: "Password / UUID", tpl: "{{password}}{{uuid}}" },
      { label: "Host / SNI", tpl: "{{hostname}}" },
      { label: "Port", tpl: "{{port_any}}" },
      { label: "Payload", tpl: "GET /flexy HTTP/1.1[crlf]Host: {{hostname}}[crlf][crlf]" },
      { label: "Link Config", tpl: "{{link_grpc}}" },
    ],
  },
  {
    name: "Biz Line",
    fields: [
      { label: "Catatan", tpl: TEMPLATE_PLACEHOLDER },
      { label: "Username", tpl: "{{username}}" },
      { label: "Password / UUID", tpl: "{{password}}{{uuid}}" },
      { label: "Host / SNI", tpl: "{{hostname}}" },
      { label: "Port", tpl: "{{port_tls}}" },
      { label: "Payload", tpl: "GET /biz HTTP/1.1[crlf]Host: {{hostname}}[crlf][crlf]" },
      { label: "Link Config", tpl: "{{link_tls}}" },
    ],
  },
  {
    name: "Biz WA",
    fields: [
      { label: "Catatan", tpl: TEMPLATE_PLACEHOLDER },
      { label: "Username", tpl: "{{username}}" },
      { label: "Password / UUID", tpl: "{{password}}{{uuid}}" },
      { label: "Host / SNI", tpl: "{{hostname}}" },
      { label: "Port", tpl: "{{port_any}}" },
      { label: "Payload", tpl: "GET /bizwa HTTP/1.1[crlf]Host: {{hostname}}[crlf][crlf]" },
      { label: "Link Config", tpl: "{{link_up}}" },
    ],
  },
];

function ensureSeed(db) {
  const adminCount = db
    .prepare("SELECT COUNT(*) AS c FROM users WHERE is_admin = 1")
    .get().c;

  if (adminCount === 0) {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD || "admin";

    db.prepare(
      "INSERT INTO users (username, password, is_admin) VALUES (?, ?, 1)"
    ).run(username, password);

    console.log(`[seed] admin dibuat: ${username} / ${password} — segera ganti password!`);
  }

  const insert = db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
  );
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    insert.run(key, value);
  }

  const templateCount = db
    .prepare("SELECT COUNT(*) AS c FROM config_templates")
    .get().c;
  if (templateCount === 0) {
    const insertTpl = db.prepare(
      "INSERT INTO config_templates (name, fields) VALUES (?, ?)"
    );
    for (const tpl of DEFAULT_TEMPLATES) {
      insertTpl.run(tpl.name, JSON.stringify(tpl.fields));
      console.log(`[seed] template config dibuat: ${tpl.name}`);
    }
  }
}

module.exports = { ensureSeed, DEFAULT_SETTINGS, DEFAULT_TEMPLATES };
