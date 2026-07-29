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
// TikTok auto-detection via HTML scraping sengaja DINONAKTIFKAN dari cron.
// HTML TikTok tidak reliable (offline pages embed liveRoom JSON, Cloudflare blocks).
// TikTok live dikelola manual via Telegram bot command /startlive tiktok

// ── Konstanta ──────────────────────────────────────────────────────────────
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// Toleransi waktu untuk mencocokkan jadwal:
// Jika channel live dan ada jadwal dalam window ini → dianggap match
const SCHEDULE_MATCH_WINDOW_MINUTES = 45;

// Toleransi keterlambatan sebelum alert dikirim (menit)
const LATENESS_ALERT_THRESHOLD_MINUTES = 10;

// ── 2-Strike Confirmation Buffer ────────────────────────────────────────────
// Mencegah false positive flash detection: channel harus terdeteksi live
// di 2 cron cycle berturut-turut (>15 menit) sebelum auto-schedule dibuat.
// Key: channelId, Value: { firstSeenAt: Date, videoId: string }
const pendingLiveMap = new Map();
const PENDING_CONFIRM_MS = 16 * 60 * 1000; // 16 menit (lebih dari satu 15-min cron cycle)

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

// isChannelScheduleActive dihapus — sistem sekarang selalu cek semua channel (pure live detection)

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

