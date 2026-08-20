import pool from '../config/db.js';

async function migrateSalaryAdjustments() {
  console.log('🔄 Running non-destructive Salary & Penalty Audit migration...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create streamer_salary_adjustments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS streamer_salary_adjustments (
        id SERIAL PRIMARY KEY,
        streamer_id INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
        period_key VARCHAR(50) NOT NULL,
        signal_cut_count INTEGER NOT NULL DEFAULT 0,
        signal_cut_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        custom_bonus NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        custom_deduction NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        notes TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(streamer_id, period_key)
      );
    `);

    await client.query('COMMIT');
    console.log('✅ Table streamer_salary_adjustments created/verified successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateSalaryAdjustments();
