# Setup & Run (Development)

Dokumen teknis cara menjalankan aplikasi secara lokal. Untuk deployment produksi lihat plan.md Fase 9.

## Deploy 1-Click (goal.md)

1. Buat repo GitHub publik (contoh: github.com/rohcuan/rohtunnel, branch `main`).
2. Paste `docker-stack.yml` di Portainer → Stacks → Add stack → Deploy. Ubah `APP_REPO`/`APP_BRANCH`/port bila perlu.
3. Setelah berjalan, repo boleh diprivat kembali — source & node_modules sudah tersimpan di container, data di volume `rohtunnel-data` (`/app/data`).
4. Admin pertama: username `admin`, password random dicetak SEKALI di container logs.

Detail `entrypoint.sh`:
- Unduh source: `$APP_REPO/archive/refs/heads/$APP_BRANCH.tar.gz` via node fetch (tanpa curl/wget di image).
- Marker `/app/app/.version` → re-download HANYA bila branch berubah atau source belum ada (tidak auto-update).
- Marker `/app/app/.installed` → `npm install --omit=dev` sekali; fallback install `python3 make g++` bila prebuild better-sqlite3 gagal.
- `exec npm start` (PORT dari env).

Uji lokal dengan podman (host immutable Fedora, via `distrobox-host-exec`):
```bash
# fake repo server (struktur seperti GitHub)
mkdir -p /tmp/opencode/fakerepo/raw/main /tmp/opencode/fakerepo/archive/refs/heads
cp entrypoint.sh /tmp/opencode/fakerepo/raw/main/entrypoint.sh
tar --exclude=node_modules --exclude=data --exclude=.git -czf /tmp/opencode/fakerepo/archive/refs/heads/main.tar.gz -C . .
python3 -m http.server 8000 --directory /tmp/opencode/fakerepo &

distrobox-host-exec podman run -d --name rt-test --network host \
  -e APP_REPO=http://127.0.0.1:8000 -e APP_BRANCH=main -e PORT=3001 \
  -v rt-data:/app/data node:20-slim \
  sh -c 'node -e "fetch(process.env.APP_REPO + \"/raw/\" + process.env.APP_BRANCH + \"/entrypoint.sh\").then(r => { if (!r.ok) process.exit(1); return r.arrayBuffer(); }).then(b => require(\"fs\").writeFileSync(\"/tmp/entrypoint.sh\", Buffer.from(b)))" && sh /tmp/entrypoint.sh'

# verifikasi: log "[app] RohTunnel berjalan", landing 200, restart tanpa re-download
distrobox-host-exec curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/
distrobox-host-exec podman logs rt-test
distrobox-host-exec podman restart rt-test   # harus langsung start (idempoten)
```

## Prasyarat

- Node.js >= 18, npm
- Modul native `better-sqlite3` butuh build tools bila prebuild tidak tersedia:
  `sudo apt install -y build-essential python3` (Debian/Ubuntu)

## Menjalankan

```bash
npm install
npm start            # atau PORT=3000 npm start
# Buka http://localhost:3000
```

## First run (otomatis saat boot)

1. Migrasi SQL di `src/migrations/` diterapkan otomatis (tabel `schema_migrations` mencatat versi).
2. Admin pertama dibuat jika belum ada admin:
   - username: `admin` (bisa dioverride env `ADMIN_USERNAME`)
   - password: **random 12 karakter, dicetak SEKALI di console/log** — salin sebelum hilang.
     Di docker/Portainer ambil dari container logs.
   - Bisa dioverride dengan env `ADMIN_PASSWORD` bila ingin password tetap.
3. Settings default di-seed ke tabel `settings` (hanya jika key belum ada).

## Verifikasi cepat (curl)

```bash
# landing
curl -i http://localhost:3000/
# register user baru (auto-login -> redirect /dashboard)
curl -i -c jar.txt -d "username=test1&password=rahasia123" http://localhost:3000/register
# dashboard dengan cookie
curl -i -b jar.txt http://localhost:3000/dashboard
# login admin
curl -i -c jar2.txt -d "username=admin&password=<password dari log>" http://localhost:3000/login-admin
# admin dashboard
curl -i -b jar2.txt http://localhost:3000/admin
# guard: tanpa login -> 302 /login; user biasa akses /admin -> 403
```

## Menguji Topup QRIS dengan Mock Gateway (tanpa QRIS asli)

1. Jalankan mock (file `/tmp/opencode/mock-qris.js`): `node mock-qris.js` (listen 3100; `/create-qris`, `/check-payment` auto-mark paid, `/token-status`).
2. Login admin → `/admin/setup-qris` → isi endpoint `http://localhost:3100`, key apa saja → Test Koneksi.
3. Register user → `/topup` → isi nominal → halaman QR (iframe) → `/topup/check/:id` → status paid, saldo masuk.
4. PaymentWatcher menyelesaikan topup tanpa check manual dalam ~10 detik (cek di log `[topup] ...`).
5. Reset settings QRIS ke kosong setelah pengujian: lewat UI admin atau SQL.

Catatan: mock dibuat hanya untuk uji lokal; produksi memakai endpoint QRIS asli user.

## Menguji Beli VPN dengan Mock VPN API (tanpa server VPN asli)

1. Jalankan mock (file `/tmp/opencode/mock-vpn.js`): `node mock-vpn.js` (listen 3200; Bearer token `mock-vpn-token`; create akun + checkconfig 4 protocol; username duplikat → 409).
2. Tambahkan server via admin: endpoint `http://localhost:3200`, api_key `mock-vpn-token`. Tambahkan package per protocol.
3. Register user → isi saldo (SQL langsung untuk uji) → `/beli` → pilih server/protocol/package → checkout.
4. Cek `/beli/hasil/:id` untuk config + tombol salin; cek tabel `vpn_accounts` & `transactions` & saldo terpotong.
5. Bersihkan data uji setelah selesai (SQL hapus servers/packages/vpn_accounts/transactions/users uji).

