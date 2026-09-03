import { query } from '../config/db.js';

export const getAllStreamers = async (req, res) => {
  const { all } = req.query;
  try {
    let whereClause = "WHERE COALESCE(s.status, 'active') = 'active' AND COALESCE(s.is_active, TRUE) = TRUE";
    if (all === 'true') {
      whereClause = "";
    }
    const result = await query(
      `SELECT s.*, 
       COALESCE(COUNT(r.id), 0) as total_reports,
       COALESCE(SUM(r.live_duration), 0) as total_live_hours
       FROM streamers s
       LEFT JOIN daily_reports r ON s.id = r.streamer_id
       ${whereClause}
       GROUP BY s.id
       ORDER BY s.nama ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching streamers:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createStreamer = async (req, res) => {
  const { nama, platform, telegram_username, status } = req.body;

  if (!nama) {
    return res.status(400).json({ message: 'Streamer name is required' });
  }

  const streamerStatus = status || 'active';
  const isActive = streamerStatus === 'active';

  try {
    const checkName = await query('SELECT id FROM streamers WHERE LOWER(nama) = LOWER($1)', [nama.trim()]);
    if (checkName.rows.length > 0) {
      return res.status(409).json({ message: 'Streamer with this name already exists' });
    }

    const result = await query(
      `INSERT INTO streamers (nama, platform, telegram_username, status, is_active) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nama.trim(), platform ? platform.trim() : 'TikTok', telegram_username ? telegram_username.trim() : null, streamerStatus, isActive]
    );

    res.status(201).json({
      message: 'Streamer created successfully',
      streamer: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating streamer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateStreamer = async (req, res) => {
  const { id } = req.params;
  const { nama, platform, telegram_username, status } = req.body;

  if (!nama) {
    return res.status(400).json({ message: 'Streamer name is required' });
  }

  try {
    // Check if name is taken by another streamer
    const checkName = await query(
      'SELECT id FROM streamers WHERE LOWER(nama) = LOWER($1) AND id <> $2',
      [nama.trim(), id]
    );
    if (checkName.rows.length > 0) {
      return res.status(409).json({ message: 'Streamer name is already taken' });
    }

    const streamerStatus = status || 'active';
    const isActive = streamerStatus === 'active';

    const result = await query(
      `UPDATE streamers 
       SET nama = $1, platform = $2, telegram_username = $3, status = $4, is_active = $5 
       WHERE id = $6 RETURNING *`,
      [nama.trim(), platform ? platform.trim() : 'TikTok', telegram_username ? telegram_username.trim() : null, streamerStatus, isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Streamer not found' });
    }

    // Sync payroll_profiles if exists
    try {
      await query('UPDATE payroll_profiles SET is_active = $1 WHERE streamer_id = $2', [isActive, id]);
    } catch (profileErr) {
      console.warn('[updateStreamer] Sync to payroll profile failed:', profileErr.message);
    }

    res.json({
      message: 'Streamer updated successfully',
      streamer: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating streamer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const setStreamerStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['active', 'resigned', 'inactive'].includes(status)) {
    return res.status(400).json({ message: "Invalid status. Allowed values: 'active', 'resigned', 'inactive'" });
  }

  const isActive = status === 'active';

  try {
    const result = await query(
      `UPDATE streamers 
       SET status = $1, is_active = $2 
       WHERE id = $3 RETURNING *`,
      [status, isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Streamer not found' });
    }

    // Sync payroll_profiles if exists
    try {
      await query('UPDATE payroll_profiles SET is_active = $1 WHERE streamer_id = $2', [isActive, id]);
    } catch (profileErr) {
      console.warn('[setStreamerStatus] Sync to payroll profile failed:', profileErr.message);
    }

    res.json({
      message: `Streamer status updated to ${status}`,
      streamer: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating streamer status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteStreamer = async (req, res) => {
  const { id } = req.params;
  const { force } = req.query;

  try {
    // Check if streamer exists
    const streamerCheck = await query('SELECT * FROM streamers WHERE id = $1', [id]);
    if (streamerCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Streamer not found' });
    }
    const streamer = streamerCheck.rows[0];

    // Check report count
    const reportsRes = await query('SELECT COUNT(*) as count FROM daily_reports WHERE streamer_id = $1', [id]);
    const reportCount = parseInt(reportsRes.rows[0]?.count || 0, 10);

    // If streamer has historical reports or force is not explicitly true, perform non-destructive resign/deactivate
    if (reportCount > 0 || force !== 'true') {
      const updateRes = await query(
        `UPDATE streamers 
         SET status = 'resigned', is_active = FALSE 
         WHERE id = $1 RETURNING *`,
        [id]
      );

      try {
        await query('UPDATE payroll_profiles SET is_active = FALSE WHERE streamer_id = $1', [id]);
      } catch (profileErr) {
        console.warn('[deleteStreamer] Sync to payroll profile failed:', profileErr.message);
      }

      return res.json({
        message: `Streamer "${streamer.nama}" berhasil ditandai sebagai Resign. Seluruh ${reportCount} riwayat laporan harian tetap aman tersimpan!`,
        streamer: updateRes.rows[0],
        softDeleted: true,
        reportCount,
      });
    }

    // Only if 0 reports and force=true, do hard delete
    const result = await query('DELETE FROM streamers WHERE id = $1 RETURNING *', [id]);
    res.json({
      message: 'Streamer deleted successfully',
      streamer: result.rows[0],
    });
  } catch (error) {
    console.error('Error deleting streamer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

