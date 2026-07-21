/**
 * youtube.service.js
 * 
 * Service untuk mendeteksi status live YouTube secara otomatis
 * menggunakan YouTube Data API v3.
 * 
 * Cara kerja:
 * 1. Ambil semua akun YouTube yang punya channel_id dari DB
 * 2. Cek tiap channel apakah sedang live via YouTube Search API
 * 3. Jika live → cocokkan dengan jadwal terdaftar → catat actual_start_time + lateness
 * 4. Jika channel tiba-tiba offline → catat actual_end_time + update live_duration
 * 
 * Gracefully disabled jika YOUTUBE_API_KEY tidak dikonfigurasi.
 */

import { query } from '../config/db.js';
import { checkTikTokLiveStatus } from './tiktok.service.js';

// ── Konstanta ──────────────────────────────────────────────────────────────
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// Toleransi waktu untuk mencocokkan jadwal:
// Jika channel live dan ada jadwal dalam window ini → dianggap match
const SCHEDULE_MATCH_WINDOW_MINUTES = 45;

// Toleransi keterlambatan sebelum alert dikirim (menit)
const LATENESS_ALERT_THRESHOLD_MINUTES = 10;

// ── Helper: format menit ke string "X jam Y menit" ───────────────────────
const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0 && m > 0) return `${h} jam ${m} menit`;
  if (h > 0) return `${h} jam`;
  return `${m} menit`;
};

// ── Helper: cek apakah YouTube API Key sudah dikonfigurasi ─────────────────
const getApiKey = () => {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || key === 'your_key_here' || key.trim() === '') {
    return null;
  }
  return key.trim();
};

// ── Helper: cek apakah channel punya jadwal aktif sekarang atau 30 menit ke depan ────
/**
 * Hanya query YouTube API jika channel ini punya streamer yang:
 * - Sedang dalam sesi live (status = 'Live'), ATAU
 * - Jadwalnya mulai dalam 30 menit ke depan, ATAU
 * - Jadwalnya baru mulai dalam 60 menit terakhir (toleransi terlambat)
 */
const isChannelScheduleActive = async (streamerIds) => {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60 * 60 * 1000);  // 60 menit lalu
  const windowEnd   = new Date(now.getTime() + 30 * 60 * 1000);  // 30 menit ke depan

  const result = await query(
    `SELECT id FROM schedule
     WHERE streamer_id = ANY($1)
       AND (
         status = 'Live'
         OR (status = 'Scheduled' AND start_time BETWEEN $2 AND $3)
       )
     LIMIT 1`,
    [streamerIds, windowStart.toISOString(), windowEnd.toISOString()]
  );

  return result.rows.length > 0;
};

// ── Core: Mengambil Jumlah Penonton Aktif Youtube (Concurrent Viewers) ─────
export const getYouTubeConcurrentViewers = async (videoId, apiKey) => {
  try {
    const url = new URL(`${YOUTUBE_API_BASE}/videos`);
    url.searchParams.set('part', 'liveStreamingDetails');
    url.searchParams.set('id', videoId);
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return 0;
    const data = await response.json();
    if (data.items && data.items.length > 0) {
      const viewers = data.items[0].liveStreamingDetails?.concurrentViewers;
      return viewers ? parseInt(viewers, 10) : 0;
    }
    return 0;
  } catch (err) {
    console.error(`[YouTube Service] Error fetching concurrent viewers for ${videoId}:`, err.message);
    return 0;
  }
};

// ── Core: Cek satu channel apakah sedang live ─────────────────────────────
/**
 * @param {string} channelId - YouTube Channel ID (UCxxxxx)
 * @param {string} apiKey
 * @returns {{ isLive: boolean, videoId: string|null, title: string|null, actualStartTime: Date|null, viewerCount: number }}
 */
export const checkChannelLiveStatus = async (channelId, apiKey) => {
  try {
    const url = new URL(`${YOUTUBE_API_BASE}/search`);
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('channelId', channelId);
    url.searchParams.set('eventType', 'live');
    url.searchParams.set('type', 'video');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const errMsg = errBody?.error?.message || response.statusText;
      throw new Error(`YouTube API error (${response.status}): ${errMsg}`);
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return { isLive: false, videoId: null, title: null, actualStartTime: null, viewerCount: 0 };
    }

    const liveItem = data.items[0];
    const videoId = liveItem.id?.videoId || null;
    const publishedAt = liveItem.snippet?.publishedAt
      ? new Date(liveItem.snippet.publishedAt)
      : new Date();

    // Ambil jumlah penonton aktif Youtube
    let viewerCount = 0;
    if (videoId) {
      viewerCount = await getYouTubeConcurrentViewers(videoId, apiKey);
    }

    return {
      isLive: true,
      videoId,
      title: liveItem.snippet?.title || null,
      actualStartTime: publishedAt,
      viewerCount
    };
  } catch (err) {
    console.error(`[YouTube Service] Error checking channel ${channelId}: ${err.message}`);
    return { isLive: false, videoId: null, title: null, actualStartTime: null, viewerCount: 0 };
  }
};

