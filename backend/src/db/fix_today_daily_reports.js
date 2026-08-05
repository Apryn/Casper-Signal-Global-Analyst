/**
 * fix_today_daily_reports.js
 * 
 * Memperbaiki akumulasi live_duration pada daily_reports hari ini (2026-08-05)
 * akibat false schedules yang sempat terakumulasi sebelum di-cancel.
 * 
 * Non-destructive: Hanya meng-update kolom live_duration sesuai durasi sesi Completed yang valid.
 */

import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fixDailyReportsToday() {
  const todayStr = '2026-08-05';
  console.log(`=== FIXING DAILY REPORTS HARI INI (${todayStr}) ===\n`);

  // 1. Update Ajo (ID: 9) -> 4.76 jam (dari schedule #132)
  const resAjo = await pool.query(`
    UPDATE daily_reports
    SET live_duration = 4.76
    WHERE streamer_id = 9 AND tanggal = $1
    RETURNING id, streamer_id, live_duration
  `, [todayStr]);
  console.log(`✅ Ajo (ID 9) updated live_duration: ${resAjo.rows[0]?.live_duration || 'not found'}`);

  // 2. Update Aline (ID: 7) -> 4.94 jam (dari schedule #130)
  const resAline = await pool.query(`
    UPDATE daily_reports
    SET live_duration = 4.94
    WHERE streamer_id = 7 AND tanggal = $1
    RETURNING id, streamer_id, live_duration
  `, [todayStr]);
  console.log(`✅ Aline (ID 7) updated live_duration: ${resAline.rows[0]?.live_duration || 'not found'}`);

  // 3. Update BG Chenn (ID: 5) -> 0.00 jam (karena schedule #134 cancelled)
  const resChenn = await pool.query(`
    UPDATE daily_reports
    SET live_duration = 0.00
    WHERE streamer_id = 5 AND tanggal = $1
    RETURNING id, streamer_id, live_duration
  `, [todayStr]);
  console.log(`✅ BG Chenn (ID 5) updated live_duration: ${resChenn.rows[0]?.live_duration || 'not found'}`);

  console.log('\n=== VERIFIKASI SELESAI ===');
  const verifyRes = await pool.query(`
    SELECT dr.id, s.nama, dr.live_duration, dr.tanggal
    FROM daily_reports dr
    JOIN streamers s ON dr.streamer_id = s.id
    WHERE dr.tanggal = $1
    ORDER BY s.nama ASC
  `, [todayStr]);

  for (const r of verifyRes.rows) {
    console.log(`- ${r.nama}: ${r.live_duration} jam`);
  }

  await pool.end();
}

fixDailyReportsToday().catch(console.error);
