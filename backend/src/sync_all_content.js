/**
 * sync_all_content.js
 * One-time cleanup script: re-fetch real metrics for ALL existing content records.
 * Connects to the same database as production (NeonDB from .env).
 * 
 * Run: node src/sync_all_content.js
 */

import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = (sql, params) => pool.query(sql, params);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const bar  = (n, total) => `[${'█'.repeat(n)}${'░'.repeat(total - n)}] ${n}/${total}`;

// ─── YouTube API v3 ───────────────────────────────────────────────────────────
const getYoutubeVideoId = (url) => {
  if (!url) return null;
  const m = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?\s*v=|&v=)([^#&?]*).*/);
  return (m && m[2].length === 11) ? m[2] : null;
};

const fetchYoutubeMetrics = async (url) => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || apiKey === 'YOUR_YOUTUBE_API_KEY') return null;
  const videoId = getYoutubeVideoId(url);
  if (!videoId) return null;
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${apiKey}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const stats = data?.items?.[0]?.statistics;
    if (stats) return {
      views:    parseInt(stats.viewCount    ?? 0, 10),
      likes:    parseInt(stats.likeCount    ?? 0, 10),
      comments: parseInt(stats.commentCount ?? 0, 10),
      shares:   0
    };
  } catch { /* ignore */ }
  return null;
};

// ─── YouTube Watch Page fallback ──────────────────────────────────────────────
const scrapeYoutubePage = async (url) => {
  const videoId = getYoutubeVideoId(url);
  if (!videoId) return null;
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    const viewPatterns = [
      /\"videoDetails\"[\s\S]{0,500}?\"viewCount\":\"(\d+)\"/,
      /\"viewCount\":\"(\d+)\"/,
      /\"views\":\{\"simpleText\":\"([\d,]+) views\"/
    ];
    let views = 0;
    for (const p of viewPatterns) {
      const m = html.match(p);
      if (m) { views = parseInt(m[1].replace(/,/g, ''), 10); if (views > 0) break; }
    }
    if (views === 0) return null;
    const likeM = html.match(/\"likeCount\":\"(\d+)\"/) || html.match(/\"likes\":\{\"simpleText\":\"([\d,]+)\"/);
    return { views, likes: likeM ? parseInt(likeM[1].replace(/,/g, ''), 10) : 0, comments: 0, shares: 0 };
  } catch { /* ignore */ }
  return null;
};

// ─── TikWM Direct Video API ───────────────────────────────────────────────────
const fetchTikTokViaTikWM = async (url) => {
  try {
    const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.tikwm.com/'
      },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.code !== 0 || !data?.data) return null;
    const v = data.data;
    const views = parseInt(v.play_count, 10) || 0;
    const likes = parseInt(v.digg_count, 10) || 0;
    if (views === 0 && likes === 0) return null; // skip if all zero
    return { views, likes, comments: parseInt(v.comment_count, 10) || 0, shares: parseInt(v.share_count, 10) || 0 };
  } catch { /* ignore */ }
  return null;
};

