/**
 * migrate_schedule_templates.js
 * 
 * Tambah tabel schedule_templates — jadwal tetap per streamer.
 * Admin input sekali, cron otomatis generate entri harian ke tabel schedule.
 * 
 * Run: node backend/src/db/migrate_schedule_templates.js
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
    console.log('🔄 Creating schedule_templates table...\n');

    // Tabel utama template jadwal
    await client.query(`
      CREATE TABLE IF NOT EXISTS schedule_templates (
        id SERIAL PRIMARY KEY,
        streamer_id INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
        platform VARCHAR(100) NOT NULL DEFAULT 'YouTube',
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        -- Array hari aktif: 0=Minggu, 1=Senin, ..., 6=Sabtu
        -- Default: aktif tiap hari
        days_of_week INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        sesi INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_streamer_sesi UNIQUE (streamer_id, sesi)
      )
    `);
    console.log('  ✅ Tabel schedule_templates dibuat');

    // Index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_schedule_templates_streamer
        ON schedule_templates(streamer_id)
        WHERE is_active = TRUE
    `);
    console.log('  ✅ Index idx_schedule_templates_streamer dibuat');

    // Verifikasi
    const verifyRes = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'schedule_templates'
      ORDER BY ordinal_position
    `);
    console.log('\n📋 Kolom schedule_templates:');
    verifyRes.rows.forEach(r => console.log(`  ${r.column_name.padEnd(20)} ${r.data_type}`));

    console.log('\n✅ Migration schedule_templates selesai!');
  } catch (err) {
    if (err.code === '42P07') {
      console.log('  ⏭️  Tabel schedule_templates sudah ada, skipped.');
    } else {
      console.error('❌ Error:', err.message);
      throw err;
    }
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
