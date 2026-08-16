import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

// ============================================================
// 1. PIN SECURITY CONTROLLERS
// ============================================================

export const verifyPin = async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ message: 'PIN diperlukan' });
    }

    const pinRes = await pool.query(`SELECT value FROM config WHERE key = 'payroll_pin_hash' LIMIT 1`);
    if (pinRes.rows.length === 0) {
      // If not configured, default is 888888
      if (pin === '888888') return res.json({ success: true });
      return res.status(401).json({ message: 'PIN salah' });
    }

    const match = await bcrypt.compare(String(pin), pinRes.rows[0].value);
    if (!match) {
      return res.status(401).json({ message: 'PIN yang Anda masukkan salah' });
    }

    return res.json({ success: true, message: 'Otorisasi berhasil' });
  } catch (err) {
    console.error('[Finance verifyPin] Error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server saat verifikasi PIN' });
  }
};

export const changePin = async (req, res) => {
  try {
    const { oldPin, newPin } = req.body;
    if (!oldPin || !newPin) {
      return res.status(400).json({ message: 'PIN lama dan PIN baru diperlukan' });
    }
    if (newPin.length < 4 || newPin.length > 12) {
      return res.status(400).json({ message: 'PIN baru harus 4 - 12 karakter' });
    }

    const pinRes = await pool.query(`SELECT value FROM config WHERE key = 'payroll_pin_hash' LIMIT 1`);
    if (pinRes.rows.length > 0) {
      const match = await bcrypt.compare(String(oldPin), pinRes.rows[0].value);
      if (!match) {
        return res.status(401).json({ message: 'PIN lama tidak sesuai' });
      }
    } else if (oldPin !== '888888') {
      return res.status(401).json({ message: 'PIN lama tidak sesuai' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(String(newPin), salt);

    await pool.query(`
      INSERT INTO config (key, value)
      VALUES ('payroll_pin_hash', $1)
      ON CONFLICT (key) DO UPDATE SET value = $1
    `, [newHash]);

    return res.json({ success: true, message: 'PIN Keuangan berhasil diperbarui' });
  } catch (err) {
    console.error('[Finance changePin] Error:', err);
    res.status(500).json({ message: 'Gagal mengubah PIN' });
  }
};

// ============================================================
// 2. PAYROLL PROFILES CONTROLLERS
// ============================================================

export const getProfiles = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM payroll_profiles 
      ORDER BY is_active DESC, role ASC, name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[Finance getProfiles] Error:', err);
    res.status(500).json({ message: 'Gagal memuat profil penerima gaji' });
  }
};

export const upsertProfile = async (req, res) => {
  try {
    const { 
      id, name, role, streamer_id, 
      bank_name, bank_account_number, bank_account_holder, 
      salary_15, salary_1, is_active, notes 
    } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Nama wajib diisi' });
    }

    if (id) {
      const updateRes = await pool.query(`
        UPDATE payroll_profiles 
        SET name = $1, role = $2, streamer_id = $3,
            bank_name = $4, bank_account_number = $5, bank_account_holder = $6,
            salary_15 = $7, salary_1 = $8, is_active = $9, notes = $10,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $11
        RETURNING *
      `, [
        name.trim(), role || 'Streamer', streamer_id || null,
        bank_name || 'BCA', bank_account_number || '', bank_account_holder || name.trim(),
        salary_15 ?? 1000000, salary_1 ?? 2000000, is_active !== false, notes || '',
        id
      ]);
      return res.json(updateRes.rows[0]);
    } else {
      const insertRes = await pool.query(`
        INSERT INTO payroll_profiles (
          name, role, streamer_id, bank_name, bank_account_number, 
          bank_account_holder, salary_15, salary_1, is_active, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        name.trim(), role || 'Streamer', streamer_id || null,
        bank_name || 'BCA', bank_account_number || '', bank_account_holder || name.trim(),
        salary_15 ?? 1000000, salary_1 ?? 2000000, is_active !== false, notes || ''
      ]);
      return res.status(201).json(insertRes.rows[0]);
    }
  } catch (err) {
    console.error('[Finance upsertProfile] Error:', err);
    res.status(500).json({ message: 'Gagal menyimpan profil penerima gaji' });
  }
};

export const deleteProfile = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM payroll_profiles WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Profil berhasil dihapus' });
  } catch (err) {
    console.error('[Finance deleteProfile] Error:', err);
    res.status(500).json({ message: 'Gagal menghapus profil' });
  }
};

export const syncStreamersToProfiles = async (req, res) => {
  try {
    const streamersRes = await pool.query('SELECT id, nama FROM streamers ORDER BY id ASC');
    let addedCount = 0;

    for (const s of streamersRes.rows) {
      const checkRes = await pool.query(
        'SELECT id FROM payroll_profiles WHERE streamer_id = $1 OR LOWER(name) = LOWER($2)',
        [s.id, s.nama]
      );
      if (checkRes.rows.length === 0) {
        await pool.query(`
          INSERT INTO payroll_profiles (name, role, streamer_id, salary_15, salary_1)
          VALUES ($1, 'Streamer', $2, 1000000.00, 2000000.00)
        `, [s.nama, s.id]);
        addedCount++;
      }
    }

    res.json({ success: true, message: `Sinkronisasi selesai. ${addedCount} anggota baru ditambahkan.` });
  } catch (err) {
    console.error('[Finance syncStreamers] Error:', err);
    res.status(500).json({ message: 'Gagal sinkronisasi data streamer' });
  }
};

// ============================================================
// 3. PAYROLL PERIODS & ITEMS CONTROLLERS
// ============================================================

export const getPeriods = async (req, res) => {
  try {
    const periodsRes = await pool.query(`
      SELECT 
        p.*,
        COUNT(i.id)::int as total_recipients,
        COALESCE(SUM(i.final_amount), 0)::numeric as calculated_total_amount,
        COALESCE(SUM(CASE WHEN i.status = 'Paid' THEN i.final_amount ELSE 0 END), 0)::numeric as calculated_paid_amount,
        COUNT(CASE WHEN i.status = 'Paid' THEN 1 END)::int as paid_recipients_count
      FROM payroll_periods p
      LEFT JOIN payroll_items i ON p.id = i.period_id
      GROUP BY p.id
      ORDER BY p.period_date DESC, p.id DESC
    `);
    res.json(periodsRes.rows);
  } catch (err) {
    console.error('[Finance getPeriods] Error:', err);
    res.status(500).json({ message: 'Gagal memuat daftar periode gajian' });
  }
};

export const getPeriodDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const periodRes = await pool.query(`SELECT * FROM payroll_periods WHERE id = $1`, [id]);
    if (periodRes.rows.length === 0) {
      return res.status(404).json({ message: 'Periode tidak ditemukan' });
    }

    const itemsRes = await pool.query(`
      SELECT * FROM payroll_items 
      WHERE period_id = $1 
      ORDER BY role ASC, recipient_name ASC
    `, [id]);

    res.json({
      period: periodRes.rows[0],
      items: itemsRes.rows
    });
  } catch (err) {
    console.error('[Finance getPeriodDetail] Error:', err);
    res.status(500).json({ message: 'Gagal memuat rincian periode' });
  }
};

export const createPeriod = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { period_type, period_date, title, notes } = req.body;

    if (!period_type || !period_date) {
      return res.status(400).json({ message: 'Tipe periode dan tanggal wajib diisi' });
    }

    // Default title formatting if empty
    const dateObj = new Date(period_date);
    const monthName = dateObj.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
    const periodTitle = title || (period_type === '15th' ? `Gaji Tgl 15 - ${monthName}` : `Gaji Tgl 1 - ${monthName}`);

    // Insert period header
    const insertPeriodRes = await client.query(`
      INSERT INTO payroll_periods (title, period_type, period_date, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [periodTitle, period_type, period_date, notes || '']);

    const period = insertPeriodRes.rows[0];

    // Fetch all active profiles
    const profilesRes = await client.query(`
      SELECT * FROM payroll_profiles 
      WHERE is_active = TRUE 
      ORDER BY role ASC, name ASC
    `);

    let totalAmount = 0;
    for (const prof of profilesRes.rows) {
      const baseSalary = period_type === '15th' ? parseFloat(prof.salary_15 || 0) : parseFloat(prof.salary_1 || 0);
      const finalAmount = baseSalary;
      totalAmount += finalAmount;

      await client.query(`
        INSERT INTO payroll_items (
          period_id, profile_id, recipient_name, role,
          bank_name, bank_account_number, bank_account_holder,
          base_amount, bonus_amount, deduction_amount, final_amount,
          status, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Pending', $12)
      `, [
        period.id, prof.id, prof.name, prof.role,
        prof.bank_name, prof.bank_account_number, prof.bank_account_holder || prof.name,
        baseSalary, 0, 0, finalAmount,
        ''
      ]);
    }

    // Update total amount on period
    await client.query(`
      UPDATE payroll_periods 
      SET total_amount = $1, total_recipients = $2 
      WHERE id = $3
    `, [totalAmount, profilesRes.rows.length, period.id]);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: `Periode ${periodTitle} berhasil dibuat dengan ${profilesRes.rows.length} penerima`,
      period_id: period.id
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Finance createPeriod] Error:', err);
    res.status(500).json({ message: 'Gagal membuat periode gajian' });
  } finally {
    client.release();
  }
};

export const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      base_amount, bonus_amount, deduction_amount, 
      status, notes, bank_name, bank_account_number, bank_account_holder, role 
    } = req.body;

    const parseNum = (val) => {
      if (val === null || val === undefined || val === '') return 0;
      const clean = String(val).replace(/[^0-9.-]/g, '');
      const parsed = parseFloat(clean);
      return isNaN(parsed) ? 0 : parsed;
    };

    const base = parseNum(base_amount);
    const bonus = parseNum(bonus_amount);
    const deduction = parseNum(deduction_amount);
    const finalAmount = Math.max(0, base + bonus - deduction);
    const validStatus = status === 'Paid' ? 'Paid' : 'Pending';

    const updateRes = await pool.query(`
      UPDATE payroll_items
      SET base_amount = $1,
          bonus_amount = $2,
          deduction_amount = $3,
          final_amount = $4,
          status = $5,
          paid_at = CASE WHEN $5 = 'Paid' THEN COALESCE(paid_at, CURRENT_TIMESTAMP) ELSE NULL END,
          notes = $6,
          bank_name = COALESCE($7, bank_name),
          bank_account_number = COALESCE($8, bank_account_number),
          bank_account_holder = COALESCE($9, bank_account_holder),
          role = COALESCE($10, role)
      WHERE id = $11
      RETURNING *
    `, [
      base,
      bonus,
      deduction,
      finalAmount,
      validStatus,
      notes !== undefined && notes !== null ? String(notes) : '',
      bank_name ?? null,
      bank_account_number ?? null,
      bank_account_holder ?? null,
      role ?? null,
      parseInt(id, 10) || id
    ]);

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ message: 'Item tidak ditemukan' });
    }

    const updatedItem = updateRes.rows[0];

    // Refresh period totals
    await pool.query(`
      UPDATE payroll_periods p
      SET total_amount = (SELECT COALESCE(SUM(final_amount), 0) FROM payroll_items WHERE period_id = p.id),
          paid_amount = (SELECT COALESCE(SUM(final_amount), 0) FROM payroll_items WHERE period_id = p.id AND status = 'Paid')
      WHERE id = $1
    `, [updatedItem.period_id]);

    res.json(updatedItem);
  } catch (err) {
    console.error('[Finance updateItem] Error:', err);
    res.status(500).json({ message: err.message || 'Gagal memperbarui item gajian' });
  }
};

