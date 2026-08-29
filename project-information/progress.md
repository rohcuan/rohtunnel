# Progress

## Auth: Email + Username lowercase — SELESAI (29 Agustus 2026)

- [x] Migrasi `008_user_email.sql`: kolom `email` di `users` (nullable, UNIQUE index — user lama/admin tanpa email tetap valid)
- [x] Register wajib email + username + password; username divalidasi `^[a-z0-9]{3,20}$` (huruf/angka kecil saja, otomatis di-lowercase), email format standar, duplikat email/username ditolak (409)
- [x] Login (user & admin) menerima username ATAU email + password (`WHERE username = ? OR email = ?`)
- [x] View: form register + field email + pattern username; label login "Username atau Email"
- [x] Admin user manager menampilkan kolom email (list & detail)
- [x] Container test `rohtunnel-dev` diperbarui: commit ac271c4 di-push ke GitHub, source dihapus di container + restart (entrypoint unduh ulang + npm install), migrasi 008 diterapkan ke DB container (user lama tetap, email NULL), register/login by username/email/validasi terverifikasi via `podman exec`

## Test Real Potato API — SELESAI (29 Agustus 2026)

- [x] Konfigurasi user: server ID1 (rohserver1.dpdns.org/vps, key valid), package vless 200GB/3IP/30hari Rp7.000
- [x] **BUG-005** ditemukan & diperbaiki: endpoint `/vps` dobel (swagger path sudah termasuk /vps) → normalisasi di `vpnApi.js`
- [x] Alur beli real: user realuser1 (saldo diset 100.000) → beli vless → **akun `realuser1` dibuat di server asli** (uuid server-generated), saldo 93.000, transaksi tercatat
- [x] Halaman hasil: link vless:// (tls/none/grpc/up), hostname, port, uuid real
- [x] Config siap pakai (XL Edu) ter-render data real tanpa placeholder
- [x] Refresh config (checkconfig server) OK
- [x] Manage real: renew (+30 hari, expired 2026-09-28→10-28), add-ip (3→4), lock/unlock — saldo akhir 79.000
- [x] Akun `realuser1` dibiarkan aktif di server untuk dicek user

## Default Admin admin/admin + BUG-004 (29 Agustus 2026)

- [x] Seed admin pertama: username `admin`, password `admin` (override via env `ADMIN_USERNAME`/`ADMIN_PASSWORD`), pesan log "segera ganti password"
- [x] **BUG-004** ditemukan & diperbaiki: `DB_PATH` di container mengarah ke `/app/app/data` (bukan volume `/app/data`) → entrypoint export `DB_PATH`/`BACKUP_DIR`; `adminSetup.js` pakai `path.dirname(DB_PATH)`
- [x] Container dev `rohtunnel-dev` diperbaiki: DB dipindah ke volume, admin login `admin/admin` terverifikasi (password lama 401)

## Test Real GitHub — SELESAI (29 Agustus 2026)

- [x] Repo **github.com/rohcuan/rohtunnel dibuat PUBLIC** untuk testing (user akan privatkan kembali setelah deploy produksi)
- [x] Container dev `rohtunnel-dev` jalan di host via podman (`--network host`, `PORT=3000`, volume `rohtunnel-dev-data`) memakai `APP_REPO` GitHub asli + `docker-stack.yml` command yang sama dengan produksi
- [x] BUG-003 ditemukan & diperbaiki (struktur tarball GitHub): entrypoint kini deteksi folder tunggal `repo-branch/` — lihat bug-found/fixed
- [x] Verifikasi: install pertama sukses (migrasi + seed + app jalan), landing 200, register/login, dashboard, topup/beli/akun, admin login + halaman admin
- [x] Catatan: `raw.githubusercontent.com` CDN cache ~2-4 menit setelah push

## Fase 9: Deploy 1-Click — SELESAI (29 Agustus 2026)

