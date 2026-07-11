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

/** Build ISO date from day/month/year parts with auto-correction for template year typos */
const buildDate = (day, monthStr, year) => {
  const key = monthStr.toLowerCase().replace(/[^a-z]/g, '');
  const month = MONTH_MAP[key];
  if (!month) return null;
  
  const currentYear = new Date().getFullYear();
  let yr = currentYear;
  if (year) {
    yr = parseInt(year, 10);
  }
  
  // Construct the parsed date object
  const parsedDate = new Date(`${yr}-${month}-${String(day).padStart(2, '0')}`);
  const today = new Date();
  
  // Calculate date difference in days
  const diffTime = Math.abs(today - parsedDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // If the parsed date is more than 30 days in the past or future,
  // it is highly likely a template year typo. Auto-correct to current year.
  if (isNaN(parsedDate.getTime()) || diffDays > 30) {
    return `${currentYear}-${month}-${String(day).padStart(2, '0')}`;
  }
  
  return `${yr}-${month}-${String(day).padStart(2, '0')}`;
};

// Parse header date string into YYYY-MM-DD
const parseHeaderDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split(/[\/\.-]/);
  if (parts.length === 3) {
    let day = parts[0].padStart(2, '0');
    let month = parts[1].padStart(2, '0');
    let year = parts[2];
    if (year.length === 2) {
      year = '20' + year;
    }
    return `${year}-${month}-${day}`;
  }
  return null;
};

