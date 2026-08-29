# Bug Fixed

## BUG-003: entrypoint salah extract tarball GitHub

**Ditemukan:** 29 Agustus 2026 (test real GitHub via podman)
**Diperbaiki:** 29 Agustus 2026

**Perbaikan:** `entrypoint.sh` — deteksi struktur tarball (satu folder → masuk folder itu; selain itu → root langsung) sebelum `cp -a "$SRC/." "$APP_DIR/"`.

**Verifikasi:** Container `rohtunnel-dev` (APP_REPO github.com/rohcuan/rohtunnel) berhasil install → migrasi + seed → app jalan di port 3000; landing 200, register/login OK, halaman admin OK.

## BUG-001: vpnApi tidak melempar error saat HTTP non-OK

**Ditemukan:** 28 Agustus 2026 (Fase 4, pengujian beli VPN)
**Diperbaiki:** 28 Agustus 2026

**Perbaikan:** `src/services/vpnApi.js` — `apiCall` sekarang melempar error bila `!res.ok`, dengan pesan dari `json.meta.message` / `json.message` / fallback `HTTP <status>`.

**Verifikasi:** Uji ulang "beli dengan username duplikat" → menampilkan error bersih "Gagal membuat akun di server: username sudah dipakai" tanpa crash; app tetap hidup.