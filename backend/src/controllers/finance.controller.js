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
          status = $5::varchar,
          paid_at = CASE WHEN $5::varchar = 'Paid' THEN COALESCE(paid_at, CURRENT_TIMESTAMP) ELSE NULL END,
          notes = $6,
          bank_name = COALESCE($7, bank_name),
          bank_account_number = COALESCE($8, bank_account_number),
          bank_account_holder = COALESCE($9, bank_account_holder),
          role = COALESCE($10, role)
      WHERE id = $11::int
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

    // Refresh period totals & auto-update period status
    await pool.query(`
      UPDATE payroll_periods p
      SET total_amount = (SELECT COALESCE(SUM(final_amount), 0) FROM payroll_items WHERE period_id = p.id),
          paid_amount = (SELECT COALESCE(SUM(final_amount), 0) FROM payroll_items WHERE period_id = p.id AND status = 'Paid'),
          status = CASE 
            WHEN (SELECT COUNT(*) FROM payroll_items WHERE period_id = p.id AND status != 'Paid') = 0 
                 AND (SELECT COUNT(*) FROM payroll_items WHERE period_id = p.id) > 0 
            THEN 'Completed' 
            ELSE 'Active' 
          END
      WHERE id = $1::int
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
      SET status = $1::varchar,
          paid_at = CASE WHEN $1::varchar = 'Paid' THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE period_id = $2::int
    `, [validStatus, parseInt(period_id, 10) || period_id]);

    await pool.query(`
      UPDATE payroll_periods p
      SET paid_amount = (SELECT COALESCE(SUM(final_amount), 0) FROM payroll_items WHERE period_id = p.id AND status = 'Paid'),
          status = CASE WHEN $1::varchar = 'Paid' THEN 'Completed' ELSE 'Active' END
      WHERE id = $2::int
    `, [validStatus, parseInt(period_id, 10) || period_id]);

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

    if (!tanggal || !tipe || nominal === undefined || nominal === null || nominal === '') {
      return res.status(400).json({ message: 'Tanggal, tipe, dan nominal wajib diisi' });
    }

    const cleanNominal = String(nominal).replace(/[^0-9]/g, '');
    const numNominal = parseFloat(cleanNominal);
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

// ==========================================
// 5. AUTOMATED PENALTY & SALARY AUDIT
// ==========================================