export const bulkUpdateStatus = async (req, res) => {
  try {
    const { period_id, status } = req.body;
    if (!period_id || !status) {
      return res.status(400).json({ message: 'period_id dan status wajib diisi' });
    }

    const validStatus = status === 'Paid' ? 'Paid' : 'Pending';

    await pool.query(`
      UPDATE payroll_items
      SET status = $1,
          paid_at = CASE WHEN $1 = 'Paid' THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE period_id = $2
    `, [validStatus, period_id]);

    await pool.query(`
      UPDATE payroll_periods p
      SET paid_amount = (SELECT COALESCE(SUM(final_amount), 0) FROM payroll_items WHERE period_id = p.id AND status = 'Paid'),
          status = CASE WHEN $1 = 'Paid' THEN 'Completed' ELSE 'Active' END
      WHERE id = $2
    `, [validStatus, period_id]);

    res.json({ success: true, message: `Seluruh status berhasil diubah ke ${validStatus}` });
  } catch (err) {
    console.error('[Finance bulkUpdateStatus] Error:', err);
    res.status(500).json({ message: err.message || 'Gagal mengubah status massal' });
  }
};

export const deletePeriod = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM payroll_periods WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Periode gajian berhasil dihapus' });
  } catch (err) {
    console.error('[Finance deletePeriod] Error:', err);
    res.status(500).json({ message: 'Gagal menghapus periode' });
  }
};

