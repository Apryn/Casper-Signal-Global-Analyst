/**
 * check_waiting_room.js
 * Cek apakah stream YouTube sedang benar-benar broadcasting atau hanya di Waiting Room.
 */
import 'dotenv/config';
import axios from 'axios';

const videoIds = [
  '-NpffO7WsMY',  // Ajo / Bang Candle
  'cgdTq0wrmP0',  // Aline
];

for (const vid of videoIds) {
  const url = `https://www.youtube.com/watch?v=${vid}`;
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000
    });
    const html = res.data;
    
    const isLive       = html.includes('"isLive":true') || html.includes('"isLive": true');
    const isUpcoming   = html.includes('"isUpcoming":true') || html.includes('"isUpcoming": true') || html.includes('upcomingEventData');
    const hasActiveDash = html.includes('activeDashManifestUrl');
    const hasHlsManifest = html.includes('hlsManifestUrl');
    const hasViewers   = html.includes('concurrentViewers') || html.includes('"viewerCountText"');
    const style        = html.match(/"style":"([^"]+)"/)?.[1];
    const scheduledTime = html.match(/"scheduledStartTime":"([^"]+)"/)?.[1];
    
    console.log(`\n=== ${vid} ===`);
    console.log(`  isLive: ${isLive}`);
    console.log(`  isUpcoming: ${isUpcoming}`);
    console.log(`  hasActiveDashManifest: ${hasActiveDash}`);
    console.log(`  hasHlsManifest: ${hasHlsManifest}`);
    console.log(`  hasViewerCount: ${hasViewers}`);
    console.log(`  style: ${style || '(none)'}`);
    console.log(`  scheduledStartTime: ${scheduledTime || '(none)'}`);
    console.log(`  ➜ VERDICT: ${(isLive && !isUpcoming && (hasActiveDash || hasHlsManifest)) ? '✅ BENAR-BENAR LIVE' : '❌ WAITING ROOM / BUKAN LIVE'}`);
  } catch(e) {
    console.log(`${vid} ERROR: ${e.message}`);
  }
}
process.exit(0);
