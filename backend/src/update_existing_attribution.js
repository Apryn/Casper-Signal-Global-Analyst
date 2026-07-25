/**
 * update_existing_attribution.js
 * Scans all existing content in DB and re-attributes streamer_id based on video title keywords.
 */

import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fixAttributions() {
  console.log('\n🤖 Casper Signal — Auto-Attributing Existing Videos by Title');
  console.log('='.repeat(60));

  const streamersRes = await pool.query('SELECT id, nama FROM streamers ORDER BY id');
  const streamers = streamersRes.rows;
  console.log('Registered Streamers:', streamers.map(s => `${s.nama} (ID ${s.id})`).join(', '));

  const contentRes = await pool.query(`
    SELECT c.id, c.title, c.streamer_id, s.nama as current_streamer
    FROM content c
    JOIN streamers s ON c.streamer_id = s.id
    ORDER BY c.id ASC
  `);
  const contents = contentRes.rows;

  let reattributed = 0;

  for (const item of contents) {
    const titleLower = item.title.toLowerCase();

    for (const st of streamers) {
      const nameParts = st.nama.toLowerCase().split(/\s+/).filter(p => p.length >= 3);
      const isMatch = nameParts.some(part => titleLower.includes(part));

      if (isMatch && st.id !== item.streamer_id) {
        await pool.query('UPDATE content SET streamer_id = $1 WHERE id = $2', [st.id, item.id]);
        console.log(`[RE-ASSIGNED] ID ${item.id} | "${item.title.slice(0, 45)}"`);
        console.log(`              ${item.current_streamer} ➔ ${st.nama}`);
        reattributed++;
        break;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅  Total re-attributed: ${reattributed} videos`);
  console.log('='.repeat(60) + '\n');

  await pool.end();
}

fixAttributions().catch(err => {
  console.error('Error:', err.message);
  pool.end();
});
