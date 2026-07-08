import { query } from '../config/db.js';

// Indonesian Month map to parse date
const INDO_MONTHS_MAP = {
  januari: '01', jan: '01',
  februari: '02', pebruari: '02', feb: '02',
  maret: '03', mar: '03',
  april: '04', apr: '04',
  mei: '05',
  juni: '06', jun: '06',
  juli: '07', jul: '07',
  agustus: '08', agt: '08', aug: '08',
  september: '09', sep: '09',
  oktober: '10', okt: '10', oct: '10',
  november: '11', nopember: '11', nov: '11',
  desember: '12', des: '12', dec: '12'
};

/**
 * Extracts content between a start keyword and any of the end keywords
 */
const getSectionBlock = (text, startWord, endWords) => {
  const startIndex = text.toUpperCase().indexOf(startWord.toUpperCase());
  if (startIndex === -1) return '';
  
  let endIndex = text.length;
  for (const endWord of endWords) {
    const idx = text.toUpperCase().indexOf(endWord.toUpperCase(), startIndex + startWord.length);
    if (idx !== -1 && idx < endIndex) {
      endIndex = idx;
    }
  }
  
  return text.substring(startIndex + startWord.length, endIndex).trim();
};

/**
 * Parses indonesian date text (e.g. "20 JUNI 2026") into ISO date "YYYY-MM-DD"
 */
const parseIndonesianDate = (dateStr) => {
  if (!dateStr) return null;
  
  // Format: "20 JUNI 2026" or "20-JUNI-2026" or "20/06/2026"
  const cleanStr = dateStr.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
  const parts = cleanStr.split(/\s+/);
  
  if (parts.length >= 3) {
    const day = parts[0].padStart(2, '0');
    const monthWord = parts[1].toLowerCase();
    const year = parts[2];
    
    // Check if month is numeric
    if (/^\d+$/.test(monthWord)) {
      return `${year}-${monthWord.padStart(2, '0')}-${day}`;
    }
    
    const monthNum = INDO_MONTHS_MAP[monthWord] || '01';
    return `${year}-${monthNum}-${day}`;
  }
  
  // If parsing fails, try JS Date parser
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch (e) {
    // Ignore and fallback
  }
  
  return null;
};

/**
 * Main parser logic
 */
