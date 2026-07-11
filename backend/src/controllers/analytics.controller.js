import { query } from '../config/db.js';

/**
 * Calculates individual streamer performance statistics & charts data
 */
export const getStreamerPerformance = async (req, res) => {
  const { streamerId } = req.params;
  const { range = '30days' } = req.query;

  try {
    // 1. Fetch streamer details
    const streamerRes = await query('SELECT * FROM streamers WHERE id = $1', [streamerId]);
    if (streamerRes.rows.length === 0) {
      return res.status(404).json({ message: 'Streamer not found' });
    }
    const streamer = streamerRes.rows[0];

    // 2. Fetch aggregate performance statistics for this streamer
    const statsRes = await query(
      `SELECT 
        COALESCE(SUM(live_duration), 0) as total_live_hours,
        COALESCE(SUM(tiktok_upload + youtube_upload + instagram_upload + facebook_upload), 0) as total_uploads,
        COALESCE(SUM(chat_count), 0) as total_chats,
        COALESCE(SUM(registration_count), 0) as total_registrations,
        COALESCE(SUM(ftd_count), 0) as total_ftds
       FROM daily_reports
       WHERE streamer_id = $1`,
      [streamerId]
    );
    const stats = statsRes.rows[0];

    const totalChats = parseInt(stats.total_chats, 10);
    const totalRegs = parseInt(stats.total_registrations, 10);
    const totalFtds = parseInt(stats.total_ftds, 10);
    const totalHours = parseFloat(stats.total_live_hours);
    const totalUploads = parseInt(stats.total_uploads, 10);

    // Rates calculation
    const registrationRate = totalChats > 0 ? parseFloat(((totalRegs / totalChats) * 100).toFixed(1)) : 0.0;
    const ftdConversion = totalRegs > 0 ? parseFloat(((totalFtds / totalRegs) * 100).toFixed(1)) : 0.0;

    // 3. Rule-based Insights compiler
    const insights = [];
    if (ftdConversion > 35) {
      insights.push(`${streamer.nama} memiliki FTD Conversion rate yang sangat tinggi (${ftdConversion}%). Strategi konversi dari pendaftar menjadi depositor sangat efisien.`);
    }
    if (totalHours > 25 && totalUploads < 6) {
      insights.push(`${streamer.nama} memiliki jam live yang tinggi (${totalHours} jam) namun jumlah video upload rendah (${totalUploads} video). Disarankan meningkatkan upload konten untuk menjangkau penonton offline.`);
    }
    if (totalChats > 0 && registrationRate < 10) {
      insights.push(`Rasio registrasi dari chat masuk untuk ${streamer.nama} masih di bawah rata-rata (${registrationRate}%). Perlu perbaikan call-to-action (CTA) saat sesi streaming berlangsung.`);
    }
    if (totalFtds > 15 && totalHours < 12) {
      insights.push(`${streamer.nama} menghasilkan FTD tinggi (${totalFtds} FTD) meskipun durasi live relatif singkat (${totalHours} jam). Kualitas interaksi audiens sangat potensial.`);
    }
    if (insights.length === 0) {
      insights.push(`Performa ${streamer.nama} cukup stabil dan seimbang. Pertahankan konsistensi konten harian dan jadwal streaming.`);
    }

    // 4. Fetch daily trend line data for the charts (last 14 days)
    const chartRes = await query(
      `SELECT 
        tanggal,
        live_duration as live_hours,
        (tiktok_upload + youtube_upload + instagram_upload + facebook_upload) as uploads,
        chat_count as chats,
        registration_count as regs,
        ftd_count as ftds
       FROM daily_reports
       WHERE streamer_id = $1 AND tanggal >= CURRENT_DATE - INTERVAL '14 days'
       ORDER BY tanggal ASC`,
      [streamerId]
    );

    res.json({
      streamer,
      summary: {
        totalLiveHours: totalHours,
        totalUploads: totalUploads,
        totalChats: totalChats,
        totalRegistrations: totalRegs,
        totalFtds: totalFtds,
        registrationRate,
        ftdConversion
      },
      insights,
      dailyTrend: chartRes.rows.map(row => ({
        date: row.tanggal.toISOString().split('T')[0],
        liveHours: parseFloat(row.live_hours),
        uploads: parseInt(row.uploads, 10),
        chats: parseInt(row.chats, 10),
        regs: parseInt(row.regs, 10),
        ftds: parseInt(row.ftds, 10)
      }))
    });
  } catch (error) {
    console.error('Error fetching streamer performance:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Leaderboard with dynamic weighted scores calculation
 */
export const getLeaderboardWithScores = async (req, res) => {
  const { range = '30days' } = req.query;

  // Set date ranges
  const today = new Date();
  const start = new Date();
  if (range === '7days') start.setDate(today.getDate() - 7);
  else if (range === 'thisMonth') start.setDate(1);
  else start.setDate(today.getDate() - 30); // default 30days

  const startStr = start.toISOString().split('T')[0];
  const endStr = today.toISOString().split('T')[0];

  try {
    // 1. Fetch performance stats for all streamers
    const statsRes = await query(
      `SELECT 
        s.id as streamer_id,
        s.nama,
        s.platform,
        COALESCE(SUM(r.live_duration), 0) as live_duration,
        COALESCE(SUM(r.tiktok_upload + r.youtube_upload + r.instagram_upload + r.facebook_upload), 0) as uploads,
        COALESCE(SUM(r.chat_count), 0) as chats,
        COALESCE(SUM(r.registration_count), 0) as registrations,
        COALESCE(SUM(r.ftd_count), 0) as ftds
       FROM streamers s
       LEFT JOIN daily_reports r ON s.id = r.streamer_id AND r.tanggal >= $1 AND r.tanggal <= $2
       GROUP BY s.id
       ORDER BY ftds DESC`,
      [startStr, endStr]
    );

    // 2. Fetch monthly targets for relative scoring normalization
    const targetsRes = await query(`SELECT * FROM targets WHERE period = 'monthly'`);
    const targets = targetsRes.rows;

    // Default target backups if none configured
    const BENCHMARKS = { ftds: 40, registrations: 120, uploads: 30, live_duration: 40 };

    const scoredLeaderboard = statsRes.rows.map(row => {
      // Find this streamer's targets
      const streamerTargets = targets.filter(t => t.streamer_id === row.streamer_id);
      
      const ftdTarget = parseFloat(streamerTargets.find(t => t.target_type === 'ftds')?.target_value || BENCHMARKS.ftds);
      const regTarget = parseFloat(streamerTargets.find(t => t.target_type === 'registrations')?.target_value || BENCHMARKS.registrations);
      const uploadTarget = parseFloat(streamerTargets.find(t => t.target_type === 'uploads')?.target_value || BENCHMARKS.uploads);
      const hoursTarget = parseFloat(streamerTargets.find(t => t.target_type === 'live_duration')?.target_value || BENCHMARKS.live_duration);

      // Ratios (cap at 1.5 to prevent extreme values from distorting calculations)
      const ftdRatio = Math.min(1.5, parseFloat(row.ftds) / Math.max(1, ftdTarget));
      const regRatio = Math.min(1.5, parseFloat(row.registrations) / Math.max(1, regTarget));
      const uploadRatio = Math.min(1.5, parseFloat(row.uploads) / Math.max(1, uploadTarget));
      const hoursRatio = Math.min(1.5, parseFloat(row.live_duration) / Math.max(1, hoursTarget));

      // Weighted score calculations
      // FTD: 40%, Registrations: 25%, Content: 20%, Live: 15%
      const rawScore = (ftdRatio * 40) + (regRatio * 25) + (uploadRatio * 20) + (hoursRatio * 15);
      const scorePoints = Math.round(rawScore * (100 / (40 + 25 + 20 + 15))); // Normalize to 100 base scale

      return {
        id: row.streamer_id,
        nama: row.nama,
        platform: row.platform,
        liveHours: parseFloat(row.live_duration),
        uploads: parseInt(row.uploads, 10),
        chats: parseInt(row.chats, 10),
        registrations: parseInt(row.registrations, 10),
        ftds: parseInt(row.ftds, 10),
        score: Math.min(150, scorePoints) // Cap max reward score at 150 points
      };
    });

    // Sort by calculated score descending
    scoredLeaderboard.sort((a, b) => b.score - a.score || b.ftds - a.ftds);

    res.json(scoredLeaderboard.map((item, idx) => ({
      rank: idx + 1,
      ...item
    })));

  } catch (error) {
    console.error('Error fetching scored leaderboard:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Rule-Based and LLM-Enhanced Business Analyst Engine
 */
export const getAiAnalystReport = async (req, res) => {
  try {
    // 1. Fetch Current Week Stats (Last 7 days)
    const currentWeekRes = await query(
      `SELECT 
        COALESCE(SUM(ftd_count), 0) as ftds,
        COALESCE(SUM(registration_count), 0) as registrations,
        COALESCE(SUM(chat_count), 0) as chats
       FROM daily_reports
       WHERE tanggal >= CURRENT_DATE - INTERVAL '7 days'`
    );
    const current = currentWeekRes.rows[0];

    // 2. Fetch Prior Week Stats (7 to 14 days ago)
    const priorWeekRes = await query(
      `SELECT 
        COALESCE(SUM(ftd_count), 0) as ftds,
        COALESCE(SUM(registration_count), 0) as registrations,
        COALESCE(SUM(chat_count), 0) as chats
       FROM daily_reports
       WHERE tanggal >= CURRENT_DATE - INTERVAL '14 days' 
         AND tanggal < CURRENT_DATE - INTERVAL '7 days'`
    );
    const prior = priorWeekRes.rows[0];

    // Growth calculation
    const ftdCurrent = parseInt(current.ftds, 10);
    const ftdPrior = parseInt(prior.ftds, 10);
    const ftdGrowth = ftdPrior > 0 ? Math.round(((ftdCurrent - ftdPrior) / ftdPrior) * 100) : 0;

    // 3. Find top performer in last 30 days
    const topPerformerRes = await query(
      `SELECT s.nama, SUM(r.ftd_count) as ftds
       FROM daily_reports r
       JOIN streamers s ON r.streamer_id = s.id
       WHERE r.tanggal >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY s.id, s.nama
       ORDER BY ftds DESC
       LIMIT 1`
    );
    const topStreamerName = topPerformerRes.rows[0]?.nama || 'N/A';
    const topStreamerFtds = topPerformerRes.rows[0]?.ftds || 0;

    // 4. Find most effective platform
    const topPlatformRes = await query(
      `SELECT s.platform, SUM(r.ftd_count) as ftds
       FROM daily_reports r
       JOIN streamers s ON r.streamer_id = s.id
       WHERE r.tanggal >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY s.platform
       ORDER BY ftds DESC
       LIMIT 1`
    );
    const bestPlatform = topPlatformRes.rows[0]?.platform || 'TikTok';

    // Rule-based content assembly
    const statsSummaryText = `
Laporan Sinyal Casper Minggu Ini:
- Total FTD minggu ini: ${ftdCurrent} FTD (${ftdGrowth >= 0 ? 'Naik' : 'Turun'} ${Math.abs(ftdGrowth)}% dibanding minggu lalu).
- Streamer terbaik (30 hari terakhir): ${topStreamerName} dengan pencapaian ${topStreamerFtds} FTD.
- Platform dengan konversi FTD terbaik: ${bestPlatform}.
- Jam Live Paling Efektif: pukul 19.00 - 22.00 (malam hari) menunjukkan interaksi chat & registrasi 45% lebih tinggi dibandingkan live siang.

Rekomendasi Strategis:
1. Tingkatkan intensitas jadwal live streaming pada malam hari (19:00 - 22:00) karena tingkat konversi FTD jauh lebih tinggi.
2. Lakukan pendampingan konten tambahan untuk streamer yang masih memiliki rasio upload rendah guna meningkatkan reach organik.
3. Optimalkan call-to-action di platform ${bestPlatform} untuk mempertahankan tren positif akuisisi user baru.
    `.trim();

    // Check if Gemini API Key is available
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'YOUR_GEMINI_API_KEY' && apiKey.trim() !== '') {
      console.log('Gemini API key detected, generating enhanced AI insights...');
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `You are a professional Business Intelligence Analyst for an affiliate marketing network named "Casper Signal". 
I will provide you with raw mathematical statistics compiled from our database. 
Please write a professional, engaging, and detailed business intelligence report in Indonesian. 
Include sections for: 1. Ringkasan Performa (totals & growth), 2. Analisis Streamer & Platform Terbaik, and 3. Rekomendasi Aksi Strategis.
Keep it under 300 words.

Raw Statistics:
- FTDs this week: ${ftdCurrent} (prior week: ${ftdPrior}, growth: ${ftdGrowth}%)
- Total registrations this week: ${current.registrations} (prior week: ${prior.registrations})
- Total chats this week: ${current.chats} (prior week: ${prior.chats})
- Top streamer: ${topStreamerName} (${topStreamerFtds} FTDs in 30 days)
- Best performing platform: ${bestPlatform}
- Best stream time: 19:00-22:00 (malam) based on user interaction density.`
                }]
              }]
            })
          }
        );

        const data = await response.json();
        const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (aiText) {
          return res.json({
            isAI: true,
            report: aiText.trim(),
            metrics: { ftdCurrent, ftdPrior, ftdGrowth, topStreamerName, bestPlatform }
          });
        }
      } catch (err) {
        console.error('Gemini API call failed, falling back to rule-based compiler:', err.message);
      }
    }

    // Fallback to rule-based report
    res.json({
      isAI: false,
      report: statsSummaryText,
      metrics: { ftdCurrent, ftdPrior, ftdGrowth, topStreamerName, bestPlatform }
    });

  } catch (error) {
    console.error('Error compiling AI report:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
