/**
 * cancel_waiting_room_schedules.js
 * Batalkan jadwal yang dibuat berdasarkan deteksi Waiting Room YouTube yang salah.
 */
import 'dotenv/config';
import pkg from 'pg';

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = (sql, params) => pool.query(sql, params);

const main = async () => {
  // Cancel schedule #88 dan #89 yang merupakan false positive Waiting Room
  const res = await db(`
    UPDATE schedule
    SET status = 'Cancelled',
        actual_end_time = NOW()
    WHERE id IN (88, 89)
      AND status = 'Live'
    RETURNING id, streamer_id, platform, status
  `);
  
  console.log('Cancelled schedules:', res.rows);
  
  // Verifikasi tidak ada lagi Live schedule
  const check = await db(`
    SELECT sc.id, s.nama, sc.platform, sc.status
    FROM schedule sc JOIN streamers s ON sc.streamer_id = s.id
    WHERE sc.status = 'Live'
  `);
  console.log('Remaining Live schedules:', check.rows.length, check.rows);
  
  await pool.end();
  process.exit(0);
};

main().catch(err => { console.error('Error:', err); process.exit(1); });