export const getPenaltyAudit = async (req, res) => {
  try {
    const { startDate, endDate, periodType = '15th', periodKey } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate dan endDate wajib diisi' });
    }

    const pKey = periodKey || `${startDate.slice(0, 7)}_${periodType}`;

    // 1. Get all streamers and their payroll profiles
    const streamersRes = await pool.query(`
      SELECT s.id as streamer_id, s.nama, s.platform,
             p.id as profile_id, p.bank_name, p.bank_account_number, p.bank_account_holder,
             COALESCE(p.salary_15, 1000000.00) as salary_15,
             COALESCE(p.salary_1, 2000000.00) as salary_1
      FROM streamers s
      LEFT JOIN payroll_profiles p ON p.streamer_id = s.id
      ORDER BY s.nama ASC
    `);

    // 2. Get all reports in date range
    const reportsRes = await pool.query(`
      SELECT r.id, 
             TO_CHAR(r.tanggal, 'YYYY-MM-DD') as tanggal, 
             r.streamer_id, 
             r.kategori, 
             COALESCE(r.live_duration, 0.0) as live_duration,
             r.raw_message, 
             r.created_at,
             r.status_izin, 
             r.catatan_izin
      FROM daily_reports r
      WHERE r.tanggal >= $1 AND r.tanggal <= $2
      ORDER BY r.tanggal ASC
    `, [startDate, endDate]);

    // Index reports by "streamer_id_YYYY-MM-DD"
    const reportMap = {};
    for (const r of reportsRes.rows) {
      const key = `${r.streamer_id}_${r.tanggal}`;
      reportMap[key] = r;
    }

    // 3. Get saved adjustments (signal cuts, custom bonus/deduction)
    const adjustmentsRes = await pool.query(`
      SELECT * FROM streamer_salary_adjustments 
      WHERE period_key = $1
    `, [pKey]);

    const adjMap = {};
    for (const a of adjustmentsRes.rows) {
      adjMap[a.streamer_id] = a;
    }

    // Generate list of all dates in range
    const allDates = [];
    let curr = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    while (curr <= end) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      allDates.push({
        dateStr: `${y}-${m}-${d}`,
        dayOfWeek: curr.getDay(), // 0 = Sunday
        shortDate: `${parseInt(d, 10)} ${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][curr.getMonth()]}`
      });
      curr.setDate(curr.getDate() + 1);
    }

    // Calculate audit per streamer
    const auditResults = [];

    for (const streamer of streamersRes.rows) {
      const sId = streamer.streamer_id;
      
      // Determine Base Salary based on periodType
      let baseSalary = 1000000;
      if (periodType === '15th') {
        baseSalary = parseFloat(streamer.salary_15 || 1000000);
      } else if (periodType === '1st') {
        baseSalary = parseFloat(streamer.salary_1 || 2000000);
      } else if (periodType === 'full') {
        baseSalary = parseFloat(streamer.salary_15 || 1000000) + parseFloat(streamer.salary_1 || 2000000);
      }

      let totalLiveDuration = 0;
      let liveDaysCount = 0;
      let under4hCount = 0;
      let totalShortageHours = 0;
      let shortagePenalty = 0; // Rp 30,000 / jam

      let noReportDaysCount = 0;
      let noReportPenalty = 0; // Rp 150,000 / hari

      let absentDaysCount = 0;
      let absentPenalty = 0; // Rp 60,000 / sesi (2 sesi = Rp 120,000 / hari)

      let offDaysCount = 0;
      let excusedDaysCount = 0;

      const dailyBreakdown = [];

      for (const d of allDates) {
        const key = `${sId}_${d.dateStr}`;
        const rep = reportMap[key];
        const isSunday = d.dayOfWeek === 0;

        const isCompensated = rep?.status_izin === 'Kompensasi';
        const isExcused = (rep && (rep.status_izin === 'Izin' || rep.status_izin === 'Kompensasi')) || isSunday;

        const dayItem = {
          dateStr: d.dateStr,
          shortDate: d.shortDate,
          dayOfWeek: d.dayOfWeek,
          isSunday,
          reportId: rep ? rep.id : null,
          hasReport: !!rep,
          kategori: rep ? rep.kategori : (isSunday ? 'Hari Libur (Minggu)' : 'Tidak Ada Laporan'),
          liveDuration: rep ? parseFloat(rep.live_duration || 0) : 0,
          submittedAt: rep?.created_at || null,
          rawMessage: rep?.raw_message || null,
          statusIzin: rep?.status_izin || (isSunday ? 'Izin' : 'Normal'),
          catatanIzin: rep?.catatan_izin || (isSunday ? 'Libur Minggu' : ''),
          isExcused,
          isCompensated,
          shortageHours: 0,
          shortagePenalty: 0,
          noReportPenalty: 0,
          absentPenalty: 0,
          totalDayPenalty: 0,
          statusLabel: 'OK',
          statusColor: 'green'
        };

        if (dayItem.isExcused) {
          excusedDaysCount++;
          if (isSunday) {
            dayItem.statusLabel = 'Libur Minggu';
            dayItem.statusColor = 'amber';
          } else if (isCompensated) {
            dayItem.statusLabel = rep?.catatan_izin ? `🔄 Kompensasi: ${rep.catatan_izin}` : '🔄 Kompensasi Jam';
            dayItem.statusColor = 'cyan';
          } else {
            dayItem.statusLabel = rep?.catatan_izin ? `Izin: ${rep.catatan_izin}` : 'Izin Sah (ACC)';
            dayItem.statusColor = 'amber';
          }
        } else if (rep) {
          if (rep.kategori === 'Non Streaming') {
            offDaysCount++;
            dayItem.statusLabel = 'Hari Off';
            dayItem.statusColor = 'blue';
          } else {
            // Streaming
            liveDaysCount++;
            const duration = parseFloat(rep.live_duration || 0);
            totalLiveDuration += duration;

            // SOP Durasi (< 4.0 Jam)
            if (duration < 4.0) {
              const shortage = parseFloat((4.0 - duration).toFixed(2));
              dayItem.shortageHours = shortage;
              under4hCount++;
              dayItem.shortagePenalty = Math.round(shortage * 30000);
              totalShortageHours += shortage;
              shortagePenalty += dayItem.shortagePenalty;
              dayItem.statusLabel = `Durasi Kurang (${duration}h / -${shortage}h)`;
              dayItem.statusColor = 'rose';
            } else {
              dayItem.statusLabel = 'OK';
              dayItem.statusColor = 'green';
            }
          }
        } else {
          // Missing report on non-Sunday
          absentDaysCount++;
          noReportDaysCount++;
          
          dayItem.absentPenalty = 120000; // 2 sesi x Rp 60,000
          dayItem.noReportPenalty = 150000; // Rp 150,000
          
          absentPenalty += 120000;
          noReportPenalty += 150000;

          dayItem.statusLabel = 'Absen (Tidak Live & Tidak Rekap)';
          dayItem.statusColor = 'red';
        }

        dayItem.totalDayPenalty = dayItem.shortagePenalty + dayItem.noReportPenalty + dayItem.absentPenalty;
        dailyBreakdown.push(dayItem);
      }

      // Adjustments (Signal cut, custom bonus/deduction)
      const adj = adjMap[sId] || { signal_cut_count: 0, signal_cut_amount: 0, custom_bonus: 0, custom_deduction: 0, notes: '' };
      const signalCutCount = parseInt(adj.signal_cut_count || 0, 10);
      const signalCutAmount = parseFloat(adj.signal_cut_amount || (signalCutCount * 30000));
      const customBonus = parseFloat(adj.custom_bonus || 0);
      const customDeduction = parseFloat(adj.custom_deduction || 0);

      const totalPenalties = shortagePenalty + noReportPenalty + absentPenalty + signalCutAmount + customDeduction;
      const netSalary = Math.max(0, baseSalary + customBonus - totalPenalties);

      auditResults.push({
        streamerId: sId,
        nama: streamer.nama,
        platform: streamer.platform,
        profileId: streamer.profile_id,
        bankName: streamer.bank_name || 'BCA',
        bankAccountNumber: streamer.bank_account_number || '-',
        bankAccountHolder: streamer.bank_account_holder || streamer.nama,
        baseSalary,
        totalLiveDuration: parseFloat(totalLiveDuration.toFixed(2)),
        liveDaysCount,
        under4hCount,
        totalShortageHours: parseFloat(totalShortageHours.toFixed(2)),
        shortagePenalty,
        noReportDaysCount,
        noReportPenalty,
        absentDaysCount,
        absentPenalty,
        offDaysCount,
        excusedDaysCount,
        signalCutCount,
        signalCutAmount,
        customBonus,
        customDeduction,
        notes: adj.notes || '',
        isVerified: !!adj.is_verified,
        compensationNotes: dailyBreakdown
          .filter((d) => d.isCompensated)
          .map((d) => ({
            date: d.shortDate,
            dateStr: d.dateStr,
            note: d.catatanIzin || 'Hutang Kompensasi Jam'
          })),
        totalPenalties,
        netSalary,
        dailyBreakdown
      });
    }

    res.json({
      periodKey: pKey,
      periodType,
      startDate,
      endDate,
      totalStreamers: auditResults.length,
      auditResults
    });
  } catch (err) {
    console.error('[Finance getPenaltyAudit] Error:', err);
    res.status(500).json({ message: 'Gagal melakukan audit denda & gaji streamer' });
  }
};

