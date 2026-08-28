import { query } from '../config/db.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extracts YouTube Video ID from a URL.
 * Supports: watch?v=, youtu.be/, embed/, and YouTube Shorts (/shorts/).
 */
const getYoutubeVideoId = (url) => {
  if (!url) return null;
  // YouTube Shorts: https://www.youtube.com/shorts/VIDEO_ID
  const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];
  // Standard: watch?v=, youtu.be/, embed/
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?\s*v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

/**
 * Attempts to fetch real metrics for a YouTube video using YouTube Data API v3.
 * Returns null if API key is not configured or request fails.
 */
const fetchYoutubeMetrics = async (url) => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || apiKey === 'YOUR_YOUTUBE_API_KEY') return null;

  const videoId = getYoutubeVideoId(url);
  if (!videoId) return null;

  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${apiKey}`;
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;

    const data = await res.json();
    const stats = data?.items?.[0]?.statistics;
    if (stats) {
      return {
        views: parseInt(stats.viewCount, 10) || 0,
        likes: parseInt(stats.likeCount, 10) || 0,
        comments: parseInt(stats.commentCount, 10) || 0,
        shares: 0 // YouTube API doesn't provide share counts directly
      };
    }
  } catch (error) {
    console.warn(`[Social Service]: Failed to fetch YouTube metrics for ID ${videoId}: ${error.message}`);
  }
  return null;
};

/**
 * Attempts to fetch real metrics for a TikTok video using RapidAPI tiktok-api23.
 * Returns null if RAPIDAPI_KEY is not configured or request fails.
 */
const fetchTikTokVideoMetrics = async (videoUrl) => {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey || apiKey === 'YOUR_RAPIDAPI_KEY') return null;

  try {
    const videoIdMatch = videoUrl.match(/video\/(\d+)/);
    if (!videoIdMatch) return null;
    const videoId = videoIdMatch[1];

    const url = `https://tiktok-api23.p.rapidapi.com/api/post/detail?videoId=${videoId}`;
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'tiktok-api23.p.rapidapi.com'
      },
      signal: AbortSignal.timeout(25000)
    });

    if (!res.ok) return null;

    const result = await res.json();
    const itemInfo = result?.itemInfo?.itemStruct || result?.data;
    if (itemInfo) {
      const stats = itemInfo.stats;
      return {
        views: parseInt(stats?.playCount || itemInfo.play_count, 10) || 0,
        likes: parseInt(stats?.diggCount || itemInfo.digg_count, 10) || 0,
        comments: parseInt(stats?.commentCount || itemInfo.comment_count, 10) || 0,
        shares: parseInt(stats?.shareCount || itemInfo.share_count, 10) || 0
      };
    }
  } catch (error) {
    console.warn(`[Social Service]: Failed to fetch TikTok metrics via RapidAPI for ${videoUrl}: ${error.message}`);
  }
  return null;
};

/**
 * Attempts to resolve secUid from TikWM as a fallback when RapidAPI returns 204.
 * TikWM is free and doesn't require an API key for user info lookups.
 */
const resolveSecUidFromTikWM = async (cleanUsername) => {
  try {
    const url = `https://www.tikwm.com/api/user/info?unique_id=${cleanUsername}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const secUid = data?.data?.user?.secUid;
    if (secUid) {
      console.log(`[Social Service]: Resolved secUid from TikWM for ${cleanUsername}: ${secUid}`);
      return secUid;
    }
  } catch (error) {
    console.warn(`[Social Service]: TikWM secUid lookup failed for ${cleanUsername}: ${error.message}`);
  }
  return null;
};

/**
 * Attempts to resolve secUid by scraping the mobile TikTok user profile.
 * Works even when RapidAPI or TikWM are unavailable or quota-exhausted.
 */
const resolveSecUidFromProfileScrape = async (cleanUsername) => {
  try {
    const url = `https://www.tiktok.com/@${cleanUsername}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/secUid["':\s]+([a-zA-Z0-9_-]{40,})/);
    if (match) {
      console.log(`[Social Service]: Resolved secUid from mobile TikTok profile for ${cleanUsername}: ${match[1]}`);
      return match[1];
    }
  } catch (error) {
    console.warn(`[Social Service]: Profile scrape secUid lookup failed for ${cleanUsername}: ${error.message}`);
  }
  return null;
};

