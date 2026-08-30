# Compacted Chat — RohTunnel (Sesi 3)

> **Dokumen kompaksi percakapan** — dibuat 2026-08-29 (lanjutan `compacted-session/session-2.md`).
> Tujuan: ringkasan lengkap keputusan, pekerjaan, dan state proyek pada sesi ini agar sesi berikutnya bisa lanjut tanpa kehilangan konteks.
> Catatan: `session-2.md` **dikembalikan ke versi kompaksi `fe98bc1`** atas permintaan user — seluruh delta sesi lanjutan (badge/negara/collapsible/form terpisah, dashboard menu, setup notif, fix judul plain, backup/restore zip, metode deploy) dicatat DI SINI, bukan di session-2.
> File terkait: `blueprint.md`, `goal.md`, `plan.md`, `progress.md`, `setup-run.md`, `bug-found.md`, `bug-fixed.md`, `compacted-session/session-1.md`, `compacted-session/session-2.md`.

---

## 1. Ringkasan Sesi (12 commit, `e5eccb4` → `9463e62`)

Sesi lanjutan setelah kompaksi sesi 2. Topik utama: (1) iterasi final list server admin (badge sejajar mobile, hapus badge negara → baris COUNTRY, collapsible, form halaman terpisah), (2) dashboard admin imitasi Rohtembak-XL, (3) setup notifikasi Telegram imitasi `notiftele.html`, (4) fix judul halaman tampil plain (`.page-title` tanpa h1), (5) **backup/restore diganti dari raw `.db` ke ZIP berisi banyak file** (JSON per tabel + manifest + aset).

| Commit | Isi |
|---|---|
| `e5eccb4` | Admin: list server — badge kode+negara sejajar di bawah label (mobile) |
| `c7b22a5` | Admin: list server — hapus badge negara, negara jadi baris info COUNTRY |
| `53afaac` | Docs: sinkronkan session-2.md dengan layout badge/negara terakhir |
| `397ad34` | Admin: list server — collapsible, default tertutup (label+badge+chevron) |
| `dfeaaaa` | Docs: sinkronkan session-2.md dengan layout collapsible list server |
| `2c2b8db` | Admin: server — form pindah ke halaman sendiri (1 baris = 1 field), list berisi tombol Tambah Server |
| `24ed5e9` | Docs: sinkronkan session-2.md dengan halaman form server terpisah |
| `e2f2150` | Admin: dashboard menu imitasi rohtembak-xl (header + menu-grid tombol outline) |
| `f2b75a8` | Admin: setup notifikasi mengikuti rohtembak-xl (status pill bot + notif-item) |
| `c88a352` | Style: judul halaman standalone (`.page-title` tanpa h1) tidak lagi plain — bold 20px + jarak benar |
| `5418339` | Backup/restore: ganti raw `.db` → zip (JSON per tabel + manifest + aset), impor setelah migrasi |
| `9463e62` | Docs: catatan backup/restore zip |

## 2. Admin: List Server — Iterasi Final

Melanjutkan `session-2.md §7` (yang berhenti di badge kode+negara, `2130468`):

1. **Badge sejajar mobile** (`e5eccb4`): di layar ≤640px badge turun ke baris bawah label — `.server-card-title` pakai `flex row + wrap`, `.server-card-label { flex: 1 0 100% }`
2. **Negara bukan badge** (`c7b22a5`): badge hanya kode (`[SRV-A]`); negara dipindah jadi baris info `COUNTRY` (nama lengkap `Indonesia`, bukan `ID`) di dalam box info bersama Endpoint/API Key/Limit VPN
3. **Collapsible, default tertutup** (`397ad34`): collapsed hanya label + badge + chevron `▸`; klik toggle (seluruh baris) membuka aksi (Edit · Pricing · Hapus) + box info; chevron rotate 180° saat terbuka; kartu yang sedang diedit otomatis terbuka (`server-list-card-open`); JS `toggleServerCard()` di `servers.ejs`
4. **Form di halaman sendiri** (`2c2b8db`): box tambah di atas list diganti tombol "Tambah Server" → `/admin/servers/new`; edit → `/admin/servers/:id/edit` (urutan route `/new` sebelum `/:id/edit`); view baru `admin/server-form.ejs` **1 baris = 1 field** (tanpa `.row` multi-kolom); sukses redirect ke `/admin/servers`; validasi & render helper di `adminServers.js`

