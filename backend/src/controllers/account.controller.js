import { query } from '../config/db.js';

// GET /api/streamers/:id/accounts -> Retrieve accounts for streamer
export const getStreamerAccounts = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query(
      'SELECT * FROM streamer_accounts WHERE streamer_id = $1 ORDER BY platform, username',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching streamer accounts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/streamers/:id/accounts -> Add handle to streamer
export const addAccount = async (req, res) => {
  const { id } = req.params;
  const { platform, username, link } = req.body;

  if (!platform || !username) {
    return res.status(400).json({ message: 'Platform and username are required' });
  }

  // Validate platform
  const validPlatforms = ['TikTok', 'YouTube', 'Instagram', 'Facebook'];
  if (!validPlatforms.includes(platform)) {
    return res.status(400).json({ message: `Platform must be one of: ${validPlatforms.join(', ')}` });
  }

  try {
    const result = await query(
      `INSERT INTO streamer_accounts (streamer_id, platform, username, link)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, platform, username, link || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Username pada platform ini sudah terdaftar.' });
    }
    console.error('Error adding account handle:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/accounts/:accountId -> Remove handle
export const deleteAccount = async (req, res) => {
  const { accountId } = req.params;
  try {
    const check = await query('SELECT * FROM streamer_accounts WHERE id = $1', [accountId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ message: 'Account handle not found' });
    }

    await query('DELETE FROM streamer_accounts WHERE id = $1', [accountId]);
    res.json({ message: 'Handle akun berhasil dihapus.' });
  } catch (error) {
    console.error('Error deleting account handle:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
