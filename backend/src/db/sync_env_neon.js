import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../../.env');

const TARGET_NEON_URL = 'postgresql://neondb_owner:npg_ev2P0rstmxFi@ep-aged-resonance-ao2prpdw-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

try {
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, 'utf8');
    if (!content.includes('ep-aged-resonance-ao2prpdw')) {
      console.log('🔄 Updating DATABASE_URL in .env to Neon database...');
      content = content.replace(/DATABASE_URL=.*/g, `DATABASE_URL=${TARGET_NEON_URL}`);
      fs.writeFileSync(envPath, content, 'utf8');
      console.log('✅ .env successfully updated to Neon database!');
    } else {
      console.log('✅ .env is already pointing to Neon database.');
    }
  }
} catch (e) {
  console.error('Error syncing .env to Neon:', e.message);
}
