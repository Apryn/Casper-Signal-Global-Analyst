/**
 * check_schedule_detail.js
 * Cek detail schedule Live dan kepemilikan channel YouTube.
 */
import 'dotenv/config';
import pkg from 'pg';

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = (sql, params) => pool.query(sql, params);

const main = async () => {
  // Detail schedule yang Live
  const res = await db(`
    SELECT sc.id, sc.streamer_id, sc.substitute_streamer_id, sc.platform, sc.live_link,
           s.nama as streamer_nama,
           sub.nama as substitute_nama
    FROM schedule sc
    JOIN streamers s ON sc.streamer_id = s.id
    LEFT JOIN streamers sub ON sc.substitute_streamer_id = sub.id
    WHERE sc.status = 'Live'
    ORDER BY sc.id
  `);
  console.log('=== DETAIL SCHEDULE LIVE ===');
  res.rows.forEach(r => console.log(JSON.stringify(r)));

  // Cek account ownership: channel mana milik siapa
  const acc = await db(`
    SELECT sa.streamer_id, sa.channel_id, sa.username, s.nama
    FROM streamer_accounts sa
    JOIN streamers s ON sa.streamer_id = s.id
    WHERE sa.platform = 'YouTube'
    ORDER BY s.nama
  `);
  console.log('\n=== KEPEMILIKAN CHANNEL YOUTUBE ===');
  acc.rows.forEach(r => console.log(JSON.stringify(r)));

  await pool.end();
  process.exit(0);
};

main().catch(err => { console.error('Error:', err); process.exit(1); });
