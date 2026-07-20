import { query } from '../config/db.js';
import cron from 'node-cron';
import { syncSocialMetrics, discoverNewContent } from './social.service.js';
import { autoGenerateWeeklyEvaluations } from '../controllers/evaluation.controller.js';
import { checkYouTubeLiveStatus } from './youtube.service.js';

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
      WHERE tanggal = $1
    )
    ORDER BY nama ASC
  `, [dateStr]);
  const missingStreamers = missingStreamersRes.rows;

  if (missingStreamers.length > 0) {
    for (const streamer of missingStreamers) {
      if (!streamer.telegram_chat_id) {
        console.log(`[Manual Notification Skipped]: Streamer ${streamer.nama} has no telegram_chat_id (has not initiated private chat with bot)`);
        continue;
      }

      const mention = streamer.telegram_username
        ? `@${streamer.telegram_username.trim().replace(/([_*\[\]`])/g, '\\$1')}`
        : `*${streamer.nama}*`;
      
      const message = `⚠️ *PENGINGAT LAPORAN HARIAN* ⚠️\n\nStreamer ${mention} belum mengirimkan rekap harian untuk hari ini (*${formattedDate}*). Mohon segera dikirim ya! 🙏`;

      try {
        await bot.telegram.sendMessage(streamer.telegram_chat_id, message, { parse_mode: 'Markdown' });

        // Log to database
        await query(
          `INSERT INTO notifications (streamer_id, message, status, type) 
           VALUES ($1, $2, 'Sent', 'Report Reminder')`,
          [streamer.id, message]
        );

        console.log(`[Manual Notification Sent to Streamer ${streamer.nama} (Japri)]: Success`);
      } catch (err) {
        console.error(`[Manual Notification Error for Streamer ${streamer.nama}]: ${err.message}`);
      }

      // Small delay to avoid spamming / rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  return {
    success: true,
    message: 'Report reminder processed!',
    recipientCount: missingStreamers.filter(s => s.telegram_chat_id).length,
    missingStreamers: missingStreamers.map(s => s.nama)
  };
};

/**
 * Checks for missing daily reports (runs at 22:00 WIB)
 */
export const checkMissingReports = async (wibDateStr) => {
  const todayStr = wibDateStr || getWibHourAndDate().dateStr;
  
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

        // Check if report exists for today
        const reportCheck = await query(
          'SELECT id FROM daily_reports WHERE tanggal = $1 AND streamer_id = $2',
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
  
  // Calculate yesterday's date in WIB to capture late reports
  const todayDate = new Date();
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = formatWibDate(yesterdayDate);

  const targetDates = [yesterdayStr, todayStr];
  
  try {
    const result = await query(
      `SELECT r.*, s.nama 
       FROM daily_reports r
       JOIN streamers s ON r.streamer_id = s.id
       WHERE r.tanggal IN ($1, $2) 
         AND r.kategori = 'Streaming' 
         AND r.live_duration < 4.0`,
      [targetDates[0], targetDates[1]]
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
 * [NEW] Auto-generate daily schedule entries from schedule_templates.
 * Runs at 00:05 WIB every day. Skips if entry for that day already exists.
 */
export const generateDailySchedules = async (wibDateStr) => {
  const todayStr = wibDateStr || getWibHourAndDate().dateStr;
  // day of week: 0=Sunday, 1=Monday, ..., 6=Saturday
  const dayOfWeek = new Date(todayStr + 'T12:00:00+07:00').getDay();

  try {
    // Ambil semua template aktif yang berlaku hari ini
    const templatesRes = await query(
      `SELECT t.*, s.nama
       FROM schedule_templates t
       JOIN streamers s ON t.streamer_id = s.id
       WHERE t.is_active = TRUE
         AND $1 = ANY(t.days_of_week)
       ORDER BY t.start_time`,
      [dayOfWeek]
    );

    const templates = templatesRes.rows;
    if (templates.length === 0) {
      console.log(`[Schedule Generator] Tidak ada template aktif untuk hari ini (day ${dayOfWeek}).`);
      return;
    }

    let generated = 0;
    let skipped = 0;

    for (const t of templates) {
      // Bangun datetime dengan timezone WIB (UTC+7)
      const startISO = `${todayStr}T${t.start_time.substring(0, 5)}:00+07:00`;
      // Kalau end_time = 23:59, jadikan 23:59 (bukan tengah malam keesokan hari)
      const endISO   = `${todayStr}T${t.end_time.substring(0, 5)}:00+07:00`;

      // Cek apakah sudah ada jadwal untuk streamer ini di waktu ini hari ini
      const existCheck = await query(
        `SELECT id FROM schedule
         WHERE streamer_id = $1
           AND start_time = $2
           AND DATE(start_time AT TIME ZONE 'Asia/Jakarta') = $3`,
        [t.streamer_id, startISO, todayStr]
      );

      if (existCheck.rows.length > 0) {
        skipped++;
        continue; // Sudah ada, skip
      }

      // Insert jadwal baru
      await query(
        `INSERT INTO schedule (streamer_id, platform, start_time, end_time, status)
         VALUES ($1, $2, $3, $4, 'Scheduled')`,
        [t.streamer_id, t.platform, startISO, endISO]
      );

      generated++;
    }

    console.log(`[Schedule Generator] ${todayStr} — Generated: ${generated}, Skipped (exists): ${skipped}`);
  } catch (error) {
    console.error('[Schedule Generator] Error:', error.message);
  }
};

/**
 * [NEW] Checks schedules starting in 10-20 minutes and sends pre-live promo reminders.
 * Marks pre_live_submitted = true to prevent duplicate sends.
 */
export const checkPreLiveReminders = async () => {
  try {
    const now = new Date();
    // Window: jadwal yang mulai 10-20 menit dari sekarang
    const windowStart = new Date(now.getTime() + 10 * 60 * 1000);
    const windowEnd   = new Date(now.getTime() + 20 * 60 * 1000);

    const result = await query(
      `SELECT sc.id, sc.start_time, sc.platform, sc.streamer_id,
              s.nama, s.telegram_username, s.telegram_chat_id
       FROM schedule sc
       JOIN streamers s ON sc.streamer_id = s.id
       WHERE sc.status = 'Scheduled'
         AND sc.pre_live_submitted = FALSE
         AND sc.start_time BETWEEN $1 AND $2`,
      [windowStart.toISOString(), windowEnd.toISOString()]
    );

    for (const row of result.rows) {
      if (!row.telegram_chat_id) {
        console.log(`[Pre-Live Reminder Skipped]: Streamer ${row.nama} has no telegram_chat_id, skipped.`);
        continue;
      }

      const startWib = new Date(row.start_time).toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
      });
      const mention = row.telegram_username
        ? `@${row.telegram_username.trim()}`
        : `*${row.nama}*`;

      const message =
        `⏰ *REMINDER PRE-LIVE — ${row.nama}*\n\n` +
        `Halo ${mention}! Live kamu di *${row.platform}* dimulai pukul *${startWib} WIB* (kurang lebih 15 menit lagi).\n\n` +
        `📢 Sudah share promo, tren, atau analisa singkat ke grup belum?\n` +
        `Ketik */promo [link_post]* atau cukup */promo done* jika kamu membagikan screenshot. Semangat! 🚀`;

      await sendTelegramNotification(message, row.telegram_chat_id);

      // Tandai sudah terkirim agar tidak double-send
      await query(
        `UPDATE schedule SET pre_live_submitted = TRUE WHERE id = $1`,
        [row.id]
      );

      // Log ke notifikasi
      await query(
        `INSERT INTO notifications (streamer_id, message, status, type)
         VALUES ($1, $2, 'Sent', 'Report Reminder')`,
        [row.streamer_id, message]
      );

      console.log(`[Pre-Live Reminder] Sent to ${row.nama} for ${startWib} WIB`);
      await new Promise(r => setTimeout(r, 300));
    }
  } catch (error) {
    console.error('[Pre-Live Reminder] Error:', error.message);
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

  // ⏰ [NEW] Auto-generate jadwal harian dari templates — jam 00:05 WIB setiap hari
  cron.schedule('5 0 * * *', () => {
    const { dateStr } = getWibHourAndDate();
    console.log(`[Cron] Auto-generating daily schedules from templates for ${dateStr}`);
    generateDailySchedules(dateStr).catch(err => console.error('[Cron] Error running generateDailySchedules:', err));
  }, { timezone: 'Asia/Jakarta' });

  // ⏰ [NEW] Pre-live reminder — cek tiap 5 menit, kirim reminder 10-20 menit sebelum jadwal
  cron.schedule('*/5 * * * *', () => {
    console.log('[Cron] Running pre-live reminder check...');
    checkPreLiveReminders().catch(err => console.error('[Cron] Error running checkPreLiveReminders:', err));
  }, { timezone: 'Asia/Jakarta' });

  // ⏰ [NEW] YouTube Live Detection — tiap 15 menit, jam 07:00-23:00 WIB
  // Smart filter aktif: hanya query channel yang punya jadwal dalam window ±60 menit
  // Estimasi quota: ~12.800 unit/hari (sedikit di atas free 10K, request increase jika perlu)
  cron.schedule('*/15 7-23 * * *', () => {
    console.log('[Cron] Running YouTube live status detection (15-min smart poll)...');
    checkYouTubeLiveStatus(sendTelegramNotification).catch(err => console.error('[Cron] Error running checkYouTubeLiveStatus:', err));
  }, { timezone: 'Asia/Jakarta' });
};