/**
 * Attempts to fetch latest posts from TikWM as a fallback when Lundehund RapidAPI returns empty data.
 */
const fetchTikTokVideosFromTikWM = async (cleanUsername) => {
  try {
    const url = `https://www.tikwm.com/api/user/posts?unique_id=${cleanUsername}&count=30&cursor=0`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      },
      signal: AbortSignal.timeout(20000)
    });
    if (!res.ok) {
      console.warn(`[Social Service]: TikWM posts request failed for ${cleanUsername}. Status: ${res.status}`);
      return [];
    }
    const data = await res.json();
    if (data?.code !== 0 || !data?.data?.videos) {
      console.warn(`[Social Service]: TikWM returned no videos for ${cleanUsername}. Response code: ${data?.code}`);
      return [];
    }

    const videosArray = data.data.videos;
    console.log(`[Social Service]: TikWM returned ${videosArray.length} videos for ${cleanUsername}`);

    const videos = [];
    for (const v of videosArray) {
      const vId = v.video_id || v.id;
      if (!vId) continue;

      const createTime = v.create_time;
      const uploadDate = createTime
        ? new Date(createTime * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
        : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

      const rawTitle = v.title || v.desc || '';
      const title = rawTitle.length > 0
        ? (rawTitle.length > 255 ? rawTitle.substring(0, 250) + '...' : rawTitle)
        : `TikTok Video (${uploadDate})`;

      videos.push({
        title,
        link: `https://www.tiktok.com/@${cleanUsername}/video/${vId}`,
        uploadDate,
        views: parseInt(v.play_count, 10) || 0,
        likes: parseInt(v.digg_count, 10) || 0,
        comments: parseInt(v.comment_count, 10) || 0,
        shares: parseInt(v.share_count, 10) || 0
      });
    }
    return videos;
  } catch (error) {
    console.warn(`[Social Service]: TikWM posts fetch failed for ${cleanUsername}: ${error.message}`);
  }
  return [];
};

/**
 * Fetches real metrics for a specific TikTok video directly via TikWM's video detail API.
 * More reliable than searching user posts — works for ANY video regardless of age or position.
 * No API key required. Returns null if not found or request fails.
 */
const fetchTikTokVideoMetricsFromTikWM = async (videoUrl) => {
  try {
    // Try POST request first (TikWM API handles POST params best for long TikTok URLs)
    const params = new URLSearchParams();
    params.append('url', videoUrl);
    params.append('web', '1');

    let res = await fetch('https://www.tikwm.com/api/', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.tikwm.com/'
      },
      body: params,
      signal: AbortSignal.timeout(15000)
    }).catch(() => null);

    let data = res && res.ok ? await res.json().catch(() => null) : null;

    // Fallback to GET if POST failed
    if (!data || data?.code !== 0 || !data?.data) {
      const encodedUrl = encodeURIComponent(videoUrl);
      const apiUrl = `https://www.tikwm.com/api/?url=${encodedUrl}`;
      res = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://www.tikwm.com/'
        },
        signal: AbortSignal.timeout(15000)
      }).catch(() => null);

      if (res && res.ok) {
        data = await res.json().catch(() => null);
      }
    }

    if (data?.code === 0 && data?.data) {
      const v = data.data;
      const views   = parseInt(v.play_count,    10) || 0;
      const likes   = parseInt(v.digg_count,    10) || 0;
      const comments = parseInt(v.comment_count, 10) || 0;
      const shares  = parseInt(v.share_count,   10) || 0;

      if (views > 0 || likes > 0) {
        console.log(`[Social Service]: TikWM direct fetch — ${views} views for ${videoUrl}`);
        return { views, likes, comments, shares };
      }
    }

    console.warn(`[Social Service]: TikWM could not fetch valid metrics for ${videoUrl}`);
  } catch (error) {
    console.warn(`[Social Service]: TikWM direct video fetch failed for ${videoUrl}: ${error.message}`);
  }
  return null;
};

/**
 * Fetches latest video uploads for a TikTok user profile.
 * Strategy:
 *   1. Extract secUid from account link (if available).
 *   2. Resolve secUid via Lundehund RapidAPI /api/user/info.
 *   3. Fallback: resolve secUid via TikWM /api/user/info (free, no key needed).
 *   4. Fetch posts via Lundehund RapidAPI /api/user/posts.
 *   5. Fallback: fetch posts via TikWM /api/user/posts if Lundehund returns empty.
 */
