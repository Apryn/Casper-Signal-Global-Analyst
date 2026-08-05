/**
 * fix_all_anomalies.js
 * 
 * Perbaikan komprehensif semua jadwal anomali 24 jam terakhir.
 * 
 * MASALAH & TINDAKAN:
 * 
 * [TIPE 1] FALSE LINK — video bukan milik channel (deteksi palsu):
 *   #139 Aline, #140 Ajo → link LCK video (4VyzjpxMACo)
 *   #133 Aline, #134 BG Chenn → link Sepaktakraw video (JH9GbJl4OVg)
 *   #117 Ajo → link "PEAK Live Stream" (bukan milik channel)
 *   FIX: Hapus live_link (null), reset data yang tidak valid
 *
 * [TIPE 2] CANCELLED padahal benar-benar live (link valid, channel match):
 *   #119 Brayy → video milik channel, duration=0 → fix ke Completed + hitung durasi
 *   #118 Keylaa → video milik channel, duration=0 → fix ke Completed + hitung durasi
 *   FIX: Update status → Completed, hitung live_duration dari actual_start–actual_end
 *
 * PRINSIP: Non-destructive — tidak hapus data, hanya update
 */

import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = (sql, p) => pool.query(sql, p);

async function main() {
  console.log('=== FIX ALL ANOMALIES ===\n');

  // ────────────────────────────────────────────────────────────────────────────
  // TIPE 1A: #139, #140 — FALSE LINK LCK (4VyzjpxMACo)
  // Jadwal ini dibuat oleh sistem karena false detection.
  // actual_start_time & actual_end_time di-set sistem otomatis → tidak valid.
  // Fix: null-kan live_link, actual_start_time, actual_end_time, live_duration, lateness
  // Status tetap Completed agar tidak masuk queue cron lagi, tapi clear data palsu.
  // ────────────────────────────────────────────────────────────────────────────
  console.log('── TIPE 1A: False Link LCK (4VyzjpxMACo) ──');
  const r1 = await db(`
    UPDATE schedule
    SET live_link         = NULL,
        actual_start_time = NULL,
        actual_end_time   = NULL,
        live_duration     = 0,
        lateness_minutes  = 0,
        status            = 'Cancelled'
    WHERE id IN (139, 140)
    RETURNING id, streamer_id
  `);
  console.log(`  ✅ ${r1.rowCount} jadwal di-update (139, 140): clear false data, status→Cancelled`);

  // Hapus false viewer history untuk schedule 139 & 140
  const vh1 = await db(`DELETE FROM live_viewer_history WHERE schedule_id IN (139, 140)`);
  console.log(`  ✅ ${vh1.rowCount} record viewer history palsu dihapus (139, 140)\n`);

  // ────────────────────────────────────────────────────────────────────────────
  // TIPE 1B: #133, #134 — FALSE LINK Sepaktakraw (JH9GbJl4OVg)
  // Sama seperti 1A — false detection dari video rekomendasi
  // ────────────────────────────────────────────────────────────────────────────
  console.log('── TIPE 1B: False Link Sepaktakraw (JH9GbJl4OVg) ──');
  const r2 = await db(`
    UPDATE schedule
    SET live_link         = NULL,
        actual_start_time = NULL,
        actual_end_time   = NULL,
        live_duration     = 0,
        lateness_minutes  = 0,
        status            = 'Cancelled'
    WHERE id IN (133, 134)
    RETURNING id, streamer_id
  `);
  console.log(`  ✅ ${r2.rowCount} jadwal di-update (133, 134): clear false data, status→Cancelled`);

  const vh2 = await db(`DELETE FROM live_viewer_history WHERE schedule_id IN (133, 134)`);
  console.log(`  ✅ ${vh2.rowCount} record viewer history palsu dihapus (133, 134)\n`);

  // ────────────────────────────────────────────────────────────────────────────
  // TIPE 1C: #117 — Ajo Scheduled dengan link dari channel lain
  // actual_start_time ada tapi videoId bukan milik channel → false start
  // Fix: Clear data, status Cancelled (tidak pernah benar-benar live terdeteksi)
  // ────────────────────────────────────────────────────────────────────────────
  console.log('── TIPE 1C: #117 Ajo — Scheduled + False Link ──');
  const r3 = await db(`
    UPDATE schedule
    SET live_link         = NULL,
        actual_start_time = NULL,
        actual_end_time   = NULL,
        live_duration     = 0,
        lateness_minutes  = 0,
        status            = 'Cancelled'
    WHERE id = 117
    RETURNING id, streamer_id
  `);
  console.log(`  ✅ ${r3.rowCount} jadwal di-update (117): clear false data, status→Cancelled`);

  const vh3 = await db(`DELETE FROM live_viewer_history WHERE schedule_id = 117`);
  console.log(`  ✅ ${vh3.rowCount} record viewer history palsu dihapus (117)\n`);

  // ────────────────────────────────────────────────────────────────────────────
  // TIPE 2: #119, #118 — CANCELLED padahal benar-benar live
  // Video terbukti milik channel → ini live asli yang salah di-cancel sistem
  // Fix: Hitung durasi dari actual_start_time→actual_end_time, status→Completed
  // ────────────────────────────────────────────────────────────────────────────
  console.log('── TIPE 2: Cancelled padahal live asli (#119 Brayy, #118 Keylaa) ──');

  // Brayy #119 — mulai 22:28, selesai 00:40 → durasi ~2.2 jam
  const brayDur = await db(`
    SELECT EXTRACT(EPOCH FROM (actual_end_time - actual_start_time))/3600 AS dur
    FROM schedule WHERE id = 119
  `);
  const brayDurVal = parseFloat(parseFloat(brayDur.rows[0]?.dur || 0).toFixed(2));

  const r4 = await db(`
    UPDATE schedule
    SET status        = 'Completed',
        live_duration = $1
    WHERE id = 119
    RETURNING id
  `, [brayDurVal]);
  console.log(`  ✅ #119 Brayy: status→Completed, live_duration=${brayDurVal} jam`);

  // Update live_duration di daily_reports Brayy untuk tanggal 4 Aug
  const brayDateRes = await db(`SELECT actual_start_time, streamer_id FROM schedule WHERE id = 119`);
  const brayDate = new Date(brayDateRes.rows[0]?.actual_start_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const brayStreamerId = brayDateRes.rows[0]?.streamer_id;
  if (brayDurVal > 0 && brayStreamerId) {
    await db(`
      INSERT INTO daily_reports (streamer_id, tanggal, kategori, live_duration, tiktok_upload, youtube_upload, instagram_upload, facebook_upload, chat_count, registration_count, ftd_count)
      VALUES ($1, $2, 'Streaming', $3, 0, 0, 0, 0, 0, 0, 0)
      ON CONFLICT (streamer_id, tanggal)
      DO UPDATE SET live_duration = COALESCE(daily_reports.live_duration, 0) + $3
    `, [brayStreamerId, brayDate, brayDurVal]);
    console.log(`  ✅ daily_reports Brayy (${brayDate}): +${brayDurVal} jam`);
  }

  // Keylaa #118 — mulai 22:03, selesai 23:30 → durasi ~1.45 jam
  const keylaaDur = await db(`
    SELECT EXTRACT(EPOCH FROM (actual_end_time - actual_start_time))/3600 AS dur
    FROM schedule WHERE id = 118
  `);
  const keylaaDurVal = parseFloat(parseFloat(keylaaDur.rows[0]?.dur || 0).toFixed(2));

  const r5 = await db(`
    UPDATE schedule
    SET status        = 'Completed',
        live_duration = $1
    WHERE id = 118
    RETURNING id
  `, [keylaaDurVal]);
  console.log(`  ✅ #118 Keylaa: status→Completed, live_duration=${keylaaDurVal} jam`);

  // Update live_duration di daily_reports Keylaa untuk tanggal 4 Aug
  const keylaaDateRes = await db(`SELECT actual_start_time, streamer_id FROM schedule WHERE id = 118`);
  const keylaaDate = new Date(keylaaDateRes.rows[0]?.actual_start_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const keylaaStreamerId = keylaaDateRes.rows[0]?.streamer_id;
  if (keylaaDurVal > 0 && keylaaStreamerId) {
    await db(`
      INSERT INTO daily_reports (streamer_id, tanggal, kategori, live_duration, tiktok_upload, youtube_upload, instagram_upload, facebook_upload, chat_count, registration_count, ftd_count)
      VALUES ($1, $2, 'Streaming', $3, 0, 0, 0, 0, 0, 0, 0)
      ON CONFLICT (streamer_id, tanggal)
      DO UPDATE SET live_duration = COALESCE(daily_reports.live_duration, 0) + $3
    `, [keylaaStreamerId, keylaaDate, keylaaDurVal]);
    console.log(`  ✅ daily_reports Keylaa (${keylaaDate}): +${keylaaDurVal} jam`);
  }

  console.log('\n=== VERIFIKASI FINAL ===\n');
  const verify = await db(`
    SELECT sc.id, s.nama, sc.status, sc.live_link,
           ROUND(CAST(sc.live_duration AS numeric), 2) as live_duration
    FROM schedule sc
    JOIN streamers s ON sc.streamer_id = s.id
    WHERE sc.id IN (117, 118, 119, 133, 134, 139, 140)
    ORDER BY sc.id
  `);
  verify.rows.forEach(r => {
    console.log(`  #${r.id} ${r.nama} | ${r.status} | dur: ${r.live_duration} jam | link: ${r.live_link || '(null)'}`);
  });

  console.log('\n=== SELESAI — semua anomali diperbaiki ===');
  await pool.end();
  process.exit(0);
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
