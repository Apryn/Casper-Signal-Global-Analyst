import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const seedAccounts = async () => {
  console.log('Seeding default social media accounts for new streamers...');
  try {
    // Get all streamers
    const streamersRes = await pool.query('SELECT id, nama FROM streamers');
    const streamers = streamersRes.rows;

    for (const streamer of streamers) {
      const nameClean = streamer.nama.replace(/[^\w\s]/g, '').trim().toLowerCase().replace(/\s+/g, '_');
      
      // Default TikTok Account
      await pool.query(
        `INSERT INTO streamer_accounts (streamer_id, platform, username, link)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (platform, username) DO NOTHING`,
        [streamer.id, 'TikTok', `@${nameClean}_official`, `https://tiktok.com/@${nameClean}_official`]
      );

      // Default YouTube Account
      await pool.query(
        `INSERT INTO streamer_accounts (streamer_id, platform, username, link)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (platform, username) DO NOTHING`,
        [streamer.id, 'YouTube', `${streamer.nama} Channel`, `https://youtube.com/@${nameClean}`]
      );

      console.log(`- Default handles created for: ${streamer.nama}`);
    }

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Seeding accounts failed:', error);
  } finally {
    await pool.end();
  }
};

seedAccounts();
