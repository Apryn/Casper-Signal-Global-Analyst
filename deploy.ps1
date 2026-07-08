# ==============================================================================
# POWERSHELL DEPLOYMENT SCRIPT - CASPER SIGNAL ANALYTICS
# VPS: 187.77.156.219 (sama dengan Motodoct)
# Motodoct  → port 80  (backend :5000)
# Casper    → port 81  (backend :5001)
# ==============================================================================

Clear-Host
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  CASPER SIGNAL ANALYTICS — DEPLOYMENT TO VPS     " -ForegroundColor Cyan
Write-Host "  VPS: 187.77.156.219 (shared dengan Motodoct)    " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# ── KONFIGURASI ───────────────────────────────────────────────
$VPS_IP      = "187.77.156.219"
$VPS_USER    = "root"
$APP_DIR     = "/var/www/casper"
$BACKEND_PORT = 5001   # Motodoct pakai 5000, Casper pakai 5001
$NGINX_PORT  = 81      # Motodoct pakai 80, Casper pakai 81
# ──────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  IP VPS  : $VPS_IP" -ForegroundColor Gray
Write-Host "  User    : $VPS_USER" -ForegroundColor Gray
Write-Host "  App Dir : $APP_DIR" -ForegroundColor Gray
Write-Host ""

# ── MENU PILIHAN ──────────────────────────────────────────────
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  PILIH METODE DEPLOYMENT:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [1] Quick Update (REKOMENDASI - Cepat)" -ForegroundColor Green
Write-Host "      Push ke GitHub + Pull di VPS + Restart PM2"
Write-Host "      Tidak install ulang node_modules"
Write-Host ""
Write-Host "  [2] Full Deploy (Setup Pertama Kali)" -ForegroundColor Yellow
Write-Host "      Install Node.js, Nginx, PM2, clone repo,"
Write-Host "      setup .env, init database, build frontend"
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

$pilihan = Read-Host "Masukkan pilihan (1 atau 2, default: 1)"
if ($pilihan -ne "2") { $pilihan = "1" }

# ── COMMON: Commit & Push ke GitHub dulu ─────────────────────
Write-Host ""
Write-Host "▶ [Git] Memeriksa perubahan kode..." -ForegroundColor Yellow

$PROJECT_DIR = $PSScriptRoot
Set-Location $PROJECT_DIR

