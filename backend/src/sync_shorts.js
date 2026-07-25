/**
 * sync_shorts.js
 * Fix Shorts yang gagal sync karena URL /shorts/ tidak dikenali sebelumnya.
 * Run: node src/sync_shorts.js
 */

import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = (sql, params) => pool.query(sql, params);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Extract video ID (with Shorts support) ───────────────────────────────────
const getVideoId = (url) => {
  if (!url) return null;
  const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];
  const stdMatch = url.match(/^.*(youtu\.be\/|v\/|embed\/|watch\?\s*v=|&v=)([^#&?]*).*/);
  return (stdMatch && stdMatch[2].length === 11) ? stdMatch[2] : null;
};

// ─── YouTube Data API v3 ──────────────────────────────────────────────────────
const fetchYoutubeMetrics = async (videoId) => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${apiKey}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const stats = data?.items?.[0]?.statistics;
  if (!stats) return null;
  return {
    views:    parseInt(stats.viewCount    ?? 0, 10),
    likes:    parseInt(stats.likeCount    ?? 0, 10),
    comments: parseInt(stats.commentCount ?? 0, 10),
    shares:   0
  };
};

// ─── YouTube watch-page scraper fallback ──────────────────────────────────────
const scrapeYoutubePage = async (videoId) => {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml'
    },
    signal: AbortSignal.timeout(8000)
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const html = await res.text();
  let views = 0;
  for (const p of [
    /\"videoDetails\"[\s\S]{0,500}?\"viewCount\":\"(\d+)\"/,
    /\"viewCount\":\"(\d+)\"/
  ]) {
    const m = html.match(p);
    if (m) { views = parseInt(m[1], 10); if (views > 0) break; }
  }
  if (!views) return null;
  const lm = html.match(/\"likeCount\":\"(\d+)\"/);
  return { views, likes: lm ? parseInt(lm[1], 10) : 0, comments: 0, shares: 0 };
};

// ─── Main ─────────────────────────────────────────────────────────────────────
console.log('\n🩹  Casper Signal — Fix YouTube Shorts Metrics');
console.log('='.repeat(50));

// Ambil semua Shorts yang ada
const res = await db("SELECT id, title, link, views, likes, comments FROM content WHERE link LIKE '%/shorts/%' ORDER BY id");
const rows = res.rows;
console.log(`Shorts ditemukan: ${rows.length}\n`);

let updated = 0, skipped = 0;

for (const row of rows) {
  const videoId = getVideoId(row.link);
  if (!videoId) {
    console.log(`[SKIP] ID ${row.id} — tidak bisa extract video ID dari: ${row.link}`);
    skipped++;
    continue;
  }

  let metrics = await fetchYoutubeMetrics(videoId).catch(() => null);
  if (!metrics) {
    metrics = await scrapeYoutubePage(videoId);
  }

  if (metrics) {
    await db(
      'UPDATE content SET views=$1, likes=$2, comments=$3, shares=$4 WHERE id=$5',
      [metrics.views, metrics.likes, metrics.comments, metrics.shares, row.id]
    );
    console.log(`[✅] ID ${row.id} — "${row.title.slice(0, 45)}" → ${metrics.views} views, ${metrics.likes} likes`);
    updated++;
  } else {
    console.log(`[⏭️] ID ${row.id} — "${row.title.slice(0, 45)}" — API gagal, data lama dipertahankan`);
    skipped++;
  }

  await sleep(250); // respect API quota
}

console.log('\n' + '='.repeat(50));
console.log(`✅ Updated : ${updated} Shorts`);
console.log(`⏭️  Skipped : ${skipped}`);
console.log('');

await pool.end();
