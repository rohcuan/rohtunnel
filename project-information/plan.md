# Rencana Proyek RohTunnel

> Website penjual VPN (SSH tunnel + v2ray vmess/vless/trojan) dengan topup saldo via QRIS.
> Memenuhi workflow goal.md: repo publik manual → paste docker-stack.yml di Portainer → deploy → repo privat lagi → entrypoint melakukan semuanya (install jika belum, start jika sudah, tidak auto-update, ambil konfigurasi dari repo, tanpa .env).

---

## 1. Arsitektur

```
[User browser] ──> [Web App (1 container, Node.js + Express + SQLite)]
                        │
                        ├──> VPN API (Potato Tunneling API, rohserver1.dpdns.org/vps)  [Bearer token per server]
                        │
                        ├──> QRIS API (gopay-api-gateaway, sudah dihosting user)        [api_key]
                        │
                        └──> Telegram Bot API (notifikasi + autobackup)
```

- **Single service web app** di dalam docker stack. QRIS gateway & server VPN adalah **layanan eksternal**.
- **SQLite** sebagai database (file di volume), tanpa service tambahan.
- Konfigurasi (apikey, endpoint, dll) **tersimpan di database + disimpan admin lewat UI**, bukan `.env` → sesuai goal "tidak juggling .env".
- Entrypoint hanya unduh file app dari repo, lalu `npm install` jika belum / `npm start` jika sudah.

## 2. Tech Stack (rekomendasi)

- **Backend:** Node.js ≥ 18 + Express (sejalan dgn QRIS gateway; mudah dibundel, single-process, cocok SQLite).
- **Frontend:** Server-side render (EJS) + sedikit vanilla JS. Tanpa build step → container ringan.
- **DB:** SQLite (better-sqlite3). WAL mode.
- **Task/polling:** `node-cron` di dalam app (untuk cek pembayaran QRIS, autobackup, notifikasi).
- **HTTP client:** `fetch` bawaan Node 18 (VPN API & QRIS API & Telegram).

> Catatan: Jika nanti ingin Laravel/Python, arsitektur & fase tetap sama, hanya implementasinya beda.

## 3. Struktur Repo

```
rohtunnel/
├── docker-stack.yml          # stack Portainer (masuk repo, dipaste manual)
├── docker/
│   └── Dockerfile
├── entrypoint.sh             # logika: install jika belum, start jika sudah (diunduh app dari repo)
├── src/
│   ├── app.js                # entry server
│   ├── config.js             # baca setting dari DB
│   ├── db.js                 # SQLite init + migrasi
│   ├── middleware/
│   │   ├── auth.js           # session user
│   │   └── admin.js          # guard admin
│   ├── routes/
│   │   ├── auth.js           # register/login
│   │   ├── dashboard.js      # beli/topup/akun/hubungi-admin
│   │   ├── admin.js          # semua fitur admin
│   │   └── public.js         # landing, config pages
│   ├── services/
│   │   ├── vpnApi.js         # wrapper Potato API (semua jenis akun)
│   │   ├── qris.js           # wrapper QRIS gateway
│   │   ├── telegram.js       # bot notif + backup
│   │   ├── packages.js       # kalkulasi harga/kuota/expired dari package
│   │   └── configTemplates.js# build "config siap pakai"
│   ├── jobs/
│   │   ├── paymentWatcher.js # poll QRIS, tambah saldo otomatis
│   │   ├── backup.js         # autobackup harian/mingguan/bulanan
│   │   └── notifier.js       # kirim notif Telegram
│   └── views/                # EJS: landing, auth, dashboard, admin
├── data/                     # volume: rohtunnel.db, backup/
└── project-information/      # dokumen proyek (blueprint, plan, dst)
```

## 4. Skema Database (inti)

| Tabel | Kolom penting |
|---|---|
| `users` | id, username (a-z0-9 lowercase, 3-20), email (unique), password_hash, saldo (integer, satuan rupiah), is_admin, created_at |
| `servers` | id, code (unique, mis. SRV-A), label (mis. LinkGo Metro Teknologi), endpoint (base url), api_key (token), country (id/sg/us), limit_vpn, note |
| `packages` | id, server_id, protocol (ssh/vmess/vless/trojan), name, price, kuota_gb, limit_ip, days, active |
| `vpn_accounts` | id, user_id, server_id, protocol, username, uuid/password, kuota_gb, limit_ip, expired_at, status (active/locked/admin_locked), created_at |
| `topups` | id, user_id, amount, trx_id (QRIS), status (pending/paid), created_at |
| `transactions` | id, user_id, type (beli/renew/recovery/topup/adjust), amount, detail, created_at |
| `settings` | key, value (qris endpoint+key, telegram bot token+chatid, notif checklist, dll) |
| `config_templates` | id, name (XL Edu, dll), fields (json: label → template) |
| `backup_settings` | id, schedule (daily/weekly/monthly), value, active |
| `login_sessions` | id, user_id, token, expiry |

## 5. Integrasi API

