/**
 * migrate_schedule_substitute.js
 * 
 * ADDITIVE migration — menambah kolom substitute_streamer_id ke tabel schedule
 * agar sistem tahu siapa streamer pengganti jika ada streamer asli yang izin/sakit.
 * 
 * Run: node backend/src/db/migrate_schedule_substitute.js
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
    console.log('🔄 Running migration: add substitute_streamer_id to schedule...');

    await client.query(`
      ALTER TABLE schedule 
      ADD COLUMN IF NOT EXISTS substitute_streamer_id INTEGER REFERENCES streamers(id) ON DELETE SET NULL;
    `);

    console.log('  ✅ Column substitute_streamer_id added successfully.');

    // Verifikasi
    const verifyRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns
      WHERE table_name = 'schedule' AND column_name = 'substitute_streamer_id'
    `);
    
    if (verifyRes.rows.length > 0) {
      console.log('📋 Verification check passed! column exists.');
    } else {
      console.log('❌ Verification check failed! column missing.');
    }

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
};

run();