- [x] Repo GitHub dibuat: **github.com/rohcuan/rohtunnel** (private, branch `main`) — diprivat/dipublik manual oleh user sesuai goal.md
- [x] `entrypoint.sh` (root repo): unduh source dari `APP_REPO/archive/refs/heads/$APP_BRANCH.tar.gz` via node fetch (tanpa curl/wget), extract, marker `.version` (re-download hanya jika branch berubah/source belum ada), `npm install --omit=dev` sekali (marker `.installed`, fallback install build tools bila prebuild gagal), lalu `exec npm start`
- [x] `docker-stack.yml`: stack Portainer — image `node:20-slim`, env `APP_REPO`/`APP_BRANCH`/`PORT`/`TZ`, volume `rohtunnel-data:/app/data`, port 8080:3000; command mengunduh entrypoint.sh dari repo lalu menjalankannya (logika berat semua di entrypoint, sesuai goal)
- [x] `Dockerfile` opsional (bila ingin build image custom)
- [x] Uji end-to-end dengan podman (host, via distrobox-host-exec) + fake repo server (python3 http.server): install pertama sukses (migrasi + seed + app jalan di port 3001), **restart idempoten** (tanpa re-download/re-install, langsung start), landing 200

Catatan:

1. Flow goal: repo dipublik → paste docker-stack.yml di Portainer → deploy → repo diprivat lagi. Setelah install, source & node_modules aman di dalam container/volume sehingga privat tidak masalah.
2. `TARBALL_GITHUB_STRUCTURE`: entrypoint memakai `cp -a /tmp/appsrc/. "$APP_DIR/"` (bukan `*/.`) agar bekerja untuk tarball GitHub (folder `repo-branch/`) maupun root-`./`.
3. Test podman: `podman run --network host -e APP_REPO=http://127.0.0.1:8000 -e PORT=3001 -v rohtunnel-test-data:/app/data node:20-slim sh -c 'node -e "fetch(...entrypoint.sh...)" && sh /tmp/entrypoint.sh'` dengan fakerepo di `/tmp/opencode/fakerepo` (struktur `raw/main/entrypoint.sh` + `archive/refs/heads/main.tar.gz`).
4. SIGTERM warning saat podman restart adalah normal (node tidak handle SIGTERM; restart: unless-stopped menanganinya di swarm).

## Fase 8: Telegram Bot & Backup + Setup Template — SELESAI (29 Agustus 2026)

- [x] Migrasi `007_backup_settings.sql`: tabel `backup_settings` (daily/weekly/monthly, value, active, last_slot) + seed 3 baris
- [x] `telegram.js`: `sendDocument` (backup) + env `TELEGRAM_API_BASE` untuk uji lokal (produksi default api.telegram.org)
- [x] `notifier.js`: notif checklist dari settings (`notif_topup`, `notif_adjust`, `notif_purchase`) — terintegrasi ke paymentWatcher, adminUsers (adjust), beli/renew/add-bw/add-ip/recovery
- [x] `backup.js` + `backupWatcher`: backup SQLite via API `db.backup()`, jadwal harian/mingguan/bulanan (cek tiap 30 detik, anti duplikat via `last_slot`)
- [x] `db.js`: `applyPendingRestore` saat boot (restore-pending.db + marker → arsip pre-restore-*.db → timpa DB → hapus marker)
- [x] `/admin/setup` hub + sub-halaman: setup-telegram (simpan + test), setup-notif (checklist), setup-backup (3 jadwal + backup manual + daftar file), setup-templates (CRUD JSON fields), restore (upload .db)
- [x] Dependensi baru: `multer` (upload restore)
- [x] Verifikasi e2e — semua lulus (test TG ke mock, notif on/off sesuai checklist, backup manual + jadwal otomatis + terkirim TG, template CRUD + JSON invalid, restore saat restart, notif purchase)

Catatan:

