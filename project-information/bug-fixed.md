# Bug Fixed

## BUG-001: vpnApi tidak melempar error saat HTTP non-OK

**Ditemukan:** 28 Agustus 2026 (Fase 4, pengujian beli VPN)
**Diperbaiki:** 28 Agustus 2026

**Perbaikan:** `src/services/vpnApi.js` — `apiCall` sekarang melempar error bila `!res.ok`, dengan pesan dari `json.meta.message` / `json.message` / fallback `HTTP <status>`.

**Verifikasi:** Uji ulang "beli dengan username duplikat" → menampilkan error bersih "Gagal membuat akun di server: username sudah dipakai" tanpa crash; app tetap hidup.