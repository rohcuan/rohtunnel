"use strict";

const TYPE_SUFFIX = {
  ssh: "sshvpn",
  vmess: "vmess",
  vless: "vless",
  trojan: "trojan",
};

const TIMEOUT_MS = 15000;

async function apiCall(server, method, path, body) {
  let base = (server.endpoint || "").replace(/\/+$/, "");
  if (base.endsWith("/vps") && path.startsWith("/vps")) {
    base = base.slice(0, -4);
  }
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${server.api_key}`,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const json = await res.json().catch(() => null);
  if (!json) {
    throw new Error(`HTTP ${res.status} (respon bukan JSON)`);
  }
  if (!res.ok) {
    throw new Error(
      (json.meta && json.meta.message) || json.message || `HTTP ${res.status}`
    );
  }
  if (json.success === false) {
    throw new Error((json.message && json.message.message) || json.message || "Gagal");
  }
  return json;
}

function createAccount(server, protocol, opts) {
  if (protocol === "ssh") {
    return apiCall(server, "POST", "/vps/sshvpn", {
      username: opts.username,
      password: opts.password,
      expired: opts.expired,
      limitip: opts.limitip,
    });
  }
  return apiCall(server, "POST", `/vps/${TYPE_SUFFIX[protocol]}all`, {
    username: opts.username,
    kuota: opts.kuota,
    expired: opts.expired,
    limitip: opts.limitip,
    uuidv2: opts.uuid || undefined,
  });
}

function checkConfig(server, protocol, username) {
  return apiCall(
    server,
    "GET",
    `/vps/checkconfig${TYPE_SUFFIX[protocol]}/${encodeURIComponent(username)}`
  );
}

function renewAccount(server, protocol, username, expiredDays, kuotaGb) {
  return apiCall(
    server,
    "PATCH",
    `/vps/renew${TYPE_SUFFIX[protocol]}/${encodeURIComponent(username)}/${expiredDays}`,
    { kuota: kuotaGb }
  );
}

function changeBandwidth(server, protocol, username, kuotaGb, resetBw) {
  return apiCall(server, "POST", `/vps/changelimbw${TYPE_SUFFIX[protocol]}`, {
    username,
    kuota: kuotaGb,
    reset_bw: resetBw ? "yes" : "no",
  });
}

function changeIpLimit(server, protocol, username, limitip) {
  return apiCall(server, "POST", `/vps/changelimip${TYPE_SUFFIX[protocol]}`, {
    username,
    limitip,
  });
}

function lockAccount(server, protocol, username) {
  return apiCall(
    server,
    "PATCH",
    `/vps/lock${TYPE_SUFFIX[protocol]}/${encodeURIComponent(username)}`
  );
}

function unlockAccount(server, protocol, username, password) {
  if (protocol === "ssh") {
    return apiCall(
      server,
      "PATCH",
      `/vps/unlocksshvpn/${encodeURIComponent(username)}/${encodeURIComponent(password)}`
    );
  }
  return apiCall(
    server,
    "PATCH",
    `/vps/unlock${TYPE_SUFFIX[protocol]}/${encodeURIComponent(username)}`
  );
}

function deleteAccount(server, protocol, username) {
  return apiCall(
    server,
    "DELETE",
    `/vps/delete${TYPE_SUFFIX[protocol]}/${encodeURIComponent(username)}`
  );
}

module.exports = {
  createAccount,
  checkConfig,
  renewAccount,
  changeBandwidth,
  changeIpLimit,
  lockAccount,
  unlockAccount,
  deleteAccount,
  TYPE_SUFFIX,
};