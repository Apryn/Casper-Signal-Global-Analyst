# ==============================================================================
# POWERSHELL DEPLOYMENT SCRIPT - CASPER SIGNAL ANALYTICS
# VPS: 187.77.156.219 (sama dengan Motodoct)
# Motodoct  -> port 80  (backend :5000)
# Casper    -> port 81  (backend :5001)
# ==============================================================================

Clear-Host
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  CASPER SIGNAL ANALYTICS - DEPLOYMENT TO VPS     " -ForegroundColor Cyan
Write-Host "  VPS: 187.77.156.219 shared dengan Motodoct       " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# -- KONFIGURASI -----------------------------------------------
$VPS_IP      = "187.77.156.219"
$VPS_USER    = "root"
$APP_DIR     = "/var/www/casper"
$BACKEND_PORT = 5001   # Motodoct pakai 5000, Casper pakai 5001
$NGINX_PORT  = 81      # Motodoct pakai 80, Casper pakai 81
# --------------------------------------------------------------

# Load .env variables to prevent exposing credentials on GitHub
$ENV_PATH = Join-Path $PSScriptRoot "backend\.env"
if (Test-Path $ENV_PATH) {
    Get-Content $ENV_PATH | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $key, $value = $line.Split("=", 2)
            $key = $key.Trim()
            $value = $value.Trim()
            Set-Variable -Name "ENV_$key" -Value $value -Scope Script
        }
    }
} else {
    Write-Host "[ERROR]: File backend\.env tidak ditemukan! Inisialisasi dibatalkan." -ForegroundColor Red
    Exit 1
}

Write-Host ""
Write-Host "  IP VPS  : $VPS_IP" -ForegroundColor Gray
Write-Host "  Motodoct: backend port 5000 -> Nginx 80/443 (motodoct.com)" -ForegroundColor Gray
Write-Host "  Casper  : backend port $BACKEND_PORT -> Nginx $NGINX_PORT (new)" -ForegroundColor Gray
Write-Host ""

# -- MENU PILIHAN ----------------------------------------------
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  PILIH METODE DEPLOYMENT:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [1] Quick Update (REKOMENDASI - Cepat)" -ForegroundColor Green
Write-Host "      Push ke GitHub + Pull di VPS + Restart PM2"
Write-Host "      Tidak install ulang node_modules"
Write-Host ""
Write-Host "  [2] Full Deploy (Setup Pertama Kali)" -ForegroundColor Yellow
Write-Host "      Install Node.js, Nginx, PM2, clone repo,"
# Write-Host "      setup .env, init database, build frontend"
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

$pilihan = Read-Host "Masukkan pilihan (1 atau 2, default: 1)"
if ($pilihan -ne "2") { $pilihan = "1" }

# Set Project Directory
$PROJECT_DIR = $PSScriptRoot
Set-Location $PROJECT_DIR

