import { query } from './config/db.js';
import 'dotenv/config';

async function clean() {
  const res = await query("UPDATE schedule SET status = 'Cancelled' WHERE id = 87 OR (platform = 'TikTok' AND status = 'Live')");
  console.log('Cleaned false TikTok schedules:', res.rowCount);
  process.exit(0);
}

clean();
