/**
 * migrate_streamers_chat_id.js
 * 
 * ADDITIVE migration — menambah kolom telegram_chat_id ke tabel streamers
 * agar bot bisa mengirim pengingat secara personal (PC/Japri) bukan ke grup umum.
 * 
 * Run: node backend/src/db/migrate_streamers_chat_id.js
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
    console.log('🔄 Running migration: add telegram_chat_id to streamers...');

    await client.query(`
      ALTER TABLE streamers 
      ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(100);
    `);

    console.log('  ✅ Column telegram_chat_id added successfully.');

    // Verifikasi
    const verifyRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns
      WHERE table_name = 'streamers' AND column_name = 'telegram_chat_id'
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
