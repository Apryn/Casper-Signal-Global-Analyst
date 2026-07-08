import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import telegramService from '../services/telegram.service.js';

const { parseMessageText } = telegramService;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

const rawLogs = `
[08/07/2026 00.13] Ajo Candle: STREAMING NON STREAMING 
📆 : HARI / TANGGAL :1-7 JUL 2026
Ajo 🍢🍡🍢

UPLOAD 3 VIDIO  

LIVE : 6 JAM

CHAT MASUK TELEGRAM : 
JUMLAH REGISTRASI : 
JUMLAH FTD : 33
[08/07/2026 00.13] RATU VALENCIA: STREAMING NON STREAMING 
📆 : HARI / TANGGAL :/8 JUNY 2026 
🤩:Ratu

UPLOAD 2 Vidio 
TIKTOK : 2 vidio
YOUTUBE SHORT : -
INSTAGRAM FEELS : -
FACEBOOK FP : -

SESI LIVE 
2 jam


CHAT MASUK WA/TELE :
JUMLAH REGISTRASI :
JUMLAH FTD :2
[08/07/2026 00.14] TEIZZA GOT: STREAMING NON STREAMING 
📆 : HARI / TANGGAL :/1-7 JUNY 2026 
😎:Tizza/Got

UPLOAD 2 Vidio 
TIKTOK : 2 vidio
YOUTUBE SHORT : -
INSTAGRAM FEELS : -
FACEBOOK FP : -

SESI LIVE 
2 jam


CHAT MASUK WA/TELE :
JUMLAH REGISTRASI :
JUMLAH FTD :48
[08/07/2026 00.17] Aline: STREAMING NON STREAMING 
📆 : HARI / TANGGAL :1-7 JUL 2026
Aline

UPLOAD 3 VIDIO  

LIVE : 2JAM

CHAT MASUK TELEGRAM : 
JUMLAH REGISTRASI : 
JUMLAH FTD : 15
[08/07/2026 01.23] BAGAS: STREAMING NON STREAMING 
🤩: HARI / TANGGAL : 30 juni- 7 july 2026 
BGBAS

UPLOAD  Vidio 
TIKTOK : 5 ✅
SNACK VIDIO : 6 vidio ✅
INSTAGRAM REELS : 5✅
FACEBOOK FP : 5VIDIO ✅
TWITER : 4VIDIO ✅

SESI LIVE 
3 jam

CHAT MASUK WA/TELE :
JUMLAH REGISTRASI :
JUMLAH FTD : 61
[08/07/2026 01.53] Qamil Alvaro: STREAMING NON STREAMING 
📆 : HARI / TANGGAL : selasa 07 juli  2026
: laflanca/ Qamil alvano

UPLOAD 3 VIDIO 
TIKTOK : 3Video
YOUTUBE SHORT : 3Video 
INSTAGRAM FEELS : -
FACEBOOK FP : -

CHAT MASUK WA/TELE : 13
JUMLAH REGISTRASI : 5
JUMLAH FTD :-
[08/07/2026 03.44] Brayy Candle: STREAMING NON STREAMING 
📆 : HARI / TANGGAL : 1-7 JULI 2026
✈️Brayy💋

UPLOAD VIDIO 
TIKTOK : 2 Video ✅
YOUTUBE SHORT : 2 Video ✅
INSTAGRAM REELS : 2 Video ✅
FACEBOOK FP :  2 Video ✅

SESI LIVE: 
4 Jam

CHAT MASUK TELE/ TT: 
JUMLAH REGISTRASI : 
JUMLAH FTD : 40
`;

const run = async () => {
  const blocks = rawLogs.trim().split(/(?=\[\d{2}\/\d{2}\/\d{4}\s+\d{2}[:.]\d{2}\])/);
  console.log(`Found ${blocks.length} log reports to parse...`);

  for (const block of blocks) {
    if (!block.trim()) continue;
    try {
      const res = await parseMessageText(block);
      console.log(`✅ Success parsing report for: ${res.streamerName}`);
      console.log(`   Date: ${res.parsedData.tanggal}, FTDs: ${res.parsedData.ftdCount}, Live: ${res.parsedData.liveDuration}h`);
    } catch (err) {
      console.error(`❌ Failed parsing block:`, err.message);
    }
  }

  console.log('Finished importing reports!');
  process.exit(0);
};

run();