1. **Restore = restart-based**: file diupload → `restore-pending.db` + marker → diterapkan saat container restart berikutnya (redeploy di Portainer). DB lama diarsipkan `pre-restore-*.db`.
2. `TELEGRAM_API_BASE` env hanya untuk development/testing (mis. `http://localhost:3300` mock); produksi tanpa env → API resmi.
3. BUG-002 (dokumentasi di bawah): multer diskStorage menggantung (request tidak selesai) → diganti memoryStorage + tulis manual.

## BUG-002 (ditemukan & diperbaiki 29 Agustus 2026): upload restore hang

- Gejala: POST multipart ke `/admin/restore` dengan multer `diskStorage` tidak pernah selesai (file tidak ditulis, koneksi menggantung sampai timeout).
- Perbaikan: ganti ke `multer.memoryStorage()` + `fs.writeFileSync` manual di handler.
- Pelajaran: jika multer diskStorage bermasalah di lingkungan tertentu, memoryStorage + tulis manual adalah fallback yang andal.

## Fase 7: Admin User Manager & Akun VPN Manager — SELESAI (29 Agustus 2026)

- [x] Service `adminAccountActions.js`: lock/unlock/setBandwidth/setIp/remove — API server + update DB (lock admin → status `admin_locked`)
- [x] `routes/adminActions.js`: endpoint POST aksi akun bersama (`/admin/akun/:id/lock|unlock|bandwidth|ip|delete`) dengan hidden `back` → redirect balik ke halaman asal (validasi awalan `/`)
- [x] `/admin/users`: daftar user (saldo, jumlah akun, link kelola)
- [x] `/admin/users/:id`: adjust saldo (Topup/Kurangi/Set → transaksi `adjust` oleh admin), daftar akun user + filter protocol, riwayat transaksi 20 terakhir
- [x] `/admin/akun`: semua akun semua server + pencarian (q = username akun ATAU pemilik) + filter protocol/server/status + kolom pemilik (link ke user)
- [x] Partial view `admin/partials/akun-actions.ejs` dipakai bersama (user-detail & manager)
- [x] Verifikasi e2e — semua lulus (adjust saldo & validasi, admin lock → user tak bisa unlock, unlock, set BW+reset, set IP, delete soft, find by username/pemilik, filter, guard 403, kurangi > saldo → 400)

Catatan:

1. Lock admin memakai status `admin_locked` — user tidak bisa unlock (sesuai blueprint).
2. `back` hidden field mencegah redirect keluar (hanya path diawali `/` yang diterima).
3. Semua penyesuaian saldo admin tercatat di `transactions` (type `adjust`) sebagai jejak audit.

## Fase 6: Recovery Akun — SELESAI (28 Agustus 2026)

- [x] Migrasi `006_recovery.sql`: kolom `deleted_at` + index status di `vpn_accounts`
- [x] Hapus akun jadi **soft-delete** (status `deleted` + `deleted_at`, tetap panggil API delete di server); `/akun` hanya menampilkan akun non-deleted
- [x] User `/recovery`: list akun yang bisa di-recovery (status `deleted` ATAU `expired_at` lewat) dengan badge Dihapus/Kedaluwarsa
- [x] `/recovery/:id`: form buat ulang (username bisa diganti, set kuota GB & limit IP, default dari snapshot akun lama), biaya = snapshot `price`
- [x] Recovery = **UPDATE row lama** ke aktif (bukan INSERT) agar UNIQUE(server+protocol+username) tidak bentrok; cek bentrok username antar akun sebelum create
- [x] Alur: validasi saldo → create di server (409 username dipakai ditampilkan bersih) → update akun + potong saldo + transaksi `recovery`
- [x] Verifikasi e2e — semua lulus (soft delete, list recovery, recovery username sama/baru, 409 server, expired, bentrok username, saldo kurang, ownership 404)

Catatan:

1. Row akun lama dipertahankan (soft delete) agar ada riwayat recovery; `uuid`/`password` SSH digenerate baru saat recovery.
2. Username di mock VPN bersifat global per server (lebih ketat dari UNIQUE DB yang per protocol) — perilaku mengikuti API asli.

## Fase 5: Akun VPN Saya & Config Siap Pakai — SELESAI (28 Agustus 2026)

