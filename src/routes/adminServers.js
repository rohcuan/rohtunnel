"use strict";

const express = require("express");
const { requireAdmin } = require("../middleware/admin");

const PROTOCOLS = ["ssh", "vmess", "vless", "trojan"];
const COUNTRIES = ["id", "sg", "us"];
const CODE_RE = /^[A-Z0-9-]{2,20}$/;

module.exports = (db) => {
  const router = express.Router();

  const getServer = db.prepare("SELECT * FROM servers WHERE id = ?");
  const listServers = db.prepare("SELECT * FROM servers ORDER BY id");
  const getServerByCode = db.prepare("SELECT id FROM servers WHERE code = ?");
  const listPackages = db.prepare(
    "SELECT * FROM packages WHERE server_id = ? AND protocol = ? ORDER BY id"
  );
  const getPackage = db.prepare("SELECT * FROM packages WHERE id = ?");

  // ============ Servers ============

  const validateServer = (input) => {
    const code = (input.code || "").trim().toUpperCase();
    const label = (input.label || "").trim();
    const endpoint = (input.endpoint || "").trim();
    const apiKey = (input.api_key || "").trim();
    const country = (input.country || "").trim();
    const limitVpn = parseInt(input.limit_vpn, 10);
    const data = { code, label, endpoint, apiKey, country, limitVpn };

    if (!CODE_RE.test(code)) {
      return { error: "Kode server wajib 2-20 karakter (huruf besar, angka, -)", data };
    }
    if (!label || label.length > 100) {
      return { error: "Label server wajib diisi (maks 100 karakter)", data };
    }
    if (!/^https?:\/\/.+/i.test(endpoint)) {
      return { error: "Endpoint harus diawali http:// atau https://", data };
    }
    if (!apiKey) {
      return { error: "API key server wajib diisi", data };
    }
    if (!COUNTRIES.includes(country)) {
      return { error: "Country harus salah satu: id, sg, us", data };
    }
    if (!Number.isInteger(limitVpn) || limitVpn < 0) {
      return { error: "Limit VPN harus angka >= 0 (0 = tanpa batas)", data };
    }
    return { data };
  };

  const serverForm = (res, req, servers, editing, error) => {
    const formData = (editing && editing.formData) || {};
    const values = {
      code: formData.code !== undefined ? formData.code : (editing ? editing.code : ""),
      label: formData.label !== undefined ? formData.label : (editing ? editing.label : ""),
      endpoint: formData.endpoint !== undefined ? formData.endpoint : (editing ? editing.endpoint : ""),
      api_key: formData.api_key !== undefined ? formData.api_key : (editing ? editing.api_key : ""),
      country: formData.country !== undefined ? formData.country : (editing ? editing.country : "id"),
      limit_vpn: formData.limit_vpn !== undefined ? formData.limit_vpn : (editing ? editing.limit_vpn : "0"),
    };
    res.status(error ? 400 : 200).render("admin/servers", {
      title: "Manage Server",
      user: req.user,
      servers,
      editing: editing ? editing : null,
      values,
      error,
    });
  };

  router.get("/admin/servers", requireAdmin, (req, res) => {
    const editId = parseInt(req.query.edit, 10);
    const editing = Number.isInteger(editId) ? getServer.get(editId) : null;
    serverForm(res, req, listServers.all(), editing, null);
  });

  router.post("/admin/servers/add", requireAdmin, (req, res) => {
    const { error, data } = validateServer(req.body);
    if (error) {
      return serverForm(res, req, listServers.all(), { formData: req.body }, error);
    }
    if (getServerByCode.get(data.code)) {
      return serverForm(res, req, listServers.all(), { formData: req.body }, `Kode server ${data.code} sudah dipakai`);
    }

    db.prepare(
      "INSERT INTO servers (code, label, endpoint, api_key, country, limit_vpn) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(data.code, data.label, data.endpoint, data.apiKey, data.country, data.limitVpn);

    res.redirect("/admin/servers");
  });

  router.post("/admin/servers/:id/edit", requireAdmin, (req, res) => {
    const server = getServer.get(req.params.id);
    if (!server) return res.status(404).render("404", { title: "Tidak ditemukan" });

    const { error, data } = validateServer(req.body);
    if (error) {
      return serverForm(res, req, listServers.all(), { id: server.id, formData: req.body }, error);
    }
    const dup = getServerByCode.get(data.code);
    if (dup && dup.id !== server.id) {
      return serverForm(res, req, listServers.all(), { id: server.id, formData: req.body }, `Kode server ${data.code} sudah dipakai`);
    }

    db.prepare(
      "UPDATE servers SET code = ?, label = ?, endpoint = ?, api_key = ?, country = ?, limit_vpn = ? WHERE id = ?"
    ).run(data.code, data.label, data.endpoint, data.apiKey, data.country, data.limitVpn, server.id);

    res.redirect("/admin/servers");
  });

  router.post("/admin/servers/:id/delete", requireAdmin, (req, res) => {
    db.prepare("DELETE FROM servers WHERE id = ?").run(req.params.id);
    res.redirect("/admin/servers");
  });

  // ============ Packages ============

  router.get("/admin/servers/:id/packages", requireAdmin, (req, res) => {
    const server = getServer.get(req.params.id);
    if (!server) return res.status(404).render("404", { title: "Tidak ditemukan" });

    const protocol = PROTOCOLS.includes(req.query.protocol)
      ? req.query.protocol
      : "ssh";

    res.render("admin/packages", {
      title: "Pricing VPN",
      user: req.user,
      server,
      protocol,
      protocols: PROTOCOLS,
      packages: listPackages.all(server.id, protocol),
      error: null,
    });
  });

  router.post("/admin/servers/:serverId/packages/add", requireAdmin, (req, res) => {
    const server = getServer.get(req.params.serverId);
    if (!server) return res.status(404).render("404", { title: "Tidak ditemukan" });

    const protocol = (req.body.protocol || "").trim();
    const name = (req.body.name || "").trim();
    const price = parseInt(req.body.price, 10);
    const kuotaGb = parseInt(req.body.kuota_gb, 10);
    const limitIp = parseInt(req.body.limit_ip, 10);
    const days = parseInt(req.body.days, 10);

    const backUrl = `/admin/servers/${server.id}/packages?protocol=${encodeURIComponent(protocol)}`;
    const renderError = (error) =>
      res.status(400).render("admin/packages", {
        title: "Pricing VPN",
        user: req.user,
        server,
        protocol: PROTOCOLS.includes(protocol) ? protocol : "ssh",
        protocols: PROTOCOLS,
        packages: listPackages.all(
          server.id,
          PROTOCOLS.includes(protocol) ? protocol : "ssh"
        ),
        error,
      });

    if (!PROTOCOLS.includes(protocol)) {
      return renderError("Protocol tidak valid");
    }
    if (!name || name.length > 50) {
      return renderError("Nama package wajib diisi (maks 50 karakter)");
    }
    if (!Number.isInteger(price) || price < 1000 || price > 10000000) {
      return renderError("Harga harus antara 1.000 - 10.000.000 rupiah");
    }
    if (!Number.isInteger(kuotaGb) || kuotaGb < 1 || kuotaGb > 10000) {
      return renderError("Kuota harus 1 - 10.000 GB");
    }
    if (!Number.isInteger(limitIp) || limitIp < 1 || limitIp > 100) {
      return renderError("Limit IP harus 1 - 100");
    }
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      return renderError("Durasi harus 1 - 3650 hari");
    }

    db.prepare(
      `INSERT INTO packages (server_id, protocol, name, price, kuota_gb, limit_ip, days)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(server.id, protocol, name, price, kuotaGb, limitIp, days);

    res.redirect(backUrl);
  });

  router.post("/admin/packages/:id/delete", requireAdmin, (req, res) => {
    const pkg = getPackage.get(req.params.id);
    if (!pkg) return res.redirect("/admin/servers");
    db.prepare("DELETE FROM packages WHERE id = ?").run(pkg.id);
    res.redirect(
      `/admin/servers/${pkg.server_id}/packages?protocol=${encodeURIComponent(pkg.protocol)}`
    );
  });

  return router;
};