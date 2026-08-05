/**
 * investigate_all_anomalies.js
 * Investigasi lengkap semua jadwal anomali 24 jam terakhir
 */
import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = (sql, p) => pool.query(sql, p);

// Cek apakah video benar-benar milik channel
async function verifyVideoChannel(videoId) {
  if (!videoId) return { channelId: null, title: null };
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9' }
    });
    if (!resp.ok) return { channelId: null, title: null };
    const html = await resp.text();
    const chMatch = html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{20,})"/) ||
                    html.match(/"externalChannelId"\s*:\s*"(UC[a-zA-Z0-9_-]{20,})"/);
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    return {
      channelId: chMatch ? chMatch[1] : null,
      title: titleMatch ? titleMatch[1].replace(/ - YouTube$/, '') : null
    };
  } catch { return { channelId: null, title: null }; }
}

console.log('=== INVESTIGASI ANOMALI JADWAL ===\n');

// Ambil semua jadwal 24 jam terakhir
const res = await db(`
  SELECT sc.id, s.nama, sc.platform, sc.status,
         sc.start_time, sc.actual_start_time, sc.actual_end_time,
         sc.live_duration, sc.lateness_minutes, sc.live_link,
         sc.streamer_id, sc.substitute_streamer_id,
         sa.channel_id
  FROM schedule sc
  JOIN streamers s ON sc.streamer_id = s.id
  LEFT JOIN streamer_accounts sa ON sa.streamer_id = sc.streamer_id AND sa.platform = 'YouTube'
  WHERE sc.start_time >= NOW() - INTERVAL '24 hours'
  ORDER BY sc.start_time DESC
`);

const anomalies = [];

for (const r of res.rows) {
  const issues = [];

  // 1. Cek link 4VyzjpxMACo (LCK video palsu)
  if (r.live_link && r.live_link.includes('4VyzjpxMACo')) {
    issues.push('FALSE_LINK_LCK');
  }

  // 2. Cek link JH9GbJl4OVg duplikat
  if (r.live_link && r.live_link.includes('JH9GbJl4OVg')) {
    issues.push('POSSIBLE_DUPLICATE_LINK');
  }

  // 3. Cancelled dengan actual_start_time (seharusnya Completed)
  if (r.status === 'Cancelled' && r.actual_start_time && r.actual_end_time) {
    issues.push('CANCELLED_WITH_TIMES');
  }

  // 4. Scheduled dengan actual_start_time (tidak pernah di-update ke Live/Completed)
  if (r.status === 'Scheduled' && r.actual_start_time) {
    issues.push('SCHEDULED_WITH_ACTUAL_START');
  }

  if (issues.length > 0) {
    anomalies.push({ ...r, issues });
  }
}

console.log(`Ditemukan ${anomalies.length} jadwal anomali:\n`);

for (const a of anomalies) {
  console.log(`[#${a.id}] ${a.nama} | ${a.status} | Issues: ${a.issues.join(', ')}`);
  console.log(`  channel_id: ${a.channel_id}`);
  console.log(`  live_link:  ${a.live_link}`);
  console.log(`  duration:   ${a.live_duration} jam`);
  console.log(`  start:      ${a.actual_start_time} | end: ${a.actual_end_time}`);

  // Verifikasi video apakah benar-benar milik channel ini
  if (a.live_link && a.channel_id) {
    const videoId = a.live_link.match(/watch\?v=([a-zA-Z0-9_-]{11})/)?.[1];
    if (videoId) {
      const info = await verifyVideoChannel(videoId);
      const owned = info.channelId === a.channel_id;
      console.log(`  VIDEO CHECK: channelId=${info.channelId} | title="${info.title}"`);
      console.log(`  → Milik channel ini? ${owned ? '✅ YA' : '❌ BUKAN (video dari channel lain)'}`);
      a._videoOwned = owned;
      a._videoChannelId = info.channelId;
      a._videoTitle = info.title;
    }
  }
  console.log('');
}

await pool.end();
