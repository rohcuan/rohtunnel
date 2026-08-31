"use strict";

const express = require("express");
const { createSession, destroySession } = require("../middleware/auth");

const USERNAME_RE = /^[a-z0-9]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = (db) => {
  const router = express.Router();

  const findUserByIdentifier = db.prepare(
    "SELECT * FROM users WHERE username = ? OR email = ?"
  );
  const findUserByUsername = db.prepare(
    "SELECT * FROM users WHERE username = ?"
  );
  const findUserByEmail = db.prepare("SELECT * FROM users WHERE email = ?");

  const redirectHome = (req, res) =>
    res.redirect(req.user && req.user.is_admin ? "/admin" : "/dashboard");

  router.get("/register", (req, res) => {
    if (req.user) return redirectHome(req, res);
    res.render("register", { title: "Daftar", error: null });
  });

  router.post("/register", (req, res) => {
    const username = (req.body.username || "").trim().toLowerCase();
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";

    if (!USERNAME_RE.test(username)) {
      return res
        .status(400)
        .render("register", {
          title: "Daftar",
          error: "Username 3-20 karakter, huruf/angka kecil (a-z, 0-9) saja",
        });
    }
    if (!EMAIL_RE.test(email)) {
      return res
        .status(400)
        .render("register", {
          title: "Daftar",
          error: "Format email tidak valid",
        });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .render("register", {
          title: "Daftar",
          error: "Password minimal 6 karakter",
        });
    }
    if (findUserByUsername.get(username)) {
      return res
        .status(409)
        .render("register", { title: "Daftar", error: "Username sudah dipakai" });
    }
    if (findUserByEmail.get(email)) {
      return res
        .status(409)
        .render("register", { title: "Daftar", error: "Email sudah terdaftar" });
    }

    const info = db
      .prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)")
      .run(username, email, password);

    createSession(db, info.lastInsertRowid, res);
    res.redirect("/dashboard");
  });

  router.get("/login", (req, res) => {
    if (req.user) return redirectHome(req, res);
    res.render("login", { title: "Masuk", error: null });
  });

  router.post("/login", (req, res) => {
    const identifier = (req.body.username || "").trim().toLowerCase();
    const password = req.body.password || "";

    const user = findUserByIdentifier.get(identifier, identifier);
    if (!user || password !== user.password_hash) {
      return res
        .status(401)
        .render("login", { title: "Masuk", error: "Username/email atau password salah" });
    }
    if (user.is_admin) {
      return res
        .status(403)
        .render("login", {
          title: "Masuk",
          error: "Akun admin masuk lewat halaman Login Admin",
        });
    }

    createSession(db, user.id, res);
    res.redirect("/dashboard");
  });

  router.get("/login-admin", (req, res) => {
    if (req.user && req.user.is_admin) return res.redirect("/admin");
    res.render("login-admin", { title: "Login Admin", error: null });
  });

  router.post("/login-admin", (req, res) => {
    const identifier = (req.body.username || "").trim().toLowerCase();
    const password = req.body.password || "";

    const user = findUserByIdentifier.get(identifier, identifier);
    if (!user || !user.is_admin || password !== user.password_hash) {
      return res
        .status(401)
        .render("login-admin", { title: "Login Admin", error: "Kredensial admin salah" });
    }

    createSession(db, user.id, res);
    res.redirect("/admin");
  });

  router.get("/logout", (req, res) => {
    destroySession(db, req, res);
    res.redirect("/");
  });

  return router;
};
