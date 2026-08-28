import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../../.env');

const TARGET_SUPABASE_URL = 'postgresql://postgres.drcdghaavgdswkelfwfw:szfOROAfJGmzRNJI@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';

try {
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, 'utf8');
    if (!content.includes('supabase.com')) {
      console.log('🔄 Updating DATABASE_URL in .env to Supabase...');
      content = content.replace(/DATABASE_URL=.*/g, `DATABASE_URL=${TARGET_SUPABASE_URL}`);
      fs.writeFileSync(envPath, content, 'utf8');
      console.log('✅ .env successfully updated to Supabase!');
    } else {
      console.log('✅ .env is already pointing to Supabase.');
    }
  }
} catch (e) {
  console.error('Error syncing .env to Supabase:', e.message);
}
