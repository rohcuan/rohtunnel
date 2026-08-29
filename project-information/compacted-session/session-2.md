# Compacted Chat — RohTunnel (Sesi 2)

> **Dokumen kompaksi percakapan** — dibuat 2026-08-29 (sesudah sesi 1; lihat `compacted-session/session-1.md`).
> Tujuan: ringkasan lengkap keputusan, pekerjaan, dan state proyek pada sesi ini agar sesi berikutnya bisa lanjut tanpa kehilangan konteks.
> File terkait: `blueprint.md`, `goal.md`, `plan.md`, `progress.md`, `setup-run.md`, `bug-found.md`, `bug-fixed.md`, `compacted-session/session-1.md`.

---

## 1. Ringkasan Sesi (13 commit, `ac271c4` → `2130468`)

Sesi ini mencakup: (1) auth dengan email, (2) restyle UI mengikuti repo privat RohTembak-XL, (3) server dengan kode+label, (4) edit server admin, (5) halaman beli dengan grid bendera, (6) list server admin jadi kartu panjang.

| Commit | Isi |
|---|---|
| `ac271c4` | Auth: register wajib email + username a-z0-9 lowercase, login via username/email |
| `a18b6a3` | Docs: update container test untuk auth email |
| `6b5314c` | UI: styling mengikuti design RohTembak-XL (indigo-purple, dropdown menu, banner) |
| `abe279c` | Docs: restyle UI RohTembak-XL |
| `95b2ca8` | UI: dropdown tidak menduplikasi menu utama (brand navbar = dashboard) |
| `b30ad72` | Server: kode server + label, grid bendera negara di halaman beli |
| `eed2d9f` | Beli: gambar bendera SVG asli (tanpa emoji) + field checkout muncul setelah ketuk server |
| `fa6736b` | Admin: edit server (kode, label, endpoint, api key, country, limit) |
| `4a3a256` | Admin: list server jadi kartu panjang (desktop & mobile friendly) |
| `6685ae3` | Admin: list server — tiap info satu baris (1 kolom) sesuai contoh |
| `83bfbc2` | Admin: list server — urutan label-kode-negara, baris info tanpa box |
| `384bb97` | Admin: list server — 1 box untuk semua info, nilai font regular |
| `2130468` | Admin: list server — badge kode+negara di samping label (desktop), di bawah label (mobile) |

## 2. Auth: Email + Username lowercase

- **Migrasi `008_user_email.sql`**: kolom `email` di `users` (nullable, UNIQUE index) — user lama/admin tanpa email tetap valid (NULL)
- **Register** wajib email + username + password:
  - Username divalidasi `^[a-z0-9]{3,20}$` dan **di-lowercase otomatis** (`UserTwo` → `usertwo`; keputusan: coerced, bukan ditolak — user belum meminta ubah)
  - Email format standar `^[^\s@]+@[^\s@]+\.[^\s@]+$`; duplikat email/username → 409
- **Login** (user & admin) menerima username **ATAU** email: `WHERE username = ? OR email = ?`
- `loadUser` kini menyertakan `email` di `req.user`
- Admin user manager menampilkan kolom email (list & detail)

## 3. UI Restyle RohTembak-XL (read-only dari repo privat)

- Repo referensi dibaca read-only via `gh api` (authenticated sebagai rohcuan, scope `repo`): `rohcuan/rohtembak-xl` — **tidak ada perubahan apa pun di repo itu**
- **Design language** (`src/public/style.css` ditulis ulang, class RohTunnel dipertahankan):
  - Palet: bg `#f0f2f5`, primary `#4361ee` (dark `#3651d4`), gradien `135deg #4361ee → #7209b7`, teks `#1a1a2e`
  - Kartu putih radius 12 + `box-shadow: 0 1px 3px rgba(0,0,0,0.08)`; tombol/input radius 8, focus ring `0 0 0 3px rgba(67,97,238,0.1)`
  - Tabel: header uppercase 12px `#666` letter-spacing .5px, hover `#f8f9ff`
  - Badge: `#d1fae5/#065f46` (aktif/lunas), `#fef3c7/#92400e` (pending/locked), `#fee2e2/#b91c1c` (expired/admin_locked), `#e0e7ff/#4338ca` (country)
  - Tombol: primary/danger/success/warning/pink/outline/sm