export const parseMessageText = async (text) => {
  if (!text) {
    throw new Error('Message text is empty');
  }

  // 1. Parse Category (Streaming / Non Streaming)
  let kategori = 'Streaming';
  if (/non[\s-]*streaming/i.test(text)) {
    kategori = 'Non Streaming';
  } else if (/streaming/i.test(text)) {
    kategori = 'Streaming';
  }

  // 2. Parse Date
  const dateMatch = text.match(/Tanggal\s*:\s*([^\n]+)/i);
  let tanggal = null;
  if (dateMatch) {
    tanggal = parseIndonesianDate(dateMatch[1].trim());
  }
  if (!tanggal) {
    // Fallback to today
    tanggal = new Date().toISOString().split('T')[0];
  }

  // 3. Parse Streamer Name
  const nameMatch = text.match(/Nama\s*:\s*([^\n]+)/i);
  let rawName = 'Unknown';
  if (nameMatch) {
    rawName = nameMatch[1].trim();
  }

  // 4. Parse Uploads Section
  const uploadBlock = getSectionBlock(text, 'UPLOAD:', ['LIVE:', 'CHAT:', 'REGISTRASI:', 'FTD:']);
  
  const extractUpload = (block, platformRegex) => {
    const match = block.match(platformRegex);
    if (match) {
      const val = match[1].trim();
      if (val === '-' || isNaN(val)) return 0;
      return parseInt(val, 10);
    }
    return 0;
  };

  const tiktokUpload = extractUpload(uploadBlock, /TikTok\s*:\s*(\d+|-)/i);
  const youtubeUpload = extractUpload(uploadBlock, /Youtube\s*(?:Short)?\s*:\s*(\d+|-)/i);
  const instagramUpload = extractUpload(uploadBlock, /Instagram\s*(?:Reels)?\s*:\s*(\d+|-)/i);
  const facebookUpload = extractUpload(uploadBlock, /Facebook\s*(?:FP)?\s*:\s*(\d+|-)/i);

  // 5. Parse Live Duration Section
  const liveBlock = getSectionBlock(text, 'LIVE:', ['CHAT:', 'REGISTRASI:', 'FTD:']);
  let liveDuration = 0.0;
  const liveMatch = liveBlock.match(/([\d.,]+)/);
  if (liveMatch) {
    const val = liveMatch[1].replace(',', '.');
    liveDuration = parseFloat(val) || 0.0;
  }

  // 6. Parse Chats Section
  const chatBlock = getSectionBlock(text, 'CHAT:', ['REGISTRASI:', 'FTD:']);
  let chatCount = 0;
  const chatMatch = chatBlock.match(/(\d+)/);
  if (chatMatch) {
    chatCount = parseInt(chatMatch[1], 10) || 0;
  }

  // 7. Parse Registration Section
  const regBlock = getSectionBlock(text, 'REGISTRASI:', ['FTD:']);
  let registrationCount = 0;
  const regMatch = regBlock.match(/(\d+)/);
  if (regMatch) {
    registrationCount = parseInt(regMatch[1], 10) || 0;
  }

  // 8. Parse FTD Section
  const ftdBlock = getSectionBlock(text, 'FTD:', []);
  let ftdCount = 0;
  const ftdMatch = ftdBlock.match(/(\d+)/);
  if (ftdMatch) {
    ftdCount = parseInt(ftdMatch[1], 10) || 0;
  }

  // 9. Match Streamer in DB or Auto-Create
  let streamerId = null;
  let streamerNameMatched = rawName;

  // Let's attempt to match streamer name.
  // First, exact search
  let streamerRes = await query('SELECT id, nama FROM streamers WHERE LOWER(nama) = LOWER($1)', [rawName]);
  
  // If not found, and name contains a slash (e.g. Tizza/Got), check each part
  if (streamerRes.rows.length === 0 && rawName.includes('/')) {
    const parts = rawName.split('/').map(p => p.trim());
    for (const part of parts) {
      const partRes = await query('SELECT id, nama FROM streamers WHERE LOWER(nama) = LOWER($1)', [part]);
      if (partRes.rows.length > 0) {
        streamerRes = partRes;
        streamerNameMatched = partRes.rows[0].nama;
        break;
      }
    }
  }

  if (streamerRes.rows.length > 0) {
    streamerId = streamerRes.rows[0].id;
  } else {
    // Self-healing: create new streamer dynamically!
    // Try to determine main platform from the report or default to TikTok
    let platform = 'TikTok';
    if (youtubeUpload > 0) platform = 'YouTube';
    else if (instagramUpload > 0) platform = 'Instagram';
    else if (facebookUpload > 0) platform = 'Facebook';

    // If name contains slashes, we'll use the first part as name
    const cleanName = rawName.split('/')[0].trim();
    const newStreamer = await query(
      'INSERT INTO streamers (nama, platform) VALUES ($1, $2) RETURNING id, nama',
      [cleanName || 'Unknown Streamer', platform]
    );
    streamerId = newStreamer.rows[0].id;
    streamerNameMatched = newStreamer.rows[0].nama;
    console.log(`Auto-created missing streamer: ${streamerNameMatched} (ID: ${streamerId})`);
  }

  // 10. Upsert into daily_reports table
  const insertRes = await query(
    `INSERT INTO daily_reports (
      tanggal, streamer_id, kategori, 
      tiktok_upload, youtube_upload, instagram_upload, facebook_upload, 
      live_duration, chat_count, registration_count, ftd_count, raw_message
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (tanggal, streamer_id) DO UPDATE SET
      kategori = EXCLUDED.kategori,
      tiktok_upload = EXCLUDED.tiktok_upload,
      youtube_upload = EXCLUDED.youtube_upload,
      instagram_upload = EXCLUDED.instagram_upload,
      facebook_upload = EXCLUDED.facebook_upload,
      live_duration = EXCLUDED.live_duration,
      chat_count = EXCLUDED.chat_count,
      registration_count = EXCLUDED.registration_count,
      ftd_count = EXCLUDED.ftd_count,
      raw_message = EXCLUDED.raw_message
    RETURNING *`,
    [
      tanggal,
      streamerId,
      kategori,
      tiktokUpload,
      youtubeUpload,
      instagramUpload,
      facebookUpload,
      liveDuration,
      chatCount,
      registrationCount,
      ftdCount,
      text
    ]
  );

  return {
    report: insertRes.rows[0],
    streamerName: streamerNameMatched,
    parsedData: {
      tanggal,
      streamerName: rawName,
      kategori,
      uploads: {
        tiktok: tiktokUpload,
        youtube: youtubeUpload,
        instagram: instagramUpload,
        facebook: facebookUpload
      },
      liveDuration,
      chatCount,
      registrationCount,
      ftdCount
    }
  };
};
