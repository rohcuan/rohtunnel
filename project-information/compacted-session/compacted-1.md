# Compacted Chat — RohTunnel (Sesi 1)

> **Dokumen kompaksi percakapan** — dibuat 2026-08-29 (±09:00 WIB / 02:00 UTC).
> Tujuan: ringkasan lengkap keputusan, pekerjaan, dan state proyek agar sesi berikutnya bisa lanjut tanpa kehilangan konteks.
> File terkait lain: `blueprint.md`, `goal.md`, `plan.md`, `progress.md`, `setup-run.md`, `bug-found.md`, `bug-fixed.md`.

---

## 1. Gambaran Proyek

Website penjual VPN (SSH tunnel + v2ray vmess/vless/trojan) dengan topup saldo via QRIS.

- **Alur pengguna:** Landing → Login/Register → Dashboard (Beli VPN, Akun VPN Saya, Topup Saldo, Hubungi Admin)
- **Admin:** Manage Server + Pricing Package, User Manager, Manager Akun VPN (find), Setup QRIS/Telegram/Notif/Autobackup/Template Config, Restore Backup
- **Constraint (goal.md):** deploy 1-click via docker swarm/Portainer — entrypoint install-sekali/start-terus, tanpa auto-update, semua konfigurasi dari DB bukan .env

## 2. Stack & Keputusan Arsitektur

- **Backend:** Node.js ≥18 (Express, EJS server-side render, better-sqlite3 WAL, bcryptjs, cookie-parser, multer memoryStorage)
- **DB:** SQLite (`data/rohtunnel.db`, migration runner otomatis `src/migrations/NNN_*.sql` + tabel `schema_migrations`)
- **Integrasi eksternal:**
  - VPN API "Potato Tunneling API" (`http://rohserver1.dpdns.org`, Bearer token per server) — 4 protocol: ssh/vmess/vless/trojan
  - QRIS gateway gopay-api-gateaway (dihosting user, eksternal) — create-qris/check-payment/token-status
  - Telegram Bot API (notif + backup via sendDocument); env `TELEGRAM_API_BASE` untuk uji lokal (produksi tanpa env)
- **Semua secret & konfigurasi di tabel `settings`** (bukan .env) — sesuai goal.md
- **Status akun:** `active` / `locked` (user) / `admin_locked` (admin, user tidak bisa unlock) / `deleted` (soft delete untuk recovery)

## 3. Fase yang Diselesaikan (plan.md 0-9)

| Fase | Isi |
|---|---|
| 0 | Scaffold Express+SQLite, auth (register/login/logout/login-admin), session DB, seed admin & settings, landing/dashboard |
| 2 | Topup QRIS: halaman topup + QR iframe + polling, `paymentWatcher` (10s, settle saldo atomik, anti double-credit, expire 5 menit), setup-qris admin |
| 3 | Server & Package: CRUD server (endpoint/api_key/country/limit_vpn), pricing per protocol per server |
| 4 | Beli VPN: pilih server/protocol/package (JS dinamis), username/uuid opsional, create via Potato API, simpan akun + transaksi atomik |
| 5 | Akun Saya & Config Siap Pakai: list akun, manage (renew/+BW/+IP/lock/unlock/hapus/refresh), 7 template placeholder (XL Edu, XL Conference, XL Addon XCP, Tsel Ilmupedia, Tsel Halo Flexy+, Biz Line, Biz WA) dengan variabel `{{username}} {{uuid}} {{hostname}} {{port_tls}} {{link_*}}` dll |
| 6 | Recovery Akun: soft-delete (`deleted_at`), akun deleted/expired bisa dibeli ulang (set kuota/limitIP, username bisa ganti) |
| 7 | Admin: User Manager (topup/kurangi/set saldo → transaksi `adjust`), Manager Akun VPN (find by username/pemilik, filter protocol/server/status), partial aksi bersama `akun-actions` |
| 8 | Telegram & Backup: setup bot+test, checklist notif (`notif_topup/adjust/purchase` via `notifier.js`), autobackup harian/mingguan/bulanan (`backupWatcher` 30s, anti duplikat `last_slot`), restore (upload → `restore-pending.db` + marker → diterapkan saat restart, DB lama diarsipkan `pre-restore-*.db`), CRUD template config admin |
| 9 | Deploy: `entrypoint.sh` (unduh source dari repo via node fetch, marker `.version` no auto-update, `npm install` sekali marker `.installed`, fallback build tools) + `docker-stack.yml` (node:20-slim, volume data, command unduh entrypoint lalu jalankan) + `Dockerfile` opsional |

