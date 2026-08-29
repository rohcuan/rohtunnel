"use strict";

const express = require("express");
const { requireAuth } = require("../middleware/auth");

module.exports = (db) => {
  const router = express.Router();

  router.get("/dashboard", requireAuth, (req, res) => {
    res.render("dashboard", { title: "Dashboard", user: req.user });
  });

  return router;
};
