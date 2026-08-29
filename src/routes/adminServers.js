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

  router.get("/admin/servers", requireAdmin, (req, res) => {
    res.render("admin/servers", {
      title: "Manage Server",
      user: req.user,
      servers: listServers.all(),
      error: null,
    });
  });

  router.post("/admin/servers/add", requireAdmin, (req, res) => {
    const code = (req.body.code || "").trim().toUpperCase();
    const label = (req.body.label || "").trim();
    const endpoint = (req.body.endpoint || "").trim();
    const apiKey = (req.body.api_key || "").trim();
    const country = (req.body.country || "").trim();
    const limitVpn = parseInt(req.body.limit_vpn, 10);

    const renderError = (error) =>
      res.status(400).render("admin/servers", {
        title: "Manage Server",
        user: req.user,
        servers: listServers.all(),
        error,
      });

    if (!CODE_RE.test(code)) {
      return renderError("Kode server wajib 2-20 karakter (huruf besar, angka, -)");
    }
    if (getServerByCode.get(code)) {
      return renderError(`Kode server ${code} sudah dipakai`);
    }
    if (!label || label.length > 100) {
      return renderError("Label server wajib diisi (maks 100 karakter)");
    }
    if (!/^https?:\/\/.+/i.test(endpoint)) {
      return renderError("Endpoint harus diawali http:// atau https://");
    }
    if (!apiKey) {
      return renderError("API key server wajib diisi");
    }
    if (!COUNTRIES.includes(country)) {
      return renderError("Country harus salah satu: id, sg, us");
    }
    if (!Number.isInteger(limitVpn) || limitVpn < 0) {
      return renderError("Limit VPN harus angka >= 0 (0 = tanpa batas)");
    }

    db.prepare(
      "INSERT INTO servers (code, label, endpoint, api_key, country, limit_vpn) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(code, label, endpoint, apiKey, country, limitVpn);

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