## 4. Bug Ditemukan & Diperbaiki (lengkap di bug-found.md / bug-fixed.md)

- **BUG-001** — `vpnApi` tidak throw pada HTTP non-OK → crash UNIQUE constraint saat username duplikat. Fix: cek `!res.ok` throw error.
- **BUG-002** — multer `diskStorage` menggantung pada upload → ganti `memoryStorage` + tulis manual.
- **BUG-003** — entrypoint salah extract tarball GitHub (folder `rohtunnel-main/`) → deteksi folder tunggal sebelum `cp -a`.
- **BUG-004** — `DB_PATH` default mengarah `/app/app/data` (bukan volume `/app/data`) → entrypoint `export DB_PATH="$DATA_DIR/rohtunnel.db"` + `BACKUP_DIR`; `adminSetup.js` pakai `path.dirname(DB_PATH)`.
- **BUG-005** — endpoint Potato API dobel `/vps` (admin isi `.../vps`, path swagger sudah termasuk `/vps`) → normalisasi di `vpnApi.js` (strip trailing `/vps` bila path diawali `/vps`). **Baku baru: endpoint diisi TANPA /vps** (placeholder form sudah diubah + hint).

## 5. Deployment & Environment

- **Repo:** github.com/rohcuan/rohtunnel (branch `main`) — saat ini **PUBLIC** (dipublik untuk testing; user harus privatkan setelah deploy produksi, sesuai alur goal.md)
- **Environment dev:** distrobox container (Debian 12, Node 18.20 lokal) + host immutable Fedora dengan podman 5.8 (via `distrobox-host-exec`)
- **Container dev:** `rohtunnel-dev` (podman, `--network host`, PORT 3000, volume `rohtunnel-dev-data:/app/data`) — **APP_REPO GitHub asli**, berjalan di http://localhost:3000
- **Kredensial:** admin/admin (default baru, ganti segera); user test `realuser` / `rahasia123`
- **Catatan penting:**
  - App TIDAK auto-update (by design) — perubahan code di container dev harus di-patch manual via `podman exec` lalu restart
  - `raw.githubusercontent.com` CDN cache ~2-4 menit setelah push (verifikasi konten dengan curl sebelum restart container)
  - `pkill -f "node src/app.js"` mematikan shell sendiri (pattern match cmdline) — pakai kill by PID

## 6. Hasil Real Testing (server Potato asli)

- Akun **`realuser1`** & **`realuser2`** dibuat di rohserver1 (vless, 200GB/3IP/30hari, Rp7.000) — sengaja dibiarkan aktif untuk dicek user
- Verifikasi: beli (saldo terpotong, transaksi tercatat), hasil config (link vless:// real), config siap pakai ter-render tanpa placeholder, refresh config, renew (+30 hari dari expired saat ini), add-ip (3→4→6), lock/unlock, saldo akhir 79.000

## 7. Perubahan UI Terakhir (commit terbaru)

1. **Manager Akun VPN dirombak**: tabel 9 kolom → card list (`admin/partials/akun-card.ejs` + `akun-actions.ejs` didesain ulang: form `act-form` berlabel) — dipakai juga di user-detail
2. **Mobile friendly menyeluruh**: `.table-wrap` (scroll horizontal) untuk semua tabel, media queries 768px/640px (form/kolom/card-grid/kv-row/aksi vertikal, tabs scroll, header wrap)
3. **Landing page tidak menampilkan saldo** walau logged in (flag `hideSaldo`, default false di locals middleware)
4. **Admin tidak bisa login sebagai user**: /login tolak admin (403), semua halaman user pakai `requireUser` (admin → redirect /admin)

## 8. State Saat Ini & Lanjutan Opsional

- Semua fase plan.md selesai; container dev berjalan; repo ter-push
- **Sisa opsional:** isi template config asli (masih placeholder, bisa diedit di /admin/setup-templates), pricing per-aksi (saat ini semua aksi manage = snapshot harga beli), pemakaian bandwidth dari API (belum tersedia di API Potato — UI tampil "—")
- Konvensi: dokumentasi penting selalu dicatat di `project-information/` (jangan hapus file, boleh tambah); user berkomunikasi dalam Bahasa Indonesia