// ── Core: Cocokkan live channel dengan jadwal terdaftar ───────────────────
/**
 * Cari jadwal yang paling cocok dengan waktu sekarang untuk streamer_id tertentu.
 * Window matching: start_time ±SCHEDULE_MATCH_WINDOW_MINUTES menit dari sekarang.
 */
const findMatchingSchedule = async (streamerId) => {
  const now = new Date();
  const windowStart = new Date(now.getTime() - SCHEDULE_MATCH_WINDOW_MINUTES * 60 * 1000);
  const windowEnd = new Date(now.getTime() + SCHEDULE_MATCH_WINDOW_MINUTES * 60 * 1000);

  const result = await query(
    `SELECT * FROM schedule
     WHERE (streamer_id = $1 OR substitute_streamer_id = $1)
       AND status IN ('Scheduled', 'Live')
       AND start_time BETWEEN $2 AND $3
     ORDER BY ABS(EXTRACT(EPOCH FROM (start_time - $4))) ASC
     LIMIT 1`,
    [streamerId, windowStart.toISOString(), windowEnd.toISOString(), now.toISOString()]
  );

  return result.rows[0];
};

// ── Core: Catat aktivitas live ke DB (actual_start_time, lateness) & kirim tele ──
const handleChannelLive = async (account, liveInfo, sendNotification) => {
  const { streamer_id } = account;
  const schedule = await findMatchingSchedule(streamer_id);

  if (!schedule) {
    console.log(`[YouTube/TikTok Service] Terdeteksi live untuk streamer ID ${streamer_id}, tapi tidak ada jadwal matching.`);
    return;
  }

  // Jika sudah status Live di DB, kita hanya log history penonton secara periodik
  if (schedule.status === 'Live') {
    const targetStreamerId = schedule.substitute_streamer_id || streamer_id;
    const currentViewers = liveInfo.viewerCount || 0;
    
    await query(
      `INSERT INTO live_viewer_history (schedule_id, streamer_id, platform, viewer_count)
       VALUES ($1, $2, $3, $4)`,
      [schedule.id, targetStreamerId, account.platform || 'YouTube', currentViewers]
    );
    return;
  }

  // Jika masih Scheduled, ubah status ke Live
  const now = new Date();
  const scheduledStart = new Date(schedule.start_time);
  const diffMs = now.getTime() - scheduledStart.getTime();
  const latenessMinutes = Math.max(0, Math.floor(diffMs / 60000));

  await query(
    `UPDATE schedule
     SET actual_start_time = $1,
         lateness_minutes = $2,
         status = 'Live'
     WHERE id = $3`,
    [now.toISOString(), latenessMinutes, schedule.id]
  );

  // Tentukan streamer target (pengganti atau asli)
  const targetStreamerId = schedule.substitute_streamer_id || streamer_id;
  const isSubstituting = !!schedule.substitute_streamer_id;

  // Catat data penonton awal (live_viewer_history)
  const initialViewers = liveInfo.viewerCount || 0;
  await query(
    `INSERT INTO live_viewer_history (schedule_id, streamer_id, platform, viewer_count)
     VALUES ($1, $2, $3, $4)`,
    [schedule.id, targetStreamerId, account.platform || 'YouTube', initialViewers]
  );

  // Ambil nama streamer target & telegram_chat_id untuk notifikasi
  const streamerRes = await query('SELECT nama, telegram_username, telegram_chat_id FROM streamers WHERE id = $1', [targetStreamerId]);
  const streamer = streamerRes.rows[0];
  if (!streamer) return;

  // Jika menggantikan, ambil nama streamer asli
  let originalName = '';
  if (isSubstituting) {
    const origRes = await query('SELECT nama FROM streamers WHERE id = $1', [streamer_id]);
    originalName = origRes.rows[0]?.nama || '';
  }

  const mention = streamer.telegram_username
    ? `@${streamer.telegram_username.trim()}`
    : `*${streamer.nama}*`;

  const targetChatId = streamer.telegram_chat_id || null;
  const substituteText = isSubstituting ? ` *(menggantikan ${originalName})*` : '';

  if (latenessMinutes > LATENESS_ALERT_THRESHOLD_MINUTES) {
    // Kirim alert keterlambatan
    const msg =
      `⏰ *LIVE TERLAMBAT — ${streamer.nama}*${substituteText}\n\n` +
      `${mention} terdeteksi mulai live *${formatDuration(latenessMinutes)} terlambat*\n` +
      `• Jadwal: *${scheduledStart.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} WIB*\n` +
      `• Platform: ${account.platform || 'YouTube'}\n` +
      `• Aktual: *${now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} WIB*\n\n` +
      `_Keterlambatan ini dicatat dalam sistem._`;

    if (targetChatId) {
      await sendNotification(msg, targetChatId);
    } else {
      console.log(`[YouTube Service Alert Skipped]: Streamer ${streamer.nama} has no telegram_chat_id (cannot send lateness japri)`);
    }

    // Log ke tabel notifications untuk target streamer
    await query(
      `INSERT INTO notifications (streamer_id, message, status, type)
       VALUES ($1, $2, 'Sent', 'Alert')`,
      [targetStreamerId, msg]
    );

    console.log(`[YouTube/TikTok Service] ⚠️  ${streamer.nama}${substituteText} terlambat ${latenessMinutes} menit`);
  } else {
    // Live tepat waktu atau dalam toleransi → notif positif
    const msg =
      `🔴 *LIVE DIMULAI — ${streamer.nama}*${substituteText}\n\n` +
      `${mention} sudah mulai live!\n` +
      `• Platform: ${account.platform || 'YouTube'}\n` +
      `• Jam: *${now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} WIB*${latenessMinutes > 0 ? ` _(terlambat ${latenessMinutes} mnt)_` : ' ✅ ontime'}`;

    if (targetChatId) {
      await sendNotification(msg, targetChatId);
    } else {
      console.log(`[YouTube Service Notification Skipped]: Streamer ${streamer.nama} has no telegram_chat_id (cannot send live status japri)`);
    }

    console.log(`[YouTube/TikTok Service] 🔴 ${streamer.nama}${substituteText} mulai live${latenessMinutes > 0 ? ` (terlambat ${latenessMinutes} mnt)` : ' (ontime)'}`);
  }
};

