import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function inspectDailyReportsDetail() {
  const todayStr = '2026-08-05';
  console.log(`=== FULL DETAIL DAILY REPORTS (2026-08-05) ===\n`);

  const res = await pool.query(`
    SELECT dr.*, s.nama
    FROM daily_reports dr
    JOIN streamers s ON dr.streamer_id = s.id
    WHERE dr.tanggal = $1
    ORDER BY s.nama ASC
  `, [todayStr]);

  for (const r of res.rows) {
    console.log(JSON.stringify(r, null, 2));
  }

  await pool.end();
}

inspectDailyReportsDetail().catch(console.error);
