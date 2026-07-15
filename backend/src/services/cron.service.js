import { query } from '../config/db.js';
import cron from 'node-cron';

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
const sendTelegramNotification = async (message) => {
  console.log(`[Notification Engine]: ${message}`);
  
  if (!bot) return;

  let chatId = process.env.TELEGRAM_GROUP_CHAT_ID || process.env.TELEGRAM_GROUP_ID;

  if (!chatId) {
    try {
      const chatRulesRes = await query("SELECT value FROM config WHERE key = 'telegram_group_id'");
      chatId = chatRulesRes.rows[0]?.value;
    } catch (err) {
      console.warn(`[Notification Engine]: Config table query failed: ${err.message}`);
    }
  }

  if (chatId) {
    try {
      const threadId = process.env.TELEGRAM_REPORT_THREAD_ID
        ? parseInt(process.env.TELEGRAM_REPORT_THREAD_ID, 10)
        : null;

      const options = { parse_mode: 'Markdown' };
      if (threadId) {
        options.message_thread_id = threadId;
      }

      await bot.telegram.sendMessage(chatId, message, options);
      console.log(`[Notification Sent to Telegram Chat ${chatId} (Thread: ${threadId || 'none'})]: Success`);
    } catch (err) {
      console.error(`[Notification Telegram Error]: Failed to dispatch message: ${err.message}`);
    }
  } else {
    console.error('[Notification Telegram Error]: No telegram group ID configured.');
  }
};

/**
 * Checks for missing daily reports (runs at 22:00 WIB)
 */
export const checkMissingReports = async (wibDateStr) => {
  const todayStr = wibDateStr || getWibHourAndDate().dateStr;
  
  try {
    // Get all streamers
    const streamersRes = await query('SELECT id, nama FROM streamers');
    const streamers = streamersRes.rows;

    for (const streamer of streamers) {
      try {
        // Check if report exists for today
        const reportCheck = await query(
          'SELECT id FROM daily_reports WHERE tanggal = $1 AND streamer_id = $2',
          [todayStr, streamer.id]
        );

        if (reportCheck.rows.length === 0) {
          const message = `⚠️ Laporan Belum Dikirim: Streamer ${streamer.nama} belum mengirim laporan hari ini (${todayStr}).`;
          
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

          // Dispatch Telegram
          await sendTelegramNotification(message);
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

  // ⏰ Check missing daily reports at 22:00 WIB every day
  cron.schedule('0 22 * * *', () => {
    const { dateStr } = getWibHourAndDate();
    console.log(`[Cron] Running checkMissingReports at 22:00 WIB for ${dateStr}`);
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
};
