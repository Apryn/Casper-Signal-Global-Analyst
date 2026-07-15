import pool from '../config/db.js';

const realStreamers = [
  { name: 'Brayy', platform: 'TikTok', telegram_username: 'brayycandle' },
  { name: 'Tizza', platform: 'TikTok', telegram_username: 'tizzagot' },
  { name: 'Rival Suhanda', platform: 'TikTok', telegram_username: 'rivalsuhanda' },
  { name: 'Ratu', platform: 'TikTok', telegram_username: 'ratuvalencia' },
  { name: 'BG Chenn', platform: 'TikTok', telegram_username: 'anandarioo' },
  { name: 'Keylaa', platform: 'TikTok', telegram_username: 'keylaa' },
  { name: 'Aline', platform: 'TikTok', telegram_username: 'aline' },
  { name: 'Katrineely', platform: 'TikTok', telegram_username: 'katrinee_09' },
  { name: 'Ajo', platform: 'TikTok', telegram_username: 'ajocandle' },
  { name: 'Bagas', platform: 'TikTok', telegram_username: 'bagas' },
  { name: 'Laflanca', platform: 'TikTok', telegram_username: 'laflanca' }
];

async function seedRealStreamers() {
  console.log('🚀 Seeding real streamers into production database...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Clean existing streamers & accounts to prevent duplicates
    await client.query('DELETE FROM weekly_evaluations');
    await client.query('DELETE FROM notifications');
    await client.query('DELETE FROM schedule');
    await client.query('DELETE FROM content');
    await client.query('DELETE FROM scores');
    await client.query('DELETE FROM targets');
    await client.query('DELETE FROM daily_reports');
    await client.query('DELETE FROM streamer_accounts');
    await client.query('DELETE FROM streamers');

    await client.query('ALTER SEQUENCE streamers_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE streamer_accounts_id_seq RESTART WITH 1');

    for (const streamer of realStreamers) {
      // 1. Insert Streamer
      const streamerRes = await client.query(
        `INSERT INTO streamers (nama, platform, telegram_username)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [streamer.name, streamer.platform, streamer.telegram_username]
      );
      const streamerId = streamerRes.rows[0].id;
      const cleanName = streamer.name.toLowerCase().replace(/\s+/g, '');

      // 2. Insert accounts for TikTok, YouTube, Instagram, Facebook
      const platforms = [
        { name: 'TikTok', link: `https://www.tiktok.com/@${cleanName}` },
        { name: 'YouTube', link: `https://www.youtube.com/@${cleanName}` },
        { name: 'Instagram', link: `https://www.instagram.com/${cleanName}` },
        { name: 'Facebook', link: `https://www.facebook.com/${cleanName}` }
      ];

      for (const p of platforms) {
        await client.query(
          `INSERT INTO streamer_accounts (streamer_id, platform, username, link)
           VALUES ($1, $2, $3, $4)`,
          [streamerId, p.name, cleanName, p.link]
        );
      }

      console.log(`  ✅ Added streamer: ${streamer.name} (with 4 platform accounts)`);
    }

    await client.query('COMMIT');
    console.log('\n🎉 Successfully seeded 11 real streamers and their accounts!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding real streamers:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seedRealStreamers();
