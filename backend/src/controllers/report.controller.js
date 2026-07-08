import { query } from '../config/db.js';
import { parseMessageText } from '../services/telegram.service.js';

export const getReports = async (req, res) => {
  const { startDate, endDate, streamerName, kategori, sortBy, sortOrder } = req.query;

  try {
    let sql = `
      SELECT r.*, s.nama as streamer_name, s.platform as streamer_platform
      FROM daily_reports r
      JOIN streamers s ON r.streamer_id = s.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      sql += ` AND r.tanggal >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      sql += ` AND r.tanggal <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (kategori) {
      sql += ` AND r.kategori = $${paramIndex}`;
      params.push(kategori);
      paramIndex++;
    }

    if (streamerName) {
      sql += ` AND s.nama ILIKE $${paramIndex}`;
      params.push(`%${streamerName}%`);
      paramIndex++;
    }

    // Sorting
    const validSortFields = ['tanggal', 'live_duration', 'chat_count', 'registration_count', 'ftd_count', 'tiktok_upload'];
    const validSortOrder = ['ASC', 'DESC'];
    
    const field = validSortFields.includes(sortBy) ? sortBy : 'tanggal';
    const order = validSortOrder.includes(sortOrder?.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    sql += ` ORDER BY r.${field} ${order}, s.nama ASC`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const simulateReportParsing = async (req, res) => {
  const { rawText } = req.body;

  if (!rawText) {
    return res.status(400).json({ message: 'Raw message content is required' });
  }

  try {
    const result = await parseMessageText(rawText);
    res.status(200).json({
      message: 'Message parsed and saved successfully',
      ...result
    });
  } catch (error) {
    console.error('Parsing simulation failed:', error);
    res.status(400).json({ message: `Parsing failed: ${error.message}` });
  }
};

export const updateReport = async (req, res) => {
  const { id } = req.params;
  const {
    kategori,
    tiktok_upload,
    youtube_upload,
    instagram_upload,
    facebook_upload,
    live_duration,
    chat_count,
    registration_count,
    ftd_count
  } = req.body;

  try {
    const checkReport = await query('SELECT id FROM daily_reports WHERE id = $1', [id]);
    if (checkReport.rows.length === 0) {
      return res.status(404).json({ message: 'Report not found' });
    }

    const result = await query(
      `UPDATE daily_reports 
       SET kategori = $1,
           tiktok_upload = $2,
           youtube_upload = $3,
           instagram_upload = $4,
           facebook_upload = $5,
           live_duration = $6,
           chat_count = $7,
           registration_count = $8,
           ftd_count = $9
       WHERE id = $10 
       RETURNING *`,
      [
        kategori,
        tiktok_upload || 0,
        youtube_upload || 0,
        instagram_upload || 0,
        facebook_upload || 0,
        live_duration || 0.0,
        chat_count || 0,
        registration_count || 0,
        ftd_count || 0,
        id
      ]
    );

    res.json({
      message: 'Report updated successfully',
      report: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteReport = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query('DELETE FROM daily_reports WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Report not found' });
    }
    res.json({
      message: 'Report deleted successfully',
      report: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