## Struktur direktori

```
src/
├── app.js                 # entry server (init db, seed, routes, listen, start paymentWatcher)
├── db.js                  # koneksi SQLite + migration runner (DB_PATH, default data/rohtunnel.db)
├── seed.js                # seed admin pertama + settings default (DEFAULT_SETTINGS)
├── config.js              # getSetting/setSetting baca-tulis tabel settings
├── migrations/            # file NNN_nama.sql diterapkan otomatis saat boot
├── middleware/
│   ├── auth.js            # loadUser, createSession, destroySession, requireAuth
│   └── admin.js           # requireAdmin
├── routes/
│   ├── auth.js            # /register /login /login-admin /logout
│   ├── dashboard.js       # /dashboard (user)
│   ├── topup.js           # /topup, /topup/:id, /topup/check/:id
│   ├── beli.js            # /beli, /beli/hasil/:id
│   ├── akun.js            # /akun + aksi (renew/add-bw/add-ip/lock/unlock/delete/refresh) + /akun/:id/config(/:templateId)
│   ├── recovery.js        # /recovery, /recovery/:id (buat ulang akun deleted/expired)
│   ├── admin.js           # /admin, /admin/setup-qris, /admin/test-qris
│   ├── adminServers.js    # /admin/servers (CRUD) + /admin/servers/:id/packages
│   ├── adminUsers.js      # /admin/users + /admin/users/:id (adjust saldo, akun user, riwayat)
│   ├── adminAkun.js       # /admin/akun (semua akun + find + filter)
│   ├── adminActions.js    # POST aksi akun admin (/admin/akun/:id/lock|unlock|bandwidth|ip|delete)
│   └── adminSetup.js      # /admin/setup hub + telegram/notif/backup/templates/restore (multer memoryStorage)
├── services/
│   ├── qris.js            # wrapper gopay-api-gateaway (createQris, checkPayment, tokenStatus)
│   ├── telegram.js        # sendMessage + sendDocument (env TELEGRAM_API_BASE untuk uji lokal)
│   ├── vpnApi.js          # wrapper Potato API (createAccount, checkConfig, renew, changeBandwidth,
│   │                      #   changeIpLimit, lock, unlock, delete) — WAJIB throw error pada HTTP non-OK
│   ├── configBuilder.js   # parse raw_config vpn_accounts → daftar {label, value} untuk UI
│   ├── templateRenderer.js# isi {{variabel}} pada template config dari data akun
│   ├── adminAccountActions.js # aksi akun admin (lock/unlock/setBW/setIP/remove) via API + DB
│   ├── backup.js          # createBackupFile (db.backup), listBackups, runBackup (kirim ke TG)
│   └── notifier.js        # notif Telegram sesuai checklist settings (topup/adjust/purchase)
├── jobs/
│   ├── paymentWatcher.js  # poll topup pending tiap 10s → settle saldo → notif Telegram
│   └── backupWatcher.js   # cek jadwal backup tiap 30s (daily/weekly/monthly, anti duplikat last_slot)
├── views/                 # EJS: partials/head+footer, landing, login, register, login-admin,
│                          # dashboard, topup, topup-qr, beli, beli-hasil, akun, akun-config,
│                          # akun-config-detail, recovery, recovery-form, admin/, 404
└── public/style.css
data/rohtunnel.db          # database (di-ignore git, jadi volume di docker)
```

Catatan: migrasi `004_vpn_accounts.sql` menambah tabel `vpn_accounts` & `transactions`; `005_config_templates.sql` menambah tabel `config_templates` + kolom `days`/`price`; `006_recovery.sql` menambah kolom `deleted_at` (soft delete untuk recovery); `007_backup_settings.sql` menambah tabel `backup_settings`.

## Menguji Telegram & Backup tanpa bot asli

1. Jalankan mock TG: `node /tmp/opencode/mock-tg.js` (listen 3300, log panggilan ke `/tmp/opencode/mock-tg.log`).
2. Jalankan app dengan `TELEGRAM_API_BASE=http://localhost:3300` (produksi tanpa env → API asli).
3. Set bot token & chat id apa saja di `/admin/setup-telegram` → "Simpan & Kirim Test".
4. Nyalakan checklist notif di `/admin/setup-notif`, trigger topup/adjust/beli → cek log mock.
5. Backup: `/admin/setup-backup` → "Backup & Kirim Sekarang" atau set jadwal harian ke jam:menit sekarang (watcher cek tiap 30 detik).
6. Restore: upload `.db` di `/admin/restore` → restart app → log `[restore] DB dipulihkan dari restore-pending.db`, DB lama diarsipkan `pre-restore-*.db`.

## Konvensi pengembangan

- **Menambah tabel**: buat file `src/migrations/NNN_nama.sql` (nomor urut), jangan edit file migrasi lama.
- **Konfigurasi**: semua lewat tabel `settings` via `src/config.js`, jangan tambah `.env`.
- **Secret**: jangan pernah menaruh secret di file yang masuk git (folder `data/`, `.env`, dsb sudah di-ignore).
- **Session**: cookie `session_token` (httpOnly) → baris di `login_sessions` (TTL 30 hari, validasi saat request).
- **Format uang**: `saldo` & `amount` disimpan sebagai INTEGER rupiah.