const fetchTikTokRssVideos = async (username, accountLink) => {
  const apiKey = process.env.RAPIDAPI_KEY;
  const cleanUsername = username.replace(/^@/, '');

  try {
    let secUid = null;

    // Step 1: Extract secUid from account link query param
    if (accountLink && accountLink.includes('secUid=')) {
      try {
        const urlObj = new URL(accountLink);
        secUid = urlObj.searchParams.get('secUid');
        if (secUid) {
          console.log(`[Social Service]: Extracted secUid from account link for ${cleanUsername}: ${secUid}`);
        }
      } catch (e) {
        console.warn(`[Social Service]: Failed to parse account link URL: ${e.message}`);
      }
    }

    // Step 2: Resolve via Lundehund RapidAPI if no secUid
    if (!secUid && apiKey && apiKey !== 'YOUR_RAPIDAPI_KEY') {
      console.log(`[Social Service]: Resolving secUid via Lundehund API for ${cleanUsername}...`);
      try {
        const infoUrl = `https://tiktok-api23.p.rapidapi.com/api/user/info?uniqueId=${cleanUsername}`;
        const infoRes = await fetch(infoUrl, {
          headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': 'tiktok-api23.p.rapidapi.com'
          },
          signal: AbortSignal.timeout(20000)
        });
        if (infoRes.status === 200) {
          const text = await infoRes.text();
          if (text) {
            const infoResult = JSON.parse(text);
            secUid = infoResult?.userInfo?.user?.secUid
              || infoResult?.data?.secUid
              || infoResult?.data?.user?.secUid;
            if (secUid) {
              console.log(`[Social Service]: Resolved secUid via Lundehund for ${cleanUsername}: ${secUid}`);
            }
          }
        } else {
          console.warn(`[Social Service]: Lundehund /api/user/info returned ${infoRes.status} for ${cleanUsername}. Trying fallback...`);
        }
      } catch (e) {
        console.warn(`[Social Service]: Lundehund secUid resolve error for ${cleanUsername}: ${e.message}`);
      }
    }

    // Step 3: Fallback — resolve via TikWM (no API key required)
    if (!secUid) {
      console.log(`[Social Service]: Falling back to TikWM to resolve secUid for ${cleanUsername}...`);
      secUid = await resolveSecUidFromTikWM(cleanUsername);
    }

    // If still no secUid, try fetching posts directly via TikWM using username
    if (!secUid) {
      console.log(`[Social Service]: No secUid found for ${cleanUsername}. Attempting TikWM posts fetch directly by username...`);
      return await fetchTikTokVideosFromTikWM(cleanUsername);
    }

    // Step 4: Fetch posts via Lundehund RapidAPI
    let videosArray = [];
    if (apiKey && apiKey !== 'YOUR_RAPIDAPI_KEY') {
      console.log(`[Social Service]: Fetching posts via Lundehund for ${cleanUsername} (secUid: ${secUid})...`);
      try {
        const postsUrl = `https://tiktok-api23.p.rapidapi.com/api/user/posts?secUid=${secUid}&count=20&cursor=0`;
        const postsRes = await fetch(postsUrl, {
          headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': 'tiktok-api23.p.rapidapi.com'
          },
          signal: AbortSignal.timeout(25000)
        });

        if (postsRes.ok) {
          const postsResult = await postsRes.json();
          videosArray = postsResult?.itemList
            || postsResult?.data?.videos
            || postsResult?.data?.itemList
            || [];
          console.log(`[Social Service]: Lundehund returned ${videosArray.length} posts for ${cleanUsername}.`);
        } else {
          console.warn(`[Social Service]: Lundehund posts request failed for ${cleanUsername}. Status: ${postsRes.status}`);
        }
      } catch (e) {
        console.warn(`[Social Service]: Lundehund posts fetch error for ${cleanUsername}: ${e.message}`);
      }
    }

    // Step 5: Fallback — fetch posts via TikWM if Lundehund returned nothing
    if (videosArray.length === 0) {
      console.log(`[Social Service]: Lundehund returned 0 posts for ${cleanUsername}. Falling back to TikWM posts...`);
      return await fetchTikTokVideosFromTikWM(cleanUsername);
    }

    // Build the video list from Lundehund response format
    const videos = [];
    for (const v of videosArray) {
      const vId = v.id || v.video_id;
      if (!vId) continue;

      const createTime = v.createTime || v.create_time;
      const uploadDate = createTime
        ? new Date(createTime * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
        : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

      const rawTitle = v.desc || v.title || '';
      const title = rawTitle.length > 0
        ? (rawTitle.length > 255 ? rawTitle.substring(0, 250) + '...' : rawTitle)
        : `TikTok Video (${uploadDate})`;

      const playCount = v.stats?.playCount || v.play_count || 0;
      const diggCount = v.stats?.diggCount || v.digg_count || 0;
      const commentCount = v.stats?.commentCount || v.comment_count || 0;
      const shareCount = v.stats?.shareCount || v.share_count || 0;

      videos.push({
        title,
        link: `https://www.tiktok.com/@${cleanUsername}/video/${vId}`,
        uploadDate,
        views: parseInt(playCount, 10) || 0,
        likes: parseInt(diggCount, 10) || 0,
        comments: parseInt(commentCount, 10) || 0,
        shares: parseInt(shareCount, 10) || 0
      });
    }

    return videos;
  } catch (error) {
    console.warn(`[Social Service]: Failed to fetch TikTok videos for ${cleanUsername}: ${error.message}`);
  }
  return [];
};

