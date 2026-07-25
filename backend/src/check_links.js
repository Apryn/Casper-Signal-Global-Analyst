import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const res = await pool.query(
  "SELECT id, title, link, views, likes, comments FROM content WHERE comments = 0 AND platform = 'YouTube' ORDER BY id DESC LIMIT 15"
);

console.log('=== YouTube Videos dengan Comments = 0 ===\n');
for (const r of res.rows) {
  const isShorts = r.link?.includes('/shorts/');
  const isWatch  = r.link?.includes('watch?v=');
  const linkType = isShorts ? 'SHORTS' : (isWatch ? 'WATCH' : 'UNKNOWN');
  console.log('[' + r.id + '] ' + linkType.padEnd(7) + ' | views=' + String(r.views).padStart(5) + ' likes=' + String(r.likes).padStart(4) + ' | ' + r.title.slice(0, 40));
  if (r.link) console.log('         ' + r.link.slice(0, 75));
  console.log('');
}

const stats = await pool.query(
  "SELECT SUM(CASE WHEN link LIKE '%/shorts/%' THEN 1 ELSE 0 END) as shorts, " +
  "SUM(CASE WHEN link LIKE '%watch?v=%' THEN 1 ELSE 0 END) as watch, " +
  "SUM(CASE WHEN link NOT LIKE '%/shorts/%' AND link NOT LIKE '%watch?v=%' THEN 1 ELSE 0 END) as other " +
  "FROM content WHERE platform = 'YouTube'"
);
const s = stats.rows[0];
console.log('=== Breakdown Format Link YouTube ===');
console.log('WATCH  (watch?v=) :', s.watch);
console.log('SHORTS (/shorts/) :', s.shorts);
console.log('Lainnya           :', s.other);

await pool.end();
