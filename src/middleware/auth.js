"use strict";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

function loadUser(db) {
  return (req, res, next) => {
    req.user = null;
    const token = req.cookies && req.cookies.session_token;
    if (!token) return next();

    const row = db
      .prepare(
        `SELECT s.token, s.expires_at, u.id, u.username, u.email, u.saldo, u.is_admin
         FROM login_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = ?`
      )
      .get(token);

    if (!row) return next();

    if (new Date(row.expires_at) < new Date()) {
      db.prepare("DELETE FROM login_sessions WHERE token = ?").run(token);
      return next();
    }

    req.user = {
      id: row.id,
      username: row.username,
      email: row.email,
      saldo: row.saldo,
      is_admin: !!row.is_admin,
    };
    next();
  };
}

function createSession(db, userId, res) {
  const token = cryptoRandomHex(24);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare(
    "INSERT INTO login_sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
  ).run(token, userId, expiresAt);
  res.cookie("session_token", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
  });
  return token;
}

function destroySession(db, req, res) {
  const token = req.cookies && req.cookies.session_token;
  if (token) {
    db.prepare("DELETE FROM login_sessions WHERE token = ?").run(token);
  }
  res.clearCookie("session_token");
}

function requireAuth(req, res, next) {
  if (!req.user) return res.redirect("/login");
  next();
}

function requireUser(req, res, next) {
  if (!req.user) return res.redirect("/login");
  if (req.user.is_admin) return res.redirect("/admin");
  next();
}

function cryptoRandomHex(bytes) {
  const crypto = require("crypto");
  return crypto.randomBytes(bytes).toString("hex");
}

module.exports = { loadUser, createSession, destroySession, requireAuth, requireUser };