/**
 * Scrapes views and likes from a public YouTube video page.
 * Tries multiple regex patterns to handle YouTube's evolving page structure.
 * Returns null if the watch page cannot be fetched or parsed.
 */
const scrapeYoutubeWatchPage = async (videoUrl) => {
  const videoId = getYoutubeVideoId(videoUrl);
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
    if (!res.ok) {
      console.warn(`[Social Service Scraper]: YouTube watch page returned ${res.status} for ${videoUrl}`);
      return null;
    }

    const html = await res.text();

    // Pattern 1: Direct viewCount in videoDetails JSON (most reliable)
    const viewPatterns = [
      /"videoDetails"[\s\S]{0,500}?"viewCount":"(\d+)"/,
      /"viewCount":"(\d+)"/,
      /"views":\{"simpleText":"([\d,]+) views"/
    ];

    let viewCount = 0;
    for (const pattern of viewPatterns) {
      const match = html.match(pattern);
      if (match) {
        // Strip commas in case of formatted number
        viewCount = parseInt(match[1].replace(/,/g, ''), 10) || 0;
        if (viewCount > 0) break;
      }
    }

    // Like count (may be unavailable on some videos)
    const likeMatch = html.match(/"likeCount":"(\d+)"/) || html.match(/"likes":\{"simpleText":"([\d,]+)"/)
    const likeCount = likeMatch ? parseInt(likeMatch[1].replace(/,/g, ''), 10) : 0;

    if (viewCount > 0) {
      console.log(`[Social Service Scraper]: YouTube watch page scraped ${viewCount} views for ${videoId}`);
      return {
        views: viewCount,
        likes: likeCount,
        comments: 0,
        shares: 0
      };
    }

    console.warn(`[Social Service Scraper]: Could not extract viewCount from YouTube page for ${videoId}`);
  } catch (error) {
    console.warn(`[Social Service Scraper]: Failed to scrape YouTube page for ${videoUrl}: ${error.message}`);
  }
  return null;
};

/**
 * Retrieves real metrics for a TikTok video.
 * Strategy:
 *   1. TikWM direct video detail API (best — works for any video by URL, no API key).
 *   2. Search through user's latest 30 posts via TikWM (fallback for videos not in direct API).
 */
const scrapeTikTokViaUserPosts = async (videoUrl, accountUsername) => {
  // Priority 1: Direct TikWM video detail — most reliable, no age/position limit
  const directMetrics = await fetchTikTokVideoMetricsFromTikWM(videoUrl);
  if (directMetrics) return directMetrics;

  // Priority 2: Search through user's latest posts as fallback
  let cleanUsername = accountUsername;
  if (!cleanUsername) {
    const match = videoUrl.match(/@([a-zA-Z0-9_.]+)/);
    if (match) cleanUsername = match[1];
  }
  if (!cleanUsername) {
    console.warn(`[Social Service]: Could not determine TikTok username for ${videoUrl}, skipping user-posts fallback`);
    return null;
  }

  cleanUsername = cleanUsername.replace(/^@/, '');
  try {
    const videos = await fetchTikTokVideosFromTikWM(cleanUsername);
    const videoIdMatch = videoUrl.match(/video\/(\d+)/);
    if (videoIdMatch && videos.length > 0) {
      const targetVideoId = videoIdMatch[1];
      const matched = videos.find(v => v.link && v.link.includes(targetVideoId));
      if (matched) {
        console.log(`[Social Service]: Matched video in user posts for ${videoUrl} — ${matched.views} views`);
        return { views: matched.views, likes: matched.likes, comments: matched.comments, shares: matched.shares };
      }
      console.warn(`[Social Service]: Video ID ${targetVideoId} not found in latest 30 posts for @${cleanUsername}`);
    }
  } catch (error) {
    console.warn(`[Social Service Scraper]: Failed to get TikTok metrics via user posts for ${videoUrl}: ${error.message}`);
  }
  return null;
};

export const syncSocialMetrics = async () => {
  console.log('[Social Service]: Starting social media content metrics synchronization...');
  
  try {
    // 1. Fetch all contents with joined username and streamer name
    const contentsRes = await query(`
      SELECT c.*, sa.username as account_username, s.nama as streamer_name
      FROM content c
      LEFT JOIN streamer_accounts sa ON c.account_id = sa.id
      JOIN streamers s ON c.streamer_id = s.id
    `);
    const contents = contentsRes.rows;
    let updatedCount = 0;

    for (const row of contents) {
      let metrics = null;

      // 2. Attempt real API fetch based on platform
      if (row.platform === 'YouTube' && row.link) {
        metrics = await fetchYoutubeMetrics(row.link);
        if (!metrics) {
          console.log(`[Social Service]: API failed/missing for YouTube, trying watch page scraper for ${row.link}...`);
          metrics = await scrapeYoutubeWatchPage(row.link);
        }
      } else if (row.platform === 'TikTok' && row.link) {
        metrics = await fetchTikTokVideoMetrics(row.link);
        if (!metrics && row.account_username) {
          try {
            const userVideos = await fetchRealTikTokVideos(row.account_username, 30);
            const videoIdMatch = row.link.match(/video\/(\d+)/);
            if (videoIdMatch) {
              const targetId = videoIdMatch[1];
              const matched = userVideos.find(v => v.id === targetId || (v.link && v.link.includes(targetId)));
              if (matched) {
                metrics = {
                  views: matched.views,
                  likes: matched.likes,
                  comments: matched.comments,
                  shares: matched.shares
                };
              }
            }
          } catch (e) {
            console.warn(`[Social Service]: Failed to sync metrics via TikTok crawler for ${row.link}: ${e.message}`);
          }
        }
      }

      // 3. Update the database only if real metrics were successfully fetched.
      // IMPORTANT: Do NOT touch created_at — it is the original record creation timestamp.
      if (metrics) {
        await query(
          `UPDATE content
           SET views = $1,
               likes = $2,
               comments = $3,
               shares = $4
           WHERE id = $5`,
          [metrics.views, metrics.likes, metrics.comments, metrics.shares, row.id]
        );
        console.log(`[Social Service]: Updated metrics for ID ${row.id} — ${metrics.views} views`);
        updatedCount++;
      } else {
        console.log(`[Social Service]: Skip updating metrics for ID ${row.id} (${row.title}) — no real data could be fetched from the platform`);
      }
    }

    console.log(`[Social Service]: Successfully synchronized real metrics for ${updatedCount} posts.`);
    return updatedCount;
  } catch (error) {
    console.error('[Social Service]: Error synchronizing social metrics:', error);
    throw error;
  }
};

/**
 * Resolves a YouTube channel URL to its canonical UC... channel ID
 */
const fetchYoutubeChannelId = async (channelUrl) => {
  try {
    // 1. If URL already has channel/UC...
    const ucMatch = channelUrl.match(/channel\/(UC[a-zA-Z0-9_-]{22})/);
    if (ucMatch) return ucMatch[1];

    // 2. Fetch profile page and extract channel ID from meta or links
    const res = await fetch(channelUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;

    const html = await res.text();
    const channelIdMatch = html.match(/channel_id=(UC[a-zA-Z0-9_-]{22})/);
    if (channelIdMatch) return channelIdMatch[1];
    
    const idMatch = html.match(/meta itemprop="channelId" content="(UC[a-zA-Z0-9_-]{22})"/);
    if (idMatch) return idMatch[1];

    const identifierMatch = html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/);
    if (identifierMatch) return identifierMatch[1];
  } catch (error) {
    console.warn(`[Social Service]: Failed to resolve YouTube channel ID for ${channelUrl}: ${error.message}`);
  }
  return null;
};

/**
 * Fetches and parses latest video uploads from YouTube RSS feed
 */
const fetchYoutubeRssVideos = async (channelId) => {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const res = await fetch(rssUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];

    const xml = await res.text();
    const entryBlocks = xml.split('<entry>');
    entryBlocks.shift(); // Remove header part before first entry
    
    const videos = [];
    for (const entry of entryBlocks) {
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
      const linkMatch = entry.match(/<link[^>]+href="([^"]+)"/);
      const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
      
      if (titleMatch && linkMatch) {
        // Strip CDATA or XML tags if any
        let title = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
        // Convert HTML entities
        title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
        
        videos.push({
          title,
          link: linkMatch[1].trim(),
          uploadDate: publishedMatch ? publishedMatch[1].split('T')[0] : new Date().toISOString().split('T')[0]
        });
      }
    }
    return videos;
  } catch (error) {
    console.warn(`[Social Service]: Failed to parse YouTube RSS for ID ${channelId}: ${error.message}`);
  }
  return [];
};

