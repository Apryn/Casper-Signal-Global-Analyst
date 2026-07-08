import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Import configurations and routes
import pool from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import streamerRoutes from './routes/streamer.routes.js';
import reportRoutes from './routes/report.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import { startTelegramBot } from './services/telegram.service.js';

dotenv.config();

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
    return;
  }

  // Import Telegraf dynamically to avoid startup crash if telegraf token is omitted but user wants server running
  import('telegraf').then(({ Telegraf }) => {
    try {
      const bot = new Telegraf(token);

      bot.start((ctx) => ctx.reply('Welcome to Casper Signal Analytics Bot! Send your daily reports here.'));
      
      bot.on('text', async (ctx) => {
        const messageText = ctx.message.text;
        
        // Basic check to see if it looks like a report
        if (
          messageText.toUpperCase().includes('UPLOAD:') ||
          messageText.toUpperCase().includes('TANGGAL :') ||
          messageText.toUpperCase().includes('FTD:')
        ) {
          try {
            const result = await parseMessageText(messageText);
            
            const replyMsg = `✅ *Report Parsed Successfully!*\n\n` +
              `*Streamer:* ${result.streamerName}\n` +
              `*Tanggal:* ${result.parsedData.tanggal}\n` +
              `*Kategori:* ${result.parsedData.kategori}\n\n` +
              `📈 *Metrics*:\n` +
              `- Live Duration: ${result.parsedData.liveDuration} hours\n` +
              `- Chat Count: ${result.parsedData.chatCount}\n` +
              `- Registrations: ${result.parsedData.registrationCount}\n` +
              `- FTD Count: ${result.parsedData.ftdCount}\n\n` +
              `📹 *Uploads*:\n` +
              `- TikTok: ${result.parsedData.uploads.tiktok}\n` +
              `- YouTube Shorts: ${result.parsedData.uploads.youtube}\n` +
              `- Instagram Reels: ${result.parsedData.uploads.instagram}\n` +
              `- Facebook FP: ${result.parsedData.uploads.facebook}`;
              
            ctx.reply(replyMsg, { parse_mode: 'Markdown' });
          } catch (error) {
            console.error('Error parsing Telegram message:', error);
            ctx.reply(`❌ *Failed to parse report.*\nError: ${error.message}`, { parse_mode: 'Markdown' });
          }
        }
      });

      bot.launch()
        .then(() => console.log('Telegram Bot successfully launched in polling mode.'))
        .catch(err => console.error('Failed to launch Telegraf bot:', err));
        
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
