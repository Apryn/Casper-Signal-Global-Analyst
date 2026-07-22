import { query } from '../config/db.js';

/**
 * Helper to get date filters
 */
const getDateRangeFilter = (filterType) => {
  const today = new Date();
  const start = new Date();
  
  switch (filterType) {
    case 'today':
      start.setHours(0,0,0,0);
      return { start: start.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
    case 'yesterday':
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      return { start: yesterday.toISOString().split('T')[0], end: yesterday.toISOString().split('T')[0] };
    case '7days':
      start.setDate(today.getDate() - 7);
      return { start: start.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
    case '30days':
      start.setDate(today.getDate() - 30);
      return { start: start.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
    case 'thisMonth':
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: firstDay.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
    default:
      // Default to last 30 days
      start.setDate(today.getDate() - 30);
      return { start: start.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
  }
};

export const getDashboardSummary = async (req, res) => {
  const { range = '30days' } = req.query;
  const { start, end } = getDateRangeFilter(range);

  try {
    // 1. Total Streamers Count
    const streamersCountRes = await query('SELECT COUNT(*) as count FROM streamers');
    const totalStreamers = parseInt(streamersCountRes.rows[0].count, 10);

    // 2. Active Streamers Count (submitted at least one report in range)
    const activeStreamersRes = await query(
      'SELECT COUNT(DISTINCT streamer_id) as count FROM daily_reports WHERE tanggal >= $1 AND tanggal <= $2',
      [start, end]
    );
    const activeStreamers = parseInt(activeStreamersRes.rows[0].count, 10);

    // 3. Metrics for the selected date range
    const rangeMetricsRes = await query(
      `SELECT 
        COALESCE(SUM(live_duration), 0) as total_live_duration,
        COALESCE(SUM(tiktok_upload + youtube_upload + instagram_upload + facebook_upload), 0) as total_uploads,
        COALESCE(SUM(chat_count), 0) as total_chats,
        COALESCE(SUM(registration_count), 0) as total_registrations,
        COALESCE(SUM(ftd_count), 0) as total_ftds
       FROM daily_reports
       WHERE tanggal >= $1 AND tanggal <= $2`,
      [start, end]
    );
    const rangeMetrics = rangeMetricsRes.rows[0];

    // 4. Metrics for TODAY specifically (as requested by layout)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
    const todayStr = `${partMap.year}-${partMap.month}-${partMap.day}`;

    const todayMetricsRes = await query(
      `SELECT 
        COALESCE(SUM(live_duration), 0) as live_duration,
        COALESCE(SUM(tiktok_upload + youtube_upload + instagram_upload + facebook_upload), 0) as uploads,
        COALESCE(SUM(chat_count), 0) as chats,
        COALESCE(SUM(registration_count), 0) as registrations,
        COALESCE(SUM(ftd_count), 0) as ftds
       FROM daily_reports
       WHERE tanggal = $1`,
      [todayStr]
    );
    const todayMetrics = todayMetricsRes.rows[0];

    // 5. Today's report submission status per streamer (WIB)
    const todayReportsStatusRes = await query(
      `SELECT 
        s.id,
        s.nama,
        COALESCE(
          (
            SELECT sc.platform FROM schedule sc
            WHERE COALESCE(sc.substitute_streamer_id, sc.streamer_id) = s.id
              AND sc.status = 'Live'
              AND DATE(sc.start_time AT TIME ZONE 'Asia/Jakarta') = $1
            LIMIT 1
          ),
          s.platform
        ) as platform,
        CASE WHEN r.id IS NOT NULL AND r.raw_message IS NOT NULL THEN TRUE ELSE FALSE END as has_submitted,
        r.live_duration,
        r.reported_live_duration,
        r.ftd_count,
        CASE WHEN EXISTS (
          SELECT 1 FROM schedule sc
          WHERE COALESCE(sc.substitute_streamer_id, sc.streamer_id) = s.id
            AND sc.status = 'Live'
            AND DATE(sc.start_time AT TIME ZONE 'Asia/Jakarta') = $1
        ) THEN TRUE ELSE FALSE END as is_currently_live,
        (
          SELECT sc.start_time FROM schedule sc
          WHERE COALESCE(sc.substitute_streamer_id, sc.streamer_id) = s.id
            AND sc.status = 'Live'
            AND DATE(sc.start_time AT TIME ZONE 'Asia/Jakarta') = $1
          ORDER BY sc.start_time DESC LIMIT 1
        ) as actual_start_time,
        COALESCE(
          (
            SELECT sc.live_link 
            FROM schedule sc
            WHERE COALESCE(sc.substitute_streamer_id, sc.streamer_id) = s.id
              AND sc.status = 'Live'
              AND DATE(sc.start_time AT TIME ZONE 'Asia/Jakarta') = $1
            ORDER BY sc.start_time DESC LIMIT 1
          ),
          (
            SELECT sa.link FROM streamer_accounts sa
            WHERE sa.streamer_id = s.id
              AND sa.platform = s.platform
            LIMIT 1
          )
        ) as live_link
       FROM streamers s
       LEFT JOIN daily_reports r ON s.id = r.streamer_id AND r.tanggal = $1
       ORDER BY s.nama ASC`,
      [todayStr]
    );
    const todayReportsStatus = todayReportsStatusRes.rows.map(row => ({
      streamerId: row.id,
      nama: row.nama,
      platform: row.platform,
      hasSubmitted: row.has_submitted,
      liveDuration: row.live_duration ? parseFloat(row.live_duration) : 0,
      reportedLiveDuration: row.reported_live_duration ? parseFloat(row.reported_live_duration) : 0,
      ftdCount: row.ftd_count ? parseInt(row.ftd_count, 10) : 0,
      isCurrentlyLive: row.is_currently_live,
      actualStartTime: row.actual_start_time,
      liveLink: row.live_link
    }));

    res.json({
      range,
      startDate: start,
      endDate: end,
      totalStreamers,
      activeStreamers,
      rangeMetrics: {
        totalLiveHours: parseFloat(rangeMetrics.total_live_duration),
        totalUploads: parseInt(rangeMetrics.total_uploads, 10),
        totalChats: parseInt(rangeMetrics.total_chats, 10),
        totalRegistrations: parseInt(rangeMetrics.total_registrations, 10),
        totalFtds: parseInt(rangeMetrics.total_ftds, 10)
      },
      todayMetrics: {
        liveHours: parseFloat(todayMetrics.live_duration),
        uploads: parseInt(todayMetrics.uploads, 10),
        chats: parseInt(todayMetrics.chats, 10),
        registrations: parseInt(todayMetrics.registrations, 10),
        ftds: parseInt(todayMetrics.ftds, 10)
      },
      todayReportsStatus
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getChartData = async (req, res) => {
  try {
    // 1. Daily Chart (last 14 days)
    const dailyRes = await query(
      `SELECT 
        tanggal,
        COALESCE(SUM(live_duration), 0) as live_duration,
        COALESCE(SUM(tiktok_upload + youtube_upload + instagram_upload + facebook_upload), 0) as uploads,
        COALESCE(SUM(chat_count), 0) as chats,
        COALESCE(SUM(registration_count), 0) as registrations,
        COALESCE(SUM(ftd_count), 0) as ftds
       FROM daily_reports
       WHERE tanggal >= CURRENT_DATE - INTERVAL '14 days'
       GROUP BY tanggal
       ORDER BY tanggal ASC`
    );

    // 2. Weekly Chart (last 8 weeks)
    const weeklyRes = await query(
      `SELECT 
        DATE_TRUNC('week', tanggal)::date as week_start,
        COALESCE(SUM(live_duration), 0) as live_duration,
        COALESCE(SUM(tiktok_upload + youtube_upload + instagram_upload + facebook_upload), 0) as uploads,
        COALESCE(SUM(chat_count), 0) as chats,
        COALESCE(SUM(registration_count), 0) as registrations,
        COALESCE(SUM(ftd_count), 0) as ftds
       FROM daily_reports
       WHERE tanggal >= CURRENT_DATE - INTERVAL '8 weeks'
       GROUP BY DATE_TRUNC('week', tanggal)
       ORDER BY week_start ASC`
    );

    // 3. Monthly Chart (last 6 months)
    const monthlyRes = await query(
      `SELECT 
        DATE_TRUNC('month', tanggal)::date as month_start,
        COALESCE(SUM(live_duration), 0) as live_duration,
        COALESCE(SUM(tiktok_upload + youtube_upload + instagram_upload + facebook_upload), 0) as uploads,
        COALESCE(SUM(chat_count), 0) as chats,
        COALESCE(SUM(registration_count), 0) as registrations,
        COALESCE(SUM(ftd_count), 0) as ftds
       FROM daily_reports
       WHERE tanggal >= CURRENT_DATE - INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', tanggal)
       ORDER BY month_start ASC`
    );

    res.json({
      daily: dailyRes.rows.map(row => ({
        label: row.tanggal.toISOString().split('T')[0],
        liveHours: parseFloat(row.live_duration),
        uploads: parseInt(row.uploads, 10),
        chats: parseInt(row.chats, 10),
        registrations: parseInt(row.registrations, 10),
        ftds: parseInt(row.ftds, 10)
      })),
      weekly: weeklyRes.rows.map(row => ({
        label: `W/C ${row.week_start.toISOString().split('T')[0]}`,
        liveHours: parseFloat(row.live_duration),
        uploads: parseInt(row.uploads, 10),
        chats: parseInt(row.chats, 10),
        registrations: parseInt(row.registrations, 10),
        ftds: parseInt(row.ftds, 10)
      })),
      monthly: monthlyRes.rows.map(row => {
        const dateObj = new Date(row.month_start);
        const monthName = dateObj.toLocaleString('en-US', { month: 'short', year: '2-digit' });
        return {
          label: monthName,
          liveHours: parseFloat(row.live_duration),
          uploads: parseInt(row.uploads, 10),
          chats: parseInt(row.chats, 10),
          registrations: parseInt(row.registrations, 10),
          ftds: parseInt(row.ftds, 10)
        };
      })
    });
  } catch (error) {
    console.error('Error fetching chart data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getComparisonData = async (req, res) => {
  const { range = '30days' } = req.query;
  const { start, end } = getDateRangeFilter(range);

  try {
    const result = await query(
      `SELECT 
        kategori,
        COALESCE(SUM(live_duration), 0) as live_duration,
        COALESCE(SUM(tiktok_upload + youtube_upload + instagram_upload + facebook_upload), 0) as uploads,
        COALESCE(SUM(chat_count), 0) as chats,
        COALESCE(SUM(registration_count), 0) as registrations,
        COALESCE(SUM(ftd_count), 0) as ftds,
        COUNT(DISTINCT streamer_id) as active_streamers
       FROM daily_reports
       WHERE tanggal >= $1 AND tanggal <= $2
       GROUP BY kategori`,
      [start, end]
    );

    const data = {
      streaming: { liveHours: 0, uploads: 0, chats: 0, registrations: 0, ftds: 0, streamers: 0 },
      nonStreaming: { liveHours: 0, uploads: 0, chats: 0, registrations: 0, ftds: 0, streamers: 0 }
    };

    result.rows.forEach(row => {
      const target = row.kategori === 'Streaming' ? data.streaming : data.nonStreaming;
      target.liveHours = parseFloat(row.live_duration);
      target.uploads = parseInt(row.uploads, 10);
      target.chats = parseInt(row.chats, 10);
      target.registrations = parseInt(row.registrations, 10);
      target.ftds = parseInt(row.ftds, 10);
      target.streamers = parseInt(row.active_streamers, 10);
    });

    res.json(data);
  } catch (error) {
    console.error('Error fetching comparison data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getLeaderboard = async (req, res) => {
  const { range = '30days', limit = 10 } = req.query;
  const { start, end } = getDateRangeFilter(range);

  try {
    const result = await query(
      `SELECT 
        s.id,
        s.nama,
        s.platform,
        COALESCE(SUM(r.live_duration), 0) as total_live_hours,
        COALESCE(SUM(r.tiktok_upload + r.youtube_upload + r.instagram_upload + r.facebook_upload), 0) as total_uploads,
        COALESCE(SUM(r.chat_count), 0) as total_chats,
        COALESCE(SUM(r.registration_count), 0) as total_registrations,
        COALESCE(SUM(r.ftd_count), 0) as total_ftds
       FROM streamers s
       LEFT JOIN daily_reports r ON s.id = r.streamer_id AND r.tanggal >= $1 AND r.tanggal <= $2
       GROUP BY s.id
       ORDER BY total_ftds DESC, total_registrations DESC, total_live_hours DESC
       LIMIT $3`,
      [start, end, parseInt(limit, 10)]
    );

    res.json(result.rows.map((row, idx) => ({
      rank: idx + 1,
      id: row.id,
      nama: row.nama,
      platform: row.platform,
      liveHours: parseFloat(row.total_live_hours),
      uploads: parseInt(row.total_uploads, 10),
      chats: parseInt(row.total_chats, 10),
      registrations: parseInt(row.total_registrations, 10),
      ftds: parseInt(row.total_ftds, 10)
    })));
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
