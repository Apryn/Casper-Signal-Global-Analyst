import { query } from '../config/db.js';

export const getContentList = async (req, res) => {
  const { platform, streamerName, sortBy = 'upload_date', sortOrder = 'DESC' } = req.query;

  try {
    let sql = `
      SELECT c.*, s.nama as streamer_name, s.platform as streamer_platform, sa.username as account_username
      FROM content c
      JOIN streamers s ON c.streamer_id = s.id
      LEFT JOIN streamer_accounts sa ON c.account_id = sa.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (platform) {
      sql += ` AND c.platform = $${paramIndex}`;
      params.push(platform);
      paramIndex++;
    }

    if (streamerName) {
      sql += ` AND s.nama ILIKE $${paramIndex}`;
      params.push(`%${streamerName}%`);
      paramIndex++;
    }

    const validSortFields = ['upload_date', 'views', 'likes', 'comments', 'shares'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'upload_date';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    sql += ` ORDER BY c.${field} ${order}`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getContentAnalytics = async (req, res) => {
  try {
    // 1. Top Content (by views)
    const topContentRes = await query(
      `SELECT c.*, s.nama as creator_name
       FROM content c
       JOIN streamers s ON c.streamer_id = s.id
       ORDER BY c.views DESC
       LIMIT 1`
    );
    const topContent = topContentRes.rows[0] || null;

    // 2. Best Platform (by sum of views)
    const bestPlatformRes = await query(
      `SELECT platform, SUM(views) as total_views, COUNT(*) as post_count
       FROM content
       GROUP BY platform
       ORDER BY total_views DESC
       LIMIT 1`
    );
    const bestPlatform = bestPlatformRes.rows[0] || null;

    // 3. Overall averages
    const averagesRes = await query(
      `SELECT 
        COALESCE(AVG(views), 0) as avg_views,
        COALESCE(AVG(likes), 0) as avg_likes,
        COALESCE(AVG(comments), 0) as avg_comments
       FROM content`
    );
    const averages = {
      views: Math.round(parseFloat(averagesRes.rows[0].avg_views)),
      likes: Math.round(parseFloat(averagesRes.rows[0].avg_likes)),
      comments: Math.round(parseFloat(averagesRes.rows[0].avg_comments))
    };

    // 4. Top 10 Contents list
    const top10Res = await query(
      `SELECT c.*, s.nama as creator_name
       FROM content c
       JOIN streamers s ON c.streamer_id = s.id
       ORDER BY c.views DESC
       LIMIT 10`
    );

    res.json({
      topContent,
      bestPlatform,
      averages,
      top10: top10Res.rows
    });
  } catch (error) {
    console.error('Error fetching content analytics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const addContent = async (req, res) => {
  const { streamer_id, platform, title, upload_date, link, views, likes, comments, shares, account_id } = req.body;

  if (!streamer_id || !platform || !title || !upload_date) {
    return res.status(400).json({ message: 'streamer_id, platform, title, and upload_date are required' });
  }

  try {
    const result = await query(
      `INSERT INTO content (streamer_id, platform, title, upload_date, link, views, likes, comments, shares, account_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [streamer_id, platform, title.trim(), upload_date, link ? link.trim() : null, views || 0, likes || 0, comments || 0, shares || 0, account_id || null]
    );


    res.status(201).json({
      message: 'Content log added successfully',
      content: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding content:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateContent = async (req, res) => {
  const { id } = req.params;
  const { title, link, views, likes, comments, shares } = req.body;

  try {
    const result = await query(
      `UPDATE content
       SET title = COALESCE($1, title),
           link = COALESCE($2, link),
           views = COALESCE($3, views),
           likes = COALESCE($4, likes),
           comments = COALESCE($5, comments),
           shares = COALESCE($6, shares)
       WHERE id = $7
       RETURNING *`,
      [title, link, views, likes, comments, shares, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Content log not found' });
    }

    res.json({
      message: 'Content details updated successfully',
      content: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating content:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteContent = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query('DELETE FROM content WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Content log not found' });
    }
    res.json({
      message: 'Content log deleted successfully',
      content: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting content:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
