import pool from '../config/db.js';

export async function runMigration() {
  console.log('🔄 Running migration: split Key Team and Oky Pratama profiles & items...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update Profile ID 2 to 'Key Team'
    await client.query(`
      UPDATE payroll_profiles 
      SET name = 'Key Team', 
          bank_name = 'Mandiri', 
          bank_account_number = '1060022156296', 
          bank_account_holder = 'REYHAN OTAMA TEIZZA'
      WHERE id = 2 OR LOWER(name) LIKE '%key team + oky%' OR LOWER(name) LIKE '%key team + oky pra%'
    `);

    // 2. Check if 'Oky Pratama' profile exists, if not insert it
    const okyProfileCheck = await client.query("SELECT * FROM payroll_profiles WHERE LOWER(TRIM(name)) = 'oky pratama' OR LOWER(TRIM(name)) = 'oky pra'");
    let okyProfileId;
    if (okyProfileCheck.rows.length === 0) {
      const insRes = await client.query(`
        INSERT INTO payroll_profiles (name, role, streamer_id, bank_name, bank_account_number, bank_account_holder, salary_15, salary_1, is_active, notes)
        VALUES ('Oky Pratama', 'Streamer', NULL, 'Mandiri', '1060022156296', 'REYHAN OTAMA TEIZZA', 1000000.00, 2000000.00, TRUE, 'Transfer via rek Mandiri Reyhan')
        RETURNING id
      `);
      okyProfileId = insRes.rows[0].id;
      console.log('✅ Created Oky Pratama profile with ID:', okyProfileId);
    } else {
      okyProfileId = okyProfileCheck.rows[0].id;
      await client.query(`
        UPDATE payroll_profiles 
        SET name = 'Oky Pratama', 
            bank_name = 'Mandiri', 
            bank_account_number = '1060022156296', 
            bank_account_holder = 'REYHAN OTAMA TEIZZA'
        WHERE id = $1
      `, [okyProfileId]);
      console.log('✅ Updated Oky Pratama profile ID:', okyProfileId);
    }

    // 3. Update existing payroll_items: rename 'Key Team + Oky Pra' to 'Key Team'
    await client.query(`
      UPDATE payroll_items 
      SET recipient_name = 'Key Team',
          bank_name = 'Mandiri',
          bank_account_number = '1060022156296',
          bank_account_holder = 'REYHAN OTAMA TEIZZA'
      WHERE LOWER(recipient_name) LIKE '%key team + oky%' OR LOWER(recipient_name) LIKE '%key team + oky pra%'
    `);

    // 4. Ensure every period that has 'Key Team' also has an 'Oky Pratama' item
    const periodsWithKeyTeam = await client.query(`
      SELECT DISTINCT period_id, base_amount, status 
      FROM payroll_items 
      WHERE recipient_name = 'Key Team'
    `);

    for (const p of periodsWithKeyTeam.rows) {
      const okyItemCheck = await client.query(`
        SELECT id FROM payroll_items 
        WHERE period_id = $1 AND (LOWER(recipient_name) = 'oky pratama' OR LOWER(recipient_name) = 'oky pra')
      `, [p.period_id]);

      if (okyItemCheck.rows.length === 0) {
        await client.query(`
          INSERT INTO payroll_items (
            period_id, profile_id, recipient_name, role, 
            bank_name, bank_account_number, bank_account_holder, 
            base_amount, bonus_amount, deduction_amount, final_amount, 
            status, notes
          )
          VALUES (
            $1, $2, 'Oky Pratama', 'Streamer',
            'Mandiri', '1060022156296', 'REYHAN OTAMA TEIZZA',
            $3, 0.00, 0.00, $3,
            $4, 'Transfer gabung rek Mandiri Reyhan'
          )
        `, [p.period_id, okyProfileId, p.base_amount || 2000000.00, p.status || 'Pending']);
        console.log(`✅ Added Oky Pratama item to period ${p.period_id}`);
      }
    }

    await client.query('COMMIT');
    console.log('✅ Migration completed: Key Team and Oky Pratama successfully separated!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith('split_key_team_oky_pratama.js')) {
  runMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}
