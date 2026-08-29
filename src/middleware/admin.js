"use strict";

const { requireAuth } = require("./auth");

function requireAdmin(req, res, next) {
  if (!req.user) return res.redirect("/login-admin");
  if (!req.user.is_admin) return res.status(403).send("Forbidden");
  next();
}

module.exports = { requireAdmin };