// ── Core: Handle channel yang offline (sebelumnya Live) ──────────────────
const handleChannelOffline = async (account) => {
  const { streamer_id } = account;

  // Cari jadwal yang sedang berstatus Live (bisa streamer asli atau pengganti)
  const result = await query(
    `SELECT * FROM schedule
     WHERE (streamer_id = $1 OR substitute_streamer_id = $1)
       AND status = 'Live'
       AND actual_start_time IS NOT NULL
       AND actual_end_time IS NULL
     ORDER BY actual_start_time DESC
     LIMIT 1`,
    [streamer_id]
  );

  const schedule = result.rows[0];
  if (!schedule) return; // Tidak ada sesi live aktif

  const now = new Date();
  const startTime = new Date(schedule.actual_start_time);
  const durationMs = now.getTime() - startTime.getTime();
  const durationHours = parseFloat((durationMs / 3600000).toFixed(2));

  // Update schedule → Completed
  await query(
    `UPDATE schedule
     SET actual_end_time = $1,
         status = 'Completed'
     WHERE id = $2`,
    [now.toISOString(), schedule.id]
  );

  // Catat live_duration di daily_reports milik target streamer (asli atau pengganti)
  const targetReportStreamerId = schedule.substitute_streamer_id || schedule.streamer_id;
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD
  
  // Pastikan daily report untuk target streamer hari ini ada sebelum update
  await query(
    `INSERT INTO daily_reports (streamer_id, tanggal, kategori, live_duration, tiktok_upload, youtube_upload, instagram_upload, facebook_upload, chat_count, registration_count, ftd_count)
     VALUES ($1, $2, 'Streaming', $3, 0, 0, 0, 0, 0, 0, 0)
     ON CONFLICT (streamer_id, tanggal) 
     DO UPDATE SET live_duration = COALESCE(daily_reports.live_duration, 0) + EXCLUDED.live_duration`,
    [targetReportStreamerId, dateStr, durationHours]
  );

  const streamerRes = await query('SELECT nama FROM streamers WHERE id = $1', [targetReportStreamerId]);
  const nama = streamerRes.rows[0]?.nama || `Streamer #${targetReportStreamerId}`;

  console.log(`[YouTube Service] ✅ ${nama} selesai live — durasi: ${formatDuration(durationMs / 60000)}`);
};

