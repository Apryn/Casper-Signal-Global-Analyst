import { query } from '../config/db.js';

// Call Gemini API for evaluation narrative
const generateAIEvaluation = async (streamerName, stats, targets) => {
  const apiKey = process.env.GEMINI_API_KEY;
  
  const textPrompt = `
You are Head Office (HO) of Casper Signal, a professional affiliate BI platform.
Evaluate this weekly performance summary for streamer "${streamerName}":
- Live Duration: ${stats.liveDuration} hours (Target: ${targets.liveDuration} hours, Achievement: ${stats.liveAchievement}%)
- Days Below 4-Hour Daily Minimum Target: ${stats.daysBelowMinLive} days
- Upload Count: ${stats.uploads} videos (Target: ${targets.uploads} videos, Achievement: ${stats.uploadAchievement}%)
- Chat Received: ${stats.chats}
- Registrations: ${stats.registrations} (Target: ${targets.registrations}, Achievement: ${stats.regAchievement}%)
- FTD (First Time Deposit): ${stats.ftds} (Target: ${targets.ftds}, Achievement: ${stats.ftdAchievement}%)
- Registration Rate (Reg / Chats): ${stats.regRate}%
- FTD Conversion Rate (FTDs / Reg): ${stats.ftdConversionRate}%
- Schedule Adherence (Actual vs Planned Live Hours): ${stats.adherence}%

Generate a professional evaluation in Indonesian. Be constructive, tactical, and direct. Mention if they failed the 4-hour daily live standard on any days.
Output ONLY a valid JSON object matching this structure:
{
  "kelebihan": "Highlight key positive points. Why did they do well in these areas?",
  "kekurangan": "Identify critical bottlenecks, gaps, or lack of targets met. Explicitly mention the days below 4 hours minimum live target if greater than 0.",
  "rekomendasi": "List 2-3 concrete tactical actions they must take next week."
}
Do not wrap it in markdown code blocks like \`\`\`json. Return only the raw JSON string.
`;

  if (apiKey && apiKey !== 'YOUR_GEMINI_API_KEY_HERE' && apiKey.trim() !== '') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second timeout

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: textPrompt }] }]
          }),
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);
      
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
      if (text) {
        // Strip markdown code block if present
        const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        return JSON.parse(cleaned);
      }
    } catch (err) {
      console.warn('[AI Evaluation] Gemini API failed, falling back to rule-based insights:', err.message);
    }
  }

  // Deterministic rule-based fallback
  const kelebihan = stats.ftdAchievement >= 100
    ? `${streamerName} menunjukkan performa closing yang sangat baik minggu ini dengan pencapaian FTD sebesar ${stats.ftdAchievement}%. Konversi FTD-nya sebesar ${stats.ftdConversionRate}% menunjukkan kualitas interaksi yang tinggi.`
    : `${streamerName} menjaga stabilitas interaksi dengan total durasi live ${stats.liveDuration} jam, yang membuktikan dedikasi harian dalam siaran.`;

  let kekurangan = stats.uploadAchievement < 100
    ? `Volume upload konten media sosial masih di bawah target (${stats.uploadAchievement}%). Hal ini membatasi jangkauan audiens baru dan menurunkan potensi penonton live.`
    : `Meskipun target tercapai, volume chat masuk masih bisa dimaksimalkan jika waktu streaming dikoordinasikan dengan jam-jam traffic sibuk.`;

  if (stats.daysBelowMinLive > 0) {
    kekurangan += ` Terdeteksi ${stats.daysBelowMinLive} hari di mana durasi live berada di bawah standar minimal 4 jam per hari.`;
  }

  const rekomendasi = stats.daysBelowMinLive > 0
    ? `1. Pastikan durasi live setiap hari minimal mencapai 4 jam penuh sesuai standar.\n2. Tingkatkan upload video secara konsisten untuk membangun traffic organik.\n3. Lakukan evaluasi interaksi chat agar conversion rate tetap terjaga di atas 10%.`
    : `1. Tingkatkan upload video secara konsisten untuk membangun traffic organik.\n2. Lakukan evaluasi interaksi chat agar conversion rate tetap terjaga di atas 10%.\n3. Perpanjang durasi live pada slot jam ramai di malam hari.`;

  return { kelebihan, kekurangan, rekomendasi };
};


