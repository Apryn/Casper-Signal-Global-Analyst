import { query } from '../config/db.js';

export const getTargets = async (req, res) => {
  const { period = 'monthly' } = req.query;

  try {
    const result = await query(
      `SELECT t.*, s.nama as streamer_name, s.platform as streamer_platform
       FROM targets t
       JOIN streamers s ON t.streamer_id = s.id
       WHERE t.period = $1
       ORDER BY s.nama ASC, t.target_type ASC`,
      [period]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching targets:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getStreamerTargets = async (req, res) => {
  const { streamerId } = req.params;
  const { period = 'monthly' } = req.query;

  try {
    const result = await query(
      `SELECT * FROM targets 
       WHERE streamer_id = $1 AND period = $2`,
      [streamerId, period]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching streamer targets:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const saveTarget = async (req, res) => {
  const { streamer_id, target_type, target_value, period } = req.body;

  if (!streamer_id || !target_type || target_value === undefined || !period) {
    return res.status(400).json({ message: 'streamer_id, target_type, target_value, and period are required' });
  }

  if (!['live_duration', 'uploads', 'registrations', 'ftds'].includes(target_type)) {
    return res.status(400).json({ message: 'Invalid target type' });
  }

  if (!['daily', 'weekly', 'monthly'].includes(period)) {
    return res.status(400).json({ message: 'Invalid period. Must be daily, weekly, or monthly' });
  }

  try {
    // Upsert target
    const result = await query(
      `INSERT INTO targets (streamer_id, target_type, target_value, period)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (streamer_id, target_type, period) 
       DO UPDATE SET target_value = EXCLUDED.target_value
       RETURNING *`,
      [streamer_id, target_type, parseFloat(target_value), period]
    );

    res.status(201).json({
      message: 'Target saved successfully',
      target: result.rows[0]
    });
  } catch (error) {
    console.error('Error saving target:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
