import pg from 'pg';

pg.Pool = class MockPool {
  on() {}
  async query(text, params) {
    if (text.includes('SELECT id FROM streamers')) {
      return { rows: [{ id: 42 }] };
    }
    return { rows: [{ id: 100, nama: 'Ajo' }] };
  }
};

import { parseMessageText } from './services/telegram.service.js';

const sampleReport = `[10/07/2026 03.12] Ajo Candle: ? Laporan Berhasil Diproses!

?? Streamer: Ajo ??
?? Tanggal: 2026-07-09
??? Kategori: Streaming

?? Metrics:
• Live: 6 jam
• Chat: 0
• Registrasi: 0
• FTD: 2

?? Upload Konten:
- TikTok : 2`;

const run = async () => {
  try {
    const result = await parseMessageText(sampleReport);
    console.log('RESULT:' + JSON.stringify(result.parsedData, null, 2));
  } catch (error) {
    console.error('ERROR_MESSAGE:', error.message);
  }
};

run();
