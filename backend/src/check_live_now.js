/**
 * check_live_now.js
 * Cek semua jadwal berstatus Live di DB vs status YouTube aktual.
 * Menggunakan multi-signal scraper yang sama dengan cron service (robust).
 * Run: node src/check_live_now.js
 */

import 'dotenv/config';
import pkg from 'pg';

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = (sql, params) => pool.query(sql, params);

// ── Multi-signal scraper (sama persis dengan youtube.service.js) ──────────
const checkChannelOrVideoLive = async (identifier) => {
  // identifier bisa channel_id (UC...) atau videoId (11 karakter)
  const isVideoId = identifier.length === 11 && !identifier.startsWith('UC');
  const url = isVideoId
    ? `https://www.youtube.com/watch?v=${identifier}`
    : `https://www.youtube.com/channel/${identifier}/live`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    if (!response.ok) return null; // ambiguous

    const html = await response.text();

    // STEP 1: Ada marker live?
    const hasIsLiveMarker = /"isLive"\s*:\s*true/.test(html) ||
                            /"isLiveNow"\s*:\s*true/.test(html) ||
                            /"style"\s*:\s*"LIVE"/.test(html) ||
                            /"status"\s*:\s*"LIVE"/.test(html) ||
                            html.includes('"style":"LIVE"') ||
                            html.includes('"status":"LIVE"');
    if (!hasIsLiveMarker) return false;

    // STEP 2: Reject waiting room
    const isWaitingRoom = /"isUpcoming"\s*:\s*true/.test(html) ||
                          html.includes('upcomingEventData');
    if (isWaitingRoom) return false;

    // STEP 3: Multi-signal confirmation (min 2)
    const signals = [
      html.includes('isLiveContent'),
      html.includes('streamingData'),
      html.includes('videoDetails'),
      html.includes('hlsManifestUrl'),
      html.includes('activeDashManifestUrl'),
      html.includes('"style":"LIVE"'),
      html.includes('liveChunkReadahead'),
      html.includes('broadcastEventId'),
      /"isLive"\s*:\s*true/.test(html),
      /"isLiveContent"\s*:\s*true/.test(html),
    ];
    const confirmedCount = signals.filter(Boolean).length;
    if (confirmedCount < 2) return false;

    // STEP 4: Verifikasi channel ownership
    // Pastikan video yang terdeteksi memang milik channel target,
    // bukan video rekomendasi dari channel lain yang kebetulan live.
    if (!isVideoId) {
      const channelIdInHtml =
        html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{20,})"/) ||
        html.match(/"externalChannelId"\s*:\s*"(UC[a-zA-Z0-9_-]{20,})"/);
      const detectedChannelId = channelIdInHtml ? channelIdInHtml[1] : null;
      if (detectedChannelId && detectedChannelId !== identifier) {
        console.log(`  [Check] ⚠️ Channel mismatch! Expected: ${identifier}, Got: ${detectedChannelId}. Video rekomendasi, bukan live channel ini.`);
        return false;
      }
    }

    return true;

  } catch (err) {
    console.log(`  [Check] Error: ${err.message}`);
    return null; // null = tidak bisa dicek, jangan cancel
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
      let isActuallyLive = null;

      // 1. Cek via videoId dari live_link (lebih spesifik)
      if (row.live_link && row.live_link.includes('/watch?v=')) {
        const videoId = row.live_link.match(/watch\?v=([a-zA-Z0-9_-]{11})/)?.[1];
        if (videoId) {
          isActuallyLive = await checkChannelOrVideoLive(videoId);
        }
      }

      // 2. Fallback ke channel live page
      if (isActuallyLive === null && row.channel_id) {
        isActuallyLive = await checkChannelOrVideoLive(row.channel_id);
      }

      if (isActuallyLive === false) {
        console.log(`  STATUS: ❌ TIDAK LIVE — di-Completed (bukan Cancelled)`);
        await db(
          `UPDATE schedule
           SET status = 'Completed',
               actual_end_time = NOW(),
               live_duration = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - COALESCE(actual_start_time, start_time)))/3600)
           WHERE id = $1`,
          [row.id]
        );
        console.log(`  → Schedule #${row.id} di-Completed`);
      } else if (isActuallyLive === true) {
        console.log(`  STATUS: ✅ BENAR-BENAR LIVE — dibiarkan`);
      } else {
        console.log(`  STATUS: ⚠️ Tidak dapat dicek (scraper error) — dibiarkan aman`);
      }
    } else if (row.platform === 'TikTok') {
      console.log(`  STATUS: TikTok — perlu dicek manual (auto-scraping dinonaktifkan)`);
      if (ageMinutes > 480) {
        console.log(`  → Sudah > 8 jam, di-Completed`);
        await db(
          `UPDATE schedule
           SET status = 'Completed',
               actual_end_time = NOW(),
               live_duration = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - COALESCE(actual_start_time, start_time)))/3600)
           WHERE id = $1`,
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
