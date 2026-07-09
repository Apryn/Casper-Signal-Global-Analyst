import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env from backend root BEFORE any other imports use process.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

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
import { startCronJobs } from './services/cron.service.js';
import telegramService from './services/telegram.service.js';
const { parseMessageText } = telegramService;


const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health Check API
app.get('/health', async (req, res) => {
  try {
    const dbCheck = await pool.query('SELECT NOW()');
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: dbCheck.rows[0].now
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    });
  }
});

// Register API Routes
app.use('/api/auth', authRoutes);
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



// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({
    message: 'An unexpected error occurred on the server',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Start Express Server
const server = app.listen(PORT, () => {
  console.log(`Express API Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  
  // Initialize and launch Telegram bot (Telegraf)
  launchBot();
});

// Telegram Bot Launch Wrapper
const launchBot = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE' || token.trim() === '') {
    console.log('Telegram Bot Token not configured. Polling bot listener disabled.');
    startCronJobs(null);
    return;
  }

  // Import Telegraf dynamically to avoid startup crash if telegraf token is omitted but user wants server running
  import('telegraf').then(({ Telegraf }) => {
    try {
      const bot = new Telegraf(token);

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
          
          const replyMsg =
            `✅ *Laporan ${result.streamerName} tanggal ${result.parsedData.tanggal} berhasil disimpan ke dashboard!* 🚀`;
            
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


      bot.launch()
        .then(() => {
          console.log('Telegram Bot successfully launched in polling mode.');
          startCronJobs(bot);
        })
        .catch(err => {
          console.error('Failed to launch Telegraf bot:', err);
          startCronJobs(null);
        });
        
      // Enable graceful stop
      process.once('SIGINT', () => bot.stop('SIGINT'));
      process.once('SIGTERM', () => bot.stop('SIGTERM'));

    } catch (e) {
      console.error('Error setting up Telegram Bot:', e);
    }
  }).catch(e => {
    console.error('Could not import Telegraf:', e);
  });
};
