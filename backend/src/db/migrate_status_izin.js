import pool from '../config/db.js';

async function migrateStatusIzin() {
  console.log('🔄 Running migration: add status_izin and catatan_izin to daily_reports...');

  try {
    await pool.query(`
      ALTER TABLE daily_reports 
      ADD COLUMN IF NOT EXISTS status_izin VARCHAR(50) DEFAULT 'Normal',
      ADD COLUMN IF NOT EXISTS catatan_izin TEXT;
    `);
    console.log('  ✅ Columns status_izin and catatan_izin added successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrateStatusIzin();
