import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env from backend root BEFORE any other imports use process.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

// ============================================================
// ENVIRONMENT VALIDATION — fail fast with clear messages
// ============================================================
const REQUIRED_VARS = ['DATABASE_URL', 'JWT_SECRET'];
const missing = REQUIRED_VARS.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  console.error('Please check your .env file.');
  process.exit(1);
}

// Import configurations and routes
import pool from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import streamerRoutes from './routes/streamer.routes.js';
import reportRoutes from './routes/report.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import targetRoutes from './routes/target.routes.js';
import contentRoutes from './routes/content.routes.js';
import scheduleRoutes from './routes/schedule.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import evaluationRoutes from './routes/evaluation.routes.js';
import accountRoutes from './routes/account.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import { startCronJobs, setBotInstance } from './services/cron.service.js';
import telegramService from './services/telegram.service.js';
const { parseMessageText } = telegramService;


const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// CORS — allow frontend origins explicitly
// ============================================================
const allowedOrigins = [
  'http://localhost:5173',  // Vite dev server
  'http://localhost:3000',
  'http://localhost:80',
  'http://localhost',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ============================================================
// RATE LIMITING
// ============================================================
// Global limiter: 200 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

// Auth limiter: 20 login attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
});

app.use(globalLimiter);

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', async (req, res) => {
  try {
    const dbCheck = await pool.query('SELECT NOW()');
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: dbCheck.rows[0].now,
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    });
  }
});

// ============================================================
// API ROUTES
// ============================================================
// Apply stricter limiter to auth routes
app.use('/api/auth', authLimiter, authRoutes);

