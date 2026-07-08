#!/bin/bash
# =============================================================
#   CASPER SIGNAL ANALYTICS — UPDATE SCRIPT
#   Jalankan setiap kali ada update kode dari GitHub
#   Usage: bash /var/www/casper/deploy/update.sh
# =============================================================

APP_DIR="/var/www/casper"
START_TIME=$(date '+%Y-%m-%d %H:%M:%S')

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   CASPER SIGNAL — UPDATE DEPLOY                 ║"
echo "╚══════════════════════════════════════════════════╝"
echo "  Waktu: $START_TIME"
echo ""

# ── Pull kode terbaru ─────────────────────────────────────────
echo "▶ [1/4] Pull kode terbaru dari GitHub..."
cd "$APP_DIR"
git pull origin main
echo "✅ Kode ter-update"

# ── Update dependencies backend ───────────────────────────────
echo ""
echo "▶ [2/4] Update dependencies backend..."
cd "$APP_DIR/backend"
npm install --omit=dev
echo "✅ Dependencies backend siap"

# ── Rebuild frontend ──────────────────────────────────────────
echo ""
echo "▶ [3/4] Build ulang frontend..."
cd "$APP_DIR/frontend"
npm install
npm run build
echo "✅ Frontend berhasil di-build"

# ── Restart backend ───────────────────────────────────────────
echo ""
echo "▶ [4/4] Restart backend (PM2)..."
pm2 restart casper-api
echo "✅ Backend berhasil di-restart"

# ── Selesai ───────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   ✅  UPDATE SELESAI!                           ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
pm2 list
echo ""