// ── MAIN EXPORT: checkYouTubeLiveStatus ──────────────────────────────────
/**
 * Dipanggil oleh cron job tiap 1 jam.
 * Mengecek semua channel YouTube yang terdaftar di streamer_accounts.
 * 
 * @param {Function} sendNotification - Fungsi untuk kirim pesan ke Telegram grup
 */
export const checkYouTubeLiveStatus = async (sendNotification = async () => {}) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log('[YouTube Service] YOUTUBE_API_KEY belum dikonfigurasi. Deteksi live dilewati.');
    return;
  }

  // Ambil semua akun YouTube dengan channel_id
  const accountsRes = await query(
    `SELECT sa.id, sa.streamer_id, sa.channel_id, sa.username, s.nama
     FROM streamer_accounts sa
     JOIN streamers s ON sa.streamer_id = s.id
     WHERE sa.platform = 'YouTube'
       AND sa.channel_id IS NOT NULL
       AND sa.channel_id <> ''`
  );

  const accounts = accountsRes.rows;
  if (accounts.length === 0) {
    console.log('[YouTube Service] Tidak ada channel YouTube dengan channel_id terdaftar.');
    return;
  }

  console.log(`[YouTube Service] Checking ${accounts.length} YouTube channel(s)...`);

  // Deduplicate: satu channel_id bisa dipunya 2 streamer
  // Kita cek per channel_id, lalu tentukan streamer berdasarkan jadwal
  const uniqueChannels = [...new Map(accounts.map(a => [a.channel_id, a])).values()];

  for (const account of uniqueChannels) {
    try {
      const liveInfo = await checkChannelLiveStatus(account.channel_id, apiKey);

      if (liveInfo.isLive) {
        // Channel sedang live → cari semua streamer yang pakai channel ini
        const channelAccounts = accounts.filter(a => a.channel_id === account.channel_id);
        
        // Cari streamer mana yang punya jadwal paling dekat sekarang
        let bestMatch = null;
        let bestSchedule = null;

        for (const acc of channelAccounts) {
          const schedule = await findMatchingSchedule(acc.streamer_id);
          if (schedule) {
            if (!bestSchedule || Math.abs(new Date(schedule.start_time) - new Date()) < Math.abs(new Date(bestSchedule.start_time) - new Date())) {
              bestMatch = acc;
              bestSchedule = schedule;
            }
          }
        }

        if (bestMatch) {
          // Ada jadwal yang cocok -> proses normal
          await handleChannelLive(bestMatch, liveInfo, sendNotification);
        } else {
          // Live di luar jadwal -> Auto-create schedule instan agar muncul "On Air" di dashboard
          const defaultAcc = channelAccounts[0]; // ambil streamer utama pemilik channel
          if (defaultAcc) {
            console.log(`[YouTube Service] 🔴 Streamer ${defaultAcc.nama} live YouTube di luar jadwal. Membuat schedule instan...`);
            const now = new Date();
            const startTime = new Date(now.getTime() - 15 * 60 * 1000); // diasumsikan mulai 15 menit lalu
            const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);  // estimasi 2 jam lagi

            const insertRes = await query(
              `INSERT INTO schedule (streamer_id, platform, start_time, end_time, status, actual_start_time)
               VALUES ($1, 'YouTube', $2, $3, 'Live', $4)
               RETURNING id`,
              [defaultAcc.streamer_id, startTime.toISOString(), endTime.toISOString(), startTime.toISOString()]
            );

            const newScheduleId = insertRes.rows[0].id;
            await query(
              `INSERT INTO live_viewer_history (schedule_id, streamer_id, platform, viewer_count)
               VALUES ($1, $2, 'YouTube', $3)`,
              [newScheduleId, defaultAcc.streamer_id, liveInfo.viewerCount || 0]
            );

            // Kirim notifikasi Telegram Japri
            // Dapatkan telegram_chat_id
            const chatRes = await query('SELECT telegram_username, telegram_chat_id FROM streamers WHERE id = $1', [defaultAcc.streamer_id]);
            const targetChatId = chatRes.rows[0]?.telegram_chat_id;
            const teleUser = chatRes.rows[0]?.telegram_username;
            const mention = teleUser ? `@${teleUser.trim()}` : `*${defaultAcc.nama}*`;
            
            const msg = `🔴 *LIVE YOUTUBE DIMULAI — ${defaultAcc.nama}* (Di Luar Jadwal)\n\n${mention} mulai live di luar jadwal resmi.\n• Jam: *${now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} WIB*\n_Sesi ekstra ini tetap dicatat di laporan jam live._`;
            
            if (targetChatId) {
              await sendNotification(msg, targetChatId);
            }
          }
        }
      } else {
        // Channel offline → cek apakah ada sesi yang perlu ditutup
        const channelAccounts = accounts.filter(a => a.channel_id === account.channel_id);
        for (const acc of channelAccounts) {
          await handleChannelOffline(acc);
        }
      }

      // Jeda kecil antar request agar tidak rate-limit
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`[YouTube Service] Error processing channel ${account.channel_id}:`, err.message);
    }
  }
 
  console.log('[YouTube Service] Live status check complete.');
 
  // ── NEW: DETEKSI LIVE TIKTOK (Smart HTML Scraping) ────────────────────────
  try {
    console.log('[TikTok Service] Running TikTok live status detection...');
    // Ambil semua akun TikTok yang aktif dan punya username
    const ttAccountsRes = await query(
      `SELECT sa.id, sa.streamer_id, sa.username, s.nama, s.telegram_username
       FROM streamer_accounts sa
       JOIN streamers s ON sa.streamer_id = s.id
       WHERE sa.platform = 'TikTok'
         AND sa.username IS NOT NULL
         AND sa.username <> ''`
    );
    const ttAccounts = ttAccountsRes.rows;
 
    for (const account of ttAccounts) {
      try {
        // Pengecekan TikTok live selalu berjalan tanpa perlu filter jadwal aktif (karena streamer live mandiri tanpa jadwal)
        const liveInfo = await checkTikTokLiveStatus(account.username);
 
        if (liveInfo.isLive) {
          const schedule = await findMatchingSchedule(account.streamer_id);
          
          if (schedule) {
            // Pasang platform untuk log
            const ttAccount = { ...account, platform: 'TikTok' };
            const ttLiveInfo = {
              isLive: true,
              viewerCount: liveInfo.viewerCount,
              liveLink: `https://www.tiktok.com/@${account.username.trim().replace(/^@/, '')}/live`
            };
            await handleChannelLive(ttAccount, ttLiveInfo, sendNotification);
          } else {
            // Murni live mandiri tanpa jadwal -> Auto-create schedule instan agar muncul "On Air" di dashboard
            console.log(`[TikTok Service] 🔴 Streamer @${account.username} live mandiri tanpa jadwal. Membuat schedule instan...`);
            const now = new Date();
            const startTime = new Date(now.getTime() - 15 * 60 * 1000); // diasumsikan mulai 15 menit lalu
            const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);  // estimasi selesai 2 jam lagi

            const insertRes = await query(
              `INSERT INTO schedule (streamer_id, platform, start_time, end_time, status, actual_start_time)
               VALUES ($1, 'TikTok', $2, $3, 'Live', $4)
               RETURNING id`,
              [account.streamer_id, startTime.toISOString(), endTime.toISOString(), startTime.toISOString()]
            );

            // Rekam viewer count perdana untuk schedule instan ini
            const newScheduleId = insertRes.rows[0].id;
            await query(
              `INSERT INTO live_viewer_history (schedule_id, streamer_id, platform, viewer_count)
               VALUES ($1, $2, 'TikTok', $3)`,
              [newScheduleId, account.streamer_id, liveInfo.viewerCount || 0]
            );

            // Kirim notifikasi Telegram Japri
            const mention = account.telegram_username ? `@${account.telegram_username.trim()}` : `*${account.nama}*`;
            const msg = `🔴 *LIVE TIKTOK DIMULAI — ${account.nama}* (Self-development)\n\n${mention} sudah mulai live TikTok secara mandiri!\n• Jam: *${now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} WIB*\n_Sesi ini dicatat otomatis untuk pengembangan channel._`;
            
            // Mengambil telegram_chat_id
            const chatRes = await query('SELECT telegram_chat_id FROM streamers WHERE id = $1', [account.streamer_id]);
            const targetChatId = chatRes.rows[0]?.telegram_chat_id;
            if (targetChatId) {
              await sendNotification(msg, targetChatId);
            }
          }
        } else {
          // Jika offline, cek dan tutup sesi live yang aktif
          const ttAccount = { ...account, platform: 'TikTok' };
          await handleChannelOffline(ttAccount);
        }
 
        // Delay 2 detik antar check TikTok agar tidak dicurigai bot oleh Cloudflare
        await new Promise(r => setTimeout(r, 2000));
      } catch (ttErr) {
        console.error(`[TikTok Service] Error processing @${account.username}:`, ttErr.message);
      }
    }
    console.log('[TikTok Service] TikTok live status check complete.');
  } catch (ttGlobalErr) {
    console.error('[TikTok Service] Global error in TikTok live status loop:', ttGlobalErr.message);
  }
};
