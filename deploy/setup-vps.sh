#!/bin/bash
# =============================================================
#   CASPER SIGNAL ANALYTICS — VPS SETUP SCRIPT (Hostinger)
#   Jalankan SEKALI saat pertama kali setup VPS
#   Usage: bash setup-vps.sh
# =============================================================

set -e  # Stop jika ada error

# ── KONFIGURASI ───────────────────────────────────────────────
REPO_URL="https://github.com/USERNAME/casper-signal-global-analyst.git"  # ← GANTI INI
APP_DIR="/var/www/casper"
DOMAIN=""          # ← Isi domain kamu, kosongkan jika pakai IP saja
APP_PORT=5000
# ──────────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   CASPER SIGNAL — VPS SETUP                     ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── STEP 1: Update sistem ──────────────────────────────────────
echo "▶ [1/8] Update sistem..."
sudo apt update -y && sudo apt upgrade -y
echo "✅ Sistem updated"

# ── STEP 2: Install Node.js 20 ────────────────────────────────
echo ""
echo "▶ [2/8] Install Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
echo "✅ Node.js $(node -v) terinstall"

# ── STEP 3: Install PM2 & dependencies ───────────────────────
echo ""
echo "▶ [3/8] Install PM2, Nginx, Git..."
sudo npm install -g pm2
sudo apt install -y nginx git
echo "✅ PM2 $(pm2 -v), Nginx, Git terinstall"

# ── STEP 4: Clone repository ──────────────────────────────────
echo ""
echo "▶ [4/8] Clone repository..."
if [ -d "$APP_DIR" ]; then
  echo "  Folder sudah ada, pull update terbaru..."
  cd "$APP_DIR" && git pull
else
  sudo git clone "$REPO_URL" "$APP_DIR"
fi
sudo chown -R $USER:$USER "$APP_DIR"
echo "✅ Kode berhasil diclone ke $APP_DIR"

# ── STEP 5: Setup Backend ─────────────────────────────────────
echo ""
echo "▶ [5/8] Setup backend..."
cd "$APP_DIR/backend"
npm install --omit=dev

# Buat file .env jika belum ada
if [ ! -f ".env" ]; then
  echo ""
  echo "⚠️  File .env belum ada. Silakan isi nilai berikut:"
  echo ""
  read -p "  DATABASE_URL (Neon PostgreSQL URL): " DB_URL
  read -p "  JWT_SECRET (buat string random panjang): " JWT_SEC
  read -p "  TELEGRAM_BOT_TOKEN: " TG_TOKEN
  read -p "  TELEGRAM_GROUP_ID (angka negatif, misal -1001234567890): " TG_GROUP
  read -p "  TELEGRAM_REPORT_THREAD_ID (opsional, tekan Enter jika tidak ada): " TG_THREAD

  cat > .env << EOF
DATABASE_URL=$DB_URL
JWT_SECRET=$JWT_SEC
TELEGRAM_BOT_TOKEN=$TG_TOKEN
TELEGRAM_GROUP_ID=$TG_GROUP
TELEGRAM_REPORT_THREAD_ID=$TG_THREAD
NODE_ENV=production
PORT=$APP_PORT
EOF
  echo "✅ File .env berhasil dibuat"
else
  echo "✅ File .env sudah ada, melewati..."
fi

# Init database schema
echo "  Inisialisasi schema database..."
node src/db/init.js
echo "✅ Database schema siap"

# ── STEP 6: Build Frontend ────────────────────────────────────
echo ""
echo "▶ [6/8] Build frontend..."
cd "$APP_DIR/frontend"
npm install

# Buat .env.production untuk frontend
cat > .env.production << EOF
VITE_API_URL=/api
EOF

npm run build
echo "✅ Frontend berhasil di-build ke dist/"

# ── STEP 7: Setup Nginx ───────────────────────────────────────
echo ""
echo "▶ [7/8] Konfigurasi Nginx..."

SERVER_NAME="${DOMAIN:-_}"  # pakai domain atau catch-all "_"

sudo tee /etc/nginx/sites-available/casper > /dev/null << EOF
server {
    listen 80;
    server_name $SERVER_NAME;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # Frontend static files
    root $APP_DIR/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://localhost:$APP_PORT;
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
EOF

# Aktifkan site
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/casper /etc/nginx/sites-enabled/casper
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
echo "✅ Nginx terkonfigurasi dan berjalan"

# ── STEP 8: Jalankan Backend dengan PM2 ──────────────────────
echo ""
echo "▶ [8/8] Menjalankan backend dengan PM2..."
cd "$APP_DIR/backend"

pm2 delete casper-api 2>/dev/null || true
pm2 start src/index.js --name "casper-api" --env production
pm2 save
pm2 startup | tail -1 | sudo bash -  # jalankan startup command otomatis
echo "✅ Backend berjalan dengan PM2"

# ── SELESAI ───────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   ✅  SETUP SELESAI!                            ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
if [ -n "$DOMAIN" ]; then
  echo "  🌐 Dashboard: http://$DOMAIN"
  echo ""
  echo "  🔒 Untuk SSL (HTTPS), jalankan:"
  echo "     sudo apt install -y certbot python3-certbot-nginx"
  echo "     sudo certbot --nginx -d $DOMAIN"
else
  VPS_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
  echo "  🌐 Dashboard: http://$VPS_IP"
fi
echo ""
echo "  📋 PM2 Status   : pm2 status"
echo "  📋 Backend Log  : pm2 logs casper-api"
echo "  📋 Update app   : bash /var/www/casper/deploy/update.sh"
echo ""
