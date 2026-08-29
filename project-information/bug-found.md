# Bug Found

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