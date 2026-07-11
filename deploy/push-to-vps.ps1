# =============================================================
#   CASPER SIGNAL ANALYTICS - PUSH UPDATE KE VPS
#   Jalankan dari PC Windows setiap kali ingin update server
#   Usage: .\deploy\push-to-vps.ps1
# =============================================================

param(
    [string]$VPS_IP = "0.0.0.0",         # < GANTI dengan IP VPS Hostinger kamu
    [string]$VPS_USER = "root",            # < GANTI jika bukan root
    [string]$SSH_KEY = ""                  # < Path ke SSH key jika pakai key (opsional)
)

$START_TIME = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "    CASPER SIGNAL - PUSH UPDATE KE VPS" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Waktu  : $START_TIME" -ForegroundColor Gray
Write-Host "  Target : $VPS_USER@$VPS_IP" -ForegroundColor Gray
Write-Host ""

# Build SSH command
$SSH_ARGS = @()
if ($SSH_KEY -ne "") {
    $SSH_ARGS += "-i", $SSH_KEY
}
$SSH_ARGS += "-o", "StrictHostKeyChecking=no"
$SSH_TARGET = "$VPS_USER@$VPS_IP"

# -- Step 1: Commit & Push ke GitHub (Dilewati) ---------------------
Write-Host "-> [1/3] Skip commit & push (lakukan push manual jika ada perubahan lokal)" -ForegroundColor Yellow

# -- Step 2: SSH ke VPS dan jalankan update script ------------
Write-Host ""
Write-Host "-> [2/3] SSH ke VPS dan jalankan update..." -ForegroundColor Yellow
ssh @SSH_ARGS $SSH_TARGET "bash /var/www/casper/deploy/update.sh"

# -- Step 3: Cek status ----------------------------------------
Write-Host ""
Write-Host "-> [3/3] Cek status PM2..." -ForegroundColor Yellow
ssh @SSH_ARGS $SSH_TARGET "pm2 status"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "    [SUCCESS] DEPLOY SELESAI!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Buka: http://$VPS_IP" -ForegroundColor Cyan
Write-Host ""
