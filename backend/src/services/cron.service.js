import { query } from '../config/db.js';
import cron from 'node-cron';
import { syncSocialMetrics, discoverNewContent } from './social.service.js';
import { autoGenerateWeeklyEvaluations } from '../controllers/evaluation.controller.js';
import { checkYouTubeLiveStatus, checkTikTokLiveStatus, checkYouTubeLiveViaScrape, checkVideoLiveStatus, checkTikTokUserLive } from './youtube.service.js';

let bot = null;

export const setBotInstance = (botInstance) => {
  bot = botInstance;
  if (botInstance) {
    console.log('[Cron Service]: Telegram Bot instance linked successfully.');
  } else {
    console.log('[Cron Service]: Telegram Bot instance unlinked.');
  }
};

// Helper to format Date to YYYY-MM-DD in WIB (UTC+7)
const formatWibDate = (dateInput) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(new Date(dateInput));
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}`;
};

// Helper to get time and date in WIB (UTC+7) regardless of VPS local timezone
const getWibHourAndDate = () => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(new Date());
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const hour = parseInt(partMap.hour, 10);
  const dateStr = formatWibDate(new Date());
  return { hour, dateStr };
};

// Helper to push Telegram message if bot is active
const sendTelegramNotification = async (message, targetChatId = null) => {
  console.log(`[Notification Engine]: ${message}`);
  
  if (!bot) return;

  const chatId = targetChatId;

  if (chatId) {
    try {
      const options = { parse_mode: 'Markdown' };
      await bot.telegram.sendMessage(chatId, message, options);
      console.log(`[Notification Sent to Telegram Chat ID ${chatId} (PC/Japri)]: Success`);
    } catch (err) {
      console.error(`[Notification Telegram Error]: Failed to dispatch private message to ${chatId}: ${err.message}`);
    }
  } else {
    console.log('[Notification Engine]: No targetChatId specified, skipped sending to group.');
  }
};

/**
 * Compiles a consolidated list of streamers who have not submitted their report today
 * and posts it to the Telegram group chat / thread.
 */
export const sendManualReportReminder = async () => {
  if (!bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token && token !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE' && token.trim() !== '') {
      try {
        const { Telegraf } = await import('telegraf');
        bot = new Telegraf(token);
      } catch (err) {
        console.error('Failed to dynamically initialize Telegraf bot for manual reminder:', err);
      }
    }
  }

  if (!bot) {
    throw new Error('Telegram Bot is not initialized or configured. Please check your TELEGRAM_BOT_TOKEN.');
  }

  const { dateStr } = getWibHourAndDate();
  
  // Format date to Indonesian (e.g. 18 Juli 2026)
  const dateParts = dateStr.split('-');
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const formattedDate = `${parseInt(dateParts[2], 10)} ${months[parseInt(dateParts[1], 10) - 1]} ${dateParts[0]}`;

  // Get active streamers who have not sent report today
  const missingStreamersRes = await query(`
    SELECT id, nama, telegram_username, telegram_chat_id 
    FROM streamers 
    WHERE id NOT IN (
      SELECT streamer_id 
      FROM daily_reports 
      WHERE tanggal = $1 AND raw_message IS NOT NULL
    )
    ORDER BY nama ASC
  `, [dateStr]);
  const missingStreamers = missingStreamersRes.rows;

  let groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID || process.env.TELEGRAM_GROUP_ID;
  if (!groupChatId) {
    try {
      const chatRulesRes = await query("SELECT value FROM config WHERE key = 'telegram_group_id'");
      groupChatId = chatRulesRes.rows[0]?.value;
    } catch (err) {
      console.warn(`[Notification Engine]: Config table query failed: ${err.message}`);
    }
  }

  if (!groupChatId) {
    throw new Error('Telegram Group ID is not configured.');
  }

  const threadId = process.env.TELEGRAM_REPORT_THREAD_ID
    ? parseInt(process.env.TELEGRAM_REPORT_THREAD_ID, 10)
    : null;

  const options = { parse_mode: 'Markdown' };
  if (threadId) {
    options.message_thread_id = threadId;
  }

  let sentCount = 0;
  if (missingStreamers.length > 0) {
    for (const streamer of missingStreamers) {
      const mention = streamer.telegram_username
        ? `@${streamer.telegram_username.trim().replace(/([_*\[\]`])/g, '\\$1')}`
        : `*${streamer.nama}*`;
      
      const message = `⚠️ *PENGINGAT LAPORAN HARIAN* ⚠️\n\nStreamer ${mention} belum mengirimkan rekap harian untuk hari ini (*${formattedDate}*). Mohon segera dikirim ya! 🙏`;

      try {
        await bot.telegram.sendMessage(groupChatId, message, options);
        sentCount++;

        // Log to database
        await query(
          `INSERT INTO notifications (streamer_id, message, status, type) 
           VALUES ($1, $2, 'Sent', 'Report Reminder')`,
          [streamer.id, message]
        );

        console.log(`[Manual Notification Sent to Group ${groupChatId} for ${streamer.nama}]: Success`);
      } catch (err) {
        console.error(`[Manual Notification Group Error for ${streamer.nama}]: ${err.message}`);
      }

      // Small delay to avoid spamming / rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  return {
    success: true,
    message: 'Report reminder processed!',
    recipientCount: sentCount,
    missingStreamers: missingStreamers.map(s => s.nama)
  };
};

/**
 * Checks for missing daily reports (runs at 22:00 WIB)
 */
export const checkMissingReports = async (wibDateStr) => {
  const todayStr = wibDateStr || getWibHourAndDate().dateStr;
  const dayOfWeek = new Date(todayStr + 'T12:00:00+07:00').getDay();

  // Hari Minggu libur -> tidak perlu ingatkan/cari laporan kosong
  if (dayOfWeek === 0) {
    console.log(`[Missing Report Check] Hari ini adalah hari Minggu (Libur). Lewati pengingat setoran.`);
    return;
  }
  
  try {
    // Get all streamers
    const streamersRes = await query('SELECT id, nama, telegram_username, telegram_chat_id FROM streamers');
    const streamers = streamersRes.rows;

    for (const streamer of streamers) {
      try {
        if (!streamer.telegram_chat_id) {
          console.log(`[Missing Report Check]: Streamer ${streamer.nama} has no telegram_chat_id, skipped.`);
          continue;
        }

        // Check if report exists for today (must be a manually or telegram submitted report)
        const reportCheck = await query(
          'SELECT id FROM daily_reports WHERE tanggal = $1 AND streamer_id = $2 AND raw_message IS NOT NULL',
          [todayStr, streamer.id]
        );

        if (reportCheck.rows.length === 0) {
          const mention = streamer.telegram_username
            ? `@${streamer.telegram_username.trim().replace(/([_*\[\]`])/g, '\\$1')}`
            : streamer.nama;
          const message = `⚠️ Laporan Belum Dikirim: Streamer ${mention} belum mengirim laporan hari ini (${todayStr}).`;
          
          // Double check if report reminder was already sent today to prevent duplicate spamming
          const doubleCheck = await query(
            `SELECT id FROM notifications 
             WHERE streamer_id = $1 
               AND message = $2`,
            [streamer.id, message]
          );

          if (doubleCheck.rows.length > 0) continue;
          
          // Log to database
          await query(
            `INSERT INTO notifications (streamer_id, message, status, type) 
             VALUES ($1, $2, 'Sent', 'Report Reminder')`,
            [streamer.id, message]
          );

          // Dispatch Telegram Japri
          await sendTelegramNotification(message, streamer.telegram_chat_id);
        }
      } catch (streamerError) {
        console.error(`Error checking missing report for streamer ${streamer.nama}:`, streamerError);
      }
    }
  } catch (error) {
    console.error('Error checking missing reports cron:', error);
  }
};

/**
 * Checks for performance drops (>30% FTD decline week-over-week)
 */
export const checkPerformanceDrops = async () => {
  try {
    const streamersRes = await query('SELECT id, nama FROM streamers');
    
    for (const streamer of streamersRes.rows) {
      try {
        // 1. Current week FTDs
        const currentWeekRes = await query(
          `SELECT COALESCE(SUM(ftd_count), 0) as ftds
           FROM daily_reports
           WHERE streamer_id = $1 AND tanggal >= CURRENT_DATE - INTERVAL '7 days'`,
          [streamer.id]
        );
        
        // 2. Prior week FTDs
        const priorWeekRes = await query(
          `SELECT COALESCE(SUM(ftd_count), 0) as ftds
           FROM daily_reports
           WHERE streamer_id = $1 
             AND tanggal >= CURRENT_DATE - INTERVAL '14 days'
             AND tanggal < CURRENT_DATE - INTERVAL '7 days'`,
          [streamer.id]
        );

        const currentFtd = parseInt(currentWeekRes.rows[0].ftds, 10);
        const priorFtd = parseInt(priorWeekRes.rows[0].ftds, 10);

        // Trigger if prior was high enough to matter (e.g. >= 5 FTDs) and current dropped > 30%
        if (priorFtd >= 5) {
          const dropRatio = ((priorFtd - currentFtd) / priorFtd) * 100;
          if (dropRatio >= 30) {
            const message = `⚠️ Performa Turun: FTD untuk streamer ${streamer.nama} turun ${Math.round(dropRatio)}% minggu ini (${currentFtd} FTD) dibanding minggu lalu (${priorFtd} FTD).`;
            
            // Verify if alert was already sent in the last 3 days to prevent duplicate spamming
            const doubleCheck = await query(
              `SELECT id FROM notifications 
               WHERE streamer_id = $1 
                 AND type = 'Alert' 
                 AND created_at >= NOW() - INTERVAL '3 days'`,
              [streamer.id]
            );

            if (doubleCheck.rows.length === 0) {
              await query(
                `INSERT INTO notifications (streamer_id, message, status, type) 
                 VALUES ($1, $2, 'Sent', 'Alert')`,
                [streamer.id, message]
              );
              await sendTelegramNotification(message);
            }
          }
        }
      } catch (streamerError) {
        console.error(`Error running performance check for streamer ${streamer.nama}:`, streamerError);
      }
    }
  } catch (error) {
    console.error('Error running performance drop checks:', error);
  }
};

/**
 * Checks for target achievements (e.g. Monthly targets hit)
 */
export const checkTargetAchievements = async () => {
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  const startStr = currentMonthStart.toISOString().split('T')[0];

  try {
    const streamersRes = await query('SELECT id, nama FROM streamers');
    
    for (const streamer of streamersRes.rows) {
      try {
        // 1. Fetch monthly FTD target
        const targetRes = await query(
          `SELECT target_value FROM targets 
           WHERE streamer_id = $1 AND target_type = 'ftds' AND period = 'monthly'`,
          [streamer.id]
        );

        if (targetRes.rows.length > 0) {
          const targetValue = parseFloat(targetRes.rows[0].target_value);

          // 2. Fetch current month total FTDs
          const actualRes = await query(
            `SELECT COALESCE(SUM(ftd_count), 0) as ftds
             FROM daily_reports
             WHERE streamer_id = $1 AND tanggal >= $2`,
            [streamer.id, startStr]
          );
          const actualValue = parseInt(actualRes.rows[0].ftds, 10);

          if (actualValue >= targetValue && targetValue > 0) {
            const message = `🔥 Target Tercapai: Streamer ${streamer.nama} berhasil mencapai target bulanan ${targetValue} FTD bulan ini (Aktual: ${actualValue} FTD)!`;
            
            // Check if we already logged this achievement this month to prevent spamming
            const alreadyLogged = await query(
              `SELECT id FROM notifications 
               WHERE streamer_id = $1 
                 AND type = 'Achievement'
                 AND message LIKE $2
                 AND created_at >= $3`,
              [streamer.id, `%target bulanan%`, startStr]
            );

            if (alreadyLogged.rows.length === 0) {
              await query(
                `INSERT INTO notifications (streamer_id, message, status, type) 
                 VALUES ($1, $2, 'Sent', 'Achievement')`,
                [streamer.id, message]
              );
              await sendTelegramNotification(message);
            }
          }
        }
      } catch (streamerError) {
        console.error(`Error checking target achievements for streamer ${streamer.nama}:`, streamerError);
      }
    }
  } catch (error) {
    console.error('Error checking target achievements:', error);
  }
};

/**
 * Checks for daily live duration violations (runs at 23:00 WIB)
 */
export const checkMinLiveViolations = async (wibDateStr) => {
  const todayStr = wibDateStr || getWibHourAndDate().dateStr;
  const dayOfWeek = new Date(todayStr + 'T12:00:00+07:00').getDay();

  // Hari Minggu libur -> tidak ada pelanggaran minimal live di hari Minggu
  if (dayOfWeek === 0) {
    console.log(`[Min Live Check] Hari ini adalah hari Minggu (Libur). Lewati pengecekan minimal live.`);
    return;
  }
  
  // Calculate yesterday's date in WIB to capture late reports
  const todayDate = new Date();
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = formatWibDate(yesterdayDate);
  const yesterdayDay = new Date(yesterdayStr + 'T12:00:00+07:00').getDay();

  // Hanya periksa tanggal yang bukan hari Minggu
  const targetDates = [];
  if (yesterdayDay !== 0) targetDates.push(yesterdayStr);
  targetDates.push(todayStr);
  
  try {
    const result = await query(
      `SELECT r.*, s.nama 
       FROM daily_reports r
       JOIN streamers s ON r.streamer_id = s.id
       WHERE r.tanggal = ANY($1) 
         AND r.kategori = 'Streaming' 
         AND r.live_duration < 4.0
         AND EXISTS (
           SELECT 1 FROM schedule sc
           WHERE (sc.streamer_id = r.streamer_id OR sc.substitute_streamer_id = r.streamer_id)
             AND DATE(sc.start_time AT TIME ZONE 'Asia/Jakarta') = r.tanggal
             AND sc.platform = 'YouTube'
         )`,
      [targetDates]
    );

    for (const row of result.rows) {
      try {
        const reportDateStr = formatWibDate(row.tanggal);
        const message = `⚠️ Pelanggaran Target: Streamer ${row.nama} melakukan live hanya ${row.live_duration} jam pada tanggal ${reportDateStr} (di bawah standar minimal 4 jam).`;
        
        // Verify duplicate check to prevent double writes on the same report date
        const doubleCheck = await query(
          `SELECT id FROM notifications 
           WHERE streamer_id = $1 
             AND message = $2`,
          [row.streamer_id, message]
        );

        if (doubleCheck.rows.length === 0) {
          await query(
            `INSERT INTO notifications (streamer_id, message, status, type) 
             VALUES ($1, $2, 'Sent', 'Alert')`,
            [row.streamer_id, message]
          );
          await sendTelegramNotification(message);
        }
      } catch (rowError) {
        console.error(`Error checking min live violation for row ID ${row.id}:`, rowError);
      }
    }
  } catch (error) {
    console.error('Error checking min live violations:', error);
  }
};

/**
 * Clean up stale 'Scheduled' entries older than 24 hours.
 * Also sweeps Live schedules that are YouTube Waiting Rooms (false positives).
 */
export const cleanupStaleSchedules = async () => {
  try {
    // 1. Cancel Scheduled entries yang sudah lewat 36 jam (buffer cukup untuk late streamer)
    // Dulu 24 jam, terlalu agresif mencancel jadwal hari ini yang belum sempat live
    const resScheduled = await query(
      `UPDATE schedule
       SET status = 'Cancelled'
       WHERE status = 'Scheduled'
         AND start_time < NOW() - INTERVAL '36 hours'`
    );

    // 2. Sweep SEMUA jadwal berstatus 'Live' yang sudah berjalan > 30 menit
    //    → Cek scraper. Hanya tutup jika scraper KONFIRMASI offline.
    //    → Tidak ada lagi batas waktu paksa (8h/12h). Murni hasil scraper.
    const liveYouTubeRes = await query(
      `SELECT sc.id, sc.live_link, sc.platform
       FROM schedule sc
       WHERE sc.status = 'Live'
         AND sc.actual_start_time < NOW() - INTERVAL '30 minutes'`
    );

    let scraperClosed = 0;
    for (const row of liveYouTubeRes.rows) {
      try {
        let isLive = true; // Default fail-safe: anggap masih live

        if (row.platform === 'YouTube' && row.live_link?.includes('/watch?v=')) {
          // YouTube: verifikasi via videoId scraper
          const videoId = row.live_link.match(/watch\?v=([a-zA-Z0-9_-]+)/)?.[1];
          if (!videoId) continue;
          try {
            isLive = await checkVideoLiveStatus(videoId);
          } catch (err) {
            console.log(`[Cron Cleanup] YouTube check error #${row.id}, skip (ambiguous):`, err.message);
            continue;
          }
        } else if (row.platform === 'TikTok' && row.live_link) {
          // TikTok: verifikasi via username dari live_link
          const username = row.live_link.match(/tiktok\.com\/@([^/?]+)/)?.[1];
          if (!username) continue;
          try {
            const tiktokInfo = await checkTikTokUserLive(username);
            isLive = tiktokInfo?.isLive ?? true;
          } catch (err) {
            console.log(`[Cron Cleanup] TikTok check error #${row.id}, skip (ambiguous):`, err.message);
            continue;
          }
        } else {
          // Platform tidak dikenali atau live_link kosong → skip, jangan tutup
          continue;
        }

        if (!isLive) {
          // Scraper konfirmasi OFFLINE → tandai Completed & simpan durasi ke daily_reports
          const scheduleRes = await query(
            `SELECT streamer_id, substitute_streamer_id, actual_start_time, start_time, live_duration 
             FROM schedule WHERE id = $1`,
            [row.id]
          );
          const sch = scheduleRes.rows[0];
          if (sch) {
            const start = new Date(sch.actual_start_time || sch.start_time || Date.now());
            const durationHours = parseFloat(Math.max(0, (Date.now() - start.getTime()) / 3600000).toFixed(2));
            const previousDuration = parseFloat(sch.live_duration || 0);
            const netDuration = Math.max(0, parseFloat((durationHours - previousDuration).toFixed(2)));

            await query(
              `UPDATE schedule 
               SET status = 'Completed', 
                   actual_end_time = NOW(),
                   live_duration = $1
               WHERE id = $2`,
              [durationHours, row.id]
            );

            if (netDuration > 0) {
              const targetStreamerId = sch.substitute_streamer_id || sch.streamer_id;
              const dateStr = new Date(sch.actual_start_time || start).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
              await query(
                `INSERT INTO daily_reports (streamer_id, tanggal, kategori, live_duration, tiktok_upload, youtube_upload, instagram_upload, facebook_upload, chat_count, registration_count, ftd_count)
                 VALUES ($1, $2, 'Streaming', $3, 0, 0, 0, 0, 0, 0, 0)
                 ON CONFLICT (streamer_id, tanggal) 
                 DO UPDATE SET live_duration = COALESCE(daily_reports.live_duration, 0) + EXCLUDED.live_duration`,
                [targetStreamerId, dateStr, netDuration]
              );
            }
          }
          scraperClosed++;
          console.log(`[Cron Cleanup] Schedule #${row.id} (${row.platform}) ditutup — scraper konfirmasi OFFLINE.`);
        }
        // isLive = true → masih live, tidak disentuh
      } catch (err) {
        console.error(`[Cron Cleanup] Error checking schedule #${row.id}:`, err.message);
      }
    }

    if (resScheduled.rowCount > 0 || scraperClosed > 0) {
      console.log(`[Cron] Cleaned up ${resScheduled.rowCount || 0} stale Scheduled, ${scraperClosed} live sessions confirmed offline by scraper.`);
    }
  } catch (error) {
    console.error('[Cron] Error cleaning up stale schedules:', error.message);
  }
};