export const saveSalaryAdjustment = async (req, res) => {
  try {
    const { streamerId, periodKey, signalCutCount, customBonus, customDeduction, notes } = req.body;

    if (!streamerId || !periodKey) {
      return res.status(400).json({ message: 'streamerId dan periodKey wajib diisi' });
    }

    const count = parseInt(signalCutCount || 0, 10);
    const cutAmount = count * 30000;
    const bonus = parseFloat(customBonus || 0);
    const deduction = parseFloat(customDeduction || 0);

    const upsertRes = await pool.query(`
      INSERT INTO streamer_salary_adjustments (
        streamer_id, period_key, signal_cut_count, signal_cut_amount,
        custom_bonus, custom_deduction, notes, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (streamer_id, period_key) DO UPDATE SET
        signal_cut_count = EXCLUDED.signal_cut_count,
        signal_cut_amount = EXCLUDED.signal_cut_amount,
        custom_bonus = EXCLUDED.custom_bonus,
        custom_deduction = EXCLUDED.custom_deduction,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *
    `, [streamerId, periodKey, count, cutAmount, bonus, deduction, notes || '']);

    res.json({ success: true, adjustment: upsertRes.rows[0] });
  } catch (err) {
    console.error('[Finance saveSalaryAdjustment] Error:', err);
    res.status(500).json({ message: 'Gagal menyimpan penyesuaian potongan sinyal' });
  }
};