// ─── RapidAPI TikTok Video Detail ─────────────────────────────────────────────
const fetchTikTokViaRapidAPI = async (url) => {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey || apiKey === 'YOUR_RAPIDAPI_KEY') return null;
  const videoIdM = url.match(/video\/(\d+)/);
  if (!videoIdM) return null;
  try {
    const res = await fetch(`https://tiktok-api23.p.rapidapi.com/api/post/detail?videoId=${videoIdM[1]}`, {
      headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': 'tiktok-api23.p.rapidapi.com' },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return null;
    const d = await res.json();
    const item = d?.itemInfo?.itemStruct || d?.data;
    if (!item) return null;
    const stats = item.stats;
    return {
      views:    parseInt(stats?.playCount    || item.play_count    || 0, 10),
      likes:    parseInt(stats?.diggCount    || item.digg_count    || 0, 10),
      comments: parseInt(stats?.commentCount || item.comment_count || 0, 10),
      shares:   parseInt(stats?.shareCount   || item.share_count   || 0, 10)
    };
  } catch { /* ignore */ }
  return null;
};

// ─── Main Sync ────────────────────────────────────────────────────────────────
async function syncAllContent() {
  console.log('\n🔄  Casper Signal — One-Time Content Metrics Cleanup');
  console.log('='.repeat(55));
  console.log(`DB  : ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] ?? 'unknown'}`);
  console.log(`YT  : ${process.env.YOUTUBE_API_KEY ? '✅ API Key ada' : '❌ tidak ada'}`);
  console.log(`TT  : ${process.env.RAPIDAPI_KEY    ? '✅ RapidAPI Key ada' : '⚠️  pakai TikWM saja'}`);

  const result = await db(`
    SELECT c.id, c.platform, c.title, c.link, c.views, c.likes, c.comments, c.shares,
           sa.username as account_username
    FROM content c
    LEFT JOIN streamer_accounts sa ON c.account_id = sa.id
    ORDER BY c.id ASC
  `);
  const rows = result.rows;
  console.log(`\nTotal records: ${rows.length}`);

  const ytRows    = rows.filter(r => r.platform === 'YouTube' && r.link);
  const ttRows    = rows.filter(r => r.platform === 'TikTok'  && r.link);
  const noLink    = rows.filter(r => !r.link);
  const otherRows = rows.filter(r => !['YouTube', 'TikTok'].includes(r.platform));

  console.log(`  YouTube dengan link : ${ytRows.length}`);
  console.log(`  TikTok dengan link  : ${ttRows.length}`);
  console.log(`  Tanpa link (skip)   : ${noLink.length}`);
  console.log(`  Platform lain       : ${otherRows.length}`);

  let updated = 0, skipped = 0, failed = 0;

  // ── YouTube ────────────────────────────────────────────────────────────────
  if (ytRows.length > 0) {
    console.log(`\n📺  Syncing YouTube (${ytRows.length} videos)...`);
    for (let i = 0; i < ytRows.length; i++) {
      const row = ytRows[i];
      process.stdout.write(`\r  ${bar(i + 1, ytRows.length)}  ${row.title.slice(0, 35).padEnd(35)}`);

      let metrics = await fetchYoutubeMetrics(row.link);
      if (!metrics) metrics = await scrapeYoutubePage(row.link);

      if (metrics) {
        await db(
          `UPDATE content SET views=$1, likes=$2, comments=$3, shares=$4 WHERE id=$5`,
          [metrics.views, metrics.likes, metrics.comments, metrics.shares, row.id]
        );
        updated++;
      } else {
        skipped++;
      }
      // Respect YouTube API quota (max ~10,000 units/day, each video = 1 unit)
      await sleep(200);
    }
    console.log('\n  ✅ YouTube selesai.');
  }

  // ── TikTok ─────────────────────────────────────────────────────────────────
  if (ttRows.length > 0) {
    console.log(`\n🎵  Syncing TikTok (${ttRows.length} videos)...`);
    for (let i = 0; i < ttRows.length; i++) {
      const row = ttRows[i];
      process.stdout.write(`\r  ${bar(i + 1, ttRows.length)}  ${row.title.slice(0, 35).padEnd(35)}`);

      let metrics = await fetchTikTokViaRapidAPI(row.link);
      if (!metrics) metrics = await fetchTikTokViaTikWM(row.link);

      if (metrics) {
        await db(
          `UPDATE content SET views=$1, likes=$2, comments=$3, shares=$4 WHERE id=$5`,
          [metrics.views, metrics.likes, metrics.comments, metrics.shares, row.id]
        );
        updated++;
      } else {
        skipped++;
      }
      // TikWM free: 1 req/sec
      await sleep(1100);
    }
    console.log('\n  ✅ TikTok selesai.');
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(55));
  console.log(`✅  Updated  : ${updated} records`);
  console.log(`⏭️   Skipped  : ${skipped} (no link / API gagal / data sudah 0)`);
  console.log(`❌  Failed   : ${failed}`);
  console.log(`⚠️   No link  : ${noLink.length} (perlu input manual)`);
  console.log('');

  await pool.end();
}

syncAllContent().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  pool.end();
  process.exit(1);
});