/**
 * Resolves the target streamer_id for a video based on name matching in the video title.
 * If the title contains words from any streamer's name (e.g., "Aline", "Keyla", "Brayy", "Ajo", "Rival"),
 * attributes the video to that streamer instead of the default account owner.
 */
const resolveStreamerFromTitle = (title, defaultStreamerId, allStreamers) => {
  if (!title || !allStreamers || allStreamers.length === 0) return defaultStreamerId;
  const titleLower = title.toLowerCase();

  for (const s of allStreamers) {
    // Extract name parts of length >= 3 to avoid matching tiny words
    const nameParts = s.nama.toLowerCase().split(/\s+/).filter(p => p.length >= 3);
    for (const part of nameParts) {
      if (titleLower.includes(part)) {
        console.log(`[Social Service Smart Match]: Auto-attributed video "${title.slice(0, 40)}" -> Streamer "${s.nama}" (ID: ${s.id})`);
        return s.id;
      }
    }
  }
  return defaultStreamerId;
};

/**
 * Crawls real TikTok videos directly from a user profile using python yt-dlp with browser impersonation.
 * Bypasses TikTok bot blocks and extracts real titles, video links, upload dates, views, likes, comments, and shares.
 */
export const fetchRealTikTokVideos = (username, maxVideos = 30) => {
  return new Promise((resolve) => {
    const clean = username.replace(/^@+/, '').trim();
    if (!clean) return resolve([]);

    const scriptPath = path.join(__dirname, '../scripts/crawl_tiktok.py');
    const pythonExe = process.platform === 'win32' ? 'python' : 'python3';

    const child = spawn(pythonExe, [scriptPath, clean, String(maxVideos)]);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString('utf-8');
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString('utf-8');
    });

    child.on('close', (code) => {
      if (code !== 0) {
        console.warn(`[Social Service]: Python TikTok crawler exited with code ${code} for @${clean}: ${stderr}`);
        return resolve([]);
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.warn(`[Social Service]: Failed to parse Python TikTok output for @${clean}: ${e.message}`);
        resolve([]);
      }
    });

    child.on('error', (err) => {
      console.warn(`[Social Service]: Error spawning Python TikTok crawler for @${clean}: ${err.message}`);
      resolve([]);
    });
  });
};

