import pool from '../config/db.js';

async function migrate() {
  console.log('🚀 Running migration to add telegram_username to streamers...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Add telegram_username column if it doesn't exist
    await client.query('ALTER TABLE streamers ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(100);');
    console.log('✅ Column telegram_username verified/added.');

    // Seed default telegram usernames for the 11 real streamers
    const updates = [
      { name: 'Brayy', username: 'brayycandle' },
      { name: 'Tizza', username: 'tizzagot' },
      { name: 'Rival Suhanda', username: 'rivalsuhanda' },
      { name: 'Ratu', username: 'ratuvalencia' },
      { name: 'BG Chenn', username: 'anandarioo' },
      { name: 'Keylaa', username: 'keylaa' },
      { name: 'Aline', username: 'aline' },
      { name: 'Katrineely', username: 'katrinee_09' },
      { name: 'Ajo', username: 'ajocandle' },
      { name: 'Bagas', username: 'bagas' },
      { name: 'Laflanca', username: 'laflanca' }
    ];

    for (const update of updates) {
      await client.query(
        'UPDATE streamers SET telegram_username = $1 WHERE LOWER(nama) = LOWER($2)',
        [update.username, update.name]
      );
      console.log(`  Updated telegram_username for ${update.name} to @${update.username}`);
    }

    await client.query('COMMIT');
    console.log('🎉 Migration successful!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
