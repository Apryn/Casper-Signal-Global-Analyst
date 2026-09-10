import pool from '../config/db.js';

async function migrateTotalUpload() {
  console.log('🔄 Running migration: add total_upload to daily_reports...');

  try {
    // 1. Add total_upload column if not exists
    await pool.query(`
      ALTER TABLE daily_reports 
      ADD COLUMN IF NOT EXISTS total_upload INTEGER DEFAULT 0;
    `);
    console.log('  ✅ Column total_upload added/verified successfully.');

    // 2. Non-destructive backfill: calculate max across platform uploads for existing records
    const backfillRes = await pool.query(`
      UPDATE daily_reports 
      SET total_upload = GREATEST(tiktok_upload, youtube_upload, instagram_upload, facebook_upload)
      WHERE total_upload = 0 OR total_upload IS NULL;
    `);
    console.log(`  ✅ Backfill complete. Updated ${backfillRes.rowCount || 0} rows.`);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrateTotalUpload();
