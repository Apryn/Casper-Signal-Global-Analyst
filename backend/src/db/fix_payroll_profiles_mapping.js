import pool from '../config/db.js';

export async function runMigration() {
  console.log('🔄 Running migration: fix_payroll_profiles_mapping...');
  const client = await pool.connect();
  try {
    // 1. Sync sequence for payroll_profiles
    await client.query(`SELECT setval('payroll_profiles_id_seq', COALESCE((SELECT MAX(id) FROM payroll_profiles), 1))`);

    // 2. If id 11 has name 'Laflanca' with null bank, update to Ratu
    const ratuCheck = await client.query("SELECT * FROM payroll_profiles WHERE LOWER(name) = 'ratu'");
    if (ratuCheck.rows.length === 0) {
      await client.query(`
        UPDATE payroll_profiles 
        SET name = 'Ratu', streamer_id = 4, bank_name = 'BSI', salary_15 = 1000000.00, salary_1 = 2000000.00
        WHERE id = 11
      `);
    }

    // 3. Update streamer_id on all payroll_profiles to accurately match streamers by name
    const streamers = await client.query('SELECT id, nama FROM streamers ORDER BY id ASC');
    for (const s of streamers.rows) {
      if (s.nama.toLowerCase() === 'teizza') {
        await client.query(`
          UPDATE payroll_profiles 
          SET streamer_id = $1 
          WHERE LOWER(TRIM(name)) = 'teizza' OR LOWER(name) LIKE '%key team%' OR LOWER(name) LIKE '%teizza%'
        `, [s.id]);
      } else {
        await client.query(`
          UPDATE payroll_profiles 
          SET streamer_id = $1 
          WHERE LOWER(TRIM(name)) = LOWER(TRIM($2))
        `, [s.id, s.nama]);
      }
    }

    console.log('✅ Payroll profiles mapping fixed successfully.');
  } catch (err) {
    console.error('❌ Error fixing payroll profiles mapping:', err);
  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith('fix_payroll_profiles_mapping.js')) {
  runMigration().then(() => process.exit(0));
}
