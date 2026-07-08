import pool from '../config/db.js';

async function seedData() {
  console.log('Seeding mock streamers and daily reports data...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Clear existing reports and streamers
    await client.query('DELETE FROM daily_reports');
    await client.query('DELETE FROM streamers');
    console.log('Cleared existing data.');

    // 2. Insert Streamers
    const streamersList = [
      { nama: 'Tizza', platform: 'TikTok' },
      { nama: 'Got', platform: 'YouTube' },
      { nama: 'Lulu', platform: 'Instagram' },
      { nama: 'Romi', platform: 'TikTok' },
      { nama: 'Vero', platform: 'Facebook' },
    ];

    const streamerIds = [];
    for (const streamer of streamersList) {
      const res = await client.query(
        'INSERT INTO streamers (nama, platform) VALUES ($1, $2) RETURNING id, nama',
        [streamer.nama, streamer.platform]
      );
      streamerIds.push(res.rows[0]);
    }
    console.log(`Inserted ${streamerIds.length} streamers.`);

    // 3. Generate 30 days of daily reports
    const today = new Date();
    let reportCount = 0;

    for (let i = 29; i >= 0; i--) {
      // Calculate target date
      const date = new Date();
      date.setDate(today.getDate() - i);
      const dateString = date.toISOString().split('T')[0];

      for (const streamer of streamerIds) {
        // Streamer Tizza & Got stream more often, Lulu is non-streaming mainly, others are mixed
        let kategori = 'Streaming';
        if (streamer.nama === 'Lulu') {
          kategori = Math.random() > 0.15 ? 'Non Streaming' : 'Streaming';
        } else {
          kategori = Math.random() > 0.25 ? 'Streaming' : 'Non Streaming';
        }

        const isStreaming = kategori === 'Streaming';

        // Content uploads
        const tiktok = Math.floor(Math.random() * 4); // 0-3
        const youtube = Math.floor(Math.random() * 3); // 0-2
        const instagram = streamer.nama === 'Lulu' ? Math.floor(Math.random() * 4) + 1 : Math.floor(Math.random() * 3);
        const facebook = Math.floor(Math.random() * 2); // 0-1

        // Live stats
        const liveDuration = isStreaming
          ? parseFloat((Math.random() * 4 + 1.5).toFixed(1)) // 1.5 - 5.5 hours
          : 0.0;

        // User interaction metrics (chats, registrations, FTDs)
        // Adjust performance by streamer to make the ranking interesting
        let multiplier = 1.0;
        if (streamer.nama === 'Tizza') multiplier = 1.5; // Top performer
        if (streamer.nama === 'Got') multiplier = 1.3;
        if (streamer.nama === 'Romi') multiplier = 0.8;

        const chats = isStreaming
          ? Math.floor((Math.random() * 150 + 50) * multiplier) // 50-200 chats
          : Math.floor((Math.random() * 40 + 10) * multiplier); // 10-50 chats

        const registrations = isStreaming
          ? Math.floor((Math.random() * 20 + 8) * multiplier)  // 8-28 registrations
          : Math.floor((Math.random() * 8 + 2) * multiplier);   // 2-10 registrations

        // FTDs (First Time Deposits) must be less than or equal to registrations
        const ftd = Math.min(
          registrations,
          Math.floor((registrations * (Math.random() * 0.4 + 0.2))) // 20% to 60% conversion
        );

        // Raw message mockup for simulation auditing
        const rawMsg = `
${kategori.toUpperCase()}
Tanggal : ${dateString}
Nama : ${streamer.nama}

UPLOAD:
TikTok : ${tiktok > 0 ? `${tiktok} video` : '-'}
Youtube Short : ${youtube > 0 ? `${youtube} video` : '-'}
Instagram Reels : ${instagram > 0 ? `${instagram} video` : '-'}
Facebook FP : ${facebook > 0 ? `${facebook} video` : '-'}

LIVE:
${liveDuration > 0 ? `${liveDuration} jam` : '-'}

CHAT:
${chats} chat masuk

REGISTRASI:
${registrations} user register

FTD:
${ftd}
        `.trim();

        await client.query(
          `INSERT INTO daily_reports (
            tanggal, streamer_id, kategori, 
            tiktok_upload, youtube_upload, instagram_upload, facebook_upload, 
            live_duration, chat_count, registration_count, ftd_count, raw_message
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (tanggal, streamer_id) DO UPDATE SET
            kategori = EXCLUDED.kategori,
            tiktok_upload = EXCLUDED.tiktok_upload,
            youtube_upload = EXCLUDED.youtube_upload,
            instagram_upload = EXCLUDED.instagram_upload,
            facebook_upload = EXCLUDED.facebook_upload,
            live_duration = EXCLUDED.live_duration,
            chat_count = EXCLUDED.chat_count,
            registration_count = EXCLUDED.registration_count,
            ftd_count = EXCLUDED.ftd_count,
            raw_message = EXCLUDED.raw_message`,
          [
            dateString,
            streamer.id,
            kategori,
            tiktok,
            youtube,
            instagram,
            facebook,
            liveDuration,
            chats,
            registrations,
            ftd,
            rawMsg
          ]
        );
        reportCount++;
      }
    }

    await client.query('COMMIT');
    console.log(`Seeding completed successfully! Inserted/updated ${reportCount} daily reports.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding database:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seedData();
