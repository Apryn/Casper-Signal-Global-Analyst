import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Cek video mana yang benar-benar live
const videoToCheck = '_cLIlHRcZRA';
const videoInDB = '4VyzjpxMACo';

async function checkVideo(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  const html = await response.text();

  const hasLiveMarker = /\"isLive\"\s*:\s*true/.test(html) || /\"isLiveNow\"\s*:\s*true/.test(html) || html.includes('"style":"LIVE"');
  const isWaitingRoom = /\"isUpcoming\"\s*:\s*true/.test(html) || html.includes('upcomingEventData');

  const signals = [
    html.includes('isLiveContent'),
    html.includes('streamingData'),
    html.includes('videoDetails'),
    html.includes('hlsManifestUrl'),
    html.includes('activeDashManifestUrl'),
    html.includes('"style":"LIVE"'),
    html.includes('liveChunkReadahead'),
    /\"isLive\"\s*:\s*true/.test(html),
  ];
  const confirmedCount = signals.filter(Boolean).length;

  const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/) || html.match(/<title>(.*?)<\/title>/);
  const title = titleMatch ? titleMatch[1].replace(/ - YouTube$/, '').trim() : '(no title)';

  return { videoId, hasLiveMarker, isWaitingRoom, confirmedCount, isLive: hasLiveMarker && !isWaitingRoom && confirmedCount >= 2, title };
}

console.log('Cek status kedua video...\n');

const r1 = await checkVideo(videoToCheck);
console.log(`Video _cLIlHRcZRA: isLive=${r1.isLive} | signals=${r1.confirmedCount} | title="${r1.title}"`);

const r2 = await checkVideo(videoInDB);
console.log(`Video 4VyzjpxMACo: isLive=${r2.isLive} | signals=${r2.confirmedCount} | title="${r2.title}"`);

// Cek jadwal brayy dan chenn hari ini
const schedules = await pool.query(`
  SELECT sc.id, s.nama, sc.status, sc.live_link, sc.actual_start_time, sc.start_time, sc.substitute_streamer_id
  FROM schedule sc
  JOIN streamers s ON sc.streamer_id = s.id
  WHERE s.nama ILIKE ANY(ARRAY['%bray%', '%chenn%'])
    AND sc.start_time >= NOW() - INTERVAL '12 hours'
  ORDER BY sc.start_time DESC
`);
console.log('\n=== JADWAL BRAYY & CHENN (12 jam terakhir) ===');
schedules.rows.forEach(r => console.log(`#${r.id} | ${r.nama} | status: ${r.status} | start: ${r.start_time} | link: ${r.live_link}`));

await pool.end();
