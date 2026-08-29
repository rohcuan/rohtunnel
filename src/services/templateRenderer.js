"use strict";

const { parseAccountConfig } = require("./configBuilder");

function buildVarMap(account) {
  const map = {
    username: account.username || "",
    password: account.password || "",
    uuid: account.uuid || "",
    hostname: "",
    kuota_gb: String(account.kuota_gb ?? ""),
    limit_ip: String(account.limit_ip ?? ""),
    expired_date: account.expired_at
      ? new Date(account.expired_at).toLocaleDateString("id-ID")
      : "",
  };

  for (const item of parseAccountConfig(account)) {
    const key = item.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!map[key] && item.value) map[key] = item.value;
  }

  if (!map.password && map.uuid) map.password = map.uuid;

  return map;
}

function renderTemplate(account, template) {
  const map = buildVarMap(account);
  let fields = [];
  try {
    fields = JSON.parse(template.fields || "[]");
  } catch {}
  if (!Array.isArray(fields)) fields = [];

  return fields.map((f) => ({
    label: f.label || "",
    value: String(f.tpl || "").replace(/\{\{(\w+)\}\}/g, (m, key) =>
      map[key] !== undefined && map[key] !== ""
        ? map[key]
        : `[${key} tidak tersedia]`
    ),
  }));
}

module.exports = { buildVarMap, renderTemplate };