- **Navbar → dropdown "Menu"**: trigger "Menu" + chevron; submenu Info Profil (role/username/email); body saldo (user) + logout merah; click-outside menutup (JS di head.ejs)
- **Keputusan user: dropdown TIDAK menduplikasi menu utama** — item yang sudah ada di grid dashboard dihapus dari dropdown; brand navbar = `/dashboard` (user), `/admin` (admin), `/` (anon)
- **Auth pages standalone** (login, login-admin, register): background gradien penuh + `login-card` putih (radius 16, shadow `0 10px 40px`) + subtitle + `error-msg` + **pw-toggle** (tombol mata)
- Landing: hero jadi banner gradien; dashboard user & admin: banner gradien berisi statistik (user: saldo/akun aktif/total; admin: user/server/akun) + menu grid 2 kolom
- **Dashboard admin dirombak imitasi `rohcuan/rohtembak-xl` (dibaca read-only)**: header `page-title` "Dashboard Admin" + `page-subtitle` "Atur semuanya disini"; kartu **Menu** dengan `.menu-grid` (2 kolom → 1 kolom ≤900px) berisi tombol `.btn-outline` full-width: Kelola User, Manage Server, Manager Akun VPN, QRIS API, Bot Telegram, Notif Bot Telegram, Auto Backup, Template Config, Restore Backup
- `contactAdmin` dari settings dipakai di dropdown/dashboard; search field pakai ikon kaca pembesar (admin akun)

## 4. Server: Kode + Label (migrasi `009_server_code_label.sql`)

- `servers.name` **di-rename → `label`**; kolom baru `code` (UNIQUE index); backfill row lama `code = 'SRV-' || id`
- Form tambah server: **Kode Server** (validasi `^[A-Z0-9-]{2,20}$`, auto-uppercase, cek duplikat) + **Label** (maks 100) — menggantikan Nama Server
- Semua join `s.name AS server_name` → `s.label` (akun.js, adminUsers.js, adminAkun.js, recovery.js); detail transaksi beli pakai `server.label`
- Filter server di admin akun: `code · label`

## 5. Beli VPN: Grid Bendera + Checkout Bertahap

- Pilihan server = **grid 2 kolom kartu**: gambar bendera (SVG asli, bukan emoji) + badge kode + label + country
- **Filter chip negara**: Semua / Indonesia / Singapore / USA (flag kecil di chip)
- **SVG self-hosted**: `src/public/flags/id.svg` (2 strip), `sg.svg` (bulan sabit + 5 bintang), `us.svg` (13 strip + 50 bintang via `<use>` grid)
- **Section checkout tersembunyi** (`checkout-section.hidden`) sampai kartu server diketuk → protocol, package, username, uuid, tombol Checkout baru muncul; hint "Ketuk salah satu server di bawah untuk melanjutkan"
- Re-render error mempertahankan server terpilih (`renderBeli` baca `req.body.server_id` → `selectedId` → radio `checked` + JS reveal)

## 6. Admin: Edit Server

- Tombol **Edit** di list → `/admin/servers?edit=<id>`; form yang sama jadi mode edit (aksi `/admin/servers/:id/edit`, judul "Edit Server", tombol Simpan Perubahan + Batal, semua field prefill)
- Validasi duplikat kode **mengecualikan server itu sendiri**; id tak ada → 404; re-render error mempertahankan mode edit + nilai input
- Validasi dibagi ke `validateServer()` + render helper `serverForm()` di adminServers.js

## 7. Admin: List Server = Kartu Panjang (iterasi desain sesuai feedback user)

Urutan iterasi (hasil akhir di `2130468`):

