import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkTodayReports() {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  console.log(`=== DAILY REPORTS HARI INI (${todayStr}) ===\n`);
  
  const reportsRes = await pool.query(`
    SELECT dr.*, s.nama
    FROM daily_reports dr
    JOIN streamers s ON dr.streamer_id = s.id
    WHERE dr.tanggal = $1
    ORDER BY s.nama ASC
  `, [todayStr]);

  console.log(`Ditemukan ${reportsRes.rows.length} record daily_reports:\n`);
  for (const r of reportsRes.rows) {
    console.log(`[Streamer: ${r.nama} (ID: ${r.streamer_id})]`);
    console.log(`  Kategori: ${r.kategori}`);
    console.log(`  Live Duration: ${r.live_duration} jam`);
    console.log(`  Uploads -> TikTok: ${r.tiktok_upload}, YT: ${r.youtube_upload}, IG: ${r.instagram_upload}, FB: ${r.facebook_upload}`);
    console.log(`  Metrics -> Chat: ${r.chat_count}, Reg: ${r.registration_count}, FTD: ${r.ftd_count}`);
    console.log(`  Raw message: ${r.raw_message ? r.raw_message.substring(0, 50) + '...' : '(null)'}`);
    console.log('---');
  }

  console.log(`\n=== TOTAL DURASI LIVE DI SCHEDULE HARI INI (${todayStr}) ===\n`);
  const scheduleDurRes = await pool.query(`
    SELECT 
      COALESCE(sc.substitute_streamer_id, sc.streamer_id) as target_streamer_id,
      s.nama,
      SUM(COALESCE(sc.live_duration, 0)) as calculated_live_duration,
      COUNT(sc.id) as live_count
    FROM schedule sc
    JOIN streamers s ON COALESCE(sc.substitute_streamer_id, sc.streamer_id) = s.id
    WHERE DATE(COALESCE(sc.actual_start_time, sc.start_time) AT TIME ZONE 'Asia/Jakarta') = $1
      AND sc.status = 'Completed'
    GROUP BY COALESCE(sc.substitute_streamer_id, sc.streamer_id), s.nama
    ORDER BY s.nama ASC
  `, [todayStr]);

  for (const row of scheduleDurRes.rows) {
    console.log(`Streamer ${row.nama} (ID: ${row.target_streamer_id}): ${row.calculated_live_duration} jam dari ${row.live_count} sesi Completed`);
  }

  await pool.end();
}

checkTodayReports().catch(console.error);
