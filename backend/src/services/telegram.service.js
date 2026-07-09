import { query } from '../config/db.js';

// ============================================================
// MONTH MAP (Indonesian + English)
// ============================================================
const MONTH_MAP = {
  januari: '01', jan: '01',
  februari: '02', pebruari: '02', feb: '02',
  maret: '03', mar: '03',
  april: '04', apr: '04',
  mei: '05', may: '05',
  juni: '06', jun: '06', june: '06', juny: '06',
  juli: '07', jul: '07', july: '07',
  agustus: '08', agt: '08', aug: '08', august: '08',
  september: '09', sep: '09', sept: '09',
  oktober: '10', okt: '10', oct: '10', october: '10',
  november: '11', nopember: '11', nov: '11',
  desember: '12', des: '12', dec: '12', december: '12',
};


// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/** Extract first integer from a string (handles "3,5" → 3, "1(udah)" → 1) */
const toInt = (str) => {
  if (!str || typeof str !== 'string') return 0;
  const val = str.trim();
  if (val === '-' || val === '') return 0;
  // "minggu (1), senin (1)" → sum all numbers
  const nums = val.match(/\d+/g);
  if (!nums) return 0;
  // If multiple numbers and contains text like "minggu", "senin" → sum them
  if (nums.length > 1 && /[a-zA-Z]/.test(val)) {
    return nums.reduce((a, b) => a + parseInt(b), 0);
  }
  return Math.round(parseFloat(nums[0].replace(',', '.')));
};

/** Strip all emoji characters (leading, trailing, and components) globally while keeping numbers intact */
const stripEmoji = (str) =>
  str.replace(/(?![0-9#*])[\p{Extended_Pictographic}\p{Emoji_Component}\p{Emoji_Modifier}]/gu, '').trim();

/** Build ISO date from day/month/year parts */
const buildDate = (day, monthStr, year) => {
  const key = monthStr.toLowerCase().replace(/[^a-z]/g, '');
  const month = MONTH_MAP[key];
  if (!month) return null;
  const yr = year ? String(year) : String(new Date().getFullYear());
  return `${yr}-${month}-${String(day).padStart(2, '0')}`;
};

// ============================================================
// STEP 1: Strip Telegram export message header
// "[DD/MM/YYYY HH.MM] SenderName: ..."
// ============================================================
const stripTelegramHeader = (rawText) => {
  const match = rawText.match(/^\[(\d{2})\/(\d{2})\/(\d{4})\s+[\d.:]+\]\s+[^:]+:\s*/);
  if (match) {
    const fallbackDate = `${match[3]}-${match[2]}-${match[1]}`;
    return { fallbackDate, body: rawText.slice(match[0].length).trim() };
  }
  return { fallbackDate: null, body: rawText.trim() };
};

// ============================================================
// STEP 2: Parse date from message body
// ============================================================
const parseDate = (text, fallbackDate) => {
  // A: 📆 / HARI / TANGGAL : (RABU /) 3 sep 2025
  const tanggalMatch = text.match(/(?:HARI\s*\/\s*)?TANGGAL\s*:\s*([^\n]+)/i)
    || text.match(/📆\s*:?\s*([^\n]+)/u);

  if (tanggalMatch) {
    const raw = tanggalMatch[1].trim();
    // Skip if value is just "STREAMING" or "NON STREAMING"
    if (!/^(?:non\s+)?streaming$/i.test(raw)) {
      const d = parseDateString(raw);
      if (d) return d;
    }
  }

  // B: 📅Wednesday 3 Sep 2025  or  📝Thursday 4 Sep 2025
  const emojiDate = text.match(/[📅📝]\s*(?:\w+\s+)?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/u);
  if (emojiDate) {
    const d = buildDate(emojiDate[1], emojiDate[2], emojiDate[3]);
    if (d) return d;
  }

  // C: First few lines — Indonesian day + date (e.g. "Selasa 2 september")
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 3)) {
    const m = line.match(/(?:senin|selasa|rabu|kamis|jumat|sabtu|minggu)\s+(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))?/i);
    if (m) {
      const d = buildDate(m[1], m[2], m[3]);
      if (d) return d;
    }
  }

  return fallbackDate || new Date().toISOString().slice(0, 10);
};