1. Tabel → kartu panjang per server (header + tile info grid 2-3 kolom) — **ditolak user** (ingin 1 kolom)
2. 1 kolom, tiap info satu baris — diterima
3. Urutan header **label → kode → negara** (bukan kode dulu)
4. Info tanpa box per baris → **1 box untuk semua info** (bg `#f8fafc` + border + radius di `.server-card-body`), tanpa garis pemisah antar baris
5. Nilai info **font regular** (tanpa `cell-mono`, weight 500, bukan 600)
6. **Badge hanya kode** (`[SRV-A]`): desktop di kanan label (sebaris), mobile (≤640px) turun ke baris bawah label (label `flex: 1 0 100%`, title pakai row+wrap)
7. **Negara bukan badge** — badge s.d. hanya `[SRV-A]`; negara dipindah jadi baris info `COUNTRY` (nama lengkap, mis. `Indonesia`, bukan kode `ID`) di box bawah bersama Endpoint/API Key/Limit VPN
8. **Collapsible (default tertutup)** — collapsed hanya tampil label + badge + chevron; klik toggle (seluruh baris) membuka aksi (Edit · Pricing · Hapus) + box info. Kartu yang sedang diedit otomatis terbuka (`server-list-card-open`, chevron rotate 180°); JS `toggleServerCard()` di servers.ejs
9. **Halaman form terpisah** — box tambah server di atas list diganti tombol "Tambah Server" → `/admin/servers/new`; edit → `/admin/servers/:id/edit`; form di `admin/server-form.ejs` dengan **1 baris = 1 field** (stacked vertikal, tanpa `.row` multi-kolom); sukses redirect ke `/admin/servers`

Struktur kartu (expanded):
```
┌──────────────────────────────────────────┐
│ LinkGo Metro Teknologi  [SRV-A]      ▾   │  ← collapsed: hanya baris ini (chevron ▸)
│          Edit · Pricing · Hapus          │
│ ┌──────────────────────────────────────┐ │
│ │ ENDPOINT   https://...               │ │  ← 1 box semua info, font regular
│ │ API KEY    abc123...                 │ │
│ │ LIMIT VPN  Tak terbatas              │ │
│ │ COUNTRY    Indonesia                 │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

- Kartu yang sedang diedit di-highlight (`server-list-card-edit`, border indigo + ring)
- Fix CSS penting: `.card form` → `.card > form` (form hapus bersarang tidak kena layout kolom)

## 8. Operasional & Catatan Penting

- **Container dev** `rohtunnel-dev` (podman via `distrobox-host-exec`, host network, PORT 3000, volume `rohtunnel-dev-data`): setiap perubahan di-push ke GitHub, tunggu CDN ~2-4 menit (`curl tarball | tar -t | grep` untuk verifikasi), lalu `podman exec rm -rf /app/app` + `podman restart` → entrypoint unduh ulang + npm install + migrasi
- **⚠️ API key server ID1 di container dev TERTIMPA** saat testing fitur edit (commit `fa6736b`) — nilai asli tidak tersimpan di mana pun (backup kosong); sudah di-restore label/endpoint/country/limit (label `ID1`), tapi **api_key harus diisi ulang oleh user** via Manage Server → Edit. User juga tampaknya sudah mengedit sendiri di container (sekarang `SRV-A` / `LinkGo Metro Teknologi`)
- **Workflow container**: setuju pakai GitHub flow (push → CDN → redeploy) untuk container test
- **Lesson (tool)**: `pkill -f` yang pattern-nya cocok dengan cmdline shell sendiri akan membunuh shell — pakai `kill <PID>` dari `ss -tlnp`; background app lokal harus `setsid ... < /dev/null > log 2>&1 &` agar tidak ikut terbunuh saat shell tool timeout
- Repo GitHub masih **PUBLIC** (alur goal.md: dipublik saat testing, privatkan setelah deploy produksi)

## 9. State Saat Ini

- Semua pekerjaan sesi ter-push (`2130468`); container dev berjalan dengan code terbaru
- DB container: server `SRV-A · LinkGo Metro Teknologi` (id 1, api_key perlu diisi ulang user)
- Lanjutan opsional (dari sesi 1, belum berubah): isi template config asli, pricing per-aksi, pemakaian bandwidth dari API
- Konvensi: dokumentasi di `project-information/`; user berkomunikasi dalam Bahasa Indonesia