## 3. Dashboard Admin & Setup Notifikasi imitasi Rohtembak-XL

- **Relabel seluruh situs (setelah sesi 2)**: gradien & aksen dari indigo `#4361ee` → **ungu sebagai aksen** `--primary #7209b7` (dark `#5a0496`, focus ring `rgba(114,9,183,.15)`); gradien `135deg #7209b7 → #ec4899` (ungu kiri-atas → pink kanan-bawah, urutan dibalik atas permintaan user). Semua konsumen `var(--primary)/--grad` ikut (tombol, navbar, banner, login, tab aktif, chip, accent checkbox). Alasan user: situs lain sudah pakai aksen indigo-purple lalu aksen jadi ungu. `.badge-country` ungu tint `#f3e8ff/#7e22ce`

Referensi tetap dibaca READ-ONLY dari repo privat `rohcuan/rohtembak-xl` via `gh api` (authenticated rohcuan, scope `repo`) — jangan pernah diubah.

- **Dashboard admin** (`e2f2150`): header `page-title` "Dashboard Admin" + `page-subtitle` "Atur semuanya disini" (imitasi `dashboard.html` berjudul 'Dashboard'); kartu **Menu** dengan `.menu-grid` (2 kolom → 1 kolom ≤900px) berisi 9 tombol `.btn-outline` full-width: Kelola User, Manage Server, Manager Akun VPN, QRIS API, Bot Telegram, Notif Bot Telegram, Auto Backup, Template Config, Restore Backup
- **Setup Notifikasi** (`f2b75a8`, imitasi `notiftele.html` dari repo XL):
  - `header-section` (flex, gap 12, `flex-wrap`) + `page-title` + `page-subtitle` + pill status bot
  - `.cfg-status` pill: `.on` bg `#d1fae5`/teks `#065f46` "● Bot terkonfigurasi"; `.off` bg `#f3f4f6`/teks `#6b7280` "○ Bot belum terkonfigurasi — atur di [Atur Bot Telegram]"(link `/admin/setup-telegram`)
  - Kartu `max-width:640px`, sub-judul "Notifikasi Aktif", baris `.notif-item` (checkbox 18px `accent-color` primary + `.t` judul + `.d` deskripsi), `<label>` menyelimuti seluruh baris; tombol "Simpan Notifikasi"
  - route GET `/admin/setup-notif` melempar `botConfigured: !!getSetting("telegram_bot_token")`; flash `msg` via `?msg=`
  - Notif: `notif_topup` (Topup QRIS lunas), `notif_adjust` (penyesuaian saldo admin), `notif_purchase` (beli/renew/recovery)

## 4. Fix UI: Judul Halaman Tampil Plain (commit `c88a352`)

- **Gejala user**: "Dashboard Admin / Atur semuanya disini" tampil seperti teks biasa (judul kecil, tidak bold); area ini sempat diduga cache browser.
- **Investigasi (server-side bersih)**: CSS valid (kurung/seimbang), md5 CSS identik antara repo, container, dan serv; semua halaman admin HTTP 200; tidak ada sisa tag `<%` ter-render; landing/login benar; CSS `text/css` + `ETag max-age=0`.
- **Akar masalah**: dashboard & setup-notif memakai `<div class="page-title">` TANPA `<h1>` di dalamnya — CSS lama hanya menarget `.page-title h1` (20px/700) sehingga teks div tampil ukuran default, plus `margin-bottom:20px` berlebih.
- **Perbaikan**: `.page-title` div sendiri kini `font-size:20px; font-weight:700` (18px di media ≤640px); di dalam `.header-section`: judul `margin-bottom:4px`, `page-subtitle margin-bottom:0`, `gap:12px` + `flex-wrap` (tombol ← Setup ikut rapi).