// ── Helper: Smart HTML Scraper untuk YouTube Live Status (0 Quota / Gratis / Immune 429) ──
export const checkYouTubeLiveViaScrape = async (channelId) => {
  if (!channelId) return { isLive: false, videoId: null, title: null };
  const cleanId = channelId.trim();

  // Support @handle, UC... channel ID, or legacy channel name
  const urlsToTry = [];
  if (cleanId.startsWith('@')) {
    urlsToTry.push(`https://www.youtube.com/${cleanId}/live`);
  } else if (cleanId.startsWith('UC')) {
    urlsToTry.push(`https://www.youtube.com/channel/${cleanId}/live`);
  } else {
    urlsToTry.push(`https://www.youtube.com/@${cleanId}/live`);
    urlsToTry.push(`https://www.youtube.com/channel/${cleanId}/live`);
  }

  for (const url of urlsToTry) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      if (!response.ok) continue;

      const html = await response.text();
      const isLive = html.includes('"isLive":true') || 
                     html.includes('"isLiveContent":true') || 
                     html.includes('"style":"LIVE"') || 
                     html.includes('"status":"LIVE"') || 
                     html.includes('liveStreamabilityRenderer') || 
                     html.includes('"isLiveNow":true');

      if (!isLive) continue;

      const videoIdMatch = html.match(/"videoId":"([^"]+)"/) || 
                           html.match(/href="\/watch\?v=([^"]+)"/) || 
                           html.match(/canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([^"]+)"/) ||
                           html.match(/og:url" content="https:\/\/www\.youtube\.com\/watch\?v=([^"]+)"/);
      const videoId = videoIdMatch ? videoIdMatch[1] : null;

      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/) || 
                         html.match(/<title>(.*?)<\/title>/) || 
                         html.match(/"title":\{"runs":\[\{"text":"([^"]+)"\}/);
      let title = titleMatch ? (titleMatch[1] || titleMatch[2]) : null;
      if (title) {
        title = title.replace(/ - YouTube$/, '').trim();
      }

      return { isLive: true, videoId, title };
    } catch (err) {
      console.warn(`[YouTube Scraper] Failed to scrape ${url}: ${err.message}`);
    }
  }

  return { isLive: false, videoId: null, title: null };
};

// ── Core: Cek satu channel apakah sedang live ─────────────────────────────
/**
 * @param {string} channelId - YouTube Channel ID (UCxxxxx)
 * @param {string} apiKey - Optional
 * @returns {{ isLive: boolean, videoId: string|null, title: string|null, actualStartTime: Date|null, viewerCount: number }}
 */
export const checkChannelLiveStatus = async (channelId, apiKey = null) => {
  // 1. Utamakan HTML Scraping (0 Quota cost, 100% bebas dari error 429 Quota Exceeded!)
  const scraped = await checkYouTubeLiveViaScrape(channelId);
  if (scraped.isLive) {
    let viewerCount = 0;
    if (apiKey && scraped.videoId) {
      viewerCount = await getYouTubeConcurrentViewers(scraped.videoId, apiKey).catch(() => 0);
    }
    return {
      isLive: true,
      videoId: scraped.videoId,
      title: scraped.title,
      actualStartTime: new Date(),
      viewerCount
    };
  }

  // 2. Fallback ke API search jika scraping return false dan apiKey tersedia
  if (apiKey) {
    try {
      const url = new URL(`${YOUTUBE_API_BASE}/search`);
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('channelId', channelId);
      url.searchParams.set('eventType', 'live');
      url.searchParams.set('type', 'video');
      url.searchParams.set('key', apiKey);

      const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
      if (response.ok) {
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          const liveItem = data.items[0];
          const videoId = liveItem.id?.videoId || null;
          const publishedAt = liveItem.snippet?.publishedAt ? new Date(liveItem.snippet.publishedAt) : new Date();
          const viewerCount = videoId ? await getYouTubeConcurrentViewers(videoId, apiKey).catch(() => 0) : 0;
          return {
            isLive: true,
            videoId,
            title: liveItem.snippet?.title || null,
            actualStartTime: publishedAt,
            viewerCount
          };
        }
      }
    } catch (err) {
      console.warn(`[YouTube Service API Fallback]: ${err.message}`);
    }
  }

  return { isLive: false, videoId: null, title: null, actualStartTime: null, viewerCount: 0 };
};

// ── Core: Cocokkan live channel dengan jadwal terdaftar ───────────────────
/**
 * Cari jadwal yang paling cocok dengan waktu sekarang untuk streamer_id tertentu.
 * Window matching: start_time ±SCHEDULE_MATCH_WINDOW_MINUTES menit dari sekarang.
 */
const findMatchingSchedule = async (streamerId, videoId = null) => {
  const now = new Date();

  // 1. Prioritaskan jadwal yang statusnya memang sedang 'Live' saat ini
  const liveRes = await query(
    `SELECT * FROM schedule
     WHERE (streamer_id = $1 OR substitute_streamer_id = $1)
       AND status = 'Live'
     LIMIT 1`,
    [streamerId]
  );
  if (liveRes.rows.length > 0) {
    return liveRes.rows[0];
  }

  // 1b. Jika videoId diberikan, cek apakah ada jadwal yang prematur berstatus 'Completed' padahal video ini MASIH LIVE
  // Window diperlebar ke 6 jam agar sesi panjang yang sempat 'ditutup' sistem bisa diaktifkan kembali
  if (videoId) {
    const liveLink = `https://www.youtube.com/watch?v=${videoId}`;
    const completedRes = await query(
      `SELECT * FROM schedule
       WHERE (streamer_id = $1 OR substitute_streamer_id = $1)
         AND status = 'Completed'
         AND live_link = $2
         AND actual_end_time >= NOW() - INTERVAL '6 hours'
       ORDER BY actual_start_time DESC
       LIMIT 1`,
      [streamerId, liveLink]
    );
    if (completedRes.rows.length > 0) {
      const sch = completedRes.rows[0];
      await query(
        `UPDATE schedule SET status = 'Live', actual_end_time = NULL WHERE id = $1`,
        [sch.id]
      );
      sch.status = 'Live';
      sch.actual_end_time = null;
      console.log(`[YouTube Service] 🔄 Mengaktifkan kembali jadwal #${sch.id} yang terputus (Video ${videoId} masih LIVE).`);
      return sch;
    }
  }

  // 2. Jika tidak ada yang sedang Live, cari yang 'Scheduled' dalam window toleransi
  const windowStart = new Date(now.getTime() - SCHEDULE_MATCH_WINDOW_MINUTES * 60 * 1000);
  const windowEnd = new Date(now.getTime() + SCHEDULE_MATCH_WINDOW_MINUTES * 60 * 1000);

  const result = await query(
    `SELECT * FROM schedule
     WHERE (streamer_id = $1 OR substitute_streamer_id = $1)
       AND status = 'Scheduled'
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
    
    const liveLink = liveInfo.liveLink || (account.platform === 'YouTube' ? `https://www.youtube.com/watch?v=${liveInfo.videoId}` : null);
    if (liveLink && schedule.live_link !== liveLink) {
      await query(
        `UPDATE schedule SET live_link = $1 WHERE id = $2`,
        [liveLink, schedule.id]
      );
      schedule.live_link = liveLink;
    }
    
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
  const liveLink = liveInfo.liveLink || (account.platform === 'YouTube' ? `https://www.youtube.com/watch?v=${liveInfo.videoId}` : null);

  await query(
    `UPDATE schedule
     SET actual_start_time = $1,
         lateness_minutes = $2,
         status = 'Live',
         live_link = $3
     WHERE id = $4`,
    [now.toISOString(), latenessMinutes, liveLink, schedule.id]
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
const handleChannelOffline = async (account, sendNotification = async () => {}) => {
  const { streamer_id, platform } = account;
  const platformName = platform || 'YouTube';

  // Cari jadwal yang sedang berstatus Live (bisa streamer asli atau pengganti) khusus untuk platform ini
  const result = await query(
    `SELECT * FROM schedule
     WHERE (streamer_id = $1 OR substitute_streamer_id = $1)
       AND LOWER(platform) = LOWER($2)
       AND status = 'Live'
       AND actual_start_time IS NOT NULL
       AND actual_end_time IS NULL
     ORDER BY actual_start_time DESC
     LIMIT 1`,
    [streamer_id, platformName]
  );

  const schedule = result.rows[0];
  if (!schedule) return; // Tidak ada sesi live aktif untuk platform ini

  const now = new Date();
  const startTime = new Date(schedule.actual_start_time);
  const durationMs = now.getTime() - startTime.getTime();
  const durationHours = parseFloat((durationMs / 3600000).toFixed(2));

  // Hitung durasi baru yang belum pernah dicatat (mencegah double-counting jika di-recover)
  const previousReported = parseFloat(schedule.live_duration || 0);
  const netDurationHours = Math.max(0, parseFloat((durationHours - previousReported).toFixed(2)));

  // Update schedule → Completed & simpan live_duration terbaru
  await query(
    `UPDATE schedule
     SET actual_end_time = $1,
         live_duration = $2,
         status = 'Completed'
     WHERE id = $3`,
    [now.toISOString(), durationHours, schedule.id]
  );

  // Catat net duration di daily_reports milik target streamer (asli atau pengganti)
  // Menggunakan tanggal mulai live (actual_start_time) agar live malam/dini hari (misal 23:00 - 03:00) tercatat di tanggal hari live dimulai
  const targetReportStreamerId = schedule.substitute_streamer_id || schedule.streamer_id;
  const dateStr = new Date(schedule.actual_start_time || now).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD
  
  if (netDurationHours > 0) {
    await query(
      `INSERT INTO daily_reports (streamer_id, tanggal, kategori, live_duration, tiktok_upload, youtube_upload, instagram_upload, facebook_upload, chat_count, registration_count, ftd_count)
       VALUES ($1, $2, 'Streaming', $3, 0, 0, 0, 0, 0, 0, 0)
       ON CONFLICT (streamer_id, tanggal) 
       DO UPDATE SET live_duration = COALESCE(daily_reports.live_duration, 0) + EXCLUDED.live_duration`,
      [targetReportStreamerId, dateStr, netDurationHours]
    );
  }

  const streamerRes = await query('SELECT nama FROM streamers WHERE id = $1', [targetReportStreamerId]);
  const streamer = streamerRes.rows[0];
  const nama = streamer?.nama || `Streamer #${targetReportStreamerId}`;
  const formattedDur = formatDuration(durationMs / 60000);

  console.log(`[YouTube Service] ✅ ${nama} selesai live ${platformName} — durasi: ${formattedDur}`);
};

// Streamer keyword aliases for 100% accurate title attribution
const STREAMER_KEYWORD_ALIASES = [
  { keywords: ['bray', 'brayy', 'arief', 'candle'], canonicalName: 'brayy' },
  { keywords: ['rival', 'suhanda'], canonicalName: 'rival suhanda' },
  { keywords: ['ajo'], canonicalName: 'ajo' },
  { keywords: ['tizza', 'teizza', 'got'], canonicalName: 'tizza' },
  { keywords: ['ratu', 'valencia'], canonicalName: 'ratu' },
  { keywords: ['aline'], canonicalName: 'aline' },
  { keywords: ['keyla', 'keylaa'], canonicalName: 'keylaa' },
  { keywords: ['qamil', 'alvaro', 'alvano', 'laflanca'], canonicalName: 'laflanca' },
  { keywords: ['syabila', 'bila'], canonicalName: 'syabila' },
  { keywords: ['bagas', 'bgbas'], canonicalName: 'bagas' },
  { keywords: ['katrine', 'katrineely', 'dara'], canonicalName: 'katrineely' },
  { keywords: ['chen', 'chenn', 'bg chenn', 'anandarioo'], canonicalName: 'bg chenn' },
];

// Helper to match streamer by live title
const findStreamerByLiveTitle = (title, streamers) => {
  if (!title) return null;
  const normalizedTitle = title.toLowerCase();
  
  // 1. Check keyword alias map first for direct hits
  for (const aliasGroup of STREAMER_KEYWORD_ALIASES) {
    for (const kw of aliasGroup.keywords) {
      if (normalizedTitle.includes(kw)) {
        const matched = streamers.find(s => s.nama.toLowerCase().includes(aliasGroup.canonicalName) || aliasGroup.canonicalName.includes(s.nama.toLowerCase()));
        if (matched) {
          return matched;
        }
      }
    }
  }

  // 2. Sort by length desc to match longer names first
  const sortedStreamers = [...streamers].sort((a, b) => b.nama.length - a.nama.length);
  
  for (const streamer of sortedStreamers) {
    const normalizedName = streamer.nama.toLowerCase();
    
    // Check full name
    if (normalizedTitle.includes(normalizedName)) {
      return streamer;
    }
    
    // Check parts
    const parts = normalizedName.split(/\s+/).filter(part => part.length > 2);
    for (const part of parts) {
      if (normalizedTitle.includes(part)) {
        return streamer;
      }
      
      // Lenient check: if name ends with double letter (e.g. keylaa -> keyla)
      if (part.length > 3 && part[part.length - 1] === part[part.length - 2]) {
        const sliced = part.slice(0, -1);
        if (normalizedTitle.includes(sliced)) {
          return streamer;
        }
      }
    }
  }
  return null;
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
    console.log('[YouTube Service] YOUTUBE_API_KEY tidak set, menggunakan Smart HTML Scraper (0 Quota).');
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
  } else {
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

            // Cocokkan judul live stream dengan nama streamer yang terdaftar
            const streamersRes = await query('SELECT id, nama FROM streamers');
            const matchedStreamer = findStreamerByLiveTitle(liveInfo.title, streamersRes.rows);

            // Tentukan target account dan substitute jika ada
            let defaultAcc = null;
            let substituteStreamerId = null;
            let bestSchedule = null;

            if (matchedStreamer) {
              const matchedAcc = channelAccounts.find(a => a.streamer_id === matchedStreamer.id);
              if (matchedAcc) {
                // Jika streamer yang terdeteksi dari judul adalah pemilik resmi channel ini, set sebagai defaultAcc langsung
                defaultAcc = matchedAcc;
                console.log(`[YouTube Service] Pengecekan judul live: "${liveInfo.title}" cocok dengan pemilik resmi channel: "${matchedStreamer.nama}".`);
                bestSchedule = await findMatchingSchedule(defaultAcc.streamer_id, liveInfo.videoId);
              } else {
                // Jika tidak terdaftar sebagai pemilik channel ini, terapkan substitusi (tamu/streamer lain)
                substituteStreamerId = matchedStreamer.id;
                defaultAcc = channelAccounts[0]; // fallback ke pemilik utama
                console.log(`[YouTube Service] Pengecekan judul live: "${liveInfo.title}" cocok dengan streamer pengganti: "${matchedStreamer.nama}". Menerapkan substitusi.`);
                bestSchedule = await findMatchingSchedule(defaultAcc.streamer_id, liveInfo.videoId);
              }
            } else {
              // Jika tidak ada nama yang cocok di judul, cari jadwal terdekat di antara SEMUA pemilik resmi channel ini
              let bestScheduleDiff = Infinity;
              for (const acc of channelAccounts) {
                const schedule = await findMatchingSchedule(acc.streamer_id, liveInfo.videoId);
                if (schedule) {
                  const diff = Math.abs(new Date(schedule.start_time) - new Date());
                  if (diff < bestScheduleDiff) {
                    bestScheduleDiff = diff;
                    bestSchedule = schedule;
                    defaultAcc = acc;
                  }
                }
              }
              // Jika tidak ada jadwal yang cocok sama sekali untuk semua pemilik, fallback ke pemilik pertama
              if (!defaultAcc) {
                defaultAcc = channelAccounts[0];
              }
            }

            if (bestSchedule) {
              // Jika jadwal sudah Live, perbarui substitute jika berubah
              if (bestSchedule.status === 'Live') {
                if (substituteStreamerId && bestSchedule.substitute_streamer_id !== substituteStreamerId) {
                  await query(
                    `UPDATE schedule SET substitute_streamer_id = $1 WHERE id = $2`,
                    [substituteStreamerId, bestSchedule.id]
                  );
                  bestSchedule.substitute_streamer_id = substituteStreamerId;
                }
              } else {
                // Masih Scheduled -> Ubah status ke Live dengan substitute jika ada
                const actualStart = liveInfo.actualStartTime || new Date();
                const scheduledStart = new Date(bestSchedule.start_time);
                const diffMs = actualStart.getTime() - scheduledStart.getTime();
                const latenessMinutes = Math.max(0, Math.floor(diffMs / 60000));
 
                const liveLink = `https://www.youtube.com/watch?v=${liveInfo.videoId}`;
                await query(
                  `UPDATE schedule
                   SET actual_start_time = $1,
                       lateness_minutes = $2,
                       status = 'Live',
                       substitute_streamer_id = $3,
                       live_link = $4
                   WHERE id = $5`,
                  [actualStart.toISOString(), latenessMinutes, substituteStreamerId, liveLink, bestSchedule.id]
                );
              }
 
              // Panggil handleChannelLive dengan defaultAcc (akan membaca update status/substitute terbaru)
              await handleChannelLive(defaultAcc, liveInfo, sendNotification);
            } else {
              // Live di luar jadwal → pertimbangkan auto-create schedule instan
              if (defaultAcc) {
                const targetStreamerId = substituteStreamerId || defaultAcc.streamer_id;
                const liveLink = `https://www.youtube.com/watch?v=${liveInfo.videoId}`;
                const displayName = matchedStreamer ? matchedStreamer.nama : defaultAcc.nama;

                // ── Guard 1: Deduplication — skip jika sudah ada sesi Live aktif ──────────
                const existingLive = await query(
                  `SELECT id FROM schedule
                   WHERE streamer_id = $1
                     AND platform = 'YouTube'
                     AND status = 'Live'
                   LIMIT 1`,
                  [targetStreamerId]
                );
                if (existingLive.rows.length > 0) {
                  console.log(`[YouTube Service] Dedup: ${displayName} sudah punya sesi Live aktif. Skip auto-create.`);
                  continue;
                }

                // ── Guard 2: Cek video yang sama baru saja selesai (< 5 menit) ───────────
                const recentCompletion = await query(
                  `SELECT id FROM schedule
                   WHERE streamer_id = $1
                     AND status = 'Completed'
                     AND live_link = $2
                     AND actual_end_time >= NOW() - INTERVAL '5 minutes'
                   LIMIT 1`,
                  [targetStreamerId, liveLink]
                );
                if (recentCompletion.rows.length > 0) {
                  console.log(`[YouTube Service] ${displayName} baru saja selesai stream (< 5 mnt). Menolak auto-create schedule ganda.`);
                  continue;
                }

                // ── Guard 3: 2-Strike Confirmation ────────────────────────────────────────
                // Hanya buat schedule setelah terdeteksi live di 2 cron cycle berturut-turut
                const now = new Date();
                const pending = pendingLiveMap.get(account.channel_id);

                if (!pending || pending.videoId !== liveInfo.videoId) {
                  // Deteksi pertama kali → simpan ke buffer, tunggu siklus berikutnya
                  pendingLiveMap.set(account.channel_id, { firstSeenAt: now, videoId: liveInfo.videoId, displayName });
                  console.log(`[YouTube Service] 🟡 ${displayName} terdeteksi live PERTAMA (video: ${liveInfo.videoId}). Menunggu konfirmasi siklus ke-2 (~15 menit)...`);
                  continue;
                }

                const elapsedMs = now.getTime() - pending.firstSeenAt.getTime();
                if (elapsedMs < PENDING_CONFIRM_MS) {
                  console.log(`[YouTube Service] 🟡 ${displayName} masih dalam buffer konfirmasi (${Math.floor(elapsedMs/60000)} mnt < 16 mnt). Menunggu...`);
                  continue;
                }

                // ── Confirmed! 2 siklus berturut-turut → buat schedule instan ─────────────
                pendingLiveMap.delete(account.channel_id);
                console.log(`[YouTube Service] 🔴 ${displayName} DIKONFIRMASI live YouTube di luar jadwal. Membuat schedule instan...`);
                
                const startTime = liveInfo.actualStartTime || new Date(now.getTime() - 15 * 60 * 1000);
                const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
 
                const insertRes = await query(
                  `INSERT INTO schedule (streamer_id, platform, start_time, end_time, status, actual_start_time, substitute_streamer_id, live_link)
                   VALUES ($1, 'YouTube', $2, $3, 'Live', $4, $5, $6)
                   RETURNING id`,
                  [defaultAcc.streamer_id, startTime.toISOString(), endTime.toISOString(), startTime.toISOString(), substituteStreamerId, liveLink]
                );

                const newScheduleId = insertRes.rows[0].id;
                await query(
                  `INSERT INTO live_viewer_history (schedule_id, streamer_id, platform, viewer_count)
                   VALUES ($1, $2, 'YouTube', $3)`,
                  [newScheduleId, targetStreamerId, liveInfo.viewerCount || 0]
                );

                const chatRes = await query('SELECT telegram_username, telegram_chat_id FROM streamers WHERE id = $1', [targetStreamerId]);
                const targetChatId = chatRes.rows[0]?.telegram_chat_id;
                const teleUser = chatRes.rows[0]?.telegram_username;
                const mention = teleUser ? `@${teleUser.trim()}` : `*${displayName}*`;
                
                const substituteText = substituteStreamerId ? ` *(menggantikan ${defaultAcc.nama})*` : '';
                const msg = `🔴 *LIVE YOUTUBE DIMULAI — ${displayName}*${substituteText} (Di Luar Jadwal)\n\n${mention} mulai live di luar jadwal resmi.\n• Jam: *${now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} WIB*\n_Sesi ekstra ini tetap dicatat di laporan jam live._`;
                
                if (targetChatId) {
                  await sendNotification(msg, targetChatId);
                }
              }
            }
          } else {
            // Channel offline → hapus dari pending confirmation buffer + tutup sesi aktif
            pendingLiveMap.delete(account.channel_id);
            const channelAccounts = accounts.filter(a => a.channel_id === account.channel_id);
            for (const acc of channelAccounts) {
              await handleChannelOffline(acc, sendNotification);
            }
          }

          // Jeda kecil antar request agar tidak rate-limit
          await new Promise(r => setTimeout(r, 500));
        } catch (err) {
          console.error(`[YouTube Service] Error processing channel ${account.channel_id}:`, err.message);
        }
      }
      console.log('[YouTube Service] Live status check complete.');
    }
 
  // ── CATATAN: TikTok auto-detection via HTML scraping telah DINONAKTIFKAN ──────
  // TikTok HTML sangat tidak reliable untuk scraping eksternal:
  //   - Halaman offline embed JSON "liveRoom" meski status=4 (ended)
  //   - Cloudflare sering block bot scraper
  //   - Struktur HTML bisa berubah kapan saja tanpa notice
  // 
  // TikTok live sekarang dikelola MANUAL via Telegram bot:
  //   /startlive tiktok   → mulai sesi live TikTok
  //   /endlive            → selesai live
  // ─────────────────────────────────────────────────────────────────────────────
};
