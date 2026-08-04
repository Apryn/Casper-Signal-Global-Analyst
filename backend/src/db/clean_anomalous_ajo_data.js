import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log('🔄 Cleaning anomalous Ajo live duration data...');

  // 1. Update anomalous daily reports (set live_duration to 2.0)
  const reportRes = await pool.query(`
    UPDATE daily_reports
    SET live_duration = 2.00
    WHERE id IN (433, 338, 197, 171)
    RETURNING id, tanggal::text, live_duration
  `);
  console.log('  Updated daily reports:', reportRes.rows);

  // 2. Update corresponding schedule items (set live_duration to 2.0)
  const scheduleRes = await pool.query(`
    UPDATE schedule
    SET live_duration = 2.00
    WHERE id IN (82, 93, 96)
    RETURNING id, start_time, live_duration
  `);
  console.log('  Updated schedules:', scheduleRes.rows);

  console.log('✅ Clean up completed successfully.');
  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('❌ Clean up failed:', err.message);
  await pool.end();
  process.exit(1);
});