$STATUS = git status --porcelain
if ($STATUS) {
    Write-Host "  Ada perubahan yang belum di-commit:" -ForegroundColor White
    git status --short
    Write-Host ""
    $COMMIT_MSG = Read-Host "  Masukkan pesan commit (Enter untuk default)"
    if ([string]::IsNullOrWhiteSpace($COMMIT_MSG)) {
        $COMMIT_MSG = "deploy: update $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    }
    git add -A
    git commit -m $COMMIT_MSG
    Write-Host "  ✅ Commit berhasil" -ForegroundColor Green
} else {
    Write-Host "  ✅ Tidak ada perubahan baru, skip commit" -ForegroundColor Green
}

Write-Host ""
Write-Host "▶ [Git] Push ke GitHub..." -ForegroundColor Yellow
git push origin master
Write-Host "  ✅ Push ke GitHub berhasil" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════
if ($pilihan -eq "1") {
# ══ QUICK UPDATE ══════════════════════════════════════════════

    Write-Host ""
    Write-Host "====================================================" -ForegroundColor Green
    Write-Host "  MODE: QUICK UPDATE" -ForegroundColor Green
    Write-Host "====================================================" -ForegroundColor Green

    Write-Host ""
    Write-Host "▶ [VPS] Menghubungkan ke VPS dan menjalankan update..." -ForegroundColor Yellow

    $REMOTE_COMMANDS = @"
echo '▶ Pull kode terbaru...'
cd $APP_DIR
git pull origin master

echo '▶ Update dependencies backend...'
cd $APP_DIR/backend
npm install --omit=dev --silent

echo '▶ Rebuild frontend...'
cd $APP_DIR/frontend
npm install --silent
npm run build

echo '▶ Restart backend dengan PM2...'
pm2 restart casper-api

echo ''
echo '✅ Update selesai!'
pm2 list
"@

    ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" $REMOTE_COMMANDS

} else {
# ══ FULL SETUP ════════════════════════════════════════════════

    Write-Host ""
    Write-Host "====================================================" -ForegroundColor Yellow
    Write-Host "  MODE: FULL SETUP (Setup Pertama Kali)" -ForegroundColor Yellow
    Write-Host "====================================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  ⚠️  Kamu perlu mengisi .env di VPS setelah ini." -ForegroundColor Yellow
    Write-Host ""

    $REMOTE_SETUP = @"
set -e

echo '▶ [1/8] Update sistem...'
apt update -y && apt upgrade -y

echo '▶ [2/8] Install Node.js 20...'
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo '▶ [3/8] Install PM2, Nginx, Git...'
npm install -g pm2
apt install -y nginx git

echo '▶ [4/8] Clone repository...'
if [ -d '$APP_DIR' ]; then
  cd '$APP_DIR' && git pull origin master
else
  git clone https://github.com/Apryn/Casper-Signal-Global-Analyst.git '$APP_DIR'
fi
chown -R root:root '$APP_DIR'

echo '▶ [5/8] Install dependencies backend...'
cd '$APP_DIR/backend'
npm install --omit=dev

echo ''
echo '⚠️  PENTING: Sekarang buat file .env di VPS!'
echo '    Jalankan perintah ini di VPS:'
echo '    nano $APP_DIR/backend/.env'
echo ''
echo '    Isi dengan:'
echo '    DATABASE_URL=postgresql://...'
echo '    JWT_SECRET=...'
echo '    TELEGRAM_BOT_TOKEN=...'
echo '    TELEGRAM_GROUP_ID=...'
echo '    TELEGRAM_REPORT_THREAD_ID=...'
echo '    NODE_ENV=production'
echo '    PORT=5001   # Casper pakai 5001 (Motodoct sudah pakai 5000)'
echo ''
read -p 'Tekan Enter setelah .env dibuat dan diisi...'

echo '▶ [6/8] Init database schema...'
cd '$APP_DIR/backend'
node src/db/init.js

echo '▶ [7/8] Build frontend...'
cd '$APP_DIR/frontend'
npm install
echo 'VITE_API_URL=/api' > .env.production
echo 'VITE_APP_PORT=5001' >> .env.production
npm run build

echo '▶ [8/8] Setup Nginx & PM2...'
cat > /etc/nginx/sites-available/casper << 'NGINX'
server {
    listen 81;  # Casper pakai port 81 (Motodoct di port 80)
    server_name _;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    root $APP_DIR/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:5001;  # Backend Casper di port 5001
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX

# JANGAN hapus default — Motodoct masih pakai config Nginx yang ada!
# Hanya tambahkan site baru untuk Casper
ln -sf /etc/nginx/sites-available/casper /etc/nginx/sites-enabled/casper
nginx -t && systemctl reload nginx

cd '$APP_DIR/backend'
pm2 delete casper-api 2>/dev/null || true
PORT=5001 pm2 start src/index.js --name 'casper-api' --env production
pm2 save
pm2 startup | tail -1 | bash -

echo ''
echo '======================================================'
echo '  ✅  FULL SETUP SELESAI!'
echo '======================================================'
echo "  Casper Dashboard : http://187.77.156.219:81"
echo "  Motodoct         : http://187.77.156.219 (tidak berubah)"
pm2 list
"@

    ssh -o StrictHostKeyChecking=no -t "${VPS_USER}@${VPS_IP}" $REMOTE_SETUP
}

# ── SELESAI ───────────────────────────────────────────────────
Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host "  ✅  DEPLOY SELESAI!                             " -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  🌐 Casper Dashboard : http://${VPS_IP}:81" -ForegroundColor Cyan
Write-Host "  🌐 Motodoct         : http://${VPS_IP} (tidak berubah)" -ForegroundColor Gray
Write-Host "  📋 Log Casper       : ssh ${VPS_USER}@${VPS_IP} 'pm2 logs casper-api'" -ForegroundColor Gray
Write-Host ""
