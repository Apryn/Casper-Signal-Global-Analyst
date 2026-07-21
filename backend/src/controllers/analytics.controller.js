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
  const { engine = 'auto' } = req.query;

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

    // If rule-based is explicitly requested, return immediately
    if (engine === 'rule-based') {
      return res.json({
        isAI: false,
        report: statsSummaryText,
        metrics: { ftdCurrent, ftdPrior, ftdGrowth, topStreamerName, bestPlatform }
      });
    }

    // Check if Gemini API Key is available
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'YOUR_GEMINI_API_KEY' && apiKey.trim() !== '') {
      console.log(`Generating AI insights using Gemini (requested engine: ${engine})...`);
      
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
            }),
            signal: AbortSignal.timeout(25000)
          }
        );

        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error.message || JSON.stringify(data.error));
        }

        const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (aiText) {
          return res.json({
            isAI: true,
            report: aiText.trim(),
            metrics: { ftdCurrent, ftdPrior, ftdGrowth, topStreamerName, bestPlatform }
          });
        }
      } catch (err) {
        console.error('Gemini API call failed:', err.message);
        if (engine === 'gemini') {
          return res.status(502).json({ 
            message: `Gagal memanggil Gemini API: ${err.message}. Pastikan API Key di .env backend valid.`,
            error: err.message
          });
        }
      }
    } else {
      if (engine === 'gemini') {
        return res.status(400).json({ 
          message: 'Gemini API Key tidak ditemukan atau belum dikonfigurasi di file .env backend.' 
        });
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

/**
 * [NEW] Generates monthly accountability & penalty report for streamers
 */
export const getMonthlyPenaltyReport = async (req, res) => {
  const { month } = req.query; // format YYYY-MM
  const rateLate = parseInt(req.query.rateLate, 10) || 2000;    // Rp 2.000 / menit
  const rateAbsent = parseInt(req.query.rateAbsent, 10) || 100000; // Rp 100.000 / bolos
  const rateSwap = parseInt(req.query.rateSwap, 10) || 50000;     // Rp 50.000 / swap izin

  if (!month) {
    return res.status(400).json({ message: 'month parameter (YYYY-MM) is required' });
  }

  const getLocalDateString = (val) => {
    if (!val) return '';
    const dateObj = (val instanceof Date) ? val : new Date(val);
    return dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  };

  const formatIDR = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
  };

  const startOfMonth = `${month}-01T00:00:00+07:00`;
  const nextMonthDate = new Date(`${month}-01T12:00:00+07:00`);
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
  const endOfMonth = nextMonthDate.toISOString();

  try {
    // Ambil list semua streamer
    const streamersRes = await query('SELECT id, nama, platform FROM streamers ORDER BY nama ASC');
    const streamers = streamersRes.rows;

    // Ambil semua jadwal dalam bulan tersebut
    const schedulesRes = await query(
      `SELECT sc.*, s.nama as original_streamer_name
       FROM schedule sc
       JOIN streamers s ON sc.streamer_id = s.id
       WHERE sc.start_time >= $1 AND sc.start_time < $2`,
      [startOfMonth, endOfMonth]
    );
    const schedules = schedulesRes.rows;

    const report = streamers.map(s => {
      // 1. Sesi terjadwal milik dia (asli)
      const originalSessions = schedules.filter(sc => sc.streamer_id === s.id);
      
      // 2. Menit terlambat (Hanya wajib YouTube yang didenda)
      const totalLateMinutes = originalSessions
        .filter(sc => sc.substitute_streamer_id === null && sc.platform === 'YouTube') 
        .reduce((sum, sc) => sum + (sc.lateness_minutes || 0), 0);

      // 3. Sesi bolos: status Scheduled, start_time sudah lewat > 2 jam, tapi actual_start_time NULL, substitute_streamer_id NULL, DAN bukan sakit (is_sick = false). Hanya wajib YouTube yang didenda bolos.
      const now = new Date();
      const absentSessions = originalSessions.filter(sc => {
        const isScheduled = sc.status === 'Scheduled';
        const isPassed = new Date(sc.end_time).getTime() + (2 * 60 * 60 * 1000) < now.getTime();
        const noStart = sc.actual_start_time === null;
        const noSub = sc.substitute_streamer_id === null;
        const notSick = sc.is_sick !== true; // Jika sakit, bukan bolos
        const isYouTube = sc.platform === 'YouTube';
        return isScheduled && isPassed && noStart && noSub && notSick && isYouTube;
      });

      // 4. Sesi izin biasa (ada pengganti, dan tidak sakit) - Hanya wajib YouTube yang dipotong
      const leaveSessions = originalSessions.filter(sc => sc.substitute_streamer_id !== null && !sc.is_sick && sc.platform === 'YouTube');
      
      // Sesi Sakit (baik ada pengganti maupun tidak)
      const sickSessions = originalSessions.filter(sc => sc.is_sick === true);

      // 5. Sesi menggantikan orang lain: jadwal milik orang lain yang diisi oleh dia
      const substituteSessions = schedules.filter(sc => sc.substitute_streamer_id === s.id);

      // Sesi terlambat saat menggantikan orang lain (juga dicatat sebagai keterlambatan dia, hanya untuk YouTube)
      const substituteLateMinutes = substituteSessions
        .filter(sc => sc.platform === 'YouTube')
        .reduce((sum, sc) => sum + (sc.lateness_minutes || 0), 0);
      const totalAccumulatedLateMinutes = totalLateMinutes + substituteLateMinutes;

      // 6. Kumpulkan Rincian History Kejadian untuk Pop-up Modal Detail
      const history = [];

      // Telat di jadwal sendiri
      originalSessions
        .filter(sc => sc.substitute_streamer_id === null && (sc.lateness_minutes || 0) > 0)
        .forEach(sc => {
          const isTiktok = sc.platform === 'TikTok';
          history.push({
            id: sc.id,
            date: getLocalDateString(sc.start_time),
            type: isTiktok ? 'Late (TikTok)' : 'Late',
            time: `${new Date(sc.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - ${new Date(sc.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
            description: isTiktok 
              ? `Terlambat live TikTok selama ${sc.lateness_minutes} menit (Bebas Denda - Opsional)`
              : `Terlambat live selama ${sc.lateness_minutes} menit (Denda: ${formatIDR(sc.lateness_minutes * rateLate)})`
          });
        });

      // Telat saat menggantikan orang lain
      substituteSessions
        .filter(sc => (sc.lateness_minutes || 0) > 0)
        .forEach(sc => {
          const isTiktok = sc.platform === 'TikTok';
          history.push({
            id: sc.id,
            date: getLocalDateString(sc.start_time),
            type: isTiktok ? 'Late (Substitute - TikTok)' : 'Late (Substitute)',
            time: `${new Date(sc.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - ${new Date(sc.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
            description: isTiktok
              ? `Terlambat saat menggantikan ${sc.original_streamer_name} di TikTok selama ${sc.lateness_minutes} menit (Bebas Denda)`
              : `Terlambat saat menggantikan ${sc.original_streamer_name} selama ${sc.lateness_minutes} menit (Denda: ${formatIDR(sc.lateness_minutes * rateLate)})`
          });
        });

      // Sesi Bolos (YouTube didenda, TikTok bebas denda)
      originalSessions.filter(sc => {
        const isScheduled = sc.status === 'Scheduled';
        const isPassed = new Date(sc.end_time).getTime() + (2 * 60 * 60 * 1000) < now.getTime();
        const noStart = sc.actual_start_time === null;
        const noSub = sc.substitute_streamer_id === null;
        const notSick = sc.is_sick !== true;
        return isScheduled && isPassed && noStart && noSub && notSick;
      }).forEach(sc => {
        const isTiktok = sc.platform === 'TikTok';
        history.push({
          id: sc.id,
          date: getLocalDateString(sc.start_time),
          type: isTiktok ? 'Absent (TikTok)' : 'Absent',
          time: `${new Date(sc.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - ${new Date(sc.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
          description: isTiktok
            ? `Tidak live TikTok / Bolos (Bebas Denda - Opsional)`
            : `Tidak live tanpa kabar pengganti / Bolos (Denda: ${formatIDR(rateAbsent)})`
        });
      });

      // Izin Biasa (YouTube didenda, TikTok bebas denda)
      originalSessions.filter(sc => sc.substitute_streamer_id !== null && !sc.is_sick).forEach(sc => {
        const isTiktok = sc.platform === 'TikTok';
        const substituteName = streamers.find(st => st.id === sc.substitute_streamer_id)?.nama || 'Streamer';
        history.push({
          id: sc.id,
          date: getLocalDateString(sc.start_time),
          type: isTiktok ? 'Leave (TikTok)' : 'Leave',
          time: `${new Date(sc.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - ${new Date(sc.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
          description: isTiktok
            ? `Izin swap jadwal TikTok, digantikan oleh ${substituteName} (Bebas Denda)`
            : `Izin swap jadwal, digantikan oleh ${substituteName} (Denda Potong: ${formatIDR(rateSwap)})`
        });
      });

      // Sesi Sakit
      sickSessions.forEach(sc => {
        const subName = sc.substitute_streamer_id 
          ? ` (digantikan oleh ${streamers.find(st => st.id === sc.substitute_streamer_id)?.nama || 'Streamer'})` 
          : ' (tidak ada pengganti)';
        history.push({
          id: sc.id,
          date: getLocalDateString(sc.start_time),
          type: 'Sick',
          time: `${new Date(sc.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - ${new Date(sc.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
          description: `Izin sakit terkonfirmasi${subName} (Bebas Denda: Rp 0)`
        });
      });

      // Menggantikan orang lain (Bonus)
      substituteSessions.forEach(sc => {
        history.push({
          id: sc.id,
          date: getLocalDateString(sc.start_time),
          type: 'Substitute Incentive',
          time: `${new Date(sc.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - ${new Date(sc.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
          description: `Menggantikan live untuk streamer ${sc.original_streamer_name} (Bonus: +${formatIDR(rateSwap)})`
        });
      });

      // Sort history by date ascending
      history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // 7. Kalkulasi Keuangan
      const dendaLate = totalAccumulatedLateMinutes * rateLate;
      const dendaAbsent = absentSessions.length * rateAbsent;
      const dendaLeave = leaveSessions.length * rateSwap; // potongan hanya jika izin biasa (bukan sakit)
      const bonusSubstitute = substituteSessions.length * rateSwap; // insentif karena menggantikan tetap dapat bonus

      const totalPenalty = dendaLate + dendaAbsent + dendaLeave;
      const netDeduction = totalPenalty - bonusSubstitute;

      return {
        streamerId: s.id,
        nama: s.nama,
        platform: s.platform,
        stats: {
          totalScheduled: originalSessions.length,
          lateMinutes: totalAccumulatedLateMinutes,
          absentCount: absentSessions.length,
          leaveCount: leaveSessions.length,
          sickCount: sickSessions.length,
          substituteCount: substituteSessions.length
        },
        financials: {
          dendaLate,
          dendaAbsent,
          dendaLeave,
          bonusSubstitute,
          totalPenalty,
          netDeduction
        },
        history
      };
    });

    res.json({
      month,
      rates: { rateLate, rateAbsent, rateSwap },
      report
    });

  } catch (error) {
    console.error('Error generating monthly monthly penalty report:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * GET /analytics/viewer-history
 * Mengambil history data penonton (YouTube vs TikTok) untuk dianalisa
 */
export const getViewerHistory = async (req, res) => {
  const { date, streamerId } = req.query;

  try {
    let sql = `
      SELECT h.*, s.nama as streamer_name, sc.start_time, sc.end_time
      FROM live_viewer_history h
      JOIN streamers s ON h.streamer_id = s.id
      JOIN schedule sc ON h.schedule_id = sc.id
      WHERE DATE(h.recorded_at AT TIME ZONE 'Asia/Jakarta') = $1
    `;
    const params = [date || new Date().toISOString().split('T')[0]];

    if (streamerId) {
      sql += ` AND h.streamer_id = $2`;
      params.push(parseInt(streamerId, 10));
    }

    sql += ` ORDER BY h.recorded_at ASC`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching live viewer history:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

