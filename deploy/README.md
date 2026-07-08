# Casper Signal Analytics — Deploy Scripts

Folder ini berisi script otomatis untuk deploy dan update aplikasi ke VPS Hostinger.

---

## 📁 Isi Folder

| File | Kegunaan |
|------|----------|
| `setup-vps.sh` | Setup **pertama kali** di VPS baru |
| `update.sh` | Update app di VPS setelah ada perubahan kode |
| `push-to-vps.ps1` | Deploy dari PC Windows (commit + push + update VPS sekaligus) |

---

## 🚀 Cara Pakai

### 1. Setup Pertama Kali (di VPS)

```bash
# Login ke VPS via SSH dari Hostinger panel atau terminal
ssh root@IP_VPS_KAMU

# Upload script setup (dari PC)
scp deploy/setup-vps.sh root@IP_VPS:/root/
scp deploy/update.sh root@IP_VPS:/root/

# Jalankan setup (di VPS)
bash setup-vps.sh
```

> Script akan meminta input: DATABASE_URL, JWT_SECRET, Telegram Token, dll.

---

### 2. Update Setelah Ada Perubahan Kode

**Dari PC Windows (cara termudah):**
```powershell
# Edit VPS_IP dan VPS_USER di file push-to-vps.ps1 dulu
.\deploy\push-to-vps.ps1
```

Script ini akan:
1. Commit & push perubahan ke GitHub
2. SSH ke VPS otomatis
3. Pull kode terbaru
4. Rebuild frontend
5. Restart backend

**Atau langsung dari VPS:**
```bash
bash /var/www/casper/deploy/update.sh
```

---

### 3. Install SSL HTTPS (opsional, setelah punya domain)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d domain-kamu.com
```

---

## ⚙️ Konfigurasi

Sebelum menjalankan, edit bagian ini di `setup-vps.sh`:

```bash
REPO_URL="https://github.com/USERNAME/casper-signal-global-analyst.git"  # ← URL repo GitHub
DOMAIN=""          # ← Isi domain jika ada, kosongkan untuk pakai IP
```

Dan di `push-to-vps.ps1`:

```powershell
[string]$VPS_IP = "0.0.0.0"    # ← IP VPS dari Hostinger
[string]$VPS_USER = "root"      # ← User SSH
```

---

## 📋 Perintah Berguna di VPS

```bash
pm2 status                    # Lihat status backend
pm2 logs casper-api           # Lihat log backend realtime
pm2 restart casper-api        # Restart backend
pm2 stop casper-api           # Stop backend
sudo systemctl status nginx   # Status Nginx
sudo nginx -t                 # Test konfigurasi Nginx
```
