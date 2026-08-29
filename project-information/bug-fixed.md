# Bug Fixed

## BUG-005: endpoint Potato API dobel /vps

**Ditemukan:** 29 Agustus 2026 (test real GitHub via podman)
**Diperbaiki:** 29 Agustus 2026

**Perbaikan:** `src/services/vpnApi.js` — strip `/vps` trailing dari endpoint bila path sudah diawali `/vps`.

**Verifikasi:** Beli vless real (realuser1, 200GB/3IP/30hari, Rp7.000) sukses; saldo 100.000→93.000; refresh config OK; renew (+30 hari), add-ip (3→4), lock/unlock OK; saldo akhir 79.000.

## BUG-004: DB_PATH tidak mengarah ke volume DATA_DIR di container

**Ditemukan:** 29 Agustus 2026 (test real GitHub via podman)
**Diperbaiki:** 29 Agustus 2026

**Perbaikan:** `entrypoint.sh` export `DB_PATH`/`BACKUP_DIR` ke `DATA_DIR` (volume); `adminSetup.js` pakai `path.dirname(DB_PATH)`.

**Verifikasi:** Container `rohtunnel-dev` restart → DB benar di `/app/data` (volume `rohtunnel-dev-data`), landing 200, login admin OK.

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