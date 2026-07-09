import pool from '../config/db.js';

async function seedData() {
  console.log('Seeding mock streamers, daily reports, targets, content, and schedules...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Clear existing database logs
    await client.query('DELETE FROM notifications');
    await client.query('DELETE FROM schedule');
    await client.query('DELETE FROM content');
    await client.query('DELETE FROM scores');
    await client.query('DELETE FROM targets');
    await client.query('DELETE FROM daily_reports');
    await client.query('DELETE FROM weekly_evaluations');
    await client.query('DELETE FROM streamer_accounts');
    await client.query('DELETE FROM streamers');
    console.log('Cleared existing data tables.');

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

    // 2.5 Seed Streamer Accounts
    console.log('Seeding streamer accounts...');
    const accountsMap = {}; // Maps streamerId_platform -> accountId
    for (const streamer of streamerIds) {
      const nameClean = streamer.nama.replace(/[^\w\s]/g, '').trim().toLowerCase().replace(/\s+/g, '_');
      
      // TikTok
      const ttRes = await client.query(
        `INSERT INTO streamer_accounts (streamer_id, platform, username, link)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [streamer.id, 'TikTok', `@${nameClean}_official`, `https://tiktok.com/@${nameClean}_official`]
      );
      accountsMap[`${streamer.id}_TikTok`] = ttRes.rows[0].id;

      // YouTube
      const ytRes = await client.query(
        `INSERT INTO streamer_accounts (streamer_id, platform, username, link)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [streamer.id, 'YouTube', `${streamer.nama} Channel`, `https://youtube.com/@${nameClean}`]
      );
      accountsMap[`${streamer.id}_YouTube`] = ytRes.rows[0].id;

      // Instagram
      const igRes = await client.query(
        `INSERT INTO streamer_accounts (streamer_id, platform, username, link)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [streamer.id, 'Instagram', `@${nameClean}_insta`, `https://instagram.com/${nameClean}_insta`]
      );
      accountsMap[`${streamer.id}_Instagram`] = igRes.rows[0].id;

      // Facebook
      const fbRes = await client.query(
        `INSERT INTO streamer_accounts (streamer_id, platform, username, link)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [streamer.id, 'Facebook', `${streamer.nama} FB Page`, `https://facebook.com/${nameClean}_page`]
      );
      accountsMap[`${streamer.id}_Facebook`] = fbRes.rows[0].id;
    }
    console.log('Seeded streamer accounts.');

    // 3. Generate 30 days of daily reports
    const today = new Date();
    let reportCount = 0;

    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      const dateString = date.toISOString().split('T')[0];

      for (const streamer of streamerIds) {
        let kategori = 'Streaming';
        if (streamer.nama === 'Lulu') {
          kategori = Math.random() > 0.15 ? 'Non Streaming' : 'Streaming';
        } else {
          kategori = Math.random() > 0.25 ? 'Streaming' : 'Non Streaming';
        }

        const isStreaming = kategori === 'Streaming';

        const tiktok = Math.floor(Math.random() * 4); // 0-3
        const youtube = Math.floor(Math.random() * 3); // 0-2
        const instagram = streamer.nama === 'Lulu' ? Math.floor(Math.random() * 4) + 1 : Math.floor(Math.random() * 3);
        const facebook = Math.floor(Math.random() * 2);

        const liveDuration = isStreaming
          ? parseFloat((Math.random() * 4 + 1.5).toFixed(1))
          : 0.0;

        let multiplier = 1.0;
        if (streamer.nama === 'Tizza') multiplier = 1.6;
        if (streamer.nama === 'Got') multiplier = 1.3;
        if (streamer.nama === 'Romi') multiplier = 0.8;

        const chats = isStreaming
          ? Math.floor((Math.random() * 150 + 50) * multiplier)
          : Math.floor((Math.random() * 40 + 10) * multiplier);

        const registrations = isStreaming
          ? Math.floor((Math.random() * 20 + 8) * multiplier)
          : Math.floor((Math.random() * 8 + 2) * multiplier);

        const ftd = Math.min(
          registrations,
          Math.floor((registrations * (Math.random() * 0.4 + 0.25)))
        );

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
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [dateString, streamer.id, kategori, tiktok, youtube, instagram, facebook, liveDuration, chats, registrations, ftd, rawMsg]
        );
        reportCount++;
      }
    }
    console.log(`Inserted ${reportCount} daily reports.`);

    // 4. Seed Targets (Daily & Monthly targets for each streamer)
    // Metric types: 'live_duration', 'uploads', 'registrations', 'ftds'
    console.log('Seeding targets...');
    for (const streamer of streamerIds) {
      let ftdTargetMonthly = 80;
      let regTargetMonthly = 200;
      
      if (streamer.nama === 'Tizza') { ftdTargetMonthly = 120; regTargetMonthly = 300; }
      else if (streamer.nama === 'Got') { ftdTargetMonthly = 100; regTargetMonthly = 250; }
      else if (streamer.nama === 'Lulu') { ftdTargetMonthly = 30; regTargetMonthly = 70; }

      const targets = [
        // Monthly Targets
        { type: 'ftds', value: ftdTargetMonthly, period: 'monthly' },
        { type: 'registrations', value: regTargetMonthly, period: 'monthly' },
        { type: 'uploads', value: 45, period: 'monthly' },
        { type: 'live_duration', value: 60, period: 'monthly' },
        // Daily Targets
        { type: 'ftds', value: Math.ceil(ftdTargetMonthly / 30), period: 'daily' },
        { type: 'registrations', value: Math.ceil(regTargetMonthly / 30), period: 'daily' },
        { type: 'uploads', value: 2, period: 'daily' },
        { type: 'live_duration', value: 2, period: 'daily' }
      ];

      for (const target of targets) {
        await client.query(
          `INSERT INTO targets (streamer_id, target_type, target_value, period)
           VALUES ($1, $2, $3, $4)`,
          [streamer.id, target.type, target.value, target.period]
        );
      }
    }

    // 5. Seed Content Library (Fitur 4)
    console.log('Seeding content library...');
    const mockContents = [
      { platform: 'TikTok', title: 'Cara Jitu Analisis Sinyal Casper' },
      { platform: 'TikTok', title: 'Tutorial Live Streaming Cuan Parah' },
      { platform: 'YouTube', title: 'Casper Signal Global Affiliate Program' },
      { platform: 'YouTube', title: 'Review Komisi Tembus Ratusan FTD!' },
      { platform: 'Instagram', title: 'Peluang Affiliate 2026' },
      { platform: 'Instagram', title: 'Tips Tampil Pede Saat Live Streaming' },
      { platform: 'Facebook', title: 'Casper Global Community Meetup' }
    ];

    for (const streamer of streamerIds) {
      for (let c = 0; c < 3; c++) {
        const item = mockContents[Math.floor(Math.random() * mockContents.length)];
        const views = Math.floor(Math.random() * 45000) + 1000;
        const likes = Math.floor(views * (Math.random() * 0.15 + 0.05));
        const comments = Math.floor(likes * (Math.random() * 0.1 + 0.02));
        const shares = Math.floor(likes * (Math.random() * 0.2));
        
        const dateSub = new Date();
        dateSub.setDate(today.getDate() - Math.floor(Math.random() * 20));

        // Get matching account_id from accountsMap
        const accountId = accountsMap[`${streamer.id}_${item.platform}`] || null;

        await client.query(
          `INSERT INTO content (streamer_id, platform, title, upload_date, link, views, likes, comments, shares, account_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            streamer.id,
            item.platform,
            `[${streamer.nama}] ${item.title}`,
            dateSub.toISOString().split('T')[0],
            `https://www.google.com/search?q=${encodeURIComponent(item.title)}`,
            views,
            likes,
            comments,
            shares,
            accountId
          ]
        );
      }
    }

    // 6. Seed Schedules (Fitur 5)
    console.log('Seeding live schedules...');
    // We want schedules for today, yesterday, and upcoming days
    const platforms = ['TikTok', 'YouTube', 'Instagram', 'Facebook'];
    
    for (const streamer of streamerIds) {
      // Past Completed Schedule (Yesterday)
      const startTimePast = new Date();
      startTimePast.setDate(today.getDate() - 1);
      startTimePast.setHours(19, 0, 0, 0);
      
      const endTimePast = new Date();
      endTimePast.setDate(today.getDate() - 1);
      endTimePast.setHours(21, 0, 0, 0);

      await client.query(
        `INSERT INTO schedule (streamer_id, platform, start_time, end_time, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [streamer.id, platforms[Math.floor(Math.random() * platforms.length)], startTimePast, endTimePast, 'Completed']
      );

      // Future Scheduled Stream (Tomorrow or Day after)
      const startTimeFuture = new Date();
      startTimeFuture.setDate(today.getDate() + 1);
      startTimeFuture.setHours(20, 0, 0, 0);
      
      const endTimeFuture = new Date();
      endTimeFuture.setDate(today.getDate() + 1);
      endTimeFuture.setHours(22, 0, 0, 0);

      await client.query(
        `INSERT INTO schedule (streamer_id, platform, start_time, end_time, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [streamer.id, platforms[Math.floor(Math.random() * platforms.length)], startTimeFuture, endTimeFuture, 'Scheduled']
      );
    }

    await client.query('COMMIT');
    console.log('Database seeding successfully completed with all Phase 2 logs!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding database:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seedData();