/** Parse a raw date string that may be multi-date or with day name prefix */
const parseDateString = (raw) => {
  if (!raw) return null;
  const cleanRaw = raw.replace(/^\//, '').trim();

  // Handle ranges like "1-7 JUL 2026" or "30 juni- 7 july 2026"
  if (cleanRaw.includes('-') || cleanRaw.toLowerCase().includes('sampai') || cleanRaw.toLowerCase().includes('s/d')) {
    const parts = cleanRaw.split(/[-]|sampai|s\/d/i);
    if (parts.length > 1) {
      const secondPart = parts[1].trim();
      const d = parseDateString(secondPart);
      if (d) return d;
    }
  }

  // Multi-date with comma: "18,19,20, sep 2025"
  let m = cleanRaw.match(/(\d{1,2})[,\/\s][\d,\/\s]*([A-Za-z]+)\s*(\d{4})/);
  if (m) return buildDate(m[1], m[2], m[3]);

  // Normal: "3 sep 2025" or "RABU / 3 sep 2025"
  m = cleanRaw.match(/(?:\w+\s*\/\s*)?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) return buildDate(m[1], m[2], m[3]);

  // Without year: "3 sep"
  m = cleanRaw.match(/(\d{1,2})\s+([A-Za-z]+)/);
  if (m) return buildDate(m[1], m[2], null);

  return null;
};

// ============================================================
// STEP 3: Extract streamer name
// ============================================================
const extractName = (text) => {
  // A: Lines with person emoji before name, allow optional leading whitespace
  // e.g. "👱🏻‍♀️ : Dara / katrinee_09"  "😎: laflanca/ Qamil"  "🙋🏼 : Anandarioo" "🤩:Ratu"
  const personEmojiRE = /^\s*[👱🙋😎👤👩👨🧑🤩✈]\S*?\s*:?\s*([^\n\r]+)/mu;
  const personMatch = text.match(personEmojiRE);
  if (personMatch) {
    const candidate = normalizeName(personMatch[1]);
    if (candidate) return candidate;
  }

  // A2: Lines starting with a colon (e.g. ": laflanca/ Qamil alvano")
  const colonMatch = text.match(/^\s*:\s*([^:\n\r]+)/m);
  if (colonMatch) {
    const candidate = normalizeName(colonMatch[1]);
    if (candidate) return candidate;
  }

  // B: Line starting with non-person emoji then name (e.g. "✈️Brayy")
  const emojiPrefixRE = /^\s*[\p{Emoji}]+([A-Za-z][^\n]{1,25})/mu;
  const emojiPrefixMatch = text.match(emojiPrefixRE);
  if (emojiPrefixMatch) {
    const candidate = emojiPrefixMatch[1].trim();
    // Must not be a date or keyword
    if (!/^(?:STREAMING|NON|HARI|TANGGAL|\d)/i.test(candidate) && candidate.length < 40) {
      const normalized = normalizeName(candidate);
      if (normalized) return normalized;
    }
  }

  // C: Standalone name line (after header, before UPLOAD section)
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const headerKeywords = /^(?:STREAMING|NON STREAMING|NONSTREAM|📆|📅|📝|HARI|TANGGAL|UPLOAD|SESI|CHAT|JUMLAH)/i;
  let passedHeader = false;

  for (const line of lines) {
    if (headerKeywords.test(line)) {
      passedHeader = true;
      continue;
    }
    if (passedHeader && line.length > 0 && line.length < 40 && !line.includes(':')) {
      const clean = stripEmoji(line);
      if (clean.length > 0 && /[A-Za-z]/.test(clean)) {
        const normalized = normalizeName(clean);
        if (normalized) return normalized;
      }
    }
    if (/UPLOAD/i.test(line)) break;
  }

  return null;
};

/** Clean and normalize a raw name string */
const normalizeName = (raw) => {
  if (!raw) return null;
  let name = raw.trim();
  // Strip leading/trailing emoji
  name = stripEmoji(name);
  // Remove special chars that aren't part of a name
  name = name.replace(/[📀✅❌⭐️📌]/g, '').trim();
  // Strip colon at start
  name = name.replace(/^[:\s]+/, '').trim();
  // Take first part before " / " (name / username) or "/" after >2 chars
  if (name.includes(' / ')) name = name.split(' / ')[0].trim();
  else if (name.includes('/') && name.indexOf('/') > 2) name = name.split('/')[0].trim();
  
  // Trim again
  name = name.trim();

  // Rejection rules: ignore day names, date/time words, and numeric strings
  const dayNames = /^(?:senin|selasa|rabu|kamis|jumat|sabtu|minggu|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i;
  const ignoreKeywords = /^(?:upload|vidio|video|live|jam|sesi|chat|registrasi|ftd|ttd|total|nonstream|streaming|hari|tanggal|nama|streamer|rekap|laporan)$/i;
  const isDateOrNumber = /^[\d\s.,\/\-()]+$/;
  const containsYear = /\b\d{4}\b/;
  const containsMonth = /\b(?:jan|feb|mar|apr|mei|may|jun|jul|aug|agt|sep|okt|oct|nov|dec|des)[a-z]*\b/i;
  
  if (
    dayNames.test(name) ||
    ignoreKeywords.test(name) ||
    isDateOrNumber.test(name) ||
    containsYear.test(name) ||
    containsMonth.test(name) ||
    name.length < 2
  ) {
    return null;
  }

  // Reject group admins/hosts who are not streamers
  const excludedStreamers = [
    'apriyan', 'admin casper', 'stevan', 'kuro trade', 'alwi komar', 'casperbot', 'casper bot'
  ];
  if (excludedStreamers.includes(name.toLowerCase().trim())) {
    return null;
  }

  return name;
};

// ============================================================
// STEP 4: Extract upload counts
// ============================================================
const extractUploads = (text) => {
  let tiktok = 0, youtube = 0, instagram = 0, facebook = 0;
  const lines = text.split('\n');

  for (const line of lines) {
    const up = line.toUpperCase().trim();
    // Skip if this is a SESI LIVE line
    if (/^JAM\s*(?:ONTIME)?/i.test(up)) continue;

    // Extract number from end: "TIKTOK : 3 Video ✅" → 3, "TIKTOK : ✅" → 1
    const afterColon = (line.split(':').slice(1).join(':')).trim();
    const numMatch = afterColon.match(/\d+/);
    // If there's a checkmark but no number → count as 1 video
    const hasCheck = /[✅☑️]/.test(afterColon);
    const count = numMatch ? parseInt(numMatch[0]) : (hasCheck ? 1 : 0);

    if (/^TIK?\s*TOK/i.test(up)) {
      tiktok += count;
    } else if (/^YOUTUBE|^YT\b/i.test(up)) {
      youtube += count;
    } else if (/^INSTAGRAM|^INSTAGRAM\s+REELS|^INSTAGRAM\s+FEELS/i.test(up)) {
      instagram += count;
    } else if (/^FACEBOOK/i.test(up)) {
      facebook += count;
    }
  }

  return { tiktok, youtube, instagram, facebook };
};

// ============================================================
// STEP 5: Extract live duration (hours / sessions)
// ============================================================
const extractLive = (text) => {
  // A: Detailed sessions with parentheses: e.g. "Jam 09:00 (1.5 jam)" or "Jam 14:00 (2 jam)"
  const parenthesizedJams = [...text.matchAll(/\(\s*(\d+(?:[.,]\d+)?)\s*jam\s*\)/gi)];
  if (parenthesizedJams.length > 0) {
    const total = parenthesizedJams.reduce((sum, match) => {
      return sum + parseFloat(match[1].replace(',', '.'));
    }, 0);
    return Math.round(total);
  }

  // B: "LIVE : 5 JAM" or "LIVE: 5 JAM"
  const liveJam = text.match(/\bLIVE\s*[:\s]+(\d+(?:[.,]\d+)?)\s*JAM/i);
  if (liveJam) return Math.round(parseFloat(liveJam[1].replace(',', '.')));


  // B: "YouTube : 6 jam" or "YouTube : 5 jam" inside SESI LIVE block
  const ytJam = text.match(/YouTube\s*:\s*(\d+(?:[.,]\d+)?)\s*jam/i);
  if (ytJam) return Math.round(parseFloat(ytJam[1].replace(',', '.')));

  // C: "Total live : 3 jam"
  const totalJam = text.match(/Total\s+live\s*:\s*(\d+(?:[.,]\d+)?)\s*(?:jam)/i);
  if (totalJam) return Math.round(parseFloat(totalJam[1].replace(',', '.')));

  // D: "Total live : 3 sesi" → treat as 3 hours (1 session ≈ 1 hour)
  const totalSesi = text.match(/Total\s+live\s*:\s*(\d+)\s*sesi/i);
  if (totalSesi) return parseInt(totalSesi[1]);

  // E: "SESI LIVE: 4jam"  or  "Sesi live: 3 jam"
  const sesiJam = text.match(/SESI\s+LIVE\s*[:\s]+(\d+(?:[.,]\d+)?)\s*jam/i);
  if (sesiJam) return Math.round(parseFloat(sesiJam[1].replace(',', '.')));

  // F: Count "JAM : HH:MM" or "JAM ONTIME : HH:MM" lines (numeric time only)
  const jamLines = (text.match(/^JAM\s*(?:ONTIME)?\s*:\s*[\d.:]+/gim) || [])
    .filter(l => /\d{1,2}[:.]\d{2}/.test(l));
  if (jamLines.length > 0) return jamLines.length;

  return 0;
};

// ============================================================
// STEP 6: Extract chat / registrasi / FTD
// ============================================================
const extractField = (text, ...patterns) => {
  for (const pattern of patterns) {
    const re = new RegExp(`(?:${pattern})\\s*[:\\.]+[ \\t]*([^\\n\\r]+)`, 'i');
    const m = text.match(re);
    if (m) return toInt(m[1]);
  }
  return 0;
};

// ============================================================
// STEP 7: Kategori
// ============================================================
const extractKategori = (text) => {
  // Get first part before any divider lines
  const parts = text.split(/^\s*[-_]+\s*$/m);
  let firstPart = parts[0].trim();

  // Remove the joint placeholder "STREAMING NON STREAMING" or "STREAMING NONSTREAMING"
  firstPart = firstPart.replace(/STREAMING\s+NON\s*STREAMING/i, '');
  firstPart = firstPart.replace(/STREAMING\s+NON\s*STREAM/i, '');

  const up = firstPart.toUpperCase();

  // If there's any live duration parsed in the first part, it must be Streaming
  const liveHours = extractLive(firstPart);
  if (liveHours > 0) {
    return 'Streaming';
  }

  if (up.includes('NON STREAMING') || up.includes('NONSTREAM')) {
    return 'Non Streaming';
  }

  if (up.includes('STREAMING')) {
    return 'Streaming';
  }

  return 'Streaming';
};

// ============================================================
// BULK FORMAT HANDLER
// (Rival Suhanda format: 1 message, N streamers each with "Total vidio/live/chat/registrasi/ftd")
// ============================================================
const isBulkFormat = (body) =>
  /Total\s+vi[dt]io/i.test(body) && /Total\s+(?:live|registrasi|ftd|ttd)/i.test(body);

const parseBulkBlocks = (body, date) => {
  const lines = body.split('\n').map(l => l.trim());
  const blocks = [];
  let currentName = null;
  let currentLines = [];

  for (const line of lines) {
    if (!line) continue;

    const looksLikeName =
      line.length > 0 &&
      line.length < 30 &&
      !line.includes(':') &&
      !/^(?:total|senin|selasa|rabu|kamis|jumat|sabtu|minggu|\d)/i.test(line) &&
      /[A-Za-z]/.test(line);

    if (looksLikeName) {
      if (currentName) blocks.push({ name: currentName, text: currentLines.join('\n') });
      currentName = line;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentName) blocks.push({ name: currentName, text: currentLines.join('\n') });

  return blocks.map(b => ({
    name: b.name,
    date,
    kategori: 'Streaming',
    uploads: extractUploads(b.text),
    totalVidio: toInt(b.text.match(/Total\s+vi[dt]io\s*:\s*([^\n]+)/i)?.[1]),
    liveDuration: extractLive(b.text) || toInt(b.text.match(/Total\s+live\s*:\s*([^\n]+)/i)?.[1]),
    chatCount: extractField(b.text, 'Total\\s+chat', 'CHAT\\s+MASUK', 'CHAT'),
    registrationCount: extractField(b.text, 'Total\\s+registrasi', 'JUMLAH\\s+REGISTRASI'),
    ftdCount: extractField(b.text, 'Total\\s+(?:ftd|ttd)', 'JUMLAH\\s+(?:FTD|TTD)'),
  }));
};

// ============================================================
// DB HELPERS
// ============================================================
const upsertStreamer = async (rawName, uploads) => {
  let name = normalizeName(rawName) || rawName.split('/')[0].trim();

  // ── ALIAS MAP ────────────────────────────────────────────────
  // Maps common Telegram display-name variants → canonical DB name
  const ALIAS_MAP = {
    // Ajo
    'ajo candle'      : 'Ajo',
    'ajo'             : 'Ajo',
    // Tizza
    'teizza got'      : 'Tizza',
    'tizza/got'       : 'Tizza',
    'tizza got'       : 'Tizza',
    'tizza'           : 'Tizza',
    // Ratu
    'ratu valencia'   : 'Ratu',
    'ratu'            : 'Ratu',
    // Aline
    'aline'           : 'Aline',
    // Bagas
    'bagas'           : 'Bagas',
    'bgbas'           : 'Bagas',
    // Brayy
    'brayy candle'    : 'Brayy',
    'brayy'           : 'Brayy',
    'arief lutfi'     : 'Brayy',
    // Laflanca = Qamil Alvaro
    'laflanca'        : 'Laflanca',
    'qamil alvaro'    : 'Laflanca',
    'qamil alvano'    : 'Laflanca',
    'qamil'           : 'Laflanca',
    // Rival Suhanda
    'rival suhanda'   : 'Rival Suhanda',
    'rival'           : 'Rival Suhanda',
    // Katrineely
    'katrineely'      : 'Katrineely',
    'katrine'         : 'Katrineely',
    'dara'            : 'Katrineely',
    // Keylaa
    'keylaa'          : 'Keylaa',
    'keyla'           : 'Keylaa',
    // BG Chenn
    'bg chenn'        : 'BG Chenn',
    'bg chen'         : 'BG Chenn',
    'bgchenn'         : 'BG Chenn',
    'bgchen'          : 'BG Chenn',
    'anandarioo'      : 'BG Chenn',
  };

  const lowerName = name.toLowerCase().trim();
  const NON_STREAMERS = [
    'admin casper', 'stevan', 'kuro trade', 'kurotrade',
    'alwi komar', 'apriyan', 'casperbot', 'casper bot'
  ];
  if (NON_STREAMERS.includes(lowerName)) {
    throw new Error(`Nama "${name}" terdaftar sebagai Admin/Owner/Bot, bukan streamer.`);
  }

  if (ALIAS_MAP[lowerName]) {
    name = ALIAS_MAP[lowerName];
  }

  let res = await query('SELECT id FROM streamers WHERE LOWER(nama) = LOWER($1)', [name]);
  if (res.rows.length > 0) return res.rows[0].id;

  // Fuzzy: try first part before slash
  if (rawName.includes('/')) {
    const first = rawName.split('/')[0].trim();
    res = await query('SELECT id FROM streamers WHERE LOWER(nama) = LOWER($1)', [first]);
    if (res.rows.length > 0) return res.rows[0].id;
  }

  // Instead of auto-creating, throw an error to keep database clean
  throw new Error(`Streamer "${name}" tidak terdaftar di database.`);
};

const upsertReport = async (tanggal, streamerId, kategori, uploads, liveDuration, chatCount, registrationCount, ftdCount, rawMessage) => {
  const { tiktok = 0, youtube = 0, instagram = 0, facebook = 0, totalVidio = 0 } = uploads;

  // If individual upload counts are all 0 but we have a total, distribute to tiktok
  const ttiktok = tiktok || (tiktok + youtube + instagram + facebook === 0 ? totalVidio : 0);

  const res = await query(
    `INSERT INTO daily_reports (
       tanggal, streamer_id, kategori,
       tiktok_upload, youtube_upload, instagram_upload, facebook_upload,
       live_duration, chat_count, registration_count, ftd_count, raw_message
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (tanggal, streamer_id) DO UPDATE SET
       kategori          = EXCLUDED.kategori,
       tiktok_upload     = EXCLUDED.tiktok_upload,
       youtube_upload    = EXCLUDED.youtube_upload,
       instagram_upload  = EXCLUDED.instagram_upload,
       facebook_upload   = EXCLUDED.facebook_upload,
       live_duration     = EXCLUDED.live_duration,
       chat_count        = EXCLUDED.chat_count,
       registration_count= EXCLUDED.registration_count,
       ftd_count         = EXCLUDED.ftd_count,
       raw_message       = EXCLUDED.raw_message
     RETURNING *`,
    [tanggal, streamerId, kategori,
     ttiktok, youtube, instagram, facebook,
     liveDuration || 0, chatCount || 0, registrationCount || 0, ftdCount || 0,
     rawMessage]
  );
  return res.rows[0];
};

// ============================================================
// MAIN EXPORT: parseMessageText
// Returns array of results (supports both single and bulk format)
// ============================================================
export const parseMessageText = async (rawText) => {
  const { fallbackDate, body } = stripTelegramHeader(rawText);
  const cleanBody = body.replace(/\r/g, '');

  // ── BULK FORMAT (Rival Suhanda) ──
  if (isBulkFormat(cleanBody)) {
    const date = parseDate(cleanBody, fallbackDate);
    const blocks = parseBulkBlocks(cleanBody, date);
    if (blocks.length === 0) throw new Error('Format bulk terdeteksi tapi tidak ada data streamer.');

    const results = [];
    for (const block of blocks) {
      if (!block.name || block.name.length < 2) continue;
      const streamerId = await upsertStreamer(block.name, block.uploads);
      const report = await upsertReport(
        block.date, streamerId, block.kategori,
        { ...block.uploads, totalVidio: block.totalVidio },
        block.liveDuration, block.chatCount, block.registrationCount, block.ftdCount,
        rawText
      );
      results.push({
        report,
        streamerName: block.name,
        parsedData: {
          tanggal: block.date,
          streamerName: block.name,
          kategori: block.kategori,
          uploads: block.uploads,
          liveDuration: block.liveDuration,
          chatCount: block.chatCount,
          registrationCount: block.registrationCount,
          ftdCount: block.ftdCount,
        }
      });
    }

    if (results.length === 0) throw new Error('Tidak ada data valid dalam laporan bulk.');
    // Return first result but attach all in bulkResults
    return Object.assign(results[0], { bulkResults: results });
  }

  // ── SINGLE FORMAT ──
  const parts = cleanBody.split(/^\s*[-_]+\s*$/m);
  const todayReportText = parts[0].trim();

  const tanggal   = parseDate(todayReportText, fallbackDate);
  const kategori  = extractKategori(todayReportText);
  const rawName   = extractName(todayReportText);

  if (!rawName) throw new Error('Nama streamer tidak ditemukan. Pastikan ada nama setelah header laporan.');

  const uploads           = extractUploads(todayReportText);
  const liveDuration      = extractLive(todayReportText);
  const chatCount         = extractField(todayReportText, 'CHAT\\s+MASUK\\s*(?:WA/TELE|TELE|DM|TT|TELEGRAM)?', 'Total\\s+chat');
  const registrationCount = extractField(todayReportText, 'JUMLAH\\s+REGISTRASI', 'Total\\s+registrasi');
  const ftdCount          = extractField(todayReportText, 'JUMLAH\\s+FTD', 'JUMLAH\\s+TTD', 'Total\\s+(?:ftd|ttd)');

  const streamerId = await upsertStreamer(rawName, uploads);
  const report     = await upsertReport(
    tanggal, streamerId, kategori,
    uploads, liveDuration, chatCount, registrationCount, ftdCount,
    rawText
  );

  return {
    report,
    streamerName: rawName,
    parsedData: {
      tanggal,
      streamerName: rawName,
      kategori,
      uploads,
      liveDuration,
      chatCount,
      registrationCount,
      ftdCount,
    }
  };
};

export default { parseMessageText };
