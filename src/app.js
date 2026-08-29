"use strict";

const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const { initDb } = require("./db");
const { ensureSeed } = require("./seed");
const { setDb, getSetting } = require("./config");
const { loadUser } = require("./middleware/auth");
const { startPaymentWatcher } = require("./jobs/paymentWatcher");
const { startBackupWatcher } = require("./jobs/backupWatcher");

const db = initDb();
ensureSeed(db);
setDb(db);

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(loadUser(db));

app.use((req, res, next) => {
  res.locals.user = req.user;
  res.locals.bodyClass = null;
  res.locals.siteName = getSetting("site_name", "RohTunnel");
  res.locals.contactAdmin = getSetting(
    "contact_admin",
    "https://t.me/your_admin_here"
  );
  res.locals.hideSaldo = false;
  res.locals.formatRupiah = (n) =>
    "Rp" + Number(n || 0).toLocaleString("id-ID");
  res.locals.statusLabel = (s) =>
    ({
      pending: "Menunggu",
      paid: "Lunas",
      expired: "Kedaluwarsa",
      active: "Aktif",
      locked: "Terkunci",
      admin_locked: "Terkunci Admin",
    }[s] || s);
  next();
});

app.get("/", (req, res) => {
  res.render("landing", { title: "Beranda", hideSaldo: true });
});

app.use("/", require("./routes/auth")(db));
app.use("/", require("./routes/dashboard")(db));
app.use("/", require("./routes/topup")(db));
app.use("/", require("./routes/beli")(db));
app.use("/", require("./routes/akun")(db));
app.use("/", require("./routes/recovery")(db));
app.use("/", require("./routes/admin")(db));
app.use("/", require("./routes/adminServers")(db));
app.use("/", require("./routes/adminUsers")(db));
app.use("/", require("./routes/adminAkun")(db));
app.use("/", require("./routes/adminActions")(db));
app.use("/", require("./routes/adminSetup")(db));

app.use((req, res) => {
  res.status(404).render("404", { title: "Tidak ditemukan" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[app] RohTunnel berjalan di port ${PORT}`);
});

startPaymentWatcher(db);
startBackupWatcher(db);