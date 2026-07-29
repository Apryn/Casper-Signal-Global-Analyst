/**
 * cancel_all_false_live.js
 * Cancel SEMUA schedule yang status Live tapi videonya masih Waiting Room.
 * Run: node src/cancel_all_false_live.js
 */
import 'dotenv/config';
import pkg from 'pg';
import axios from 'axios';

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = (sql, params) => pool.query(sql, params);

const isWaitingRoom = async (liveLink) => {
  if (!liveLink) return false;
  const videoId = liveLink.match(/watch\?v=([a-zA-Z0-9_-]+)/)?.[1];
  if (!videoId) return false;
  try {
    const res = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
      timeout: 10000
    });
    const html = res.data;
    const upcoming = html.includes('"isUpcoming":true') || html.includes('upcomingEventData');
    const hasManifest = html.includes('activeDashManifestUrl') || html.includes('hlsManifestUrl');
    return upcoming || !hasManifest;
  } catch(e) {
    console.log(`  Cannot check ${liveLink}: ${e.message}`);
    return false;
  }
};

const main = async () => {
  const res = await db(`
    SELECT sc.id, sc.live_link, s.nama, sc.platform
    FROM schedule sc JOIN streamers s ON sc.streamer_id = s.id
    WHERE sc.status = 'Live'
  `);
  
  console.log(`Checking ${res.rows.length} Live schedule(s)...`);
  
  for (const row of res.rows) {
    console.log(`\n[#${row.id}] ${row.nama} — ${row.platform} — ${row.live_link}`);
    if (row.platform === 'YouTube' && row.live_link) {
      const fake = await isWaitingRoom(row.live_link);
      if (fake) {
        await db(
          `UPDATE schedule SET status = 'Cancelled', actual_end_time = NOW() WHERE id = $1`,
          [row.id]
        );
        console.log(`  → CANCELLED (Waiting Room / No manifest)`);
      } else {
        console.log(`  → KEPT (benar-benar live)`);
      }
    } else {
      console.log(`  → SKIP (TikTok atau no live_link)`);
    }
  }
  
  const remaining = await db(`SELECT id FROM schedule WHERE status = 'Live'`);
  console.log(`\nRemaining Live: ${remaining.rows.length}`);
  await pool.end();
  process.exit(0);
};

main().catch(err => { console.error('Error:', err); process.exit(1); });