export const toggleDailyExcusedStatus = async (req, res) => {
  try {
    const { streamerId, tanggal, isExcused, statusIzin, catatan } = req.body;

    if (!streamerId || !tanggal) {
      return res.status(400).json({ message: 'streamerId dan tanggal wajib diisi' });
    }

    const targetStatus = statusIzin || (isExcused ? 'Izin' : 'Normal');
    const noteText = catatan || (targetStatus === 'Kompensasi' ? 'Hutang Kompensasi Jam' : targetStatus === 'Izin' ? 'Dispensasi Izin WA' : '');

    // Check if report exists
    const checkRes = await pool.query(`
      SELECT id FROM daily_reports 
      WHERE streamer_id = $1 AND tanggal = $2
    `, [streamerId, tanggal]);

    if (checkRes.rows.length > 0) {
      await pool.query(`
        UPDATE daily_reports
        SET status_izin = $1, catatan_izin = $2
        WHERE streamer_id = $3 AND tanggal = $4
      `, [targetStatus, noteText, streamerId, tanggal]);
    } else {
      // Insert a placeholder report with kategori Non Streaming / Izin
      await pool.query(`
        INSERT INTO daily_reports (
          streamer_id, tanggal, kategori, status_izin, catatan_izin,
          tiktok_upload, youtube_upload, instagram_upload, facebook_upload,
          live_duration, chat_count, registration_count, ftd_count
        ) VALUES ($1, $2, 'Non Streaming', $3, $4, 0, 0, 0, 0, 0, 0, 0, 0)
        ON CONFLICT (streamer_id, tanggal) DO UPDATE SET
          status_izin = EXCLUDED.status_izin,
          catatan_izin = EXCLUDED.catatan_izin
      `, [streamerId, tanggal, targetStatus, noteText]);
    }

    res.json({
      success: true,
      message: `Status izin tgl ${tanggal} berhasil diubah ke ${targetStatus}`,
      status_izin: targetStatus,
      catatan_izin: noteText
    });
  } catch (err) {
    console.error('[Finance toggleDailyExcusedStatus] Error:', err);
    res.status(500).json({ message: 'Gagal mengubah status izin' });
  }
};

export const updateDailyLiveDuration = async (req, res) => {
  try {
    const { streamerId, tanggal, liveDuration } = req.body;

    if (!streamerId || !tanggal || liveDuration === undefined || liveDuration === null) {
      return res.status(400).json({ message: 'streamerId, tanggal, dan liveDuration wajib diisi' });
    }

    const duration = parseFloat(liveDuration) || 0.0;

    // Check if daily_reports exists for this date and streamer
    const checkRes = await pool.query(`
      SELECT id FROM daily_reports 
      WHERE streamer_id = $1 AND tanggal = $2
    `, [streamerId, tanggal]);

    if (checkRes.rows.length > 0) {
      await pool.query(`
        UPDATE daily_reports
        SET live_duration = $1,
            reported_live_duration = $1,
            kategori = 'Streaming'
        WHERE streamer_id = $2 AND tanggal = $3
      `, [duration, streamerId, tanggal]);
    } else {
      await pool.query(`
        INSERT INTO daily_reports (
          streamer_id, tanggal, kategori, live_duration, reported_live_duration,
          tiktok_upload, youtube_upload, instagram_upload, facebook_upload,
          chat_count, registration_count, ftd_count, raw_message
        ) VALUES ($1, $2, 'Streaming', $3, $3, 0, 0, 0, 0, 0, 0, 0, '[Manual Input]')
        ON CONFLICT (streamer_id, tanggal) DO UPDATE SET
          live_duration = EXCLUDED.live_duration,
          reported_live_duration = EXCLUDED.reported_live_duration,
          kategori = EXCLUDED.kategori
      `, [streamerId, tanggal, duration]);
    }

    res.json({
      success: true,
      message: `Durasi live tgl ${tanggal} berhasil diubah menjadi ${duration} jam`,
      live_duration: duration
    });
  } catch (err) {
    console.error('[Finance updateDailyLiveDuration] Error:', err);
    res.status(500).json({ message: 'Gagal mengubah durasi live' });
  }
};

export const toggleStreamerVerification = async (req, res) => {
  try {
    const { streamerId, periodKey, isVerified } = req.body;

    if (!streamerId || !periodKey) {
      return res.status(400).json({ message: 'streamerId dan periodKey wajib diisi' });
    }

    const verified = Boolean(isVerified);

    const upsertRes = await pool.query(`
      INSERT INTO streamer_salary_adjustments (
        streamer_id, period_key, is_verified, updated_at
      ) VALUES ($1, $2, $3, NOW())
      ON CONFLICT (streamer_id, period_key) DO UPDATE SET
        is_verified = EXCLUDED.is_verified,
        updated_at = NOW()
      RETURNING *
    `, [streamerId, periodKey, verified]);

    res.json({
      success: true,
      message: `Status verifikasi streamer berhasil diubah menjadi ${verified ? 'Sudah Diperiksa' : 'Belum Diperiksa'}`,
      is_verified: verified
    });
  } catch (err) {
    console.error('[Finance toggleStreamerVerification] Error:', err);
    res.status(500).json({ message: 'Gagal mengubah status verifikasi streamer' });
  }
};



