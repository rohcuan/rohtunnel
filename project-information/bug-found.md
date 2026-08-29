# Bug Found

## BUG-001: vpnApi tidak melempar error saat HTTP non-OK (28 Agustus 2026)

**Status:** FIXED (lihat bug-fixed.md)

**Gejala:** Beli VPN dengan username yang sudah dipakai di server → API Potato mengembalikan HTTP 409 dengan body JSON `{meta: {message: "username sudah dipakai"}}`. Aplikasi tidak melempar error (hanya cek `json.success === false`), sehingga melanjutkan ke penyimpanan akun di DB → crash `SQLITE_CONSTRAINT_UNIQUE` (UNIQUE server_id+protocol+username) → seluruh app mati.

**Lokasi:** `src/services/vpnApi.js` — fungsi `apiCall` tidak memeriksa `res.ok`.

**Perbaikan:** Tambahkan cek `!res.ok` → throw error dengan pesan dari `meta.message` sebelum cek `success`.

**Pelajaran:** Semua wrapper API eksternal WAJIB melempar error pada HTTP status non-2xx, bukan hanya pada `success: false` di body.