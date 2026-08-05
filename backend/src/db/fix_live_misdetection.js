/**
 * fix_live_misdetection.js
 * 
 * Memperbaiki kesalahan deteksi live:
 * - Jadwal #143 salah di-assign ke BG Chenn dengan video 4VyzjpxMACo
 *   (video LCK esports asing, bukan live Brayy)
 * - Yang sebenarnya live: Brayy dengan video _cLIlHRcZRA
 * 
 * FIX:
 * 1. Update schedule #143 → streamer_id = Brayy, live_link = _cLIlHRcZRA
 * 2. Update live_viewer_history schedule #143 → streamer_id = Brayy
 * 3. Log semua perubahan (non-destructive: tidak hapus data, hanya update)
 */

import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = (sql, params) => pool.query(sql, params);

const CORRECT_VIDEO_ID = '_cLIlHRcZRA';
const WRONG_VIDEO_ID   = '4VyzjpxMACo';
const SCHEDULE_ID      = 143;

async function main() {
  console.log('=== FIX LIVE MISDETECTION ===\n');

  // 1. Ambil data streamer Brayy
  const brayRes = await db(`SELECT id, nama FROM streamers WHERE nama ILIKE '%bray%' LIMIT 1`);
  if (brayRes.rows.length === 0) {
    console.error('❌ Streamer Brayy tidak ditemukan di DB!');
    await pool.end(); process.exit(1);
  }
  const brayy = brayRes.rows[0];
  console.log(`✅ Brayy ditemukan: ID=${brayy.id}, nama="${brayy.nama}"`);

  // 2. Ambil data BG Chenn (untuk verifikasi)
  const chennRes = await db(`SELECT id, nama FROM streamers WHERE nama ILIKE '%chenn%' LIMIT 1`);
  const chenn = chennRes.rows[0];
  console.log(`✅ BG Chenn ditemukan: ID=${chenn?.id}, nama="${chenn?.nama}"`);

  // 3. Cek kondisi jadwal #143 sebelum fix
  const beforeRes = await db(`SELECT * FROM schedule WHERE id = $1`, [SCHEDULE_ID]);
  const before = beforeRes.rows[0];
  if (!before) {
    console.error(`❌ Jadwal #${SCHEDULE_ID} tidak ditemukan!`);
    await pool.end(); process.exit(1);
  }
  console.log(`\n--- Kondisi jadwal #${SCHEDULE_ID} SEBELUM fix ---`);
  console.log(`  streamer_id    : ${before.streamer_id}`);
  console.log(`  status         : ${before.status}`);
  console.log(`  live_link      : ${before.live_link}`);
  console.log(`  actual_start   : ${before.actual_start_time}`);

  // 4. Update jadwal #143
  console.log(`\n🔧 Update jadwal #${SCHEDULE_ID}: streamer → Brayy (${brayy.id}), link → ${CORRECT_VIDEO_ID}...`);
  await db(
    `UPDATE schedule
     SET streamer_id         = $1,
         live_link           = $2,
         substitute_streamer_id = NULL
     WHERE id = $3`,
    [brayy.id, `https://www.youtube.com/watch?v=${CORRECT_VIDEO_ID}`, SCHEDULE_ID]
  );
  console.log(`  ✅ Jadwal #${SCHEDULE_ID} diperbarui.`);

  // 5. Update live_viewer_history yang salah dicatat ke BG Chenn
  const histBefore = await db(
    `SELECT COUNT(*) as cnt FROM live_viewer_history WHERE schedule_id = $1`,
    [SCHEDULE_ID]
  );
  console.log(`\n🔧 Live viewer history untuk schedule #${SCHEDULE_ID}: ${histBefore.rows[0].cnt} record(s).`);

  const histUpdate = await db(
    `UPDATE live_viewer_history
     SET streamer_id = $1
     WHERE schedule_id = $2
       AND streamer_id = $3`,
    [brayy.id, SCHEDULE_ID, chenn?.id]
  );
  console.log(`  ✅ ${histUpdate.rowCount} record viewer history di-update ke Brayy.`);

  // 6. Verifikasi setelah fix
  const afterRes = await db(`SELECT * FROM schedule WHERE id = $1`, [SCHEDULE_ID]);
  const after = afterRes.rows[0];
  console.log(`\n--- Kondisi jadwal #${SCHEDULE_ID} SESUDAH fix ---`);
  console.log(`  streamer_id    : ${after.streamer_id}`);
  console.log(`  status         : ${after.status}`);
  console.log(`  live_link      : ${after.live_link}`);
  console.log(`  actual_start   : ${after.actual_start_time}`);

  console.log('\n=== SELESAI — semua data diperbaiki tanpa kehilangan history ===');
  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
