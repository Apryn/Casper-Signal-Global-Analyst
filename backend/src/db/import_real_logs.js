import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import telegramService from '../services/telegram.service.js';
const { parseMessageText } = telegramService;

import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const LOGS_FILE_PATH = path.join(__dirname, '../../../scratch/raw_chat_logs.txt');

// Regex splitter to divide logs into individual Telegram messages
const splitMessages = (text) => {
  const prefixRE = /(?=\[\d{2}\/\d{2}\/\d{4}\s+[\d.:]+\]\s+[^:]+:)/g;
  return text.split(prefixRE).map(s => s.trim()).filter(s => s.length > 15);
};

async function runImport() {
  console.log('🚀 MEMULAI IMPORT DATA ASLI DARI CHAT LOGS...');
  
  if (!fs.existsSync(LOGS_FILE_PATH)) {
    console.error(`❌ File log chat tidak ditemukan di: ${LOGS_FILE_PATH}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(LOGS_FILE_PATH, 'utf-8');
  const messages = splitMessages(rawData);
  console.log(`📌 Terdeteksi ${messages.length} pesan dalam file log.`);

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  // Track success by streamer
  const streamerStats = {};

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    
    // Check if the message looks like a daily report
    const upperText = msg.toUpperCase();
    const looksLikeReport = (
      upperText.includes('UPLOAD:') ||
      upperText.includes('TANGGAL :') ||
      upperText.includes('TANGGAL:') ||
      upperText.includes('FTD:') ||
      (upperText.includes('STREAMING') && upperText.includes('LIVE:')) ||
      /Total\s+vi[dt]io/i.test(msg)
    );

    if (!looksLikeReport) {
      skipCount++;
      continue;
    }

    try {
      const result = await parseMessageText(msg);
      successCount++;
      
      const name = result.streamerName;
      streamerStats[name] = (streamerStats[name] || 0) + 1;
    } catch (err) {
      failCount++;
      // Log parsing errors for debugging if needed, but don't stop the loop
      // console.log(`❌ Gagal parse pesan #${i + 1}: ${err.message}`);
    }
  }

  console.log('\n=============================================');
  console.log('🎉 PROSES IMPORT SELESAI!');
  console.log('=============================================');
  console.log(`✅ Berhasil dimasukkan : ${successCount} laporan`);
  console.log(`❌ Gagal diparse        : ${failCount} laporan (tidak sesuai format)`);
  console.log(`➖ Dilewati (Bukan lap) : ${skipCount} pesan`);
  console.log('\n📊 Statistik Berhasil per Streamer:');
  console.log(JSON.stringify(streamerStats, null, 2));
  console.log('=============================================');
  
  await pool.end();
}

runImport();