// ============================================================
// STEP 1: Strip Telegram export message header
// "[DD/MM/YYYY HH.MM] SenderName: ..." (supports various separators)
// ============================================================
const stripTelegramHeader = (rawText) => {
  const match = rawText.match(/^\[([\d/\.-]+)\s+([\d.:\s\w]+)\]\s+([^:]+):\s*/i);
  if (match) {
    const fallbackDate = parseHeaderDate(match[1]);
    const fallbackSender = match[3].trim();
    return { fallbackDate, fallbackSender, body: rawText.slice(match[0].length).trim() };
  }
  return { fallbackDate: null, fallbackSender: null, body: rawText.trim() };
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

  // Handle slash ranges: "8/9 Juli 2025" or "8 / 9 Juli 2025"
  const slashRange = cleanRaw.match(/^(\d{1,2})\s*[\/]\s*(\d{1,2})\s+([A-Za-z]+.*)$/);
  if (slashRange) {
    const secondPart = `${slashRange[2]} ${slashRange[3]}`.trim();
    const d = parseDateString(secondPart);
    if (d) return d;
  }

  // Numeric dates: "10/07/2026", "10-07-2026", or "10.07.2026"
  let numDateMatch = cleanRaw.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})$/);
  if (numDateMatch) {
    let day = numDateMatch[1].padStart(2, '0');
    let month = numDateMatch[2].padStart(2, '0');
    let year = numDateMatch[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
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
const extractName = (text) => {
  // A0: Explicit "Nama : VALUE" or "NAMA: VALUE" field check (highest priority)
  const explicitNameMatch = text.match(/^\s*Nama\s*:\s*([^\n\r]+)/mi);
  if (explicitNameMatch) {
    const candidate = normalizeName(explicitNameMatch[1]);
    if (candidate) return candidate;
  }

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
  // Strip leading "Streamer:" prefix
  name = name.replace(/^streamer\s*:\s*/i, '').trim();
  // Strip leading "@" sign from Telegram username formats
  name = name.replace(/^@+/, '').trim();
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
  // Reject strings that contain time/duration keywords like "2 jam", "3 sesi"
  const containsDurationWord = /\b(?:jam|sesi|menit|detik|video|vidio)\b/i;
  
  if (
    dayNames.test(name) ||
    ignoreKeywords.test(name) ||
    isDateOrNumber.test(name) ||
    containsYear.test(name) ||
    containsMonth.test(name) ||
    containsDurationWord.test(name) ||
    name.length < 2
  ) {
    return null;
  }

  // Reject group admins/hosts who are not streamers
  const excludedStreamers = [
    'apriyan', 'stevan', 'kuro trade', 'alwi komar', 'casperbot', 'casper bot'
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

    // Extract number: handle both with and without colons (e.g. "TIKTOK : 3 Video" or "TIKTOK 3 Video")
    const afterColon = line.includes(':') ? (line.split(':').slice(1).join(':')).trim() : line.trim();
    const numMatch = afterColon.match(/\d+/);
    // If there's a checkmark but no number → count as 1 video
    const hasCheck = /[✅☑️]/.test(afterColon);
    const count = numMatch ? parseInt(numMatch[0]) : (hasCheck ? 1 : 0);

    if (/^(?:TIK?\s*TOK|TT)\b/i.test(up)) {
      tiktok += count;
    } else if (/^(?:YOUTUBE|YT|YUTUB|UTUBE|YOTUBE|YOUTUB)\b/i.test(up)) {
      youtube += count;
    } else if (/^(?:INSTAGRAM|IG|INSTA|REELS|REEL|FEELS)\b/i.test(up)) {
      instagram += count;
    } else if (/^(?:FACEBOOK|FB)\b/i.test(up)) {
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

  // B: "LIVE : 5 JAM" or "LIVE: 5 JAM" (same line)
  const liveJam = text.match(/\bLIVE\s*[:\s]+(\d+(?:[.,]\d+)?)\s*JAM/i);
  if (liveJam) return Math.round(parseFloat(liveJam[1].replace(',', '.')));

  // B2: Multi-line LIVE block: "LIVE:\n2 jam\n2 jam" → sum all bare "X jam" lines after LIVE:
  const liveBlockMatch = text.match(/\bLIVE\s*:\s*\n([\s\S]*?)(?=\n[A-Z]{2,}\s*:|$)/i);
  if (liveBlockMatch) {
    const blockLines = liveBlockMatch[1].split('\n');
    let total = 0;
    for (const bl of blockLines) {
      const m = bl.trim().match(/^(\d+(?:[.,]\d+)?)\s*jam/i);
      if (m) total += parseFloat(m[1].replace(',', '.'));
    }
    if (total > 0) return Math.round(total);
  }


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
  const lines = text.split('\n').map(l => l.trim());
  for (const pattern of patterns) {
    const re = new RegExp(pattern, 'i');
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        // 1. Check same line after pattern (stripping leading colons, spaces, dashes)
        const rest = lines[i].replace(re, '').replace(/^[:\.\-\s]+/, '').trim();
        const numMatch = rest.match(/\d+/);
        if (numMatch) {
          return toInt(numMatch[0]);
        }
        
        // 2. If same line has no number, look at the next lines (skipping empty lines, max 2 lines ahead)
        for (let offset = 1; offset <= 2; offset++) {
          if (i + offset < lines.length) {
            const targetLine = lines[i + offset].trim();
            if (targetLine === '') continue; // skip empty line
            const numMatch = targetLine.match(/\d+/);
            if (numMatch) {
              return toInt(numMatch[0]);
            }
            break; // Stop if we hit a non-empty line without a number
          }
        }
      }
    }
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

  if (up.includes('NON STREAMING') || up.includes('NONSTREAM') || up.includes('LIBUR') || up.includes('OFF') || up.includes('TIDAK LIVE')) {
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
    'stevan', 'kuro trade', 'kurotrade',
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

  // Reject bot confirmation logs cleanly
  if (
    cleanBody.includes('Laporan Berhasil Diproses') ||
    cleanBody.includes('Laporan Gagal Diproses') ||
    cleanBody.includes('tidak terdaftar di database') ||
    cleanBody.includes('Format laporan salah') ||
    cleanBody.includes('Pastikan format laporan sesuai template')
  ) {
    throw new Error('Pesan ini adalah konfirmasi/log bot, bukan laporan streamer.');
  }

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
  const { fallbackSender } = stripTelegramHeader(rawText);
  const parts = cleanBody.split(/^\s*[-_]+\s*$/m);
  const todayReportText = parts[0].trim();

  const tanggal   = parseDate(todayReportText, fallbackDate);
  const kategori  = extractKategori(todayReportText);
  const rawName   = extractName(todayReportText) || fallbackSender;

  if (!rawName) throw new Error('Nama streamer tidak ditemukan. Pastikan ada nama setelah header laporan.');

  const uploads           = extractUploads(todayReportText);
  const liveDuration      = extractLive(todayReportText);
  const chatCount         = extractField(todayReportText, 'CHAT\\s+MASUK\\s*(?:WA/TELE|TELE|DM|TT|TELEGRAM)?', 'Total\\s+chat', '^CHAT\\b');
  const registrationCount = extractField(todayReportText, 'JUMLAH\\s+REGISTRASI', 'Total\\s+registrasi', '^REGISTRASI\\b');
  const ftdCount          = extractField(todayReportText, 'JUMLAH\\s+FTD', 'JUMLAH\\s+TTD', 'Total\\s+(?:ftd|ttd)', '^FTD\\b');

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
