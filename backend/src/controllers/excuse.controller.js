import pool from '../config/db.js';

// Public: Get streamer names for form dropdown
export const getPublicStreamers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nama, platform FROM streamers ORDER BY nama ASC`
    );
    res.json({ streamers: result.rows });
  } catch (err) {
    console.error('[Excuse getPublicStreamers] Error:', err);
    res.status(500).json({ message: 'Gagal memuat daftar streamer' });
  }
};

// Public: Submit new excuse request from Google Form style page
export const submitExcuseRequest = async (req, res) => {
  try {
    const { streamerId, tanggalIzin, kategori, durasiKurang, tanggalGanti, keterangan } = req.body;

    if (!streamerId || !tanggalIzin || !kategori || !keterangan) {
      return res.status(400).json({ message: 'Nama streamer, tanggal izin, jenis kendala, dan keterangan wajib diisi.' });
    }

    const duration = parseFloat(durasiKurang || 0);

    const insertRes = await pool.query(
      `INSERT INTO streamer_excuse_requests (
        streamer_id, tanggal_izin, kategori, durasi_kurang, tanggal_ganti, keterangan, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'Pending')
      RETURNING *`,
      [streamerId, tanggalIzin, kategori, duration, tanggalGanti || null, keterangan]
    );

    res.status(201).json({
      success: true,
      message: 'Pengajuan izin berhasil dikirim dan sedang menunggu persetujuan (ACC) Admin.',
      request: insertRes.rows[0]
    });
  } catch (err) {
    console.error('[Excuse submitExcuseRequest] Error:', err);
    res.status(500).json({ message: 'Gagal mengirim pengajuan izin' });
  }
};

// Admin: Get all excuse requests with filter and statistics
export const getExcuseRequests = async (req, res) => {
  try {
    const { status, streamerId, month } = req.query;

    let query = `
      SELECT 
        r.id,
        r.streamer_id AS "streamerId",
        s.nama AS "streamerNama",
        s.platform,
        TO_CHAR(r.tanggal_izin, 'YYYY-MM-DD') AS "tanggalIzin",
        r.kategori,
        r.durasi_kurang AS "durasiKurang",
        TO_CHAR(r.tanggal_ganti, 'YYYY-MM-DD') AS "tanggalGanti",
        r.keterangan,
        r.status,
        r.admin_notes AS "adminNotes",
        r.reviewed_at AS "reviewedAt",
        r.created_at AS "createdAt"
      FROM streamer_excuse_requests r
      JOIN streamers s ON r.streamer_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'All') {
      params.push(status);
      query += ` AND r.status = $${params.length}`;
    }

    if (streamerId) {
      params.push(streamerId);
      query += ` AND r.streamer_id = $${params.length}`;
    }

    if (month) {
      params.push(`${month}%`);
      query += ` AND TO_CHAR(r.tanggal_izin, 'YYYY-MM') LIKE $${params.length}`;
    }

    query += ` ORDER BY 
      CASE WHEN r.status = 'Pending' THEN 0 ELSE 1 END,
      r.created_at DESC`;

    const result = await pool.query(query, params);

    // Get summary counts
    const countRes = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'Pending') AS pending_count,
        COUNT(*) FILTER (WHERE status = 'Approved') AS approved_count,
        COUNT(*) FILTER (WHERE status = 'Rejected') AS rejected_count,
        COUNT(*) AS total_count
      FROM streamer_excuse_requests
    `);

    res.json({
      requests: result.rows,
      stats: {
        pending: parseInt(countRes.rows[0].pending_count || 0, 10),
        approved: parseInt(countRes.rows[0].approved_count || 0, 10),
        rejected: parseInt(countRes.rows[0].rejected_count || 0, 10),
        total: parseInt(countRes.rows[0].total_count || 0, 10)
      }
    });
  } catch (err) {
    console.error('[Excuse getExcuseRequests] Error:', err);
    res.status(500).json({ message: 'Gagal memuat data pengajuan izin' });
  }
};

// Admin: Approve excuse request and sync directly to daily_reports (Rp 0 Denda)
export const approveExcuseRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;

    const findReq = await pool.query(
      `SELECT r.*, s.nama AS streamer_nama 
       FROM streamer_excuse_requests r 
       JOIN streamers s ON r.streamer_id = s.id 
       WHERE r.id = $1`,
      [id]
    );

    if (findReq.rows.length === 0) {
      return res.status(404).json({ message: 'Pengajuan izin tidak ditemukan' });
    }

    const exc = findReq.rows[0];
    const targetDate = exc.tanggal_izin.toISOString().split('T')[0];

    // Determine target status & note for daily_reports
    const isComp = exc.kategori === 'Kompensasi Jam' || exc.tanggal_ganti;
    const targetStatusIzin = isComp ? 'Kompensasi' : 'Izin';
    
    let noteText = exc.keterangan;
    if (isComp && exc.tanggal_ganti) {
      const gantiStr = exc.tanggal_ganti.toISOString().split('T')[0];
      noteText = `Kompensasi ${exc.durasi_kurang || 2}h (Ganti tgl ${gantiStr}): ${exc.keterangan}`;
    } else {
      noteText = `Izin (${exc.kategori}): ${exc.keterangan}`;
    }

    // 1. Update daily_reports to reflect approved status
    const reportCheck = await pool.query(
      `SELECT id FROM daily_reports WHERE streamer_id = $1 AND tanggal = $2`,
      [exc.streamer_id, targetDate]
    );

    if (reportCheck.rows.length > 0) {
      await pool.query(
        `UPDATE daily_reports 
         SET status_izin = $1, catatan_izin = $2 
         WHERE streamer_id = $3 AND tanggal = $4`,
        [targetStatusIzin, noteText, exc.streamer_id, targetDate]
      );
    } else {
      await pool.query(
        `INSERT INTO daily_reports (
          streamer_id, tanggal, kategori, status_izin, catatan_izin,
          tiktok_upload, youtube_upload, instagram_upload, facebook_upload,
          live_duration, chat_count, registration_count, ftd_count, raw_message
        ) VALUES ($1, $2, 'Non Streaming', $3, $4, 0, 0, 0, 0, 0, 0, 0, 0, '[Form Izin Disetujui Admin]')
        ON CONFLICT (streamer_id, tanggal) DO UPDATE SET
          status_izin = EXCLUDED.status_izin,
          catatan_izin = EXCLUDED.catatan_izin`,
        [exc.streamer_id, targetDate, targetStatusIzin, noteText]
      );
    }

    // 2. Update status in streamer_excuse_requests
    const updatedReq = await pool.query(
      `UPDATE streamer_excuse_requests
       SET status = 'Approved',
           reviewed_at = NOW(),
           admin_notes = $1
       WHERE id = $2
       RETURNING *`,
      [adminNotes || 'Disetujui Admin', id]
    );

    res.json({
      success: true,
      message: `Izin untuk ${exc.streamer_nama} pada tgl ${targetDate} BERHASIL DI-ACC dan disinkronkan ke laporan!`,
      request: updatedReq.rows[0]
    });
  } catch (err) {
    console.error('[Excuse approveExcuseRequest] Error:', err);
    res.status(500).json({ message: 'Gagal menyetujui izin streamer' });
  }
};

// Admin: Reject excuse request
export const rejectExcuseRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;

    const findReq = await pool.query(
      `SELECT r.*, s.nama AS streamer_nama 
       FROM streamer_excuse_requests r 
       JOIN streamers s ON r.streamer_id = s.id 
       WHERE r.id = $1`,
      [id]
    );

    if (findReq.rows.length === 0) {
      return res.status(404).json({ message: 'Pengajuan izin tidak ditemukan' });
    }

    const exc = findReq.rows[0];
    const targetDate = exc.tanggal_izin.toISOString().split('T')[0];

    // If report was previously marked as excused/compensated, reset to Normal
    await pool.query(
      `UPDATE daily_reports 
       SET status_izin = 'Normal', catatan_izin = '' 
       WHERE streamer_id = $1 AND tanggal = $2`,
      [exc.streamer_id, targetDate]
    );

    // Update excuse request status
    const updatedReq = await pool.query(
      `UPDATE streamer_excuse_requests
       SET status = 'Rejected',
           reviewed_at = NOW(),
           admin_notes = $1
       WHERE id = $2
       RETURNING *`,
      [adminNotes || 'Ditolak Admin', id]
    );

    res.json({
      success: true,
      message: `Izin untuk ${exc.streamer_nama} tgl ${targetDate} DITOLAK (Denda tetap berlaku).`,
      request: updatedReq.rows[0]
    });
  } catch (err) {
    console.error('[Excuse rejectExcuseRequest] Error:', err);
    res.status(500).json({ message: 'Gagal menolak izin streamer' });
  }
};