## 5. Backup/Restore: ZIP Berisi Banyak File (bukan raw `.db`) — commit `5418339`

- **Jawaban atas "Risky ga pakai db?"**: Ya. Raw `.db` berisiko (schema/migrasi beda → restore error; file korup → DB tak kebaca total; format tak transparan; ikut menyertakan internal indeks/WAL). Backup **data-only dalam ZIP** diimpor **setelah migrasi** → aman lintas versi + isi bisa diperiksa manual.
- **Format `rohtunnel-backup` v1**:
  ```
  manifest.json
  data/users.json            (array object; Buffer → { $blob: base64 })
  data/servers.json, packages.json, vpn_accounts.json, transactions.json,
  data/topups.json, config_templates.json, settings.json, backup_settings.json
  files/...                  (aset arbitrer: img/svg/pdf/dll bila perlu)
  ```
  - `manifest.json`: `{ format, version:1, created, appVersion, schemaVersion [migrasi terakhir], tables[], files[] }`
  - Aset: folder `DATA_DIR/assets` (bila ada) diwalk otomatis ke `files/assets/<rel>`; kolom BLOB masa depan dikode `{$blob: base64}` (belum ada kolom BLOB di schema sekarang)
  - Tabel yang TIDAK diekspor: `login_sessions` (ephemeral), `schema_migrations`, `sqlite_sequence`
- **Modul baru (tanpa dependensi baru)**:
  - `src/services/zip.js` — tulis ZIP metode STORE + CRC32 (tabel lookup) + DOS datetime; baca: scan EOCD mundur, parse central directory, dukung metode 0 (store) & 8 (deflate via `zlib.inflateRawSync`) → **zip buatan luar (Telegram/python/arkip) juga terbaca**
  - `src/services/restore.js` — `validate(buffer)`: baca zip + manifest, cek format/version (TIDAK menyentuh DB — dipakai route sebelum terima upload); `importFromZip(db, buffer)`: DELETE child-first → INSERT parent-first (urutan via topo-sort dari `PRAGMA foreign_key_list`), kolom target via `PRAGMA table_info` (map by name → toleran beda versi), reset `sqlite_sequence` (autoincrement lanjut), `PRAGMA foreign_key_check` → bila ada pelanggaran THROW → transaksi rollback; `files/assets/*` ditulis balik ke `DATA_DIR`
  - `src/services/backup.js` — `exportZip(db)` → Buffer; `createBackupFile` menghasilkan `rohtunnel-<stamp>.zip` di `data/backup/`; `listBackups` filter `.zip` (backup `.db` lama tidak lagi ter-list); `runBackup` tetap kirim ke Telegram via `telegram.sendDocument`