/**
 * Master scheduler using node-cron with Asia/Jakarta (WIB UTC+7) timezone
 */
export const startCronJobs = (botInstance) => {
  if (botInstance) {
    bot = botInstance;
  }
  console.log('Cron Service Engine started (node-cron with Asia/Jakarta timezone).');
  setTimeout(() => {
    cleanupStaleSchedules();
    checkPerformanceDrops();
    checkTargetAchievements();
  }, 5000);

  // ⏰ Check missing daily reports at 23:00 WIB every day
  cron.schedule('0 23 * * *', () => {
    const { dateStr } = getWibHourAndDate();
    console.log(`[Cron] Running checkMissingReports at 23:00 WIB for ${dateStr}`);
    checkMissingReports(dateStr);
  }, { timezone: 'Asia/Jakarta' });

  // ⏰ Check minimum live hour violations at 23:00 WIB every day
  cron.schedule('0 23 * * *', () => {
    const { dateStr } = getWibHourAndDate();
    console.log(`[Cron] Running checkMinLiveViolations at 23:00 WIB for ${dateStr}`);
    checkMinLiveViolations(dateStr);
  }, { timezone: 'Asia/Jakarta' });

  // ⏰ Run performance drop and milestone checks at 09:00 WIB every day
  cron.schedule('0 9 * * *', () => {
    console.log('[Cron] Running checkPerformanceDrops & checkTargetAchievements at 09:00 WIB');
    checkPerformanceDrops();
    checkTargetAchievements();
  }, { timezone: 'Asia/Jakarta' });

  // ⏰ Run social media metrics synchronization at 02:00 WIB every day
  cron.schedule('0 2 * * *', () => {
    console.log('[Cron] Running daily social media content metrics synchronization at 02:00 WIB');
    syncSocialMetrics().catch(err => console.error('[Cron] Error running syncSocialMetrics:', err));
  }, { timezone: 'Asia/Jakarta' });

  // ⏰ Run social media content auto-discovery every 4 hours
  cron.schedule('0 */4 * * *', () => {
    console.log('[Cron] Running social media content auto-discovery...');
    discoverNewContent().catch(err => console.error('[Cron] Error running discoverNewContent:', err));
  }, { timezone: 'Asia/Jakarta' });

  // ⏰ Run automated weekly evaluations at 00:00 WIB every Monday
  cron.schedule('0 0 * * 1', () => {
    console.log('[Cron] Running weekly evaluations auto-generation at Monday 00:00 WIB');
    autoGenerateWeeklyEvaluations().catch(err => console.error('[Cron] Error running autoGenerateWeeklyEvaluations:', err));
  }, { timezone: 'Asia/Jakarta' });

  // ⏰ Clean up stale Scheduled entries at 03:00 WIB every day
  cron.schedule('0 3 * * *', () => {
    cleanupStaleSchedules().catch(err => console.error('[Cron] Error running cleanupStaleSchedules:', err));
  }, { timezone: 'Asia/Jakarta' });

  // ⏰ [YouTube & TikTok Live Detection] — tiap 3 menit, 24/7 (24 jam nonstop, ultra-responsif)
  cron.schedule('*/3 * * * *', async () => {
    console.log('[Cron] Running YouTube & TikTok live status detection (24/7 3-min pure poll)...');
    await checkYouTubeLiveStatus(sendTelegramNotification).catch(err => console.error('[Cron] Error running checkYouTubeLiveStatus:', err));
    await checkTikTokLiveStatus(sendTelegramNotification).catch(err => console.error('[Cron] Error running checkTikTokLiveStatus:', err));
    // Langsung sweep schedule yang mungkin false positive (waiting room)
    await cleanupStaleSchedules().catch(err => console.error('[Cron] Error running post-detection cleanupStaleSchedules:', err));
  }, { timezone: 'Asia/Jakarta' });
};