# ==============================================================
if ($pilihan -eq "1") {
# == QUICK UPDATE ==============================================

    Write-Host ""
    Write-Host "====================================================" -ForegroundColor Green
    Write-Host "  MODE: QUICK UPDATE" -ForegroundColor Green
    Write-Host "====================================================" -ForegroundColor Green

    Write-Host ""
    Write-Host "-> [VPS] Menghubungkan ke VPS dan menjalankan update..." -ForegroundColor Yellow

    $REMOTE_COMMANDS = @"
echo '-> Pull kode terbaru...'
cd $APP_DIR
git pull origin master

echo '-> Update .env config...'
if grep -q "ACTIVATION_CODE" $APP_DIR/backend/.env; then
  sed -i 's/^ACTIVATION_CODE=.*/ACTIVATION_CODE=$ENV_ACTIVATION_CODE/' $APP_DIR/backend/.env
else
  echo "ACTIVATION_CODE=$ENV_ACTIVATION_CODE" >> $APP_DIR/backend/.env
fi

if grep -q "GEMINI_API_KEY" $APP_DIR/backend/.env; then
  sed -i 's/^GEMINI_API_KEY=.*/GEMINI_API_KEY=$ENV_GEMINI_API_KEY/' $APP_DIR/backend/.env
else
  echo "GEMINI_API_KEY=$ENV_GEMINI_API_KEY" >> $APP_DIR/backend/.env
fi

echo '-> Update dependencies backend...'
cd $APP_DIR/backend
npm install --omit=dev --silent

echo '-> Rebuild frontend...'
cd $APP_DIR/frontend
npm install --silent
npm run build

echo '-> Restart backend dengan PM2...'
pm2 restart casper-api

echo ''
echo '[OK] Update selesai!'
pm2 list
"@
    $REMOTE_COMMANDS = $REMOTE_COMMANDS -replace "`r`n", "`n"
    ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" $REMOTE_COMMANDS

} else {
# == FULL SETUP ================================================
# VPS State (verified):
#   - Node.js v20.20.2  sudah ada
#   - PM2               sudah ada  
#   - Nginx             sudah ada (Motodoct pakai port 3000 -> Nginx 80/443)
#   - /var/www/motodoct sudah ada
#   Target Casper:
#   - Backend  -> port 5000
#   - Nginx    -> port 8080

    Write-Host ""
    Write-Host "====================================================" -ForegroundColor Yellow
    Write-Host "  MODE: FULL SETUP (Setup Pertama Kali di VPS)    " -ForegroundColor Yellow
    Write-Host "  VPS sudah ada: Node v20, PM2, Nginx, Motodoct   " -ForegroundColor Gray
    Write-Host "  Casper akan ditambahkan tanpa mengganggu apapun  " -ForegroundColor Gray
    Write-Host "====================================================" -ForegroundColor Yellow
    Write-Host ""

    $REMOTE_SETUP = @"
set -e

echo '-> [1/6] Clone/update repository Casper Signal...'
if [ -d '/var/www/casper' ]; then
  echo '  Folder sudah ada, pull update terbaru...'
  cd /var/www/casper && git pull origin master
else
  git clone https://github.com/Apryn/Casper-Signal-Global-Analyst.git /var/www/casper
fi
echo '  [OK] Kode siap'

echo ''
echo '-> [2/6] Install dependencies backend...'
cd /var/www/casper/backend
npm install --omit=dev --silent
echo '  [OK] Dependencies backend terinstall'

echo ''
echo '-> [2/6] Menulis file .env backend...'
cat > /var/www/casper/backend/.env << 'ENVEOF'
PORT=$BACKEND_PORT
NODE_ENV=production

DATABASE_URL=$ENV_DATABASE_URL

JWT_SECRET=$ENV_JWT_SECRET
JWT_EXPIRES_IN=$ENV_JWT_EXPIRES_IN

TELEGRAM_BOT_TOKEN=$ENV_TELEGRAM_BOT_TOKEN
TELEGRAM_GROUP_CHAT_ID=$ENV_TELEGRAM_GROUP_CHAT_ID
TELEGRAM_REPORT_THREAD_ID=$ENV_TELEGRAM_REPORT_THREAD_ID

ACTIVATION_CODE=$ENV_ACTIVATION_CODE
GEMINI_API_KEY=$ENV_GEMINI_API_KEY
ENVEOF
echo '  [OK] File .env berhasil dibuat otomatis'

echo ''
echo '-> [3/6] Init database schema...'
cd /var/www/casper/backend
node src/db/init.js
echo '  [OK] Database schema siap'

echo ''
echo '-> [4/6] Build frontend...'
cd /var/www/casper/frontend
npm install --silent
printf 'VITE_API_URL=/api\n' > .env.production
npm run build
echo '  [OK] Frontend berhasil di-build'

echo ''
echo '-> [5/6] Tambah config Nginx (port $NGINX_PORT, tidak ganggu Motodoct)...'
cat > /etc/nginx/sites-available/casper << 'NGINXEOF'
server {
    listen $NGINX_PORT;
    server_name _;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    root /var/www/casper/frontend/dist;
    index index.html;

    # Frontend SPA routing
    location / {
        try_files `$uri `$uri/ /index.html;
    }

    # Backend API proxy ke port $BACKEND_PORT
    location /api/ {
        proxy_pass http://localhost:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_cache_bypass `$http_upgrade;
        proxy_read_timeout 60s;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/casper /etc/nginx/sites-enabled/casper
nginx -t && systemctl reload nginx
echo '  [OK] Nginx port $NGINX_PORT aktif untuk Casper'

echo ''
echo '-> [6/6] Jalankan backend Casper dengan PM2...'
cd /var/www/casper/backend
pm2 delete casper-api 2>/dev/null || true
PORT=$BACKEND_PORT pm2 start src/index.js --name 'casper-api' --env production
pm2 save
echo '  [OK] Backend berjalan di PM2 (port $BACKEND_PORT)'

echo ''
echo '======================================================'
echo '  [OK] CASPER SIGNAL BERHASIL DEPLOY!'
echo '======================================================'
echo ''
echo "  Casper Dashboard : http://${VPS_IP}:${NGINX_PORT}"
echo '  Motodoct         : https://motodoct.com (tidak berubah)'
echo ''
pm2 list
"@
    $REMOTE_SETUP = $REMOTE_SETUP -replace "`r`n", "`n"
    ssh -o StrictHostKeyChecking=no -t "${VPS_USER}@${VPS_IP}" $REMOTE_SETUP
}

# -- SELESAI ---------------------------------------------------
Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host "  SUCCESS: DEPLOY SELESAI!                        " -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Casper Dashboard    : http://$($VPS_IP):$($NGINX_PORT)" -ForegroundColor Cyan
Write-Host "  Motodoct            : https://motodoct.com (tidak berubah)" -ForegroundColor Gray
Write-Host "  PM2 Casper Logs     : ssh $VPS_USER@$VPS_IP 'pm2 logs casper-api'" -ForegroundColor Gray
Write-Host ""
