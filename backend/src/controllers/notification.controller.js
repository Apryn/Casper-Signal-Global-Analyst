import { query } from '../config/db.js';

// GET /api/notifications -> Retrieve all notifications with streamer info
export const getNotifications = async (req, res) => {
  try {
    const result = await query(
      `SELECT n.*, s.nama as streamer_name
       FROM notifications n
       LEFT JOIN streamers s ON n.streamer_id = s.id
       ORDER BY n.created_at DESC
       LIMIT 50`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /api/notifications/all/read -> Mark ALL notifications as read
export const markAllNotificationsRead = async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE');
    res.json({ message: 'Semua notifikasi ditandai telah dibaca.' });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /api/notifications/:id/read -> Mark single notification as read
export const markNotificationRead = async (req, res) => {
  const { id } = req.params;
  try {
    const check = await query('SELECT * FROM notifications WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [id]);
    res.json({ message: 'Notifikasi ditandai dibaca.' });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
