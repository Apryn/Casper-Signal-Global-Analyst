import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Determine __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env before importing DB connection
dotenv.config({ path: path.join(__dirname, '../../.env') });


// Now import the service and db pool
import { parseMessageText } from '../services/telegram.service.js';
import pool from '../config/db.js';

async function runImport() {
  console.log('🚀 Starting historic chat logs import...');
  const logsPath = path.join(__dirname, '../../../scratch/raw_chat_logs.txt');
  
  if (!fs.existsSync(logsPath)) {
    console.error(`❌ Source logs file not found at: ${logsPath}`);
    process.exit(1);
  }

  const rawText = fs.readFileSync(logsPath, 'utf8');

  // Split by Telegram prefix [DD/MM/YYYY HH.MM] SenderName:
  const prefixRE = /(?=\[\d{2}\/\d{2}\/\d{4}\s+[\d.]+\]\s+[^:]+:)/g;
  const messages = rawText.split(prefixRE).map(s => s.trim()).filter(s => s.length > 15);

  console.log(`Found ${messages.length} messages to parse.`);

  let successCount = 0;
  let failCount = 0;
  const errors = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const snippet = msg.split('\n')[0];
    
    try {
      const result = await parseMessageText(msg);
      
      if (result.bulkResults) {
        successCount += result.bulkResults.length;
        console.log(`  [Bulk success] Parsed ${result.bulkResults.length} reports from: "${snippet}"`);
      } else {
        successCount++;
        console.log(`  [Success] Parsed report for ${result.streamerName} on ${result.parsedData.tanggal}`);
      }
    } catch (err) {
      failCount++;
      errors.push({ index: i, snippet, error: err.stack || err.message });
      console.error(`  [Failed] Message ${i + 1} ("${snippet}"):`, err);
    }
  }

  console.log('\n=======================================');
  console.log('📊 IMPORT SUMMARY:');
  console.log(`✅ Success Reports Inserted: ${successCount}`);
  console.log(`❌ Failed Messages: ${failCount}`);
  console.log('=======================================');

  if (errors.length > 0) {
    console.log('\n❌ ERROR DETAILS:');
    errors.forEach(e => {
      console.log(`- Msg #${e.index + 1} "${e.snippet}": ${e.error}`);
    });
  }

  // List all created streamers
  try {
    const streamersRes = await pool.query('SELECT id, nama, platform FROM streamers ORDER BY id ASC');
    console.log(`\n👤 Created Streamer Profiles (${streamersRes.rows.length}):`);
    streamersRes.rows.forEach(s => {
      console.log(`  ID ${s.id}: ${s.nama} (${s.platform})`);
    });
  } catch (err) {
    console.error('Error fetching streamers:', err.message);
  }

  // Close db connection
  await pool.end();
  console.log('\n👋 Done!');
}

runImport().catch(err => {
  console.error('Fatal import error:', err);
  process.exit(1);
});