- **Restore saat boot** (`src/db.js`): pending = `restore-pending.zip` + marker `.restore-pending`; di bootstrap diimpor **SETELAH loop migrasi** (aman lintas versi); DB lama diarsip dulu sebagai `pre-restore-<ts>.db`; bila impor GAGAL (zip korup dll): log `[restore] GAGAL, data lama tetap dipakai`, marker dihapus, zip disimpan → app TIDAK crash loop
- **Route & UI**: `POST /admin/restore` memakai `upload.single("backup_file")` (multer memory, limit 100MB), memvalidasi zip+manifest; error bila bukan backup rohtunnel (pesan dari `zip.METHOD tidak didukung`/EOCD); `restore.ejs` menerima `accept=".zip"` dan menjelaskan info keamanan; `setup-backup.ejs` timestamp list pakai replace `.zip`
- **Verifikasi (lokal + live)**:
  - Round-trip ekspor→impor ke DB baru: 9 tabel, `PRAGMA foreign_key_check = 0` violation, autoincrement lanjut (insert berikutnya = max+1), aset `logo.svg`/`banner.png` tertulis balik
  - Jalur boot-restore: marker+zip diterapkan (data masuk), marker+zip terhapus, `pre-restore-*` tersimpan
  - Jalur zip rusak: data lama tetap (users=1), app tetap boot
  - Zip eksternal DEFLATE (dibuat `python3 zipfile`) terbaca & tervalidasi
  - LIVE container: `POST /admin/backup/run` → `rohtunnel-20260829-091815.zip` (manifest: app 0.1.0, schema 9, 9 tabel; isi data asli: users 10, server `SRV-A` label/code utuh); `GET /admin/restore` 200 (tampil `.zip`); upload file non-zip → 302 ke `?error=File bukan backup RohTunnel yang valid…` tanpa menulis pending

## 6. Operasional: Metode Deploy Saat Ini (GANTI catatan lama di session-2 §8)

- Container dev `rohtunnel-dev` (podman via `distrobox-host-exec`, host network, PORT 3000, volume `rohtunnel-dev-data`; entrypoint unduh tarball GitHub ke `/app/app`, DB di `/app/data`).
- **Metode terkini — skip CDN stale** (setiap selesai commit+push):
  ```bash
  distrobox-host-exec podman exec rohtunnel-dev sh -c 'rm -f /app/app/.version'
  git -C <repo> archive HEAD | distrobox-host-exec podman exec -i rohtunnel-dev sh -c 'tar -x -C /app/app && echo main > /app/app/.version'
  distrobox-host-exec podman restart rohtunnel-dev
  curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/   # harap 200
  ```
  - Tanpa hapus `.version`, `podman restart` cukup (source sudah terbaru). Hapus `.version` bila ingin entrypoint mengunduh ulang + `npm install` + migrasi dari nol.
  - Verifikasi isi container: langsung `podman exec` (grep/ls) atau unduh file + md5. **JANGAN** pakai pipa `curl | tar -xO | grep` — tidak reliabel (palsu saat CDN 404 / cache stale; pernah di-fake oleh SHA salah).
- **Catatan**: `podman restart` kadang log `StopSignal SIGTERM failed … resorting to SIGKILL` — normal, tidak masalah.

## 7. State Saat Ini (HEAD `9463e62`)

- Semua kerja ter-push `origin/main` dan ter-deploy di container (HTTP 200). Verifikasi isi container: `setup-notif.ejs` punya 3 `notif-item` + 1 `cfg-status`; CSS served mengandung `.notif-item` (6) & `.page-title` standalone.
- **DB container**: 10 user; server `SRV-A · LinkGo Metro Teknologi` (id 1) — **`api_key` perlu diisi ulang user** (tertimpa saat sesi 1/2 testing, nilai asli tidak tersimpan; label/endpoint/country/limit sudah benar). Backup `.db` lama tidak lagi ter-list di UI (hanya `.zip`).
- **Login lokal (curl)**: seed default `admin/admin` bila env `ADMIN_USERNAME`/`ADMIN_PASSWORD` tidak diset di container; sesi admin tersimpan di `/tmp/opencode/cookies.txt` (untuk verifikasi HTTP lokal); referensi CSS XL di `/tmp/opencode/rohtembak-style.css`.
- **Lanjutan opsional (belum berubah)**: isi template config asli (ada placeholder), pricing per-aksi, pemakaian bandwidth dari API, register/email polish.
- Repo GitHub masih PUBLIC (alur `goal.md`: dipublik saat testing, privatkan sebelum produksi).
- Konvensi: dokumentasi di `project-information/`; kompaksi berurutan `session-N.md`; user berkomunikasi Bahasa Indonesia.