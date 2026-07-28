/**
 * migrate_schedule_sick.js
 * 
 * ADDITIVE migration — menambah kolom is_sick ke tabel schedule
 * untuk membedakan izin sakit (tanpa denda) dengan izin biasa (potong gaji).
 * 
 * Run: node backend/src/db/migrate_schedule_sick.js
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
    console.log('🔄 Running migration: add is_sick to schedule...');

    await client.query(`
      ALTER TABLE schedule 
      ADD COLUMN IF NOT EXISTS is_sick BOOLEAN DEFAULT FALSE;
    `);

    console.log('  ✅ Column is_sick added successfully.');

    // Verifikasi
    const verifyRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns
      WHERE table_name = 'schedule' AND column_name = 'is_sick'
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