- [x] Migrasi `005_config_templates.sql`: tabel `config_templates` + kolom `days`/`price` di `vpn_accounts` (snapshot harga & durasi saat beli)
- [x] Seed 7 template placeholder (XL Edu, XL Conference, XL Addon XCP, Tsel Ilmupedia, Tsel Halo Flexy+, Biz Line, Biz WA) — isi sementara, admin bisa edit di fase Setup Template
- [x] Service `templateRenderer.js`: isi variabel `{{username}}`, `{{password}}`, `{{uuid}}`, `{{hostname}}`, `{{port_tls}}`, `{{payload_*}}`, `{{link_*}}`, `{{expired_date}}` dari config akun; var hilang → `[key tidak tersedia]`
- [x] User `/akun`: list akun (server, protocol badge, status badge, kuota, expired, limit IP), tombol manage
- [x] Aksi akun: Renew (perpanjang dari tanggal expired saat ini), +Bandwidth (+kuota), +IP (+1), Lock, Unlock (ditolak jika `admin_locked`), Hapus, Refresh Config (panggil ulang checkconfig)
- [x] Harga semua aksi manage = snapshot `price` saat beli (placeholder pricing, bisa diubah admin di fase berikutnya)
- [x] Halaman config: `/akun/:id/config` (daftar template) + `/akun/:id/config/:templateId` (label/value + tombol salin)
- [x] Verifikasi e2e dengan mock VPN API — semua lulus (list, renew, add-bw, add-ip, lock/unlock, admin_locked ditolak, hapus, refresh, saldo kurang, ownership 404)

Catatan:

1. Pemakaian bandwidth (sisa kuota terpakai) **belum tersedia** dari API Potato (checkconfig tidak mengembalikan usage) — UI menampilkan "— (belum tersedia dari API)".
2. `days` & `price` disimpan sebagai snapshot saat pembelian agar renew/aksi lain tetap punya acuan walau package dihapus admin.
3. Renew menghitung tanggal baru dari `max(sekarang, expired_at)` + days (tidak memendekkan periode aktif).
4. Template placeholder: label "Catatan" berisi penanda bahwa isi masih sementara.

## Fase 4: Beli VPN — SELESAI (28 Agustus 2026)

- [x] Tabel `vpn_accounts` + `transactions` (migrasi `004_vpn_accounts.sql`; UNIQUE server+protocol+username)
- [x] Service `vpnApi.js`: wrapper Potato API (create 4 protocol + checkconfig, Bearer auth, timeout 15s)
- [x] Service `configBuilder.js`: parse raw_config ke label/value (fondasi "Config siap pakai" Fase 5)
- [x] User `/beli`: pilih server (group per negara), protocol, package (filter dinamis via JS), username opsional, uuid opsional (hanya v2ray), checkout
- [x] User `/beli/hasil/:id`: detail akun + config lengkap dengan tombol salin
- [x] Alur transaksi atomik: buat akun di server → potong saldo → simpan akun → catat transaksi (rollback otomatis bila gagal)
- [x] Validasi: saldo cukup, limit_vpn server, username 3-20 alfanumerik, UUID format v4, package cocok server+protocol
- [x] BUG-001 ditemukan & diperbaiki (lihat bug-found.md / bug-fixed.md): vpnApi tidak melempar error pada HTTP non-OK → crash UNIQUE constraint
- [x] Verifikasi e2e dengan mock VPN API — 12+ pengecekan lulus

Catatan:

1. Username kosong → generate random (`u` + hex). SSH password kosong → generate random (base64url). UUID kosong → diserahkan ke server.
2. `raw_config` diisi hasil checkconfig (fallback: hasil create). Dipakai untuk menampilkan config & nanti template Fase 5.
3. `expired_at` dihitung dari package days (ISO UTC).

## Fase 3: Server & Package — SELESAI (28 Agustus 2026)

