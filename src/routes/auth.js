"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const { createSession, destroySession } = require("../middleware/auth");

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,20}$/;

module.exports = (db) => {
  const router = express.Router();

  const findUserByUsername = db.prepare(
    "SELECT * FROM users WHERE username = ?"
  );

  router.get("/register", (req, res) => {
    if (req.user) return res.redirect("/dashboard");
    res.render("register", { title: "Daftar", error: null });
  });

  router.post("/register", (req, res) => {
    const username = (req.body.username || "").trim();
    const password = req.body.password || "";

    if (!USERNAME_RE.test(username)) {
      return res
        .status(400)
        .render("register", {
          title: "Daftar",
          error: "Username 3-20 karakter (huruf, angka, . _ -)",
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

    const hash = bcrypt.hashSync(password, 10);
    const info = db
      .prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
      .run(username, hash);

    createSession(db, info.lastInsertRowid, res);
    res.redirect("/dashboard");
  });

  router.get("/login", (req, res) => {
    if (req.user) return res.redirect("/dashboard");
    res.render("login", { title: "Masuk", error: null });
  });

  router.post("/login", (req, res) => {
    const username = (req.body.username || "").trim();
    const password = req.body.password || "";

    const user = findUserByUsername.get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res
        .status(401)
        .render("login", { title: "Masuk", error: "Username atau password salah" });
    }

    createSession(db, user.id, res);
    res.redirect("/dashboard");
  });

  router.get("/login-admin", (req, res) => {
    if (req.user && req.user.is_admin) return res.redirect("/admin");
    res.render("login-admin", { title: "Login Admin", error: null });
  });

  router.post("/login-admin", (req, res) => {
    const username = (req.body.username || "").trim();
    const password = req.body.password || "";

    const user = findUserByUsername.get(username);
    if (!user || !user.is_admin || !bcrypt.compareSync(password, user.password_hash)) {
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
