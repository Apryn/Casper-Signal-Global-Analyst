/**
 * check_live_now.js
 * Cek semua jadwal berstatus Live di DB vs status YouTube aktual.
 * Menggunakan multi-signal scraper yang sama dengan cron service (robust).
 * Run: node src/check_live_now.js
 */

import { query } from './config/db.js';
const db = (sql, params) => query(sql, params);

// ── Multi-signal scraper (sama persis dengan youtube.service.js) ──────────
const checkChannelOrVideoLive = async (identifier) => {
  if (!identifier) return false;
  const cleanId = identifier.trim();
  const isVideoId = cleanId.length === 11 && !cleanId.startsWith('UC');
  const url = isVideoId
    ? `https://www.youtube.com/watch?v=${cleanId}`
    : `https://www.youtube.com/channel/${cleanId}/live`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(9000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    if (!response.ok) return null;

    const html = await response.text();

    // STEP 1: Cek watch page
    const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)">/);
    const ogUrlMatch = html.match(/<meta property="og:url" content="([^"]+)">/);
    const targetUrl = canonicalMatch?.[1] || ogUrlMatch?.[1] || '';

    const isWatchPage = targetUrl.includes('/watch?v=') || isVideoId;
    if (!isWatchPage) {
      return false; // Halaman channel biasa -> OFFLINE
    }

    // STEP 2: Extract ytInitialPlayerResponse
    const playerMatch = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});(?:var|<\/script>)/s) ||
                        html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
    
    if (playerMatch) {
      try {
        const playerObj = JSON.parse(playerMatch[1]);
        const vd = playerObj.videoDetails;
        if (vd) {
          const isUpcoming = playerObj.playabilityStatus?.liveStreamability?.liveStreamabilityRenderer?.displayStatus === 'LIVE_STREAMABILITY_DISPLAY_STATUS_UPCOMING' ||
                             vd.isUpcoming === true;
          if (isUpcoming) return false;

          const isLive = vd.isLive === true || vd.isLiveContent === true;
          if (!isLive) return false;

          if (!isVideoId && cleanId.startsWith('UC') && vd.channelId && vd.channelId !== cleanId) {
            console.log(`  [Check] ⚠️ Channel mismatch! Expected: ${cleanId}, Got: ${vd.channelId}. Video rekomendasi dari channel lain.`);
            return false;
          }

          return true;
        }
      } catch (e) {}
    }

    // STEP 3: Fallback
    const hasIsLiveMarker = /"isLive"\s*:\s*true/.test(html) || /"isLiveNow"\s*:\s*true/.test(html) || html.includes('"style":"LIVE"');
    const isWaitingRoom = /"isUpcoming"\s*:\s*true/.test(html) || html.includes('upcomingEventData');
    if (!hasIsLiveMarker || isWaitingRoom) return false;

    if (!isVideoId && cleanId.startsWith('UC')) {
      const channelIdInHtml = html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{20,})"/);
      if (channelIdInHtml && channelIdInHtml[1] !== cleanId) {
        return false;
      }
    }

    return true;
  } catch (err) {
    console.log(`  [Check] Error: ${err.message}`);
    return null;
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
  process.exit(0);
};

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
