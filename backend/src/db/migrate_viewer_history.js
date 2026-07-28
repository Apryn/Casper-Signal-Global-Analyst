/**
 * migrate_viewer_history.js
 * 
 * ADDITIVE migration — membuat tabel live_viewer_history
 * untuk mencatat data time-series jumlah penonton live stream (YouTube & TikTok)
 * agar admin bisa menganalisis jam tayang teramai.
 * 
 * Run: node backend/src/db/migrate_viewer_history.js
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const run = async () => {
  const client = await pool.connect();
  try {
    console.log('🔄 Running migration: create live_viewer_history table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS live_viewer_history (
        id SERIAL PRIMARY KEY,
        schedule_id INTEGER REFERENCES schedule(id) ON DELETE CASCADE,
        streamer_id INTEGER REFERENCES streamers(id) ON DELETE CASCADE,
        platform VARCHAR(20) NOT NULL,
        viewer_count INTEGER NOT NULL DEFAULT 0,
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('  ✅ Table live_viewer_history created/verified successfully.');

    // Verifikasi kolom
    const verifyRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables
      WHERE table_name = 'live_viewer_history'
    `);
    
    if (verifyRes.rows.length > 0) {
      console.log('📋 Verification check passed! table exists.');
    } else {
      console.log('❌ Verification check failed! table missing.');
    }

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
};

run();
