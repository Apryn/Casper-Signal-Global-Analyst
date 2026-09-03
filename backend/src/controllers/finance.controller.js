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
    res.status(500).json({ message: 'Gagal mengubah status massal' });
  }
};

export const syncAuditToPeriod = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { startDate: customStart, endDate: customEnd, periodType: customPeriodType } = req.body || {};

    const periodRes = await client.query('SELECT * FROM payroll_periods WHERE id = $1', [id]);
    if (periodRes.rows.length === 0) {
      return res.status(404).json({ message: 'Periode penggajian tidak ditemukan' });
    }
    const period = periodRes.rows[0];

    // Determine audit date range
    let startDate = customStart;
    let endDate = customEnd;
    let periodType = customPeriodType || period.period_type;

    if (!startDate || !endDate) {
      const pDate = new Date(period.period_date);
      const py = pDate.getFullYear();
      const pm = pDate.getMonth(); // 0-indexed

      if (period.period_type === '15th') {
        const mStr = String(pm + 1).padStart(2, '0');
        startDate = `${py}-${mStr}-01`;
        endDate = `${py}-${mStr}-15`;
        periodType = '15th';
      } else {
        // '1st' or monthly end
        if (pDate.getDate() <= 10) {
          const prevDate = new Date(py, pm - 1, 1);
          const yStr = prevDate.getFullYear();
          const mStr = String(prevDate.getMonth() + 1).padStart(2, '0');
          const lastDay = new Date(yStr, prevDate.getMonth() + 1, 0).getDate();
          startDate = `${yStr}-${mStr}-16`;
          endDate = `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`;
        } else {
          const mStr = String(pm + 1).padStart(2, '0');
          const lastDay = new Date(py, pm + 1, 0).getDate();
          startDate = `${py}-${mStr}-16`;
          endDate = `${py}-${mStr}-${String(lastDay).padStart(2, '0')}`;
        }
        periodType = '1st';
      }
    }

    // Run audit logic for this date range
    // 0. Rules
    let rules = DEFAULT_FINANCE_RULES;
    try {
      const rulesRes = await client.query("SELECT value FROM config WHERE key = 'finance_rules'");
      if (rulesRes.rows.length > 0 && rulesRes.rows[0].value) {
        rules = { ...DEFAULT_FINANCE_RULES, ...JSON.parse(rulesRes.rows[0].value) };
      }
    } catch (e) {
      console.warn('[syncAuditToPeriod] Failed to parse finance_rules, using default:', e.message);
    }

    // 1. Get streamers
    const streamersRes = await client.query(`
      SELECT 
        s.id AS streamer_id,
        s.nama,
        s.platform,
        p.id AS profile_id,
        COALESCE(p.bank_name, 'BCA') AS bank_name,
        p.bank_account_number,
        p.bank_account_holder,
        COALESCE(p.salary_15, 1000000.00) AS salary_15,
        COALESCE(p.salary_1, 2000000.00) AS salary_1
      FROM streamers s
      LEFT JOIN LATERAL (
        SELECT * FROM payroll_profiles p
        WHERE p.streamer_id = s.id 
           OR LOWER(TRIM(p.name)) = LOWER(TRIM(s.nama))
           OR (LOWER(s.nama) = 'teizza' AND (LOWER(p.name) LIKE '%teizza%' OR LOWER(p.name) LIKE '%key team%'))
        ORDER BY CASE WHEN p.streamer_id = s.id THEN 0 ELSE 1 END, p.id ASC
        LIMIT 1
      ) p ON true
      WHERE COALESCE(s.status, 'active') = 'active'
        AND COALESCE(s.is_active, TRUE) = TRUE
        AND (p.is_active IS TRUE OR p.is_active IS NULL)
      ORDER BY s.nama ASC
    `);

    // 2. Daily reports
    const reportsRes = await client.query(`
      SELECT 
        id,
        streamer_id,
        TO_CHAR(tanggal, 'YYYY-MM-DD') AS tanggal,
        kategori,
        live_duration,
        status_izin,
        catatan_izin
      FROM daily_reports
      WHERE tanggal >= $1::date AND tanggal <= $2::date
    `, [startDate, endDate]);

    const reportMap = {};
    for (const r of reportsRes.rows) {
      reportMap[`${r.streamer_id}_${r.tanggal}`] = r;
    }

    // 3. Adjustments
    const pKey = `${startDate.slice(0, 7)}_${periodType}`;
    const adjustmentsRes = await client.query(`
      SELECT * FROM streamer_salary_adjustments 
      WHERE period_key = $1
    `, [pKey]);

    const adjMap = {};
    for (const a of adjustmentsRes.rows) {
      adjMap[a.streamer_id] = a;
    }

    // Date range
    const allDates = [];
    let curr = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    while (curr <= end) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      allDates.push({
        dateStr: `${y}-${m}-${d}`,
        dayOfWeek: curr.getDay()
      });
      curr.setDate(curr.getDate() + 1);
    }

    const auditResultsMap = {};

    for (const streamer of streamersRes.rows) {
      const sId = streamer.streamer_id;
      let baseSalary = periodType === '15th' ? parseFloat(streamer.salary_15 || rules.baseSalary15th) : parseFloat(streamer.salary_1 || rules.baseSalaryMonthEnd);

      let totalLiveDuration = 0;
      let liveDaysCount = 0;
      let under4hCount = 0;
      let totalShortageHours = 0;
      let shortagePenalty = 0;
      let noReportDaysCount = 0;
      let noReportPenalty = 0;
      let absentDaysCount = 0;
      let absentPenalty = 0;
      let offDaysCount = 0;
      let excusedDaysCount = 0;

      for (const d of allDates) {
        const key = `${sId}_${d.dateStr}`;
        const rep = reportMap[key];
        const isSunday = d.dayOfWeek === 0;
        const isExcused = (rep && (rep.status_izin === 'Izin' || rep.status_izin === 'Kompensasi')) || isSunday;

        if (isExcused) {
          excusedDaysCount++;
        } else if (rep) {
          if (rep.kategori === 'Non Streaming') {
            offDaysCount++;
          } else {
            liveDaysCount++;
            const duration = parseFloat(rep.live_duration || 0);
            totalLiveDuration += duration;
            if (duration < rules.standardLiveDurationHours) {
              const shortage = parseFloat((rules.standardLiveDurationHours - duration).toFixed(2));
              under4hCount++;
              const pAmount = Math.round(shortage * rules.durationShortagePenaltyPerHour);
              totalShortageHours += shortage;
              shortagePenalty += pAmount;
            }
          }
        } else {
          absentDaysCount++;
          const dailyAbsentCost = rules.absentPenaltyPerSession * rules.sessionsPerDay;
          absentPenalty += dailyAbsentCost;
        }
      }

      const adj = adjMap[sId] || { signal_cut_count: 0, signal_cut_amount: 0, custom_bonus: 0, custom_deduction: 0, notes: '' };
      const signalCutCount = parseInt(adj.signal_cut_count || 0, 10);
      const signalCutAmount = parseFloat(adj.signal_cut_amount !== undefined && adj.signal_cut_amount !== null ? adj.signal_cut_amount : (signalCutCount * rules.signalCutPenaltyPerEvent));
      const customBonus = parseFloat(adj.custom_bonus || 0);
      const customDeduction = parseFloat(adj.custom_deduction || 0);

      const totalPenalties = shortagePenalty + noReportPenalty + absentPenalty + signalCutAmount + customDeduction;
      const netSalary = Math.max(0, baseSalary + customBonus - totalPenalties);

      // Build readable notes
      const noteParts = [];
      if (shortagePenalty > 0) noteParts.push(`Kurang Jam: -Rp ${shortagePenalty.toLocaleString('id-ID')} (${totalShortageHours.toFixed(1)}h)`);
      if (absentPenalty > 0) noteParts.push(`Absen: -Rp ${absentPenalty.toLocaleString('id-ID')} (${absentDaysCount} hari)`);
      if (noReportPenalty > 0) noteParts.push(`Telat Rekap: -Rp ${noReportPenalty.toLocaleString('id-ID')}`);
      if (signalCutAmount > 0) noteParts.push(`Potong Sinyal: -Rp ${signalCutAmount.toLocaleString('id-ID')} (${signalCutCount}x)`);
      if (customDeduction > 0) noteParts.push(`Kasbon/Potongan: -Rp ${customDeduction.toLocaleString('id-ID')}`);
      if (customBonus > 0) noteParts.push(`Bonus: +Rp ${customBonus.toLocaleString('id-ID')}`);

      auditResultsMap[streamer.nama.toLowerCase()] = {
        streamerId: sId,
        profileId: streamer.profile_id,
        nama: streamer.nama,
        baseSalary,
        totalPenalties,
        customBonus,
        netSalary,
        notes: noteParts.join(' • ') || (totalPenalties === 0 ? 'SOP Terpenuhi (Bebas Denda)' : '')
      };
    }

    await client.query('BEGIN');

    // Update payroll_items for period
    const itemsRes = await client.query('SELECT * FROM payroll_items WHERE period_id = $1', [id]);
    let updatedCount = 0;

    for (const item of itemsRes.rows) {
      let audit = auditResultsMap[item.recipient_name.toLowerCase()];
      if (!audit && (item.recipient_name.toLowerCase().includes('key team') || item.recipient_name.toLowerCase().includes('teizza'))) {
        audit = auditResultsMap['teizza'] || auditResultsMap['key team'];
      }

      if (audit) {
        const base = parseFloat(item.base_amount) || audit.baseSalary;
        const bonus = audit.customBonus > 0 ? audit.customBonus : (parseFloat(item.bonus_amount) || 0);
        const deduction = audit.totalPenalties;
        const finalAmt = Math.max(0, base + bonus - deduction);
        const notes = audit.notes || item.notes || '';

        await client.query(`
          UPDATE payroll_items
          SET bonus_amount = $1,
              deduction_amount = $2,
              final_amount = $3,
              notes = $4
          WHERE id = $5
        `, [bonus, deduction, finalAmt, notes, item.id]);
        updatedCount++;
      }
    }

    // Recalculate total_amount and paid_amount on period
    const sumRes = await client.query(`
      SELECT 
        COALESCE(SUM(final_amount), 0) as total,
        COALESCE(SUM(CASE WHEN status = 'Paid' THEN final_amount ELSE 0 END), 0) as paid_total,
        COUNT(id) as count 
      FROM payroll_items WHERE period_id = $1
    `, [id]);

    const newTotal = parseFloat(sumRes.rows[0].total || 0);
    const newPaidTotal = parseFloat(sumRes.rows[0].paid_total || 0);
    const count = parseInt(sumRes.rows[0].count || 0, 10);

    await client.query(`
      UPDATE payroll_periods 
      SET total_amount = $1, 
          paid_amount = $2,
          total_recipients = $3 
      WHERE id = $4
    `, [newTotal, newPaidTotal, count, id]);

    await client.query('COMMIT');

    // Fetch updated items
    const updatedItems = await pool.query(`
      SELECT * FROM payroll_items WHERE period_id = $1 ORDER BY role ASC, recipient_name ASC
    `, [id]);

    res.json({
      success: true,
      message: `Berhasil mensinkronkan denda & potongan untuk ${updatedCount} streamer dari audit (${startDate} s/d ${endDate})`,
      updatedCount,
      startDate,
      endDate,
      totalAmount: newTotal,
      items: updatedItems.rows
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Finance syncAuditToPeriod] Error:', err);
    res.status(500).json({ message: 'Gagal mensinkronkan audit ke penggajian', error: err.message });
  } finally {
    client.release();
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
    const { month } = req.query;

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

    // Target month for monthly metrics
    let targetMonth = month;
    if (!targetMonth || targetMonth === 'All') {
      const now = new Date();
      targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    const [tYear, tMonth] = targetMonth.split('-').map(n => parseInt(n, 10));
    const startOfMonth = new Date(Date.UTC(tYear, tMonth - 1, 1)).toISOString().split('T')[0];
    const endOfMonth = new Date(Date.UTC(tYear, tMonth, 0)).toISOString().split('T')[0];

    const monthRes = await pool.query(`
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
      selected_month: targetMonth,
      bulan_masuk: monthRes.rows[0].bulan_masuk,
      bulan_keluar: monthRes.rows[0].bulan_keluar,
      bulan_saldo: parseFloat(monthRes.rows[0].bulan_masuk) - parseFloat(monthRes.rows[0].bulan_keluar),
      total_payroll_paid: totalPayrollRes.rows[0].total_payroll_paid
    });
  } catch (err) {
    console.error('[Finance getCashSummary] Error:', err);
    res.status(500).json({ message: 'Gagal memuat ringkasan kas' });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const { tipe, kategori, search, month, limit = 500 } = req.query;
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

    if (month && month !== 'All') {
      params.push(month);
      query += ` AND TO_CHAR(tanggal, 'YYYY-MM') = $${params.length}`;
    }

    if (search && search.trim() !== '') {
      params.push(`%${search.trim()}%`);
      query += ` AND (keterangan ILIKE $${params.length} OR kategori ILIKE $${params.length} OR created_by ILIKE $${params.length})`;
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

export const updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { tanggal, tipe, kategori, nominal, keterangan } = req.body;

    if (!tanggal || !tipe || nominal === undefined || nominal === null || nominal === '') {
      return res.status(400).json({ message: 'Tanggal, tipe, dan nominal wajib diisi' });
    }

    const cleanNominal = String(nominal).replace(/[^0-9]/g, '');
    const numNominal = parseFloat(cleanNominal);
    if (isNaN(numNominal) || numNominal <= 0) {
      return res.status(400).json({ message: 'Nominal harus angka positif' });
    }

    const result = await pool.query(`
      UPDATE cash_transactions
      SET tanggal = $1, tipe = $2, kategori = $3, nominal = $4, keterangan = $5
      WHERE id = $6
      RETURNING *
    `, [tanggal, tipe, kategori || 'Operasional', numNominal, keterangan || '', id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Finance updateTransaction] Error:', err);
    res.status(500).json({ message: 'Gagal memperbarui transaksi kas' });
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
// 5. AUTOMATED FINANCE RULES & AUDIT
// ==========================================

export const DEFAULT_FINANCE_RULES = {
  baseSalary15th: 1000000,
  baseSalaryMonthEnd: 2000000,
  standardLiveDurationHours: 4.0,
  durationShortagePenaltyPerHour: 30000,
  recapDeadlineTime: '08:00',
  noReportPenaltyPerDay: 150000,
  absentPenaltyPerSession: 60000,
  sessionsPerDay: 2,
  signalCutPenaltyPerEvent: 30000
};

export const getFinanceRules = async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM config WHERE key = 'finance_rules'");
    if (result.rows.length > 0 && result.rows[0].value) {
      try {
        const parsed = JSON.parse(result.rows[0].value);
        return res.json({ success: true, rules: { ...DEFAULT_FINANCE_RULES, ...parsed } });
      } catch (e) {}
    }
    return res.json({ success: true, rules: DEFAULT_FINANCE_RULES });
  } catch (err) {
    console.error('[Finance getFinanceRules] Error:', err);
    return res.status(500).json({ message: 'Gagal mengambil konfigurasi aturan denda' });
  }
};

export const updateFinanceRules = async (req, res) => {
  try {
    const incoming = req.body.rules || req.body || {};
    const newRules = {
      baseSalary15th: parseFloat(incoming.baseSalary15th) >= 0 ? parseFloat(incoming.baseSalary15th) : DEFAULT_FINANCE_RULES.baseSalary15th,
      baseSalaryMonthEnd: parseFloat(incoming.baseSalaryMonthEnd) >= 0 ? parseFloat(incoming.baseSalaryMonthEnd) : DEFAULT_FINANCE_RULES.baseSalaryMonthEnd,
      standardLiveDurationHours: parseFloat(incoming.standardLiveDurationHours) > 0 ? parseFloat(incoming.standardLiveDurationHours) : DEFAULT_FINANCE_RULES.standardLiveDurationHours,
      durationShortagePenaltyPerHour: parseFloat(incoming.durationShortagePenaltyPerHour) >= 0 ? parseFloat(incoming.durationShortagePenaltyPerHour) : DEFAULT_FINANCE_RULES.durationShortagePenaltyPerHour,
      recapDeadlineTime: String(incoming.recapDeadlineTime || DEFAULT_FINANCE_RULES.recapDeadlineTime),
      noReportPenaltyPerDay: parseFloat(incoming.noReportPenaltyPerDay) >= 0 ? parseFloat(incoming.noReportPenaltyPerDay) : DEFAULT_FINANCE_RULES.noReportPenaltyPerDay,
      absentPenaltyPerSession: parseFloat(incoming.absentPenaltyPerSession) >= 0 ? parseFloat(incoming.absentPenaltyPerSession) : DEFAULT_FINANCE_RULES.absentPenaltyPerSession,
      sessionsPerDay: parseInt(incoming.sessionsPerDay, 10) > 0 ? parseInt(incoming.sessionsPerDay, 10) : DEFAULT_FINANCE_RULES.sessionsPerDay,
      signalCutPenaltyPerEvent: parseFloat(incoming.signalCutPenaltyPerEvent) >= 0 ? parseFloat(incoming.signalCutPenaltyPerEvent) : DEFAULT_FINANCE_RULES.signalCutPenaltyPerEvent,
    };

    const val = JSON.stringify(newRules);
    const existing = await pool.query("SELECT id FROM config WHERE key = 'finance_rules'");
    if (existing.rows.length > 0) {
      await pool.query("UPDATE config SET value = $1 WHERE key = 'finance_rules'", [val]);
    } else {
      await pool.query("INSERT INTO config (key, value) VALUES ('finance_rules', $1)", [val]);
    }

    return res.json({ success: true, message: 'Ketentuan aturan denda berhasil diperbarui', rules: newRules });
  } catch (err) {
    console.error('[Finance updateFinanceRules] Error:', err);
    return res.status(500).json({ message: 'Gagal memperbarui aturan denda' });
  }
};

// ── 5. PENALTY & SALARY AUTOMATED AUDIT ──────────────────────────────────────────
export const getPenaltyAudit = async (req, res) => {
  try {
    const { startDate, endDate, periodType = '15th', periodKey } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate dan endDate wajib diisi' });
    }

    const pKey = periodKey || `${startDate.slice(0, 7)}_${periodType}`;

    // 0. Fetch dynamic rules from config table
    let rules = DEFAULT_FINANCE_RULES;
    try {
      const rulesRes = await pool.query("SELECT value FROM config WHERE key = 'finance_rules'");
      if (rulesRes.rows.length > 0 && rulesRes.rows[0].value) {
        rules = { ...DEFAULT_FINANCE_RULES, ...JSON.parse(rulesRes.rows[0].value) };
      }
    } catch (e) {
      console.warn('[Finance Audit] Failed to parse finance_rules, using default:', e.message);
    }

    // 1. Get all active streamers with profiles
    const streamersRes = await pool.query(`
      SELECT 
        s.id AS streamer_id,
        s.nama,
        s.platform,
        p.id AS profile_id,
        COALESCE(p.bank_name, 'BCA') AS bank_name,
        p.bank_account_number,
        p.bank_account_holder,
        COALESCE(p.salary_15, 1000000.00) AS salary_15,
        COALESCE(p.salary_1, 2000000.00) AS salary_1
      FROM streamers s
      LEFT JOIN LATERAL (
        SELECT * FROM payroll_profiles p
        WHERE p.streamer_id = s.id 
           OR LOWER(TRIM(p.name)) = LOWER(TRIM(s.nama))
           OR (LOWER(s.nama) = 'teizza' AND (LOWER(p.name) LIKE '%teizza%' OR LOWER(p.name) LIKE '%key team%'))
        ORDER BY CASE WHEN p.streamer_id = s.id THEN 0 ELSE 1 END, p.id ASC
        LIMIT 1
      ) p ON true
      WHERE COALESCE(s.status, 'active') = 'active'
        AND COALESCE(s.is_active, TRUE) = TRUE
        AND (p.is_active IS TRUE OR p.is_active IS NULL)
      ORDER BY s.nama ASC
    `);

    // 2. Get all daily reports in the date range
    const reportsRes = await pool.query(`
      SELECT 
        id,
        streamer_id,
        TO_CHAR(tanggal, 'YYYY-MM-DD') AS tanggal,
        kategori,
        live_duration,
        reported_live_duration,
        status_izin,
        catatan_izin,
        raw_message,
        created_at
      FROM daily_reports
      WHERE tanggal >= $1::date AND tanggal <= $2::date
    `, [startDate, endDate]);

    // Index reports by "streamer_id_YYYY-MM-DD"
    const reportMap = {};
    for (const r of reportsRes.rows) {
      reportMap[`${r.streamer_id}_${r.tanggal}`] = r;
    }

    // 3. Get saved adjustments
    const adjustmentsRes = await pool.query(`
      SELECT * FROM streamer_salary_adjustments 
      WHERE period_key = $1
    `, [pKey]);

    const adjMap = {};
    for (const a of adjustmentsRes.rows) {
      adjMap[a.streamer_id] = a;
    }

    // Generate date range
    const allDates = [];
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    let curr = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    while (curr <= end) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      allDates.push({
        dateStr: `${y}-${m}-${d}`,
        dayOfWeek: curr.getDay(),
        shortDate: `${dayNames[curr.getDay()]}, ${parseInt(d, 10)} ${monthNames[curr.getMonth()]}`
      });
      curr.setDate(curr.getDate() + 1);
    }

    const auditResults = [];

    for (const streamer of streamersRes.rows) {
      const sId = streamer.streamer_id;
      
      // Determine Base Salary based on periodType
      let baseSalary = rules.baseSalary15th;
      if (periodType === '15th') {
        baseSalary = parseFloat(streamer.salary_15 || rules.baseSalary15th);
      } else if (periodType === '1st') {
        baseSalary = parseFloat(streamer.salary_1 || rules.baseSalaryMonthEnd);
      } else if (periodType === 'full') {
        baseSalary = parseFloat(streamer.salary_15 || rules.baseSalary15th) + parseFloat(streamer.salary_1 || rules.baseSalaryMonthEnd);
      }

      let totalLiveDuration = 0;
      let liveDaysCount = 0;
      let under4hCount = 0;
      let totalShortageHours = 0;
      let shortagePenalty = 0;

      let noReportDaysCount = 0;
      let noReportPenalty = 0;

      let absentDaysCount = 0;
      let absentPenalty = 0;

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

            // SOP Durasi (< standardLiveDurationHours Jam)
            if (duration < rules.standardLiveDurationHours) {
              const shortage = parseFloat((rules.standardLiveDurationHours - duration).toFixed(2));
              dayItem.shortageHours = shortage;
              under4hCount++;
              dayItem.shortagePenalty = Math.round(shortage * rules.durationShortagePenaltyPerHour);
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
          // Missing report on non-Sunday (Streamer Absen / Tidak Live)
          absentDaysCount++;
          
          const dailyAbsentCost = rules.absentPenaltyPerSession * rules.sessionsPerDay;
          dayItem.absentPenalty = dailyAbsentCost;
          dayItem.noReportPenalty = 0; // Tidak didenda ganda jika sudah kena denda absen
          
          absentPenalty += dailyAbsentCost;

          dayItem.statusLabel = 'Absen (Tidak Live)';
          dayItem.statusColor = 'red';
        }

        dayItem.totalDayPenalty = dayItem.shortagePenalty + dayItem.noReportPenalty + dayItem.absentPenalty;
        dailyBreakdown.push(dayItem);
      }

      // Adjustments (Signal cut, custom bonus/deduction)
      const adj = adjMap[sId] || { signal_cut_count: 0, signal_cut_amount: 0, custom_bonus: 0, custom_deduction: 0, notes: '' };
      const signalCutCount = parseInt(adj.signal_cut_count || 0, 10);
      const signalCutAmount = parseFloat(adj.signal_cut_amount !== undefined && adj.signal_cut_amount !== null ? adj.signal_cut_amount : (signalCutCount * rules.signalCutPenaltyPerEvent));
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

    let signalRate = DEFAULT_FINANCE_RULES.signalCutPenaltyPerEvent;
    try {
      const rulesRes = await pool.query("SELECT value FROM config WHERE key = 'finance_rules'");
      if (rulesRes.rows.length > 0 && rulesRes.rows[0].value) {
        const parsed = JSON.parse(rulesRes.rows[0].value);
        if (parsed.signalCutPenaltyPerEvent !== undefined) {
          signalRate = parseFloat(parsed.signalCutPenaltyPerEvent);
        }
      }
    } catch (e) {}

    const count = parseInt(signalCutCount || 0, 10);
    const cutAmount = count * signalRate;
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



