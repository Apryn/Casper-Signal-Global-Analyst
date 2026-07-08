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

const migrate = async () => {
  console.log('Running database migration for Casper Signal...');
  try {
    // 1. Create streamer_accounts
    await pool.query(`
      CREATE TABLE IF NOT EXISTS streamer_accounts (
          id SERIAL PRIMARY KEY,
          streamer_id INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
          platform VARCHAR(100) NOT NULL CHECK (platform IN ('TikTok', 'YouTube', 'Instagram', 'Facebook')),
          username VARCHAR(255) NOT NULL,
          link VARCHAR(500),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_platform_username UNIQUE (platform, username)
      );
    `);
    console.log('- Table streamer_accounts verified/created.');

    // 2. Alter content table to add account_id
    await pool.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='content' AND column_name='account_id') THEN
              ALTER TABLE content ADD COLUMN account_id INTEGER REFERENCES streamer_accounts(id) ON DELETE SET NULL;
          END IF;
      END $$;
    `);
    console.log('- Column account_id verified/created in content table.');

    // 3. Create weekly_evaluations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS weekly_evaluations (
          id SERIAL PRIMARY KEY,
          streamer_id INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          stats JSONB NOT NULL,
          targets JSONB NOT NULL,
          peak_hour VARCHAR(50),
          kelebihan TEXT,
          kekurangan TEXT,
          rekomendasi TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_streamer_weekly_eval UNIQUE (streamer_id, start_date)
      );
    `);
    console.log('- Table weekly_evaluations verified/created.');

    // 4. Alter notifications table to add is_read
    await pool.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='is_read') THEN
              ALTER TABLE notifications ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
          END IF;
      END $$;
    `);
    console.log('- Column is_read verified/created in notifications table.');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
};

migrate();
