#!/bin/sh
# RohTunnel entrypoint — 1-click install & start (sesuai goal.md)
# - install jika belum, start jika sudah
# - tidak auto-update: source hanya diunduh ulang bila APP_BRANCH berubah / belum ada
# - semua konfigurasi dari repo + database, bukan .env
set -e

REPO="${APP_REPO:?APP_REPO wajib diisi (URL repo publik, mis. https://github.com/user/rohtunnel)}"
BRANCH="${APP_BRANCH:-main}"
APP_DIR="${APP_DIR:-/app/app}"
DATA_DIR="${DATA_DIR:-/app/data}"
VERSION_MARKER="$APP_DIR/.version"
INSTALLED_MARKER="$APP_DIR/.installed"

log() { echo "[entrypoint] $1"; }

# unduh file via node (tidak butuh curl/wget di image)
fetch() {
  node -e "
    fetch(process.argv[1]).then(r => {
      if (!r.ok) { console.error('HTTP ' + r.status + ' untuk ' + process.argv[1]); process.exit(1); }
      return r.arrayBuffer();
    }).then(b => require('fs').writeFileSync(process.argv[2], Buffer.from(b)))
       .catch(e => { console.error(e.message); process.exit(1); });
  " "$1" "$2"
}

mkdir -p "$APP_DIR" "$DATA_DIR"

need_download=false
if [ ! -f "$APP_DIR/package.json" ]; then
  need_download=true
elif [ -f "$VERSION_MARKER" ] && [ "$(cat "$VERSION_MARKER")" != "$BRANCH" ]; then
  need_download=true
fi

if [ "$need_download" = true ]; then
  log "mengunduh source dari $REPO (branch $BRANCH)..."
  fetch "$REPO/archive/refs/heads/$BRANCH.tar.gz" /tmp/app.tar.gz
  rm -rf /tmp/appsrc
  mkdir -p /tmp/appsrc
  tar -xzf /tmp/app.tar.gz -C /tmp/appsrc
  rm -rf "$APP_DIR"
  mkdir -p "$APP_DIR"
  cp -a /tmp/appsrc/. "$APP_DIR/"
  rm -rf /tmp/app.tar.gz /tmp/appsrc
  echo "$BRANCH" > "$VERSION_MARKER"
  log "source siap"
fi

if [ ! -f "$INSTALLED_MARKER" ]; then
  log "npm install (pertama kali, bisa makan waktu beberapa menit)..."
  cd "$APP_DIR"
  if ! npm install --omit=dev --no-audit --no-fund; then
    log "npm install gagal, mencoba dengan build tools (python3, make, g++)..."
    (apt-get update -qq && apt-get install -y -qq python3 make g++ >/dev/null 2>&1 || true)
    npm install --omit=dev --no-audit --no-fund
  fi
  touch "$INSTALLED_MARKER"
  log "npm install selesai"
fi

cd "$APP_DIR"
log "menjalankan aplikasi"
exec npm start