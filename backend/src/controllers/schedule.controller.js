import { query } from '../config/db.js';

export const getSchedules = async (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    let sql = `
      SELECT sc.*, s.nama as streamer_name, s.platform as streamer_platform
      FROM schedule sc
      JOIN streamers s ON sc.streamer_id = s.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      sql += ` AND sc.start_time >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      sql += ` AND sc.end_time <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    sql += ` ORDER BY sc.start_time ASC`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const addSchedule = async (req, res) => {
  const { streamer_id, platform, start_time, end_time } = req.body;

  if (!streamer_id || !platform || !start_time || !end_time) {
    return res.status(400).json({ message: 'streamer_id, platform, start_time, and end_time are required' });
  }

  const start = new Date(start_time);
  const end = new Date(end_time);

  if (start >= end) {
    return res.status(400).json({ message: 'Start time must be before end time' });
  }

  try {
    // Overlap conflict checker:
    // Checks if there is any scheduled stream for this streamer that overlaps with the proposed range.
    const overlapRes = await query(
      `SELECT sc.*, s.nama as streamer_name
       FROM schedule sc
       JOIN streamers s ON sc.streamer_id = s.id
       WHERE sc.streamer_id = $1 
         AND sc.status = 'Scheduled'
         AND (
           ($2 >= sc.start_time AND $2 < sc.end_time) OR
           ($3 > sc.start_time AND $3 <= sc.end_time) OR
           (sc.start_time >= $2 AND sc.start_time < $3)
         )`,
      [streamer_id, start.toISOString(), end.toISOString()]
    );

    if (overlapRes.rows.length > 0) {
      const conflict = overlapRes.rows[0];
      const conflictStart = new Date(conflict.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const conflictEnd = new Date(conflict.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      
      return res.status(409).json({
        message: `Jadwal bentrok! Streamer ${conflict.streamer_name} sudah memiliki jadwal live di ${conflict.platform} pada pukul ${conflictStart} - ${conflictEnd}.`
      });
    }

    const result = await query(
      `INSERT INTO schedule (streamer_id, platform, start_time, end_time, status)
       VALUES ($1, $2, $3, $4, 'Scheduled')
       RETURNING *`,
      [streamer_id, platform, start.toISOString(), end.toISOString()]
    );

    res.status(201).json({
      message: 'Schedule added successfully',
      schedule: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding schedule:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateSchedule = async (req, res) => {
  const { id } = req.params;
  const { platform, start_time, end_time, status } = req.body;

  try {
    const fetchRes = await query('SELECT * FROM schedule WHERE id = $1', [id]);
    if (fetchRes.rows.length === 0) {
      return res.status(404).json({ message: 'Schedule not found' });
    }
    const current = fetchRes.rows[0];

    const finalStart = start_time ? new Date(start_time) : new Date(current.start_time);
    const finalEnd = end_time ? new Date(end_time) : new Date(current.end_time);

    if (finalStart >= finalEnd) {
      return res.status(400).json({ message: 'Start time must be before end time' });
    }

    // Check overlap if times are updated or status is set to scheduled
    const checkScheduled = status ? status === 'Scheduled' : current.status === 'Scheduled';
    if (checkScheduled && (start_time || end_time || status === 'Scheduled')) {
      const overlapRes = await query(
        `SELECT sc.*, s.nama as streamer_name
         FROM schedule sc
         JOIN streamers s ON sc.streamer_id = s.id
         WHERE sc.streamer_id = $1 
           AND sc.id <> $2
           AND sc.status = 'Scheduled'
           AND (
             ($3 >= sc.start_time AND $3 < sc.end_time) OR
             ($4 > sc.start_time AND $4 <= sc.end_time) OR
             (sc.start_time >= $3 AND sc.start_time < $4)
           )`,
        [current.streamer_id, id, finalStart.toISOString(), finalEnd.toISOString()]
      );

      if (overlapRes.rows.length > 0) {
        const conflict = overlapRes.rows[0];
        const conflictStart = new Date(conflict.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const conflictEnd = new Date(conflict.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        
        return res.status(409).json({
          message: `Jadwal bentrok! Streamer ${conflict.streamer_name} sudah memiliki jadwal live di ${conflict.platform} pada pukul ${conflictStart} - ${conflictEnd}.`
        });
      }
    }

    const result = await query(
      `UPDATE schedule
       SET platform = COALESCE($1, platform),
           start_time = COALESCE($2, start_time),
           end_time = COALESCE($3, end_time),
           status = COALESCE($4, status)
       WHERE id = $5
       RETURNING *`,
      [platform, finalStart.toISOString(), finalEnd.toISOString(), status, id]
    );

    res.json({
      message: 'Schedule updated successfully',
      schedule: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteSchedule = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query('DELETE FROM schedule WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Schedule not found' });
    }
    res.json({
      message: 'Schedule deleted successfully',
      schedule: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
