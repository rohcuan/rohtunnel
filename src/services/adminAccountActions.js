"use strict";

const vpnApi = require("./vpnApi");

async function lock(db, account, server) {
  await vpnApi.lockAccount(server, account.protocol, account.username);
  db.prepare("UPDATE vpn_accounts SET status = 'admin_locked' WHERE id = ?").run(
    account.id
  );
}

async function unlock(db, account, server) {
  await vpnApi.unlockAccount(
    server,
    account.protocol,
    account.username,
    account.password || ""
  );
  db.prepare("UPDATE vpn_accounts SET status = 'active' WHERE id = ?").run(
    account.id
  );
}

async function setBandwidth(db, account, server, kuotaGb, resetBw) {
  await vpnApi.changeBandwidth(
    server,
    account.protocol,
    account.username,
    kuotaGb,
    !!resetBw
  );
  db.prepare("UPDATE vpn_accounts SET kuota_gb = ? WHERE id = ?").run(
    kuotaGb,
    account.id
  );
}

async function setIp(db, account, server, limitip) {
  await vpnApi.changeIpLimit(server, account.protocol, account.username, limitip);
  db.prepare("UPDATE vpn_accounts SET limit_ip = ? WHERE id = ?").run(
    limitip,
    account.id
  );
}

async function remove(db, account, server) {
  await vpnApi.deleteAccount(server, account.protocol, account.username);
  db.prepare(
    "UPDATE vpn_accounts SET status = 'deleted', deleted_at = ? WHERE id = ?"
  ).run(new Date().toISOString(), account.id);
}

module.exports = { lock, unlock, setBandwidth, setIp, remove };