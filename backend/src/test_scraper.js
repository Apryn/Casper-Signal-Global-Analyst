/**
 * test_scraper.js
 * Quick test script to verify YouTube and TikTok scrapers are working.
 * Run: node src/test_scraper.js
 */

import 'dotenv/config';

// ─── CONFIG: ganti URL ini dengan video nyata dari streamer kamu ───────────────
const YOUTUBE_TEST_URL  = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Astley (pasti ada views)
const TIKTOK_TEST_URL   = 'https://www.tiktok.com/@charlidamelio/video/7023143787128886534'; // Akun publik besar
// ─────────────────────────────────────────────────────────────────────────────

const sep = (label) => console.log(`\n${'─'.repeat(50)}\n🔍 ${label}\n${'─'.repeat(50)}`);
const ok  = (msg)   => console.log(`  ✅  ${msg}`);
const fail = (msg)  => console.log(`  ❌  ${msg}`);
const info = (msg)  => console.log(`  ℹ️   ${msg}`);

// ── YouTube API v3 ─────────────────────────────────────────────────────────────
async function testYouTubeAPI(videoUrl) {
  sep('YouTube Data API v3');
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || apiKey === 'YOUR_YOUTUBE_API_KEY') {
    fail('YOUTUBE_API_KEY tidak dikonfigurasi di .env');
    return;
  }
  info(`API Key: ${apiKey.slice(0, 8)}...`);

  const videoIdMatch = videoUrl.match(/[?&]v=([^&#]+)/) || videoUrl.match(/youtu\.be\/([^?&#]+)/);
  const videoId = videoIdMatch?.[1];
  if (!videoId) { fail('Tidak bisa extract Video ID dari URL'); return; }
  info(`Video ID: ${videoId}`);

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoId}&key=${apiKey}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) { fail(`HTTP ${res.status}: ${res.statusText}`); return; }

    const data = await res.json();
    if (data.error) { fail(`API Error: ${data.error.message}`); return; }

    const item = data.items?.[0];
    if (!item) { fail('Video tidak ditemukan / private'); return; }

    const stats = item.statistics;
    ok(`Title   : ${item.snippet.title}`);
    ok(`Views   : ${Number(stats.viewCount).toLocaleString()}`);
    ok(`Likes   : ${Number(stats.likeCount ?? 0).toLocaleString()}`);
    ok(`Comments: ${Number(stats.commentCount ?? 0).toLocaleString()}`);
  } catch (err) {
    fail(`Error: ${err.message}`);
  }
}

// ── YouTube Watch Page Scraper ─────────────────────────────────────────────────
async function testYouTubeScrapePage(videoUrl) {
  sep('YouTube Watch Page Scraper (fallback)');
  info(`URL: ${videoUrl}`);

  try {
    const res = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) { fail(`HTTP ${res.status}`); return; }

    const html = await res.text();
    info(`Page size: ${(html.length / 1024).toFixed(1)} KB`);

    const patterns = [
      /\"videoDetails\"[\s\S]{0,500}?\"viewCount\":\"(\d+)\"/,
      /\"viewCount\":\"(\d+)\"/,
      /\"views\":\{\"simpleText\":\"([\d,]+) views\"/
    ];

    let viewCount = 0;
    let matchedPattern = '';
    for (const [i, pattern] of patterns.entries()) {
      const match = html.match(pattern);
      if (match) {
        viewCount = parseInt(match[1].replace(/,/g, ''), 10);
        if (viewCount > 0) { matchedPattern = `Pattern #${i + 1}`; break; }
      }
    }

    if (viewCount > 0) {
      ok(`Views   : ${viewCount.toLocaleString()} (via ${matchedPattern})`);
    } else {
      fail('Tidak bisa extract viewCount — YouTube mungkin blokir scraping atau format berubah');
      info('Coba cek manual: apakah URL bisa dibuka di browser?');
    }

    const likeMatch = html.match(/\"likeCount\":\"(\d+)\"/) || html.match(/\"likes\":\{\"simpleText\":\"([\d,]+)\"/);
    if (likeMatch) {
      ok(`Likes   : ${parseInt(likeMatch[1].replace(/,/g, ''), 10).toLocaleString()}`);
    } else {
      info('Likes tidak tersedia (YouTube kadang sembunyikan ini)');
    }
  } catch (err) {
    fail(`Error: ${err.message}`);
  }
}

// ── TikWM Direct Video API ─────────────────────────────────────────────────────
async function testTikWMDirect(videoUrl) {
  sep('TikWM Direct Video API (TikTok)');
  info(`URL: ${videoUrl}`);

  try {
    const params = new URLSearchParams();
    params.append('url', videoUrl);
    params.append('web', '1');

    const res = await fetch('https://www.tikwm.com/api/', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.tikwm.com/'
      },
      body: params,
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) { fail(`HTTP ${res.status}`); return; }

    const data = await res.json();
    if (data?.code !== 0 || !data?.data) {
      fail(`TikWM code=${data?.code} — ${JSON.stringify(data?.msg ?? 'no message')}`);
      return;
    }

    const v = data.data;
    ok(`Title   : ${(v.title || v.desc || '(no title)').slice(0, 80)}`);
    ok(`Views   : ${Number(v.play_count ?? 0).toLocaleString()}`);
    ok(`Likes   : ${Number(v.digg_count ?? 0).toLocaleString()}`);
    ok(`Comments: ${Number(v.comment_count ?? 0).toLocaleString()}`);
    ok(`Shares  : ${Number(v.share_count ?? 0).toLocaleString()}`);
  } catch (err) {
    fail(`Error: ${err.message}`);
  }
}

// ── TikWM User Posts API ───────────────────────────────────────────────────────
async function testTikWMUserPosts(videoUrl) {
  sep('TikWM User Posts Fallback (TikTok)');
  const match = videoUrl.match(/@([a-zA-Z0-9_.]+)/);
  if (!match) { fail('Tidak bisa extract username dari URL'); return; }
  const username = match[1];
  info(`Username: @${username}`);

  try {
    const res = await fetch(`https://www.tikwm.com/api/user/posts?unique_id=${username}&count=5&cursor=0`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      },
      signal: AbortSignal.timeout(20000)
    });

    if (!res.ok) { fail(`HTTP ${res.status}`); return; }

    const data = await res.json();
    if (data?.code !== 0 || !data?.data?.videos) {
      fail(`TikWM code=${data?.code} — User posts tidak tersedia`);
      return;
    }

    const videos = data.data.videos;
    ok(`Berhasil ambil ${videos.length} video dari @${username}`);
    if (videos.length > 0) {
      const first = videos[0];
      ok(`Video #1: "${(first.title || first.desc || '(no title)').slice(0, 60)}"`);
      ok(`          ${Number(first.play_count ?? 0).toLocaleString()} views`);
    }
  } catch (err) {
    fail(`Error: ${err.message}`);
  }
}

// ── MAIN ───────────────────────────────────────────────────────────────────────
console.log('\n🚀 Casper Signal — Scraper Verification Test');
console.log('='.repeat(50));
console.log(`YouTube URL : ${YOUTUBE_TEST_URL}`);
console.log(`TikTok URL  : ${TIKTOK_TEST_URL}`);

await testYouTubeAPI(YOUTUBE_TEST_URL);
await testYouTubeScrapePage(YOUTUBE_TEST_URL);
await testTikWMDirect(TIKTOK_TEST_URL);
await testTikWMUserPosts(TIKTOK_TEST_URL);

console.log('\n' + '='.repeat(50));
console.log('✅ Test selesai.\n');
