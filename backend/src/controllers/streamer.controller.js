import { query } from '../config/db.js';

export const getAllStreamers = async (req, res) => {
  try {
    const result = await query(
      `SELECT s.*, 
       COALESCE(COUNT(r.id), 0) as total_reports,
       COALESCE(SUM(r.live_duration), 0) as total_live_hours
       FROM streamers s
       LEFT JOIN daily_reports r ON s.id = r.streamer_id
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
  const { nama, platform, telegram_username } = req.body;

  if (!nama) {
    return res.status(400).json({ message: 'Streamer name is required' });
  }

  try {
    const checkName = await query('SELECT id FROM streamers WHERE LOWER(nama) = LOWER($1)', [nama.trim()]);
    if (checkName.rows.length > 0) {
      return res.status(409).json({ message: 'Streamer with this name already exists' });
    }

    const result = await query(
      'INSERT INTO streamers (nama, platform, telegram_username) VALUES ($1, $2, $3) RETURNING *',
      [nama.trim(), platform ? platform.trim() : 'TikTok', telegram_username ? telegram_username.trim() : null]
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
  const { nama, platform, telegram_username } = req.body;

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

    const result = await query(
      'UPDATE streamers SET nama = $1, platform = $2, telegram_username = $3 WHERE id = $4 RETURNING *',
      [nama.trim(), platform ? platform.trim() : 'TikTok', telegram_username ? telegram_username.trim() : null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Streamer not found' });
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

export const deleteStreamer = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query('DELETE FROM streamers WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Streamer not found' });
    }
    res.json({
      message: 'Streamer deleted successfully',
      streamer: result.rows[0],
    });
  } catch (error) {
    console.error('Error deleting streamer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
