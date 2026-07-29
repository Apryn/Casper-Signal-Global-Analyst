/**
 * check_live_now.js
 * Cek semua jadwal berstatus Live di DB vs status YouTube aktual.
 * Jika tidak benar-benar live di YouTube → set Cancelled.
 * Run: node src/check_live_now.js
 */

import 'dotenv/config';
import pkg from 'pg';
import axios from 'axios';

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = (sql, params) => pool.query(sql, params);

const checkChannelLive = async (channelId) => {
  try {
    // Scrape YouTube channel live page
    const url = `https://www.youtube.com/channel/${channelId}/live`;
    const res = await axios.get(url, {
      timeout: 10000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    const html = res.data;
    if (!html || typeof html !== 'string') return false;

    // Check final URL after redirects for watch?v= pattern
    const wasRedirectedToVideo = res.request?.res?.responseUrl?.includes('/watch?v=') ||
                                  res.request?._redirectable?._currentUrl?.includes('/watch?v=');

    const isLive = (html.includes('"isLive":true') || html.includes('"isLive": true')) &&
                   !html.includes('"isLive":false');

    return isLive || wasRedirectedToVideo;
  } catch (err) {
    console.log(`  [Check] Error: ${err.message}`);
    return null; // null = tidak bisa dicek
  }
};

const main = async () => {
  console.log('=== CEK JADWAL LIVE DI DB ===\n');
  
  const res = await db(`
    SELECT sc.id, sc.streamer_id, sc.platform, sc.status, sc.start_time, sc.actual_start_time, sc.live_link,
           s.nama,
           sa.channel_id
    FROM schedule sc
    JOIN streamers s ON sc.streamer_id = s.id
    LEFT JOIN streamer_accounts sa ON sa.streamer_id = sc.streamer_id AND sa.platform = 'YouTube'
    WHERE sc.status = 'Live'
    ORDER BY sc.actual_start_time DESC
  `);
  
  console.log(`Ditemukan ${res.rows.length} jadwal berstatus Live\n`);
  
  for (const row of res.rows) {
    const startedAt = row.actual_start_time ? new Date(row.actual_start_time) : new Date(row.start_time);
    const ageMinutes = Math.round((Date.now() - startedAt.getTime()) / 60000);
    
    console.log(`\n[#${row.id}] ${row.nama} — ${row.platform}`);
    console.log(`  Mulai: ${startedAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB (${ageMinutes} menit lalu)`);
    console.log(`  Link: ${row.live_link || '(none)'}`);
    
    if (row.platform === 'YouTube') {
      // Cek via live_link dulu
      let isActuallyLive = null;
      
      if (row.live_link && row.live_link.includes('/watch?v=')) {
        try {
          const videoId = row.live_link.match(/watch\?v=([a-zA-Z0-9_-]+)/)?.[1];
          if (videoId) {
            const checkRes = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
              timeout: 10000,
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' }
            });
            const html = checkRes.data;
            isActuallyLive = html.includes('"isLive":true') || html.includes('"isLive": true');
            // Also check if it's not ended
            if (html.includes('"isLive":false') && !html.includes('"isLive":true')) {
              isActuallyLive = false;
            }
          }
        } catch (e) {
          console.log(`  [Check live_link] Error: ${e.message}`);
        }
      }
      
      if (isActuallyLive === null && row.channel_id) {
        isActuallyLive = await checkChannelLive(row.channel_id);
      }
      
      if (isActuallyLive === false) {
        console.log(`  STATUS: ❌ TIDAK LIVE — akan di-Cancel`);
        await db(
          `UPDATE schedule SET status = 'Cancelled', actual_end_time = NOW(), live_duration = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - actual_start_time))/3600) WHERE id = $1`,
          [row.id]
        );
        console.log(`  → Schedule #${row.id} di-Cancelled`);
      } else if (isActuallyLive === true) {
        console.log(`  STATUS: ✅ BENAR-BENAR LIVE — dibiarkan`);
      } else {
        console.log(`  STATUS: ⚠️ Tidak dapat dicek — dibiarkan`);
      }
    } else if (row.platform === 'TikTok') {
      console.log(`  STATUS: TikTok — perlu dicek manual (auto-scraping dinonaktifkan)`);
      if (ageMinutes > 480) {
        console.log(`  → Sudah > 8 jam, di-Cancelled`);
        await db(
          `UPDATE schedule SET status = 'Cancelled', actual_end_time = NOW(), live_duration = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - actual_start_time))/3600) WHERE id = $1`,
          [row.id]
        );
      }
    }
  }
  
  console.log('\n=== SELESAI ===');
  await pool.end();
  process.exit(0);
};

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
