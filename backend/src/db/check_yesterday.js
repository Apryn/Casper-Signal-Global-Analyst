import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkYesterdayReports() {
  const dateStr = '2026-08-04';
  console.log(`=== DAILY REPORTS YESTERDAY (${dateStr}) ===\n`);

  const reportsRes = await pool.query(`
    SELECT dr.id, dr.streamer_id, dr.live_duration, dr.raw_message, s.nama
    FROM daily_reports dr
    JOIN streamers s ON dr.streamer_id = s.id
    WHERE dr.tanggal = $1
    ORDER BY s.nama ASC
  `, [dateStr]);

  for (const r of reportsRes.rows) {
    console.log(`[Streamer: ${r.nama} (ID: ${r.streamer_id})]`);
    console.log(`  Live Duration in DB: ${r.live_duration} jam`);
    console.log(`  Has raw_message: ${!!r.raw_message}`);
  }

  console.log(`\n=== CALCULATED FROM SCHEDULE FOR ${dateStr} ===\n`);
  const scheduleRes = await pool.query(`
    SELECT 
      COALESCE(sc.substitute_streamer_id, sc.streamer_id) as target_streamer_id,
      s.nama,
      SUM(COALESCE(sc.live_duration, 0)) as calculated_live_duration
    FROM schedule sc
    JOIN streamers s ON COALESCE(sc.substitute_streamer_id, sc.streamer_id) = s.id
    WHERE DATE(COALESCE(sc.actual_start_time, sc.start_time) AT TIME ZONE 'Asia/Jakarta') = $1
      AND sc.status = 'Completed'
    GROUP BY COALESCE(sc.substitute_streamer_id, sc.streamer_id), s.nama
    ORDER BY s.nama ASC
  `, [dateStr]);

  for (const row of scheduleRes.rows) {
    console.log(`Streamer ${row.nama} (ID: ${row.target_streamer_id}): ${row.calculated_live_duration} jam`);
  }

  await pool.end();
}

checkYesterdayReports().catch(console.error);
