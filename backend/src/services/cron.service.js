import { query } from '../config/db.js';

let bot = null;

// Helper to get time and date in WIB (UTC+7) regardless of VPS local timezone
const getWibHourAndDate = () => {
  const now = new Date();
  const wibTime = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
  const wibDate = new Date(wibTime);
  const hour = wibDate.getHours();
  const year = wibDate.getFullYear();
  const month = String(wibDate.getMonth() + 1).padStart(2, '0');
  const day = String(wibDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  return { hour, dateStr };
};

// Helper to push Telegram message if bot is active
const sendTelegramNotification = async (message) => {
  console.log(`[Notification Engine]: ${message}`);
  
  if (!bot) return;

  const chatRulesRes = await query("SELECT value FROM config WHERE key = 'telegram_group_id'");
  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID || chatRulesRes.rows[0]?.value;

  if (chatId) {
    try {
      await bot.telegram.sendMessage(chatId, message);
      console.log(`[Notification Sent to Telegram Chat ${chatId}]: Success`);
    } catch (err) {
      console.error(`[Notification Telegram Error]: Failed to dispatch message: ${err.message}`);
    }
  }
};

/**
 * Checks for missing daily reports (runs at 22:00 local time)
 */
export const checkMissingReports = async (wibDateStr) => {
  const todayStr = wibDateStr || getWibHourAndDate().dateStr;
  
  try {
    // Get all streamers
    const streamersRes = await query('SELECT id, nama FROM streamers');
    const streamers = streamersRes.rows;

    for (const streamer of streamers) {
      // Check if report exists for today
      const reportCheck = await query(
        'SELECT id FROM daily_reports WHERE tanggal = $1 AND streamer_id = $2',
        [todayStr, streamer.id]
      );

      if (reportCheck.rows.length === 0) {
        // Double check if report reminder was already sent today to prevent duplicate spamming
        const doubleCheck = await query(
          `SELECT id FROM notifications 
           WHERE streamer_id = $1 
             AND type = 'Report Reminder' 
             AND created_at::date = $2`,
          [streamer.id, todayStr]
        );

        if (doubleCheck.rows.length > 0) continue;

        const message = `⚠️ Laporan Belum Dikirim: Streamer ${streamer.nama} belum mengirim laporan hari ini (${todayStr}).`;
        
        // Log to database
        await query(
          `INSERT INTO notifications (streamer_id, message, status, type) 
           VALUES ($1, $2, 'Sent', 'Report Reminder')`,
          [streamer.id, message]
        );

        // Dispatch Telegram
        await sendTelegramNotification(message);
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
    }
  } catch (error) {
    console.error('Error checking target achievements:', error);
  }
};

/**
 * Checks for daily live duration violations (runs at 23:00 local time)
 */
export const checkMinLiveViolations = async (wibDateStr) => {
  const todayStr = wibDateStr || getWibHourAndDate().dateStr;
  
  try {
    const result = await query(
      `SELECT r.*, s.nama 
       FROM daily_reports r
       JOIN streamers s ON r.streamer_id = s.id
       WHERE r.tanggal = $1 
         AND r.kategori = 'Streaming' 
         AND r.live_duration < 4.0`,
      [todayStr]
    );

    for (const row of result.rows) {
      const message = `⚠️ Pelanggaran Target: Streamer ${row.nama} melakukan live hanya ${row.live_duration} jam hari ini (di bawah standar minimal 4 jam).`;
      
      // Verify duplicate check to prevent double writes on the same day
      const doubleCheck = await query(
        `SELECT id FROM notifications 
         WHERE streamer_id = $1 
           AND message = $2 
           AND created_at::date = $3`,
        [row.streamer_id, message, todayStr]
      );

      if (doubleCheck.rows.length === 0) {
        await query(
          `INSERT INTO notifications (streamer_id, message, status, type) 
           VALUES ($1, $2, 'Sent', 'Alert')`,
          [row.streamer_id, message]
        );
        await sendTelegramNotification(message);
      }
    }
  } catch (error) {
    console.error('Error checking min live violations:', error);
  }
};

/**
 * Master scheduler loop
 */
export const startCronJobs = (botInstance) => {
  bot = botInstance;
  console.log('Cron Service Engine started (WIB Timezone loop enabled).');

  // Run initial checks for target achievements & performance drops on boot
  setTimeout(() => {
    checkPerformanceDrops();
    checkTargetAchievements();
  }, 5000);

  // Run checking loop every 5 minutes (more robust to restarts and ticks)
  const FIVE_MINUTES = 5 * 60 * 1000;
  setInterval(() => {
    const { hour, dateStr } = getWibHourAndDate();
    
    console.log(`[Cron Engine Check] Hour (WIB): ${hour}:00, Date (WIB): ${dateStr}`);

    // Check report submissions at 22:00 (10:00 PM) Indonesian time
    if (hour === 22) {
      checkMissingReports(dateStr);
    }

    // Check minimum daily live hours standard at 23:00 (11:00 PM)
    if (hour === 23) {
      checkMinLiveViolations(dateStr);
    }

    // Run performance drop and milestone checks once daily at 09:00 AM
    if (hour === 9) {
      checkPerformanceDrops();
      checkTargetAchievements();
    }
  }, FIVE_MINUTES);
};