### 5.1 VPN API — "Potato Tunneling API" (`http://rohserver1.dpdns.org/vps`)
Semua endpoint pakai header `Authorization: Bearer <api_key>`. 4 jenis: `sshvpn`, `vmess`, `vless`, `trojan`.

| Aksi | Endpoint |
|---|---|
| Buat akun v2ray | `POST /vps/{vmessall|vlessall|trojanall}` body `{username, kuota, expired, limitip, uuidv2?}` |
| Buat akun ssh | `POST /vps/sshvpn` body `{username, password, expired, limitip}` |
| Cek config | `GET /vps/checkconfig{jenis}/{username}` → return hostname, port, path, link (grpc/tls/up), uuid, dll |
| Renew | `PATCH /vps/renew{jenis}/{username}/{expired}` body `{kuota}` |
| Ganti pass/uuid | `PATCH /vps/modify{jenis}` body `{username, pass_uuid}` |
| Ubah kuota | `POST /vps/changelimbw{jenis}` body `{username, kuota, reset_bw}` |
| Ubah limit IP | `POST /vps/changelimip{jenis}` body `{username, limitip}` |
| Lock | `PATCH /vps/lock{jenis}/{username}` |
| Unlock | `PATCH /vps/unlock{jenis}/{username}` (ssh: `unlocksshvpn/{username}/{password}`) |
| Hapus | `DELETE /vps/delete{jenis}/{username}` |

Catatan implementasi:
- `service/vpnApi.js` dibuat generik dengan pemetaan nama jenis → suffix endpoint, agar 4 protocol dipakai 1 fungsi.
- Simpan **respons buat/checkconfig sebagai mentah (raw)** di `vpn_accounts.raw_config` → dipakai untuk render halaman "Config siap pakai".
- Kuota & expired bisa di-reset saat renew via `reset_bw=yes`.

### 5.2 QRIS API — gopay-api-gateaway (eksternal, sudah dihosting user)
Auth: `?api_key=` atau header `X-Api-Key`.

| Aksi | Endpoint |
|---|---|
| Generate QR | `POST/GET /create-qris?amount=<rupiah>` → `{qris_id, trx_id, qris_url, qris_code, expires_at}` |
| Status payment (poll) | `GET /check-payment?amount=..&trx_id=..&api_key=..` → `{paid: true, transaction}` |
| Cek token sehat | `GET /token-status` |

Flow topup: user pilih nominal → buat QRIS → tampilkan QR (qris_url) → `jobs/paymentWatcher.js` poll `/check-payment` sampai `paid` → tambah saldo → tandai topup paid → kirim notif Telegram.

### 5.3 Telegram Bot API
- Notifikasi: `POST https://api.telegram.org/bot<token>/sendMessage` ke `chat_id`.
- Autobackup: simpan `rohtunnel.db` (sqlite `.backup`) + upload via `sendDocument` sesuai jadwal (harian/mingguan/bulanan). Juga bisa manual "Restore Backup" di admin.

## 6. Halaman & Fitur (dari blueprint.md)

### 6.1 Publik
- **Landing Page**: title, deskripsi singkat bisnis, Login/Register, kelebihan VPN, link "Login as Admin" di bawah.
- **Register/Login**: user biasa; admin login lewat halaman terpisah (identitas admin dari `settings`/seed). Register wajib email + username + password (username hanya a-z0-9 kecil; email format standar); login menerima username ATAU email.

### 6.2 Dashboard User
- **Beli VPN**: pilih server (filter negara id/sg/us) → pilih protocol (ssh/vmess/vless/trojan) → pilih package → isi username (opsional, kosong = random) → isi uuid custom (opsional, v2ray) → checkout (potong saldo, pastikan saldo cukup) → buat akun via VPN API → tampilkan config (ssh account info / vless / vmess / trojan code).
- **Akun VPN Saya**: list akun (username, status Aktif/Terkunci, sisa bandwidth `(pakai/total GB)`, tanggal expired). Aksi: Renew, Tambah Bandwidth, Tambah IP, Hapus, Lock/Unlock (unlock dilarang jika `admin_locked`). Tiap akun → **Config siap pakai** (halaman khusus): template XL Edu, XL Conference, XL Addon XCP (IG/Tiktok/WA/FB), Tsel Ilmupedia/Kuota Belajar, Tsel Halo Flexy+, Biz Line, Biz WA — tiap template = pasangan Label + Value untuk disalin.
- **Recovery Akun (rebuy)**: buat ulang akun lama (bisa set limit ip/bandwidth) — harga dari package recovery.
- **Topup Saldo**: saldo sekarang, isi nominal → QRIS, riwayat topup.
- **Hubungi Admin**: link/penjelasan kontak (dari settings).

