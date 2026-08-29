"use strict";

function parseAccountConfig(account) {
  const items = [];
  let raw = null;
  try {
    raw = JSON.parse(account.raw_config || "");
  } catch {}
  const data = raw && raw.data;

  if (account.protocol === "ssh") {
    if (data) {
      items.push({ label: "Username", value: data.username || account.username });
      items.push({ label: "Password", value: data.password || account.password });
      items.push({ label: "Hostname", value: data.hostname });
      items.push({ label: "Servername", value: data.servername });
      items.push({ label: "Pubkey", value: data.pubkey });
      items.push({ label: "Expired", value: data.exp });
      const ports = data.port || {};
      for (const [k, v] of Object.entries(ports)) {
        if (v) items.push({ label: `Port ${k}`, value: String(v) });
      }
      const payload = data.payloadws || {};
      for (const [k, v] of Object.entries(payload)) {
        if (v) items.push({ label: `Payload ${k}`, value: String(v) });
      }
    } else {
      items.push({ label: "Username", value: account.username });
      items.push({ label: "Password", value: account.password });
    }
    return items;
  }

  // v2ray (vmess/vless/trojan)
  if (data) {
    items.push({ label: "Username", value: data.username || account.username });
    items.push({ label: "UUID", value: data.uuid || account.uuid });
    items.push({ label: "Hostname", value: data.hostname });
    items.push({ label: "CITY / ISP", value: [data.CITY, data.ISP].filter(Boolean).join(" / ") });
    items.push({ label: "Expired", value: data.expired });
    const ports = data.port || {};
    for (const [k, v] of Object.entries(ports)) {
      if (v) items.push({ label: `Port ${k}`, value: String(v) });
    }
    const paths = data.path || {};
    for (const [k, v] of Object.entries(paths)) {
      if (v) items.push({ label: `Path ${k}`, value: String(v) });
    }
    const links = data.link || {};
    for (const [k, v] of Object.entries(links)) {
      if (v) items.push({ label: `Link ${k.toUpperCase()}`, value: String(v), copyable: true });
    }
  } else {
    items.push({ label: "Username", value: account.username });
    items.push({ label: "UUID", value: account.uuid });
  }
  return items;
}

module.exports = { parseAccountConfig };