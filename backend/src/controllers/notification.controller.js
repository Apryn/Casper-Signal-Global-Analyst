import { query } from '../config/db.js';

// GET /api/notifications -> Retrieve all notifications
export const getNotifications = async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /api/notifications/:id/read -> Mark single notification as read
export const markNotificationRead = async (req, res) => {
  const { id } = req.params;
  try {
    if (id === 'all') {
      await query('UPDATE notifications SET is_read = TRUE');
      return res.json({ message: 'Semua notifikasi ditandai telah dibaca.' });
    }

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