- [x] Tabel `servers` + `packages` (migrasi `003_servers_packages.sql`; delete server → cascade hapus package)
- [x] Admin `/admin/servers`: tambah server (name, endpoint, api_key, country id/sg/us, limit_vpn), list, hapus
- [x] Admin `/admin/servers/:id/packages`: pricing per protocol (tab filter ssh/vmess/vless/trojan), tambah/hapus package (name, price, kuota_gb, limit_ip, days)
- [x] Validasi input server & package (endpoint http(s), country, harga 1.000-10jt, kuota 1-10.000 GB, IP 1-100, hari 1-3650)
- [x] Verifikasi: 12 pengecekan lulus (CRUD, validasi error, filter protocol, cascade delete, 404)

Catatan:

1. `limit_vpn` 0 berarti tak terbatas (jumlah akun termasuk ssh+v2ray, dicek saat pembelian di Fase 4).
2. `api_key` server tersimpan di tabel `servers` (bukan .env) — aman di UI admin.

## Fase 2: Topup QRIS — SELESAI (28 Agustus 2026)

- [x] Tabel `topups` (migrasi `002_topups.sql`)
- [x] Service QRIS wrapper (`src/services/qris.js`): create-qris, check-payment, token-status (endpoint+key dari tabel settings)
- [x] Service Telegram (`src/services/telegram.js`): sendMessage (untuk notif topup lunas)
- [x] `jobs/paymentWatcher.js`: poll QRIS tiap 10 detik, settle saldo otomatis (transaction + guard status → anti double-credit), expire otomatis setelah 5 menit
- [x] Halaman user: `/topup` (saldo + form nominal + riwayat), `/topup/:id` (iframe QRIS + auto-poll 5 detik + tombol cek manual), `/topup/check/:id` (JSON API)
- [x] Admin: `/admin/setup-qris` (endpoint + API key + test koneksi)
- [x] Verifikasi end-to-end dengan mock QRIS server — semua lulus (detail di `setup-run.md`)

Catatan:

1. Nominal topup dibatasi 5.000 - 10.000.000 rupiah (integer).
2. QRIS gateway dianggap eksternal (sudah dihosting user); app hanya panggil API-nya.
3. Saldo disimpan INTEGER rupiah; `paid_at` & `created_at` topups pakai ISO UTC dari JS (bukan `datetime('now')`) agar parsing umur topup konsisten.

## Fase 0: Bootstrap — SELESAI (28 Agustus 2026)

- [x] Scaffold app: Express + EJS + better-sqlite3 (SQLite, WAL mode)
- [x] Migration runner otomatis (`src/migrations/*.sql`, tercatat di tabel `schema_migrations`)
- [x] Seed first-run: admin pertama + settings default
- [x] Auth lengkap: register / login / logout / login-admin terpisah, session tersimpan di DB (`login_sessions`)
- [x] Middleware guard: `requireAuth` (user), `requireAdmin` (admin)
- [x] Halaman: landing, register, login, login-admin, dashboard user, dashboard admin, 404
- [x] Verifikasi lokal: semua pengecekan curl lulus (rincian & cara ulang di `setup-run.md`)

Catatan penting:

1. **Admin pertama** dibuat saat first run dengan password random yang dicetak SEKALI di log (lihat `setup-run.md`). Bisa dioverride dengan env `ADMIN_USERNAME` / `ADMIN_PASSWORD` bila diinginkan.
2. **Semua konfigurasi & secret** disimpan di tabel `settings` (DB), dibaca via `src/config.js` — bukan `.env`, sesuai goal.md.
3. DB default di `data/rohtunnel.db` (folder `data/` di-ignore git → di docker jadi volume).
4. Migrasi baru ditambahkan cukup dengan menaruh file `NNN_nama.sql` di `src/migrations/` (urutan numerik, diterapkan otomatis saat boot, idempoten).

## Fase berikutnya

- Semua fase plan.md selesai (0-9). Pekerjaan lanjutan opsional: real template config (isi XL Edu/dll), pricing per-aksi, pengukuran pemakaian bandwidth.