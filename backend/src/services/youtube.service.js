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

// ── Konstanta ──────────────────────────────────────────────────────────────
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// Toleransi waktu untuk mencocokkan jadwal:
// Jika channel live dan ada jadwal dalam window ini → dianggap match
const SCHEDULE_MATCH_WINDOW_MINUTES = 90;

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

// ── Core: Cek satu channel apakah sedang live ─────────────────────────────
/**
 * @param {string} channelId - YouTube Channel ID (UCxxxxx)
 * @param {string} apiKey
 * @returns {{ isLive: boolean, videoId: string|null, title: string|null, actualStartTime: Date|null }}
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
      return { isLive: false, videoId: null, title: null, actualStartTime: null };
    }

    const liveItem = data.items[0];
    const publishedAt = liveItem.snippet?.publishedAt
      ? new Date(liveItem.snippet.publishedAt)
      : new Date();

    return {
      isLive: true,
      videoId: liveItem.id?.videoId || null,
      title: liveItem.snippet?.title || null,
      actualStartTime: publishedAt,
    };
  } catch (err) {
    console.error(`[YouTube Service] Error checking channel ${channelId}: ${err.message}`);
    return { isLive: false, videoId: null, title: null, actualStartTime: null };
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

  return result.rows[0] || null;
};

// ── Core: Handle channel yang live ────────────────────────────────────────
const handleChannelLive = async (account, liveInfo, sendNotification) => {
  const { streamer_id, channel_id } = account;

  // Cari jadwal yang cocok
  const schedule = await findMatchingSchedule(streamer_id);
  if (!schedule) {
    console.log(`[YouTube Service] Channel ${channel_id} live tapi tidak ada jadwal matching untuk streamer_id ${streamer_id}`);
    return;
  }

  // Sudah tercatat sebagai Live → skip (tidak update ulang)
  if (schedule.status === 'Live' && schedule.actual_start_time) {
    return;
  }

  const now = new Date();
  const scheduledStart = new Date(schedule.start_time);
  const latenessMs = now.getTime() - scheduledStart.getTime();
  const latenessMinutes = Math.max(0, Math.round(latenessMs / 60000));

  // Update schedule: catat actual_start_time, lateness, status
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

    console.log(`[YouTube Service] ⚠️  ${streamer.nama}${substituteText} terlambat ${latenessMinutes} menit`);
  } else {
    // Live tepat waktu atau dalam toleransi → notif positif
    const msg =
      `🔴 *LIVE DIMULAI — ${streamer.nama}*${substituteText}\n\n` +
      `${mention} sudah mulai live!\n` +
      `• Platform: YouTube\n` +
      `• Jam: *${now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} WIB*${latenessMinutes > 0 ? ` _(terlambat ${latenessMinutes} mnt)_` : ' ✅ ontime'}`;

    if (targetChatId) {
      await sendNotification(msg, targetChatId);
    } else {
      console.log(`[YouTube Service Notification Skipped]: Streamer ${streamer.nama} has no telegram_chat_id (cannot send live status japri)`);
    }

    console.log(`[YouTube Service] 🔴 ${streamer.nama}${substituteText} mulai live${latenessMinutes > 0 ? ` (terlambat ${latenessMinutes} mnt)` : ' (ontime)'}`);
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
    `INSERT INTO daily_reports (streamer_id, tanggal, live_duration, tiktok_upload, youtube_upload, instagram_upload, facebook_upload, chat_count, registration_count, ftd_count)
     VALUES ($1, $2, $3, 0, 0, 0, 0, 0, 0, 0)
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
      // ── SMART FILTER: skip jika tidak ada jadwal aktif untuk channel ini ──
      const channelAccounts = accounts.filter(a => a.channel_id === account.channel_id);
      const streamerIds = channelAccounts.map(a => a.streamer_id);
      const hasActiveSchedule = await isChannelScheduleActive(streamerIds);

      if (!hasActiveSchedule) {
        console.log(`[YouTube Service] ⏭️  Channel ${account.channel_id.substring(0,12)}... — tidak ada jadwal aktif, skip.`);
        continue;
      }

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
          await handleChannelLive(bestMatch, liveInfo, sendNotification);
        } else {
          console.log(`[YouTube Service] Channel ${account.channel_id} live tapi tidak ada jadwal matching.`);
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
};
