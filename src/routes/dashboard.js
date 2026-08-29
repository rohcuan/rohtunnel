"use strict";

const express = require("express");
const { requireUser } = require("../middleware/auth");

module.exports = (db) => {
  const router = express.Router();

  router.get("/dashboard", requireUser, (req, res) => {
    res.render("dashboard", { title: "Dashboard", user: req.user });
  });

  return router;
};
