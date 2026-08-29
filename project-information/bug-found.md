# Bug Found

## BUG-004: DB_PATH tidak mengarah ke volume DATA_DIR di container (29 Agustus 2026)

**Status:** FIXED (lihat bug-fixed.md)

**Gejala:** Container dev: `podman exec` membuka `/app/data/rohtunnel.db` → "no such table: users"; file di volume 0 byte. Padahal app berjalan normal.

**Akar masalah:** `src/db.js` default `DB_PATH = path.join(__dirname, "..", "data", "rohtunnel.db")` — dari `/app/app/src` menjadi `/app/app/data/` (di dalam source dir), BUKAN `/app/data` (volume). Akibatnya database & backup tersimpan di dalam `/app/app`, tidak persist di volume; path restore-pending di `adminSetup.js` juga salah (`__dirname/../../data`).

**Perbaikan:**
1. `entrypoint.sh`: `export DB_PATH="$DATA_DIR/rohtunnel.db"` + `export BACKUP_DIR="$DATA_DIR/backup"`.
2. `src/routes/adminSetup.js`: `DATA_DIR = path.dirname(DB_PATH)` (import `DB_PATH` dari `../db`).

**Pelajaran:** Lokasi data (DB/backup/restore) harus satu sumber kebenaran (`DB_PATH`/env), jangan dihitung ulang dari `__dirname` di berbagai modul.

## BUG-003: entrypoint salah extract tarball GitHub (29 Agustus 2026)

**Status:** FIXED (lihat bug-fixed.md)

**Gejala:** Test real dengan repo GitHub: `npm install` gagal `ENOENT /app/app/package.json` — log "source siap" tapi file tidak ada di `/app/app`.

**Akar masalah:** Tarball GitHub (`archive/refs/heads/main.tar.gz`) berisi folder tunggal `rohtunnel-main/`, sedangkan `cp -a /tmp/appsrc/. "$APP_DIR/"` menyalin folder itu KE DALAM `/app/app` (`/app/app/rohtunnel-main/...`), bukan isinya. Uji dengan fake repo lokal lolos karena tarball lokal berstruktur root `./`.

**Perbaikan:** entrypoint mendeteksi struktur: jika `/tmp/appsrc` berisi satu folder → pakai folder itu sebagai source (`SRC`), jika tidak → pakai `/tmp/appsrc` langsung; lalu `cp -a "$SRC/." "$APP_DIR/"`.

**Catatan tambahan:** `raw.githubusercontent.com` CDN cache ~2-4 menit — setelah push fix, tunggu sebelum menguji ulang (verifikasi konten dengan `curl raw | grep`).

**Pelajaran:** Tarball dari sumber berbeda punya struktur berbeda — entrypoint harus tangguh terhadap keduanya (folder tunggal vs root).

## BUG-001: vpnApi tidak melempar error saat HTTP non-OK (28 Agustus 2026)

**Status:** FIXED (lihat bug-fixed.md)

**Gejala:** Beli VPN dengan username yang sudah dipakai di server → API Potato mengembalikan HTTP 409 dengan body JSON `{meta: {message: "username sudah dipakai"}}`. Aplikasi tidak melempar error (hanya cek `json.success === false`), sehingga melanjutkan ke penyimpanan akun di DB → crash `SQLITE_CONSTRAINT_UNIQUE` (UNIQUE server_id+protocol+username) → seluruh app mati.

**Lokasi:** `src/services/vpnApi.js` — fungsi `apiCall` tidak memeriksa `res.ok`.

**Perbaikan:** Tambahkan cek `!res.ok` → throw error dengan pesan dari `meta.message` sebelum cek `success`.

**Pelajaran:** Semua wrapper API eksternal WAJIB melempar error pada HTTP status non-2xx, bukan hanya pada `success: false` di body.