import pool from '../config/db.js';

async function migrateLateRecap() {
  console.log('🔄 Running non-destructive Late Recap migration...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add late_recap_count and late_recap_amount columns if not exists
    await client.query(`
      ALTER TABLE streamer_salary_adjustments 
      ADD COLUMN IF NOT EXISTS late_recap_count INTEGER DEFAULT NULL;
    `);

    await client.query(`
      ALTER TABLE streamer_salary_adjustments 
      ADD COLUMN IF NOT EXISTS late_recap_amount NUMERIC(15,2) DEFAULT NULL;
    `);

    await client.query('COMMIT');
    console.log('✅ Columns late_recap_count and late_recap_amount added successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateLateRecap();