// ============================================================
// 4. CASH TRANSACTIONS & EXPENSES CONTROLLERS
// ============================================================

export const getCashSummary = async (req, res) => {
  try {
    const summaryRes = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN tipe = 'Masuk' THEN nominal ELSE 0 END), 0)::numeric as total_masuk,
        COALESCE(SUM(CASE WHEN tipe = 'Keluar' THEN nominal ELSE 0 END), 0)::numeric as total_keluar,
        (
          COALESCE(SUM(CASE WHEN tipe = 'Masuk' THEN nominal ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN tipe = 'Keluar' THEN nominal ELSE 0 END), 0)
        )::numeric as saldo_kas
      FROM cash_transactions
    `);

    // Get current month total expenses
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const currentMonthRes = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN tipe = 'Masuk' THEN nominal ELSE 0 END), 0)::numeric as bulan_masuk,
        COALESCE(SUM(CASE WHEN tipe = 'Keluar' THEN nominal ELSE 0 END), 0)::numeric as bulan_keluar
      FROM cash_transactions
      WHERE tanggal BETWEEN $1 AND $2
    `, [startOfMonth, endOfMonth]);

    // Also calculate total paid payroll for reference
    const totalPayrollRes = await pool.query(`
      SELECT COALESCE(SUM(final_amount), 0)::numeric as total_payroll_paid
      FROM payroll_items
      WHERE status = 'Paid'
    `);

    res.json({
      total_masuk: summaryRes.rows[0].total_masuk,
      total_keluar: summaryRes.rows[0].total_keluar,
      saldo_kas: summaryRes.rows[0].saldo_kas,
      bulan_masuk: currentMonthRes.rows[0].bulan_masuk,
      bulan_keluar: currentMonthRes.rows[0].bulan_keluar,
      total_payroll_paid: totalPayrollRes.rows[0].total_payroll_paid
    });
  } catch (err) {
    console.error('[Finance getCashSummary] Error:', err);
    res.status(500).json({ message: 'Gagal memuat ringkasan kas' });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const { tipe, kategori, search, limit = 100 } = req.query;
    let query = `SELECT * FROM cash_transactions WHERE 1=1`;
    const params = [];

    if (tipe && tipe !== 'All') {
      params.push(tipe);
      query += ` AND tipe = $${params.length}`;
    }

    if (kategori && kategori !== 'All') {
      params.push(kategori);
      query += ` AND kategori = $${params.length}`;
    }

    if (search && search.trim() !== '') {
      params.push(`%${search.trim()}%`);
      query += ` AND (keterangan ILIKE $${params.length} OR kategori ILIKE $${params.length})`;
    }

    query += ` ORDER BY tanggal DESC, id DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit, 10));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[Finance getTransactions] Error:', err);
    res.status(500).json({ message: 'Gagal memuat riwayat transaksi kas' });
  }
};

export const createTransaction = async (req, res) => {
  try {
    const { tanggal, tipe, kategori, nominal, keterangan } = req.body;
    const userName = req.user?.nama || 'Admin';

    if (!tanggal || !tipe || !nominal) {
      return res.status(400).json({ message: 'Tanggal, tipe, dan nominal wajib diisi' });
    }

    const numNominal = parseFloat(nominal);
    if (isNaN(numNominal) || numNominal <= 0) {
      return res.status(400).json({ message: 'Nominal harus angka positif' });
    }

    const insertRes = await pool.query(`
      INSERT INTO cash_transactions (tanggal, tipe, kategori, nominal, keterangan, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      tanggal, tipe, kategori || 'Operasional',
      numNominal, keterangan || '', userName
    ]);

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    console.error('[Finance createTransaction] Error:', err);
    res.status(500).json({ message: 'Gagal mencatat transaksi kas' });
  }
};

export const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM cash_transactions WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Transaksi berhasil dihapus' });
  } catch (err) {
    console.error('[Finance deleteTransaction] Error:', err);
    res.status(500).json({ message: 'Gagal menghapus transaksi' });
  }
};