export const getWeeklyEvaluation = async (req, res) => {
  const { streamerId, startDate } = req.query;

  if (!streamerId || !startDate) {
    return res.status(400).json({ message: 'streamerId and startDate (YYYY-MM-DD) are required' });
  }

  try {
    // 1. Fetch streamer details
    const streamerRes = await query('SELECT * FROM streamers WHERE id = $1', [streamerId]);
    if (streamerRes.rows.length === 0) {
      return res.status(404).json({ message: 'Streamer not found' });
    }
    const streamer = streamerRes.rows[0];

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    const endDateStr = endDate.toISOString().slice(0, 10);

    // Check if there is an archived evaluation
    const archivedRes = await query(
      `SELECT * FROM weekly_evaluations WHERE streamer_id = $1 AND start_date = $2`,
      [streamerId, startDate]
    );

    if (archivedRes.rows.length > 0) {
      const archived = archivedRes.rows[0];
      const endDateVal = archived.end_date instanceof Date 
        ? archived.end_date.toISOString().slice(0, 10) 
        : archived.end_date;
      return res.json({
        streamer,
        period: {
          start: startDate,
          end: endDateVal
        },
        stats: archived.stats,
        targets: archived.targets,
        peakHour: archived.peak_hour,
        aiFeedback: {
          kelebihan: archived.kelebihan,
          kekurangan: archived.kekurangan,
          rekomendasi: archived.rekomendasi
        },
        isArchived: true
      });
    }


    // 2. Fetch daily reports summary
    const reportsRes = await query(
      `SELECT 
         COALESCE(SUM(live_duration), 0) as live_duration,
         COALESCE(SUM(tiktok_upload + youtube_upload + instagram_upload + facebook_upload), 0) as uploads,
         COALESCE(SUM(chat_count), 0) as chats,
         COALESCE(SUM(registration_count), 0) as registrations,
         COALESCE(SUM(ftd_count), 0) as ftds
       FROM daily_reports
       WHERE streamer_id = $1 AND tanggal BETWEEN $2 AND $3`,
      [streamerId, startDate, endDateStr]
    );

    const rawStats = reportsRes.rows[0];
    const liveDuration = parseFloat(rawStats.live_duration) || 0;
    const uploads = parseInt(rawStats.uploads, 10) || 0;
    const chats = parseInt(rawStats.chats, 10) || 0;
    const registrations = parseInt(rawStats.registrations, 10) || 0;
    const ftds = parseInt(rawStats.ftds, 10) || 0;

    const regRate = chats > 0 ? parseFloat(((registrations / chats) * 100).toFixed(1)) : 0;
    const ftdConversionRate = registrations > 0 ? parseFloat(((ftds / registrations) * 100).toFixed(1)) : 0;

    // 2b. Fetch days below 4 hours minimum live target
    const minLiveCheckRes = await query(
      `SELECT COUNT(*) as count 
       FROM daily_reports 
       WHERE streamer_id = $1 
         AND tanggal BETWEEN $2 AND $3 
         AND kategori = 'Streaming'
         AND live_duration < 4.0`,
      [streamerId, startDate, endDateStr]
    );
    const daysBelowMinLive = parseInt(minLiveCheckRes.rows[0].count, 10) || 0;

    // 3. Fetch targets
    const targetsRes = await query(
      `SELECT target_type, target_value, period FROM targets WHERE streamer_id = $1`,
      [streamerId]
    );

    const targets = { liveDuration: 28, uploads: 21, registrations: 20, ftds: 5 }; // default baseline targets (28 hours/week default = 4h/day * 7d)
    
    targetsRes.rows.forEach(t => {
      let multiplier = 1;
      if (t.period === 'daily') multiplier = 7;
      else if (t.period === 'monthly') multiplier = 0.25; // approx 1 week

      const val = parseFloat(t.target_value) * multiplier;

      if (t.target_type === 'live_duration') targets.liveDuration = Math.round(val);
      else if (t.target_type === 'uploads') targets.uploads = Math.round(val);
      else if (t.target_type === 'registrations') targets.registrations = Math.round(val);
      else if (t.target_type === 'ftds') targets.ftds = Math.round(val);
    });

    const liveAchievement = targets.liveDuration > 0 ? Math.round((liveDuration / targets.liveDuration) * 100) : 100;
    const uploadAchievement = targets.uploads > 0 ? Math.round((uploads / targets.uploads) * 100) : 100;
    const regAchievement = targets.registrations > 0 ? Math.round((registrations / targets.registrations) * 100) : 100;
    const ftdAchievement = targets.ftds > 0 ? Math.round((ftds / targets.ftds) * 100) : 100;


    // 4. Schedule Adherence (Planned hours vs actual)
    const schedulesRes = await query(
      `SELECT jam_mulai, jam_selesai 
       FROM schedule 
       WHERE streamer_id = $1 AND tanggal BETWEEN $2 AND $3`,
      [streamerId, startDate, endDateStr]
    );

    let totalPlannedMinutes = 0;
    schedulesRes.rows.forEach(s => {
      const [sh, sm] = s.jam_mulai.split(':').map(Number);
      const [eh, em] = s.jam_selesai.split(':').map(Number);
      
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff < 0) diff += 24 * 60; // handle overnight schedule crossings
      totalPlannedMinutes += diff;
    });

    const plannedHours = totalPlannedMinutes / 60;
    const adherence = plannedHours > 0 
      ? Math.min(100, Math.round((liveDuration / plannedHours) * 100)) 
      : 100; // 100% if nothing planned

    // 5. Best peak hours (derived from daily report raw messages)
    const rawReportsRes = await query(
      `SELECT raw_message FROM daily_reports 
       WHERE streamer_id = $1 AND tanggal BETWEEN $2 AND $3`,
      [streamerId, startDate, endDateStr]
    );

    const hoursTally = {};
    rawReportsRes.rows.forEach(r => {
      if (!r.raw_message) return;
      const times = r.raw_message.match(/\b(?:0\d|1\d|2[0-3])[:.][0-5]\d\b/g) || [];
      times.forEach(t => {
        const hour = t.slice(0, 2) + ':00';
        hoursTally[hour] = (hoursTally[hour] || 0) + 1;
      });
    });

    const sortedHours = Object.entries(hoursTally).sort((a, b) => b[1] - a[1]);
    const peakHour = sortedHours.length > 0 ? `${sortedHours[0][0]} - ${parseInt(sortedHours[0][0]) + 2}:00` : '20:00 - 22:00';

    // 6. Generate AI Evaluation
    const statsObj = {
      liveDuration, uploads, chats, registrations, ftds,
      regRate, ftdConversionRate, liveAchievement, uploadAchievement,
      regAchievement, ftdAchievement, adherence, daysBelowMinLive
    };


    const aiFeedback = await generateAIEvaluation(streamer.nama, statsObj, targets);

    res.json({
      streamer,
      period: {
        start: startDate,
        end: endDateStr
      },
      stats: statsObj,
      targets,
      peakHour,
      aiFeedback,
      isArchived: false
    });

  } catch (error) {
    console.error('Error generating weekly evaluation:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/evaluations/save -> Save or overwrite a weekly evaluation
export const saveWeeklyEvaluation = async (req, res) => {
  const { streamerId, startDate, endDate, stats, targets, peakHour, kelebihan, kekurangan, rekomendasi } = req.body;

  if (!streamerId || !startDate || !stats || !targets) {
    return res.status(400).json({ message: 'streamerId, startDate, stats, and targets are required' });
  }

  try {
    const result = await query(
      `INSERT INTO weekly_evaluations (streamer_id, start_date, end_date, stats, targets, peak_hour, kelebihan, kekurangan, rekomendasi)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (streamer_id, start_date)
       DO UPDATE SET 
         stats = EXCLUDED.stats,
         targets = EXCLUDED.targets,
         peak_hour = EXCLUDED.peak_hour,
         kelebihan = EXCLUDED.kelebihan,
         kekurangan = EXCLUDED.kekurangan,
         rekomendasi = EXCLUDED.rekomendasi
       RETURNING *`,
      [streamerId, startDate, endDate, JSON.stringify(stats), JSON.stringify(targets), peakHour, kelebihan, kekurangan, rekomendasi]
    );
    res.json({ message: 'Rapor mingguan berhasil disimpan!', data: result.rows[0] });
  } catch (error) {
    console.error('Error saving weekly evaluation:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/evaluations/history -> List saved evaluations for a streamer
export const getWeeklyEvaluationHistory = async (req, res) => {
  const { streamerId } = req.query;
  if (!streamerId) {
    return res.status(400).json({ message: 'streamerId is required' });
  }

  try {
    const result = await query(
      `SELECT * FROM weekly_evaluations WHERE streamer_id = $1 ORDER BY start_date DESC`,
      [streamerId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching weekly evaluation history:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

