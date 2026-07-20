/**
 * migrate_live_tracking.js
 * 
 * ADDITIVE migration — tidak menghapus atau mengubah data yang sudah ada.
 * Menambahkan kolom-kolom baru untuk:
 *  1. YouTube Channel ID per akun streamer
 *  2. Tracking aktual waktu live (actual_start_time, actual_end_time, lateness)
 *  3. Pre-live promo submission flag per jadwal
 *  4. Content recap submission flag per laporan harian
 * 
 * Run: node backend/src/db/migrate_live_tracking.js
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

const migrations = [
  // ── streamer_accounts: tambah channel_id untuk YouTube ──
  {
    name: 'streamer_accounts.channel_id',
    sql: `ALTER TABLE streamer_accounts ADD COLUMN IF NOT EXISTS channel_id VARCHAR(100);`,
  },

  // ── schedule: tambah kolom tracking aktual live ──
  {
    name: 'schedule.actual_start_time',
    sql: `ALTER TABLE schedule ADD COLUMN IF NOT EXISTS actual_start_time TIMESTAMP WITH TIME ZONE;`,
  },
  {
    name: 'schedule.actual_end_time',
    sql: `ALTER TABLE schedule ADD COLUMN IF NOT EXISTS actual_end_time TIMESTAMP WITH TIME ZONE;`,
  },
  {
    name: 'schedule.lateness_minutes',
    sql: `ALTER TABLE schedule ADD COLUMN IF NOT EXISTS lateness_minutes INTEGER DEFAULT 0;`,
  },
  {
    name: 'schedule.pre_live_submitted',
    sql: `ALTER TABLE schedule ADD COLUMN IF NOT EXISTS pre_live_submitted BOOLEAN DEFAULT FALSE;`,
  },

  // ── daily_reports: tambah kolom content recap ──
  {
    name: 'daily_reports.content_submitted',
    sql: `ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS content_submitted BOOLEAN DEFAULT FALSE;`,
  },
  {
    name: 'daily_reports.content_link',
    sql: `ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS content_link TEXT;`,
  },

  // ── Index baru untuk query YouTube detection yang efisien ──
  {
    name: 'idx_streamer_accounts_channel_id',
    sql: `CREATE INDEX IF NOT EXISTS idx_streamer_accounts_channel_id ON streamer_accounts(channel_id) WHERE channel_id IS NOT NULL;`,
  },
  {
    name: 'idx_schedule_status_start',
    sql: `CREATE INDEX IF NOT EXISTS idx_schedule_status_start ON schedule(status, start_time);`,
  },
];

const run = async () => {
  const client = await pool.connect();
  try {
    console.log('🔄 Running live tracking migration...\n');

    for (const migration of migrations) {
      try {
        await client.query(migration.sql);
        console.log(`  ✅ ${migration.name}`);
      } catch (err) {
        // Kolom sudah ada atau constraint sudah ada → skip dengan aman
        if (err.code === '42701' || err.code === '42710') {
          console.log(`  ⏭️  ${migration.name} (already exists, skipped)`);
        } else {
          console.error(`  ❌ ${migration.name}: ${err.message}`);
          throw err;
        }
      }
    }

    // Verifikasi hasil
    console.log('\n📋 Verifying migration results...');

    const verifySchedule = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'schedule'
        AND column_name IN ('actual_start_time', 'actual_end_time', 'lateness_minutes', 'pre_live_submitted')
    `);
    console.log(`  schedule columns added: ${verifySchedule.rows.map(r => r.column_name).join(', ')}`);

    const verifyReports = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'daily_reports'
        AND column_name IN ('content_submitted', 'content_link')
    `);
    console.log(`  daily_reports columns added: ${verifyReports.rows.map(r => r.column_name).join(', ')}`);

    const verifyAccounts = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'streamer_accounts'
        AND column_name = 'channel_id'
    `);
    console.log(`  streamer_accounts columns added: ${verifyAccounts.rows.map(r => r.column_name).join(', ')}`);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Isi channel_id di tabel streamer_accounts untuk akun YouTube');
    console.log('   2. Tambahkan YOUTUBE_API_KEY ke file .env');
    console.log('   3. Restart backend server');
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
