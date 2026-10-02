import pool from '../config/db.js';

async function migrateMessDeduction() {
  console.log('🔄 Running non-destructive Mess Deduction migration...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add mess_deduction column to payroll_items if not exists
    await client.query(`
      ALTER TABLE payroll_items 
      ADD COLUMN IF NOT EXISTS mess_deduction NUMERIC(15,2) NOT NULL DEFAULT 0.00;
    `);

    // Add default_mess_deduction column to payroll_profiles if not exists
    await client.query(`
      ALTER TABLE payroll_profiles 
      ADD COLUMN IF NOT EXISTS default_mess_deduction NUMERIC(15,2) NOT NULL DEFAULT 0.00;
    `);

    await client.query('COMMIT');
    console.log('✅ Columns mess_deduction on payroll_items and default_mess_deduction on payroll_profiles added successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateMessDeduction();
