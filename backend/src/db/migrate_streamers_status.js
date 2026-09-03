import { query } from '../config/db.js';

async function migrateStreamersStatus() {
  console.log('🚀 Running migration: Add status and is_active to streamers table...');
  try {
    // 1. Add status column
    await query(`
      ALTER TABLE streamers 
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
    `);

    // 2. Add is_active column
    await query(`
      ALTER TABLE streamers 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    `);

    // 3. Ensure all existing nulls default to 'active' and true
    await query(`
      UPDATE streamers 
      SET status = 'active', is_active = TRUE 
      WHERE status IS NULL OR is_active IS NULL;
    `);

    console.log('✅ Migration completed successfully: streamers table updated with status and is_active columns!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migrateStreamersStatus();