/**
 * Scans all registered streamer accounts and auto-discovers real new posts.
 * Crawls YouTube channels via RSS feeds and TikTok profiles using the real yt-dlp crawler.
 */
export const discoverNewContent = async () => {
  console.log('[Social Service]: Starting auto-discovery scan for real video uploads...');
  let discoveredCount = 0;

  try {
    // 1. Get all registered streamers for smart title matching
    const streamersRes = await query('SELECT id, nama FROM streamers');
    const allStreamers = streamersRes.rows;

    // 2. Get all accounts
    const accountsRes = await query(`
      SELECT sa.*, s.nama as streamer_name 
      FROM streamer_accounts sa
      JOIN streamers s ON sa.streamer_id = s.id
    `);
    const accounts = accountsRes.rows;

    for (const acc of accounts) {
      if (acc.platform === 'YouTube' && acc.link) {
        console.log(`[Social Service]: Crawling YouTube channel for streamer ${acc.streamer_name}...`);
        const channelId = await fetchYoutubeChannelId(acc.link);
        if (channelId) {
          const rssVideos = await fetchYoutubeRssVideos(channelId);
          console.log(`[Social Service]: Found ${rssVideos.length} videos in RSS feed for ${acc.streamer_name}`);
          
          for (const video of rssVideos) {
            const existsCheck = await query(
              'SELECT id FROM content WHERE link = $1',
              [video.link]
            );

            if (existsCheck.rows.length === 0) {
              const assignedStreamerId = resolveStreamerFromTitle(video.title, acc.streamer_id, allStreamers);

              const insertResult = await query(
                `INSERT INTO content (streamer_id, platform, title, upload_date, link, views, likes, comments, shares, account_id)
                 VALUES ($1, $2, $3, $4, $5, 0, 0, 0, 0, $6)
                 RETURNING id`,
                [
                  assignedStreamerId,
                  acc.platform,
                  video.title,
                  video.uploadDate,
                  video.link,
                  acc.id
                ]
              );
              const newId = insertResult.rows[0].id;

              let realMetrics = await fetchYoutubeMetrics(video.link);
              if (!realMetrics) {
                realMetrics = await scrapeYoutubeWatchPage(video.link);
              }
              if (realMetrics) {
                await query(
                  `UPDATE content SET views = $1, likes = $2, comments = $3, shares = $4 WHERE id = $5`,
                  [realMetrics.views, realMetrics.likes, realMetrics.comments, realMetrics.shares, newId]
                );
              }

              discoveredCount++;
            }
          }
        }
      } else if (acc.platform === 'TikTok' && acc.username) {
        console.log(`[Social Service]: Crawling real TikTok videos for streamer ${acc.streamer_name} (@${acc.username})...`);
        const tiktokVideos = await fetchRealTikTokVideos(acc.username, 30);
        console.log(`[Social Service]: Found ${tiktokVideos.length} real videos on TikTok for ${acc.streamer_name} (@${acc.username})`);
        
        for (const video of tiktokVideos) {
          if (!video.link) continue;

          const existsCheck = await query(
            'SELECT id FROM content WHERE link = $1',
            [video.link]
          );

          if (existsCheck.rows.length === 0) {
            const assignedStreamerId = resolveStreamerFromTitle(video.title, acc.streamer_id, allStreamers);

            await query(
              `INSERT INTO content (streamer_id, platform, title, upload_date, link, views, likes, comments, shares, account_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [
                assignedStreamerId,
                'TikTok',
                video.title,
                video.uploadDate || new Date().toISOString().split('T')[0],
                video.link,
                video.views || 0,
                video.likes || 0,
                video.comments || 0,
                video.shares || 0,
                acc.id
              ]
            );
            discoveredCount++;
          } else {
            // Update existing video metrics and title
            await query(
              `UPDATE content 
               SET views = $1, likes = $2, comments = $3, shares = $4, title = COALESCE(NULLIF($5, ''), title), upload_date = COALESCE($6, upload_date)
               WHERE id = $7`,
              [
                video.views || 0,
                video.likes || 0,
                video.comments || 0,
                video.shares || 0,
                video.title,
                video.uploadDate || null,
                existsCheck.rows[0].id
              ]
            );
          }
        }
      } else {
        console.log(`[Social Service]: Skipping crawler for ${acc.platform} account of ${acc.streamer_name}.`);
      }
    }

    console.log(`[Social Service]: Auto-discovery completed. Found & indexed ${discoveredCount} real new uploads.`);
    return discoveredCount;
  } catch (error) {
    console.error('[Social Service]: Error in auto-discovery scan:', error);
    throw error;
  }
};
