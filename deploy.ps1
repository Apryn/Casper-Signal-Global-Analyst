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
Write-Host "  Motodoct: port 3000 → Nginx 80/443 (motodoct.com)" -ForegroundColor Gray
Write-Host "  Casper  : port 5000 → Nginx 8080 (new)" -ForegroundColor Gray
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
# VPS State (verified):
#   - Node.js v20.20.2  ✅ sudah ada
#   - PM2               ✅ sudah ada  
#   - Nginx             ✅ sudah ada (Motodoct pakai port 3000 → Nginx 80/443)
#   - /var/www/motodoct ✅ sudah ada
#   Target Casper:
#   - Backend  → port 5000
#   - Nginx    → port 8080

    Write-Host ""
    Write-Host "====================================================" -ForegroundColor Yellow
    Write-Host "  MODE: FULL SETUP (Setup Pertama Kali di VPS)    " -ForegroundColor Yellow
    Write-Host "  VPS sudah ada: Node v20, PM2, Nginx, Motodoct   " -ForegroundColor Gray
    Write-Host "  Casper akan ditambahkan tanpa mengganggu apapun  " -ForegroundColor Gray
    Write-Host "====================================================" -ForegroundColor Yellow
    Write-Host ""

    $REMOTE_SETUP = @"
set -e

echo '▶ [1/6] Clone/update repository Casper Signal...'
if [ -d '/var/www/casper' ]; then
  echo '  Folder sudah ada, pull update terbaru...'
  cd /var/www/casper && git pull origin master
else
  git clone https://github.com/Apryn/Casper-Signal-Global-Analyst.git /var/www/casper
fi
echo '  ✅ Kode siap'

echo ''
echo '▶ [2/6] Install dependencies backend...'
cd /var/www/casper/backend
npm install --omit=dev --silent
echo '  ✅ Dependencies backend terinstall'

echo ''
echo '⚠️  LANGKAH PENTING: Buat file .env backend!'
echo '    Buka terminal baru, jalankan:'
echo '    nano /var/www/casper/backend/.env'
echo ''
echo '    Isi dengan nilai berikut:'
echo '    DATABASE_URL=postgresql://neon_url_disini'
echo '    JWT_SECRET=casper_jwt_secret_panjang_2026'
echo '    TELEGRAM_BOT_TOKEN=token_dari_botfather'
echo '    TELEGRAM_GROUP_ID=-100xxxxxxx'
echo '    TELEGRAM_REPORT_THREAD_ID=xxx (opsional)'
echo '    NODE_ENV=production'
echo '    PORT=5000'
echo ''
read -p 'Tekan Enter setelah file .env sudah dibuat dan diisi...'

echo ''
echo '▶ [3/6] Init database schema...'
cd /var/www/casper/backend
node src/db/init.js
echo '  ✅ Database schema siap'

echo ''
echo '▶ [4/6] Build frontend...'
cd /var/www/casper/frontend
npm install --silent
printf 'VITE_API_URL=/api\n' > .env.production
npm run build
echo '  ✅ Frontend berhasil di-build'

echo ''
echo '▶ [5/6] Tambah config Nginx (port 8080, tidak ganggu Motodoct)...'
cat > /etc/nginx/sites-available/casper << 'NGINXEOF'
server {
    listen 8080;
    server_name _;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    root /var/www/casper/frontend/dist;
    index index.html;

    # Frontend SPA routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API proxy ke port 5000
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/casper /etc/nginx/sites-enabled/casper
nginx -t && systemctl reload nginx
echo '  ✅ Nginx port 8080 aktif untuk Casper'

echo ''
echo '▶ [6/6] Jalankan backend Casper dengan PM2...'
cd /var/www/casper/backend
pm2 delete casper-api 2>/dev/null || true
PORT=5000 pm2 start src/index.js --name 'casper-api' --env production
pm2 save
echo '  ✅ Backend berjalan di PM2 (port 5000)'

echo ''
echo '======================================================'
echo '  ✅  CASPER SIGNAL BERHASIL DEPLOY!'
echo '======================================================'
echo ''
echo '  🌐 Casper Dashboard : http://187.77.156.219:8080'
echo '  🌐 Motodoct         : https://motodoct.com (tidak berubah)'
echo ''
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
Write-Host "  🌐 Casper Dashboard : http://${VPS_IP}:8080" -ForegroundColor Cyan
Write-Host "  🌐 Motodoct         : https://motodoct.com (tidak berubah)" -ForegroundColor Gray
Write-Host "  📋 PM2 Casper       : ssh ${VPS_USER}@${VPS_IP} 'pm2 logs casper-api'" -ForegroundColor Gray
Write-Host ""
