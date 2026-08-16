import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

async function migrateFinance() {
  console.log('🔄 Running non-destructive Finance & Payroll database migration...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 0. Ensure config table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS config (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table config verified/created.');

    // 1. Create payroll_profiles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payroll_profiles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(100) NOT NULL DEFAULT 'Streamer',
        streamer_id INTEGER REFERENCES streamers(id) ON DELETE SET NULL,
        bank_name VARCHAR(100) DEFAULT 'BCA',
        bank_account_number VARCHAR(100),
        bank_account_holder VARCHAR(255),
        salary_15 NUMERIC(15,2) NOT NULL DEFAULT 1000000.00,
        salary_1 NUMERIC(15,2) NOT NULL DEFAULT 2000000.00,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table payroll_profiles verified/created.');

    // 2. Create payroll_periods table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payroll_periods (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        period_type VARCHAR(50) NOT NULL CHECK (period_type IN ('15th', '1st')),
        period_date DATE NOT NULL,
        total_recipients INTEGER NOT NULL DEFAULT 0,
        total_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        status VARCHAR(50) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Archived')),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table payroll_periods verified/created.');

    // 3. Create payroll_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payroll_items (
        id SERIAL PRIMARY KEY,
        period_id INTEGER NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
        profile_id INTEGER REFERENCES payroll_profiles(id) ON DELETE SET NULL,
        recipient_name VARCHAR(255) NOT NULL,
        role VARCHAR(100) NOT NULL DEFAULT 'Streamer',
        bank_name VARCHAR(100),
        bank_account_number VARCHAR(100),
        bank_account_holder VARCHAR(255),
        base_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        bonus_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        deduction_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        final_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Paid')),
        paid_at TIMESTAMP WITH TIME ZONE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table payroll_items verified/created.');

    // 4. Create cash_transactions table (Uang Kas & Pengeluaran)
    await client.query(`
      CREATE TABLE IF NOT EXISTS cash_transactions (
        id SERIAL PRIMARY KEY,
        tanggal DATE NOT NULL,
        tipe VARCHAR(20) NOT NULL CHECK (tipe IN ('Masuk', 'Keluar')),
        kategori VARCHAR(100) NOT NULL DEFAULT 'Operasional',
        nominal NUMERIC(15,2) NOT NULL,
        keterangan TEXT,
        created_by VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table cash_transactions verified/created.');

    // 5. Setup default Payroll PIN in config if not set (default: 888888)
    const salt = await bcrypt.genSalt(10);
    const defaultPinHash = await bcrypt.hash('888888', salt);

    await client.query(`
      INSERT INTO config (key, value)
      VALUES ('payroll_pin_hash', $1)
      ON CONFLICT (key) DO NOTHING;
    `, [defaultPinHash]);
    console.log('✅ Default Payroll PIN hash verified (Default PIN: 888888).');

    // 6. Auto populate existing streamers into payroll_profiles if empty
    const countProfilesRes = await client.query('SELECT COUNT(*) FROM payroll_profiles');
    if (parseInt(countProfilesRes.rows[0].count, 10) === 0) {
      console.log('Populating initial payroll profiles from streamers table...');
      const streamersRes = await client.query('SELECT id, nama FROM streamers ORDER BY id ASC');
      for (const s of streamersRes.rows) {
        await client.query(`
          INSERT INTO payroll_profiles (name, role, streamer_id, salary_15, salary_1)
          VALUES ($1, 'Streamer', $2, 1000000.00, 2000000.00)
        `, [s.nama, s.id]);
      }
      console.log(`✅ Seeded ${streamersRes.rows.length} streamers into payroll profiles.`);
    }

    await client.query('COMMIT');
    console.log('🎉 Finance & Payroll migration successfully finished without any data loss!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateFinance();
