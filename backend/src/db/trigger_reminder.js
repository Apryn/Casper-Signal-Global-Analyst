import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Telegraf } from 'telegraf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

import { setBotInstance, checkMissingReports } from '../services/cron.service.js';

async function run() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN tidak ditemukan di .env');
    process.exit(1);
  }
  
  console.log('🤖 Menginisialisasi Telegram Bot...');
  const bot = new Telegraf(token);
  setBotInstance(bot);
  
  console.log('⏰ Memicu pengiriman pengingat laporan harian (checkMissingReports) sekarang...');
  
  // Ambil tanggal hari ini dalam format WIB (Asia/Jakarta)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(new Date());
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const todayStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
  
  console.log(`Checking missing reports for date: ${todayStr}`);
  
  await checkMissingReports(todayStr);
  
  console.log('✅ Selesai memicu pengingat!');
  
  // Berikan jeda 5 detik agar koneksi Telegram selesai mengirim pesan sebelum exit
  setTimeout(() => {
    console.log('👋 Keluar.');
    process.exit(0);
  }, 5000);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
