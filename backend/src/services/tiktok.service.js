/**
 * tiktok.service.js
 * 
 * Service mandiri untuk mendeteksi status live akun TikTok via HTML Scraping.
 * Metode ini gratis dan tidak memerlukan API Key resmi.
 */

import axios from 'axios';

// List User-Agents agar tidak mudah diblokir Cloudflare TikTok
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/118.0'
];

/**
 * Mendeteksi apakah akun TikTok dengan username tertentu sedang live.
 * @param {string} username Username TikTok (tanpa tanda @)
 * @returns {Promise<{isLive: boolean, roomId: string|null}>}
 */
export const checkTikTokLiveStatus = async (username) => {
  const cleanUsername = username.trim().replace(/^@/, '');
  const url = `https://www.tiktok.com/@${cleanUsername}/live`;
  
  // Pilih User-Agent acak
  const randomUserAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': randomUserAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 12000,
      validateStatus: (status) => status >= 200 && status < 400 // Terima redirect jika dialihkan
    });

    const html = response.data;
    if (!html || typeof html !== 'string') {
      return { isLive: false, roomId: null };
    }

    // 1. Deteksi lewat regex roomId (Angka Room ID TikTok Live)
    const roomIdMatch = html.match(/"roomId":"(\d+)"/) || html.match(/"room_id":\s*"?(\d+)"?/) || html.match(/"liveRoom"[\s\S]{0,100}?"id":"(\d+)"/);
    const roomId = roomIdMatch ? roomIdMatch[1] : null;

    // 2. Deteksi status live di state JSON
    const isLiveState = html.includes('"status":2') || 
                        html.includes('"status": 2') || 
                        html.includes('"isRoomLive":true') || 
                        html.includes('"liveStatus":2') ||
                        html.includes('"liveStatus": 2') ||
                        html.includes('"liveRoom":');

    // 3. Deteksi jumlah penonton (Viewer/User Count)
    const viewerMatch = html.match(/"userCount":(\d+)/) || 
                        html.match(/"viewerCount":(\d+)/) || 
                        html.match(/"user_count":(\d+)/) ||
                        html.match(/"stats":\{"userCount":(\d+)/);
    const viewerCount = viewerMatch ? parseInt(viewerMatch[1], 10) : 0;

    // Jika ada roomId aktif dan indikator live state terpenuhi (atau roomId valid != '0')
    if ((roomId && roomId !== '0' && isLiveState) || (isLiveState && html.includes('SIG_LIVE'))) {
      console.log(`[TikTok Scraper]: 🔴 Akun @${cleanUsername} terdeteksi LIVE! Room ID: ${roomId} (Viewer: ${viewerCount})`);
      return { isLive: true, roomId, viewerCount };
    }

    return { isLive: false, roomId: null, viewerCount: 0 };

  } catch (error) {
    // Jika kena block/redirect Cloudflare (biasanya status 403 atau 429)
    if (error.response?.status === 403 || error.response?.status === 429) {
      console.warn(`[TikTok Scraper Warning]: Pengecekan @${cleanUsername} dibatasi/block oleh TikTok (status ${error.response.status}).`);
    } else {
      console.error(`[TikTok Scraper Error] @${cleanUsername}:`, error.message);
    }
    return { isLive: false, roomId: null };
  }
};