app.use('/api/streamers', streamerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/targets', targetRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/notifications', notificationRoutes);

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
  // Handle CORS errors explicitly
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ message: err.message });
  }
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({
    message: 'An unexpected error occurred on the server',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// ============================================================
// START SERVER
// ============================================================
const server = app.listen(PORT, () => {
  console.log(`✅ Express API Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  
  // Initialize and launch Telegram bot (Telegraf)
  launchBot();
});

// ============================================================
// TELEGRAM BOT LAUNCH WRAPPER
// ============================================================
const launchBot = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE' || token.trim() === '') {
    console.log('⚠️  Telegram Bot Token not configured. Polling bot listener disabled.');
    startCronJobs(null);
    return;
  }

  // Import Telegraf dynamically to avoid startup crash if token is omitted
  import('telegraf').then(({ Telegraf }) => {
    try {
      const bot = new Telegraf(token);

      // Handle Telegraf runtime errors (e.g. polling conflict, network timeouts) gracefully without crashing
      bot.catch((err, ctx) => {
        console.error(`[Telegram Bot Error] Error for update type "${ctx.updateType || 'unknown'}":`, err);
      });

      const REPORT_THREAD_ID = process.env.TELEGRAM_REPORT_THREAD_ID
        ? parseInt(process.env.TELEGRAM_REPORT_THREAD_ID, 10)
        : null;

      bot.start((ctx) => {
        ctx.reply(
          '👋 *Halo! Saya CasperSignal Bot.*\n\nKirimkan laporan harian di topik *REKAP HARIAN* dan saya akan otomatis memprosesnya ke dashboard. Ketik /template atau /format untuk melihat contoh format laporan.',
          { parse_mode: 'Markdown' }
        );
      });

      bot.command(['template', 'format', 'help'], (ctx) => {
        const threadId = ctx.message?.message_thread_id ?? null;
        const replyOptions = threadId
          ? { parse_mode: 'Markdown', reply_parameters: { message_id: ctx.message.message_id } }
          : { parse_mode: 'Markdown' };

        const templateText = 
          `📝 *TEMPLATE LAPORAN HARIAN (Salin & Isi)*\n\n` +
          `\`\`\`\n` +
          `STREAMING\n` +
          `Tanggal : 8 Sep 2025\n` +
          `Nama : [Nama Panggilan]\n\n` +
          `UPLOAD:\n` +
          `TikTok : 3 Video\n` +
          `YouTube Short : 3 Video\n` +
          `Instagram Reels : -\n` +
          `Facebook FP : -\n\n` +
          `LIVE:\n` +
          `- Jam 09:00 (1.5 jam)\n` +
          `- Jam 14:00 (1.5 jam)\n\n` +
          `CHAT:\n` +
          `15 chat masuk\n\n` +
          `REGISTRASI:\n` +
          `5 user\n\n` +
          `FTD:\n` +
          `2\n` +
          `\`\`\``;
        ctx.reply(templateText, replyOptions);
      });

      // ── [NEW] Command: /promo [link] ─────────────────────────────────────────
      // Streamer kirim setelah share promo pre-live ke grup/komunitas
      bot.command('promo', async (ctx) => {
        const replyOptions = { parse_mode: 'Markdown', reply_parameters: { message_id: ctx.message.message_id } };
        const senderUsername = ctx.message?.from?.username;
        const senderName = ctx.message?.from?.first_name || 'Unknown';
        const args = ctx.message.text.split(' ').slice(1).join(' ').trim();

        try {
          // Cari streamer berdasarkan telegram_username
          const streamerRes = await import('./config/db.js').then(m =>
            m.query(
              `SELECT id, nama FROM streamers WHERE LOWER(telegram_username) = LOWER($1)`,
              [senderUsername || '']
            )
          );

          if (!streamerRes.rows || streamerRes.rows.length === 0) {
            return ctx.reply(
              `❌ *Username Telegram kamu tidak terdaftar.*\n_Hubungi admin untuk mendaftarkan @${senderUsername || senderName}._`,
              replyOptions
            );
          }

          const streamer = streamerRes.rows[0];

          // Cari jadwal terdekat hari ini yang belum live
          const now = new Date();
          const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
          const todayStart = `${dateStr}T00:00:00+07:00`;
          const todayEnd   = `${dateStr}T23:59:59+07:00`;

          const scheduleRes = await import('./config/db.js').then(m =>
            m.query(
              `SELECT id FROM schedule
               WHERE streamer_id = $1
                 AND status = 'Scheduled'
                 AND start_time BETWEEN $2 AND $3
               ORDER BY start_time ASC LIMIT 1`,
              [streamer.id, todayStart, todayEnd]
            )
          );

          if (scheduleRes.rows.length > 0) {
            await import('./config/db.js').then(m =>
              m.query(
                `UPDATE schedule SET pre_live_submitted = TRUE WHERE id = $1`,
                [scheduleRes.rows[0].id]
              )
            );
          }

          const linkInfo = args ? `\n📎 Link: ${args}` : '';
          await ctx.reply(
            `✅ *Promo pre-live ${streamer.nama} berhasil dicatat!* 🚀${linkInfo}\n\n_Semangat live-nya! Audiens sudah nunggu. 💪_`,
            replyOptions
          );
        } catch (err) {
          console.error('[Bot /promo] Error:', err.message);
          await ctx.reply(`❌ Error: ${err.message}`, replyOptions);
        }
      });

      // ── [NEW] Command: /startlive ─────────────────────────────────────────────
      // Manual fallback — dipakai jika YouTube Auto-detection tidak tersedia
      bot.command('startlive', async (ctx) => {
        const replyOptions = { parse_mode: 'Markdown', reply_parameters: { message_id: ctx.message.message_id } };
        const senderUsername = ctx.message?.from?.username;
        const senderName = ctx.message?.from?.first_name || 'Unknown';

        try {
          const streamerRes = await import('./config/db.js').then(m =>
            m.query(
              `SELECT id, nama FROM streamers WHERE LOWER(telegram_username) = LOWER($1)`,
              [senderUsername || '']
            )
          );

          if (!streamerRes.rows || streamerRes.rows.length === 0) {
            return ctx.reply(
              `❌ *Username Telegram kamu tidak terdaftar.*\n_Hubungi admin untuk mendaftarkan @${senderUsername || senderName}._`,
              replyOptions
            );
          }

          const streamer = streamerRes.rows[0];
          const now = new Date();
          const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
          const todayStart = `${dateStr}T00:00:00+07:00`;
          const todayEnd   = `${dateStr}T23:59:59+07:00`;

          // Cari jadwal yang paling cocok (terdekat sekarang, belum live)
          const scheduleRes = await import('./config/db.js').then(m =>
            m.query(
              `SELECT * FROM schedule
               WHERE streamer_id = $1
                 AND status = 'Scheduled'
                 AND start_time BETWEEN $2 AND $3
               ORDER BY ABS(EXTRACT(EPOCH FROM (start_time - $4))) ASC
               LIMIT 1`,
              [streamer.id, todayStart, todayEnd, now.toISOString()]
            )
          );

          if (scheduleRes.rows.length === 0) {
            return ctx.reply(
              `⚠️ *Tidak ada jadwal live terdaftar untuk hari ini.*\n_Pastikan jadwal kamu sudah di-input ke sistem oleh admin._`,
              replyOptions
            );
          }

          const schedule = scheduleRes.rows[0];
          const scheduledStart = new Date(schedule.start_time);
          const latenessMs = now.getTime() - scheduledStart.getTime();
          const latenessMinutes = Math.max(0, Math.round(latenessMs / 60000));

          await import('./config/db.js').then(m =>
            m.query(
              `UPDATE schedule
               SET actual_start_time = $1,
                   lateness_minutes = $2,
                   status = 'Live'
               WHERE id = $3`,
              [now.toISOString(), latenessMinutes, schedule.id]
            )
          );

          const startWib = now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
          const latenessText = latenessMinutes > 0
            ? `⚠️ Terlambat *${latenessMinutes} menit* dari jadwal.`
            : `✅ *Ontime!*`;

          await ctx.reply(
            `🔴 *${streamer.nama} mulai live!*\n\n` +
            `• Jam aktual: *${startWib} WIB*\n` +
            `• ${latenessText}\n\n` +
            `_Live kamu sudah tercatat. Semangat! 💪_`,
            replyOptions
          );
        } catch (err) {
          console.error('[Bot /startlive] Error:', err.message);
          await ctx.reply(`❌ Error: ${err.message}`, replyOptions);
        }
      });

      // ── [NEW] Command: /rekap [link] ──────────────────────────────────────────
      // Streamer kirim link postingan konten harian sebagai bukti
      bot.command('rekap', async (ctx) => {
        const replyOptions = { parse_mode: 'Markdown', reply_parameters: { message_id: ctx.message.message_id } };
        const senderUsername = ctx.message?.from?.username;
        const senderName = ctx.message?.from?.first_name || 'Unknown';
        const args = ctx.message.text.split(' ').slice(1).join(' ').trim();

        if (!args) {
          return ctx.reply(
            `⚠️ *Format salah!*\n\nGunakan: */rekap [link_postingan]*\n\nContoh:\n\`/rekap https://www.tiktok.com/@nama/video/xxx\``,
            replyOptions
          );
        }

        try {
          const streamerRes = await import('./config/db.js').then(m =>
            m.query(
              `SELECT id, nama FROM streamers WHERE LOWER(telegram_username) = LOWER($1)`,
              [senderUsername || '']
            )
          );

          if (!streamerRes.rows || streamerRes.rows.length === 0) {
            return ctx.reply(
              `❌ *Username Telegram kamu tidak terdaftar.*\n_Hubungi admin untuk mendaftarkan @${senderUsername || senderName}._`,
              replyOptions
            );
          }

          const streamer = streamerRes.rows[0];
          const now = new Date();
          const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

          // Cek apakah ada laporan harian hari ini
          const reportRes = await import('./config/db.js').then(m =>
            m.query(
              `SELECT id FROM daily_reports WHERE streamer_id = $1 AND tanggal = $2`,
              [streamer.id, dateStr]
            )
          );

          if (reportRes.rows.length === 0) {
            return ctx.reply(
              `⚠️ *Laporan harian untuk hari ini belum ditemukan.*\n_Kirim laporan harian terlebih dahulu sebelum submit rekap konten._`,
              replyOptions
            );
          }

          // Update daily_report: tandai content_submitted + simpan link
          await import('./config/db.js').then(m =>
            m.query(
              `UPDATE daily_reports
               SET content_submitted = TRUE, content_link = $1
               WHERE streamer_id = $2 AND tanggal = $3`,
              [args, streamer.id, dateStr]
            )
          );

          await ctx.reply(
            `✅ *Rekap konten ${streamer.nama} berhasil dicatat!* 📝\n\n` +
            `📎 Link: ${args}\n\n` +
            `_Hari kerja kamu dinyatakan *PENUH* untuk hari ini. Kerja bagus! 🏆_`,
            replyOptions
          );
        } catch (err) {
          console.error('[Bot /rekap] Error:', err.message);
          await ctx.reply(`❌ Error: ${err.message}`, replyOptions);
        }
      });



      
      bot.on('text', async (ctx) => {
        const messageText = ctx.message?.text;
        if (!messageText) return;

        const threadId = ctx.message?.message_thread_id ?? null;
        const senderName = ctx.message?.from?.first_name || 'Unknown';
        const chatId = ctx.message?.chat?.id;

        // Helper: reply in same thread if forum topic, else reply normally
        const replyOptions = threadId
          ? { parse_mode: 'Markdown', reply_parameters: { message_id: ctx.message.message_id } }
          : { parse_mode: 'Markdown' };

        // Filter: only process if it's from the correct thread (REKAP HARIAN)
        // or if sent directly to bot (private chat)
        const isPrivateChat = ctx.message?.chat?.type === 'private';
        const isCorrectThread = !REPORT_THREAD_ID || threadId === REPORT_THREAD_ID;

        if (!isPrivateChat && !isCorrectThread) return; // Ignore other topics

        // Check if message looks like a daily report
        const upperText = messageText.toUpperCase();
        const looksLikeReport = (
          upperText.includes('UPLOAD:') ||
          upperText.includes('TANGGAL :') ||
          upperText.includes('TANGGAL:') ||
          upperText.includes('FTD:') ||
          (upperText.includes('STREAMING') && upperText.includes('LIVE:'))
        );

        if (!looksLikeReport) return;

        console.log(`[Telegram Bot] Report received from ${senderName} in chat ${chatId} (thread: ${threadId})`);

        try {
          const result = await parseMessageText(messageText);
          
          // Handle both single and bulk format returns
          const streamerName = result.streamerName || result.parsedData?.streamerName || 'Unknown';
          const tanggal = result.parsedData?.tanggal || 'hari ini';

          // Build success message — summarize bulk results if applicable
          let replyMsg;
          if (result.bulkResults && result.bulkResults.length > 1) {
            const names = result.bulkResults.map(r => r.streamerName).join(', ');
            replyMsg = `✅ *Laporan bulk berhasil disimpan!* 🚀\n\n*Streamer:* ${names}\n*Tanggal:* ${tanggal}`;
          } else {
            const p = result.parsedData;
            const up = p.uploads || { tiktok: 0, youtube: 0, instagram: 0, facebook: 0 };
            const totalUp = (up.tiktok || 0) + (up.youtube || 0) + (up.instagram || 0) + (up.facebook || 0);
            
            replyMsg = `✅ *Laporan ${streamerName} tanggal ${tanggal} berhasil disimpan!* 🚀\n\n` +
                       `📊 *Rincian Data Terbaca:*\n` +
                       `• Kategori: *${p.kategori || 'Streaming'}*\n` +
                       `• Live: *${p.liveDuration || 0} Jam*\n` +
                       `• Upload: *${totalUp} Video* (TT: ${up.tiktok || 0}, YT: ${up.youtube || 0}, IG: ${up.instagram || 0}, FB: ${up.facebook || 0})\n` +
                       `• Chat Masuk: *${p.chatCount || 0}*\n` +
                       `• Registrasi: *${p.registrationCount || 0} user*\n` +
                       `• FTD: *${p.ftdCount || 0}*`;
          }
            
          await ctx.reply(replyMsg, replyOptions);
        } catch (error) {
          console.error('[Telegram Bot] Error parsing report:', error.message);
          await ctx.reply(
            `❌ *Laporan Gagal Diproses*\n\n` +
            `*Error:* ${error.message}\n\n` +
            `_Pastikan format laporan sesuai template._`,
            replyOptions
          );
        }
      });

      const tryLaunch = () => {
        bot.launch()
          .then(() => {
            console.log('✅ Telegram Bot successfully launched in polling mode.');
            setBotInstance(bot);
          })
          .catch(err => {
            console.error('Failed to launch Telegraf bot:', err.message || err);
            setBotInstance(null);
            if (err.message && err.message.includes('409')) {
              console.error('⚠️ WARNING: Telegram Bot Token Conflict (409). The bot token is likely being used by your local development machine or another server instance. Retrying in 15 seconds...');
            } else {
              console.error('Retrying bot launch in 15 seconds...');
            }
            setTimeout(tryLaunch, 15000);
          });
      };

      tryLaunch();
      
      // Start cron jobs immediately
      startCronJobs(null);
        
      // Enable graceful stop
      process.once('SIGINT', () => {
        if (bot) bot.stop('SIGINT');
      });
      process.once('SIGTERM', () => {
        if (bot) bot.stop('SIGTERM');
      });

    } catch (e) {
      console.error('Error setting up Telegram Bot:', e);
      startCronJobs(null);
    }
  }).catch(e => {
    console.error('Could not import Telegraf:', e);
    startCronJobs(null);
  });
};
