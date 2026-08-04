/**
 * migrate_live_detection_buffer.js
 * 
 * Membuat tabel live_detection_buffer untuk menyimpan 2-strike confirmation state secara persisten.
 * Sebelumnya menggunakan in-memory Map yang hilang setiap kali PM2/server restart.
 * Dengan tabel ini, state bertahan meski server restart.
 */

import pool from '../config/db.js';

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Tabel untuk persistent 2-strike confirmation buffer
    await client.query(`
      CREATE TABLE IF NOT EXISTS live_detection_buffer (
        channel_id    VARCHAR(100) PRIMARY KEY,
        video_id      VARCHAR(50)  NOT NULL,
        display_name  VARCHAR(255) NOT NULL,
        first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Index untuk cleanup otomatis entry yang sudah terlalu lama
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_live_detection_buffer_first_seen 
      ON live_detection_buffer(first_seen_at)
    `);

    await client.query('COMMIT');
    console.log('[Migration] ✅ Tabel live_detection_buffer berhasil dibuat/diverifikasi.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration] ❌ Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