### 6.3 Admin Dashboard
- **Manage Server**: tambah server (endpoint, apikey, country, limit jumlah vpn termasuk ssh+v2ray), list server, konfigurasi **Pricing VPN** (per protocol: package 1/2/3 → berapa GB, limit IP, hari).
- **User Manager**: topup/kurangi/set saldo, list akun VPN user (filter protocol), lock/unlock, edit limit IP, edit limit bandwidth (GB), hapus akun VPN.
- **Manager Akun VPN**: semua akun dari semua server (dengan fitur find), lock/unlock, edit limit IP, edit limit bandwidth, hapus, lihat pemilik (username user).
- **Setup QRIS API**: endpoint + key.
- **Setup Telegram Bot**: chatID + api token.
- **Setup Autobackup**: Harian (0-23 jam + menit), Mingguan (Senin–Minggu + jam/menit), Bulanan (1-30 + jam/menit).
- **Setup Notifikasi Telegram** (checklist): topup QRIS, penyesuaian saldo admin, pembelian/renew/recovery VPN.
- **Setup Config Siap Pakai Template**: kelola daftar template (XL Edu, dst).
- **Restore Backup**.

## 7. Deployment (goal.md — 1-click install)

Workflow: paste `docker-stack.yml` di Portainer → deploy → entrypoint selesai sendiri.

```
docker-stack.yml
  └─ service rohtunnel:
       image: <base image, mis. node:20-slim> (build dari repo atau image dipublish)
       volumes:
         - ./data:/app/data          # persist db + backup
         - ./app:/app/app            # hasil unduhan source dari repo
       entrypoint: ["./entrypoint.sh"]
       ports: 8080:3000
       environment:                  # HANYA variabel minimal & non-rahasia
         APP_REPO: <raw url github repo (publik saat install)>
         APP_VERSION: <tag/branch/commit>   # untuk idempotensi & no auto-update
```

`entrypoint.sh` logic (heavylifting di sini):
1. Jika `APP_VERSION` berubah / folder app kosong → unduh source dari `APP_REPO` (wget/curl tarball) ke `/app/app`, tulis marker versi.
2. Jika belum `npm install` (ada marker `.installed`) → install & tulis marker.
3. `npm start` (bukan npm run dev; tanpa watch → no auto-update).
4. Jika sudah installed → langsung `npm start`.

Syarat goal:
- **Tidak auto-update**: app hanya diunduh saat marker versi beda atau folder kosong; proses start tidak pull ulang.
- **Tanpa .env**: semua secret di-set lewat admin UI → tersimpan di SQLite. Setting awal (admin akun pertama, dsb) di-seed otomatis saat pertama jalan.
- Portainer mounts volume `./data` → db & backup survive redeploy.

Catatan keamanan: repo dibuat publik hanya saat instalasi (goal langkah 1 & 4). Karena secret tidak ada di file repo (semua di DB via UI), risiko bocor saat publik sangat kecil.

## 8. Fase Pengerjaan (urutan)

| Fase | Isi | Kriteria selesai |
|---|---|---|
| **0. Bootstrap** | Inisialisasi repo, scaffolding Express+SQLite, migrasi DB, seed admin & settings default | App jalan lokal, login admin OK |
| **1. Auth** | Register/login user, login admin, session, middleware | User & admin bisa login |
| **2. Topup QRIS** | Setup QRIS (endpoint+key), topup page, paymentWatcher poll, riwayat topup, notif topup | Topup masuk saldo otomatis |
| **3. Server & Package** | CRUD server, pricing package per protocol | Admin bisa set server & package |
| **4. Beli VPN** | Pilih server/protocol/package, checkout, panggil VPN API, simpan akun, tampilkan config | Beli sukses, akun tercatat, saldo terpotong |
| **5. Akun Saya & Config** | List akun, status & sisa bandwidth, manage (renew/tambah bw/ip/hapus/lock), halaman Config siap pakai + template | User bisa manage & salin config per template |
| **6. Recovery** | Rebuy akun dengan set limit ip/bandwidth | Recovery jalan |
| **7. Admin: user & akun manager** | User manager (adjust saldo, kelola akun), Akun VPN manager (find, lock/unlock, bw, ip, delete, owner) | Semua aksi admin jalan |
| **8. Telegram & Backup** | Setup bot token/chatid, notifikasi checklist, autobackup jadwal, restore | Notif & backup/restore jalan |
| **9. Deploy** | Dockerfile, docker-stack.yml, entrypoint.sh, seed first-run, uji 1-click di Portainer | Install & restart idempoten (install sekali, start terus) |

## 9. Risiko / Catatan

- **Rate limit QRIS**: hindari polling terlalu agresif (sesuai disclaimer gopay gateway); interval poll ~8-15 detik, batasi per topup.
- **Respons VPN API** antar-protocol beda struktur → simpan raw config & buat parser per protocol.
- **Admin "unlock" akun**: user tidak boleh unlock jika admin_lock → simpan flag `admin_locked` terpisah dari `locked` user.
- **Saldo konsistensi**: transaksi saldo (beli/topup/adjust) lewat 1 fungsi + transaction SQLite agar tidak ada saldo minus/race.
- **Backup DB saat berjalan**: gunakan `sqlite3 .backup`/WAL checkpoint, bukan copy file mentah.

## 10. Dokumen terkait

- blueprint.md → fitur & halaman.
- goal.md → constraint deployment.
- bug-found.md / bug-fixed.md → dicatat selama pengerjaan.
- progress.md → update status tiap fase.
