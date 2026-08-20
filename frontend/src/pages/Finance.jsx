import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  Unlock,
  KeyRound,
  Wallet,
  Landmark,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Plus,
  Minus,
  Trash2,
  Edit3,
  RefreshCw,
  Search,
  Users,
  DollarSign,
  AlertCircle,
  FileSpreadsheet,
  MessageSquare,
  ShieldCheck,
  Building,
  TrendingDown,
  TrendingUp,
  X,
  Printer,
  Sparkles,
  Calculator,
  AlertTriangle,
  FileText,
  ChevronRight,
  Filter
} from 'lucide-react';

const Finance = () => {
  const { user } = useAuth();

  // Security PIN state (stored in sessionStorage for current tab session)
  const [isUnlocked, setIsUnlocked] = useState(
    sessionStorage.getItem('casper_finance_unlocked') === 'true'
  );
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Change PIN modal state
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [changePinError, setChangePinError] = useState('');
  const [changePinSuccess, setChangePinSuccess] = useState('');

  // Active Tab: 'audit' | 'payroll' | 'cash' | 'profiles'
  const [activeTab, setActiveTab] = useState('audit');

  // Copy feedback state
  const [copiedKey, setCopiedKey] = useState(null);

  // ==========================================
  // AUTOMATED SALARY & PENALTY AUDIT STATES
  // ==========================================
  const [auditPeriodType, setAuditPeriodType] = useState('15th'); // '15th' | '1st' | 'full' | 'custom'
  const [auditMonth, setAuditMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [auditStartDate, setAuditStartDate] = useState('2026-08-01');
  const [auditEndDate, setAuditEndDate] = useState('2026-08-15');
  const [auditData, setAuditData] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilterPenaltyOnly, setAuditFilterPenaltyOnly] = useState(false);
  const [auditFilterStatus, setAuditFilterStatus] = useState('All'); // 'All' | 'Pending' | 'Verified'
  
  // Drilldown Modal (Daily details per streamer)
  const [drilldownStreamer, setDrilldownStreamer] = useState(null);
  const [savingAdjStreamerId, setSavingAdjStreamerId] = useState(null);
  const [viewingRawMessage, setViewingRawMessage] = useState(null);

  // Custom Adjustment Modal (Bonus / Kasbon)
  const [editingCustomAdjStreamer, setEditingCustomAdjStreamer] = useState(null);
  const [customAdjForm, setCustomAdjForm] = useState({ custom_bonus: '', custom_deduction: '', notes: '' });

  // ==========================================
  // DATA STATES (OTHER TABS)
  // ==========================================
  const [loading, setLoading] = useState(false);

  // Cash Summary & Transactions
  const [cashSummary, setCashSummary] = useState({
    total_masuk: 0,
    total_keluar: 0,
    saldo_kas: 0,
    bulan_masuk: 0,
    bulan_keluar: 0,
    total_payroll_paid: 0,
  });
  const [transactions, setTransactions] = useState([]);
  const [cashFilterType, setCashFilterType] = useState('All');
  const [cashSearch, setCashSearch] = useState('');

  // Modal Cash Transaction
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashModalType, setCashModalType] = useState('Masuk'); // 'Masuk' or 'Keluar'
  const [cashForm, setCashForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    tipe: 'Masuk',
    kategori: 'Suntikan Kas Bos',
    nominal: '',
    keterangan: '',
  });

  // Payroll Profiles
  const [profiles, setProfiles] = useState([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({
    id: null,
    name: '',
    role: 'Streamer',
    bank_name: 'BCA',
    bank_account_number: '',
    bank_account_holder: '',
    salary_15: 1000000,
    salary_1: 2000000,
    is_active: true,
    notes: '',
  });

  // Payroll Periods & Detail
  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const [currentPeriodDetail, setCurrentPeriodDetail] = useState(null);
  const [showNewPeriodModal, setShowNewPeriodModal] = useState(false);
  const [newPeriodForm, setNewPeriodForm] = useState({
    period_type: '15th',
    period_date: new Date().toISOString().split('T')[0],
    title: '',
    notes: '',
  });

  // Modal Edit Item Adjustment (Bonus/Deduction)
  const [editingItem, setEditingItem] = useState(null);
  const [itemEditForm, setItemEditForm] = useState({
    base_amount: 0,
    bonus_amount: 0,
    deduction_amount: 0,
    notes: '',
    bank_name: '',
    bank_account_number: '',
    bank_account_holder: '',
  });

  // ==========================================
  // HELPERS
  // ==========================================
  const formatRupiah = (val) => {
    const num = parseFloat(val) || 0;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(String(text));
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 1800);
  };

  const formatInputNominal = (val) => {
    if (val === null || val === undefined || val === '') return '';
    const digits = String(val).replace(/[^0-9]/g, '');
    if (!digits) return '';
    return new Intl.NumberFormat('id-ID').format(parseInt(digits, 10));
  };

  const parseCleanNumber = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    const digits = String(val).replace(/[^0-9]/g, '');
    return digits ? parseInt(digits, 10) : 0;
  };

  const getRoleBadgeClass = (role) => {
    switch (role?.toLowerCase()) {
      case 'editor':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'streamer':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      case 'analyst':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'admin':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  // ==========================================
  // PIN VERIFICATION HANDLERS
  // ==========================================
  const handleUnlock = async (e) => {
    e?.preventDefault();
    if (!pinInput) return;
    setPinLoading(true);
    setPinError('');

    try {
      const res = await api.post('/finance/verify-pin', { pin: pinInput });
      if (res.data.success) {
        setIsUnlocked(true);
        sessionStorage.setItem('casper_finance_unlocked', 'true');
        setPinInput('');
      }
    } catch (err) {
      setPinError(err.response?.data?.message || 'PIN yang dimasukkan salah');
    } finally {
      setPinLoading(false);
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem('casper_finance_unlocked');
    setPinInput('');
  };

  const handleChangePin = async (e) => {
    e.preventDefault();
    setChangePinError('');
    setChangePinSuccess('');

    if (newPin !== confirmPin) {
      setChangePinError('Konfirmasi PIN baru tidak cocok');
      return;
    }

    try {
      const res = await api.post('/finance/change-pin', { oldPin, newPin });
      setChangePinSuccess(res.data.message || 'PIN berhasil diubah');
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
      setTimeout(() => {
        setShowChangePinModal(false);
        setChangePinSuccess('');
      }, 1500);
    } catch (err) {
      setChangePinError(err.response?.data?.message || 'Gagal mengubah PIN');
    }
  };

  // ==========================================
  // DATA FETCHING
  // ==========================================
  const getLastDayOfMonth = (yearMonth) => {
    if (!yearMonth) return '2026-08-31';
    const [y, m] = yearMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
  };

  const getDatesForPeriod = (yearMonth, pType) => {
    if (pType === '15th') {
      return { start: `${yearMonth}-01`, end: `${yearMonth}-15` };
    } else if (pType === '1st') {
      return { start: `${yearMonth}-16`, end: getLastDayOfMonth(yearMonth) };
    } else if (pType === 'full') {
      return { start: `${yearMonth}-01`, end: getLastDayOfMonth(yearMonth) };
    }
    return { start: `${yearMonth}-01`, end: `${yearMonth}-15` };
  };

  const fetchPenaltyAudit = async (start = auditStartDate, end = auditEndDate, pType = auditPeriodType) => {
    setAuditLoading(true);
    try {
      const pKey = `${start.slice(0, 7)}_${pType}`;
      const res = await api.get('/finance/penalty-audit', {
        params: {
          startDate: start,
          endDate: end,
          periodType: pType,
          periodKey: pKey
        }
      });
      setAuditData(res.data);
      if (drilldownStreamer) {
        const updated = res.data.auditResults?.find(s => s.streamerId === drilldownStreamer.streamerId);
        if (updated) setDrilldownStreamer(updated);
      }
    } catch (err) {
      console.error('Error fetching penalty audit:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  const handlePeriodTypeChange = (newType) => {
    setAuditPeriodType(newType);
    if (newType !== 'custom') {
      const { start, end } = getDatesForPeriod(auditMonth, newType);
      setAuditStartDate(start);
      setAuditEndDate(end);
      fetchPenaltyAudit(start, end, newType);
    }
  };

  const handleMonthChange = (newMonth) => {
    setAuditMonth(newMonth);
    const { start, end } = getDatesForPeriod(newMonth, auditPeriodType);
    setAuditStartDate(start);
    setAuditEndDate(end);
    fetchPenaltyAudit(start, end, auditPeriodType);
  };

  const handleSignalCutChange = async (streamer, delta) => {
    const sId = streamer.streamerId;
    const newCount = Math.max(0, (streamer.signalCutCount || 0) + delta);
    if (newCount === streamer.signalCutCount) return;

    // Optimistic update
    setAuditData(prev => {
      if (!prev) return prev;
      const updatedResults = prev.auditResults.map(s => {
        if (s.streamerId === sId) {
          const cutAmount = newCount * 30000;
          const totalPenalties = s.shortagePenalty + s.noReportPenalty + s.absentPenalty + cutAmount + s.customDeduction;
          const netSalary = Math.max(0, s.baseSalary + s.customBonus - totalPenalties);
          return {
            ...s,
            signalCutCount: newCount,
            signalCutAmount: cutAmount,
            totalPenalties,
            netSalary
          };
        }
        return s;
      });
      return { ...prev, auditResults: updatedResults };
    });

    if (drilldownStreamer && drilldownStreamer.streamerId === sId) {
      setDrilldownStreamer(prev => {
        if (!prev) return prev;
        const cutAmount = newCount * 30000;
        const totalPenalties = prev.shortagePenalty + prev.noReportPenalty + prev.absentPenalty + cutAmount + prev.customDeduction;
        const netSalary = Math.max(0, prev.baseSalary + prev.customBonus - totalPenalties);
        return {
          ...prev,
          signalCutCount: newCount,
          signalCutAmount: cutAmount,
          totalPenalties,
          netSalary
        };
      });
    }

    try {
      setSavingAdjStreamerId(sId);
      const pKey = `${auditStartDate.slice(0, 7)}_${auditPeriodType}`;
      await api.post('/finance/penalty-audit/adjust', {
        streamerId: sId,
        periodKey: pKey,
        signalCutCount: newCount,
        customBonus: streamer.customBonus,
        customDeduction: streamer.customDeduction,
        notes: streamer.notes
      });
    } catch (err) {
      console.error('Failed to save signal adjustment:', err);
      fetchPenaltyAudit();
    } finally {
      setSavingAdjStreamerId(null);
    }
  };

  const handleToggleDailyExcuse = async (day) => {
    if (!drilldownStreamer) return;
    const targetStatus = !day.isExcused;
    let note = '';
    if (targetStatus) {
      const input = prompt('Masukkan keterangan izin (misal: Sakit ada surat dokter / Izin WA di-ACC):', 'Izin via WhatsApp');
      if (input === null) return;
      note = input;
    }

    try {
      await api.post('/finance/penalty-audit/toggle-excuse', {
        streamerId: drilldownStreamer.streamerId,
        tanggal: day.dateStr,
        isExcused: targetStatus,
        catatan: note || (targetStatus ? 'Dispensasi Izin WA' : '')
      });
      await fetchPenaltyAudit();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengubah status izin');
    }
  };

  const handleUpdateDailyLiveDuration = async (day) => {
    if (!drilldownStreamer) return;
    const currentDur = day.liveDuration || 0;
    const input = prompt(`Masukkan durasi live aktual untuk ${drilldownStreamer.nama} pada tanggal ${day.shortDate} (dalam satuan jam, misal: 4.5):`, String(currentDur || '4.5'));
    if (input === null) return; // User cancelled

    const numDuration = parseFloat(input.replace(',', '.'));
    if (isNaN(numDuration) || numDuration < 0) {
      alert('Durasi live harus berupa angka jam yang valid (contoh: 4.5 atau 4)');
      return;
    }

    try {
      await api.post('/finance/penalty-audit/update-duration', {
        streamerId: drilldownStreamer.streamerId,
        tanggal: day.dateStr,
        liveDuration: numDuration
      });
      await fetchPenaltyAudit();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengubah durasi live');
    }
  };

  const handleToggleVerify = async (streamer) => {
    const sId = streamer.streamerId;
    const nextStatus = !streamer.isVerified;

    // Optimistic local update
    setAuditData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        auditResults: prev.auditResults.map((s) =>
          s.streamerId === sId ? { ...s, isVerified: nextStatus } : s
        ),
      };
    });

    if (drilldownStreamer && drilldownStreamer.streamerId === sId) {
      setDrilldownStreamer((prev) => (prev ? { ...prev, isVerified: nextStatus } : prev));
    }

    try {
      const pKey = `${auditStartDate.slice(0, 7)}_${auditPeriodType}`;
      await api.post('/finance/penalty-audit/toggle-verify', {
        streamerId: sId,
        periodKey: pKey,
        isVerified: nextStatus,
      });
    } catch (err) {
      console.error('Failed to toggle verification status:', err);
      fetchPenaltyAudit();
    }
  };

  const handleSaveCustomAdj = async (e) => {
    e.preventDefault();
    if (!editingCustomAdjStreamer) return;
    try {
      const pKey = `${auditStartDate.slice(0, 7)}_${auditPeriodType}`;
      await api.post('/finance/penalty-audit/adjust', {
        streamerId: editingCustomAdjStreamer.streamerId,
        periodKey: pKey,
        signalCutCount: editingCustomAdjStreamer.signalCutCount,
        customBonus: parseCleanNumber(customAdjForm.custom_bonus),
        customDeduction: parseCleanNumber(customAdjForm.custom_deduction),
        notes: customAdjForm.notes
      });
      setEditingCustomAdjStreamer(null);
      await fetchPenaltyAudit();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menyimpan penyesuaian');
    }
  };

  const formatSubmittedAt = (isoStr) => {
    if (!isoStr) return null;
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' WIB';
    } catch (e) {
      return null;
    }
  };

  const generateStreamerAuditWaSlip = (s) => {
    let text = `📄 *SLIP GAJI & AUDIT KEDISIPLINAN STREAMER*\n`;
    text += `*CASPER SIGNAL GLOBAL ANALYST*\n`;
    text += `------------------------------------\n`;
    text += `👤 *Nama:* ${s.nama}\n`;
    text += `🏦 *Rekening:* ${s.bankName} - ${s.bankAccountNumber} (a.n ${s.bankAccountHolder})\n`;
    text += `📅 *Periode:* ${auditStartDate} s/d ${auditEndDate} (${auditPeriodType === '15th' ? 'Termin 1 (Tgl 15)' : auditPeriodType === '1st' ? 'Termin 2 (Akhir Bulan)' : 'Full 1 Bulan'})\n`;
    text += `------------------------------------\n`;
    text += `💵 *Gaji Pokok:* ${formatRupiah(s.baseSalary)}\n\n`;
    text += `*Rincian Potongan & Denda:* \n`;
    
    if (s.shortagePenalty > 0) {
      text += `• Denda Durasi Kurang (${s.totalShortageHours}h / ${s.under4hCount}x): -${formatRupiah(s.shortagePenalty)}\n`;
    } else {
      text += `• Denda Durasi Kurang: Rp 0 (SOP Terpenuhi)\n`;
    }

    if (s.noReportPenalty > 0) {
      text += `• Denda Lupa/Telat Rekap (${s.noReportDaysCount} hari): -${formatRupiah(s.noReportPenalty)}\n`;
    } else {
      text += `• Denda Lupa/Telat Rekap: Rp 0 (Lengkap)\n`;
    }

    if (s.absentPenalty > 0) {
      text += `• Denda Absen/Tidak Live (${s.absentDaysCount} hari): -${formatRupiah(s.absentPenalty)}\n`;
    }

    if (s.signalCutAmount > 0) {
      text += `• Potongan Pembagian Sinyal (${s.signalCutCount}x): -${formatRupiah(s.signalCutAmount)}\n`;
    }

    if (s.customDeduction > 0) {
      text += `• Potongan Tambahan/Kasbon: -${formatRupiah(s.customDeduction)}\n`;
    }

    if (s.customBonus > 0) {
      text += `• Bonus Tambahan: +${formatRupiah(s.customBonus)}\n`;
    }

    text += `------------------------------------\n`;
    text += `🔴 *Total Potongan:* -${formatRupiah(s.totalPenalties)}\n`;
    text += `💰 *GAJI BERSIH (TAKE HOME PAY): ${formatRupiah(s.netSalary)}*\n\n`;
    text += `_Mohon dicek kembali. Jika ada kendala, hubungi admin. Tetap semangat & salam profit! 🚀_`;

    copyToClipboard(text, `audit-wa-${s.streamerId}`);
  };

  const handleExportAuditPdf = () => {
    if (!auditData || !auditData.auditResults) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up terblokir. Harap izinkan pop-up untuk mencetak laporan PDF.');
      return;
    }

    const todayStr = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const totalBase = auditData.auditResults.reduce((acc, s) => acc + s.baseSalary, 0);
    const totalShortage = auditData.auditResults.reduce((acc, s) => acc + s.shortagePenalty, 0);
    const totalNoReport = auditData.auditResults.reduce((acc, s) => acc + s.noReportPenalty, 0);
    const totalAbsent = auditData.auditResults.reduce((acc, s) => acc + s.absentPenalty, 0);
    const totalSignal = auditData.auditResults.reduce((acc, s) => acc + s.signalCutAmount, 0);
    const totalPenaltiesAll = auditData.auditResults.reduce((acc, s) => acc + s.totalPenalties, 0);
    const totalNet = auditData.auditResults.reduce((acc, s) => acc + s.netSalary, 0);

    const rowsHtml = auditData.auditResults.map((s, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="text-align: center; padding: 6px 4px; font-size: 10px;">${idx + 1}</td>
        <td style="padding: 6px 6px; font-size: 10.5px; font-weight: 700; color: #0f172a;">
          ${s.nama}
          <div style="font-size: 9px; color: #64748b; font-weight: normal;">${s.bankName} - ${s.bankAccountNumber} (${s.bankAccountHolder})</div>
        </td>
        <td style="text-align: right; padding: 6px 6px; font-size: 10px; font-weight: 600;">${formatRupiah(s.baseSalary)}</td>
        <td style="text-align: right; padding: 6px 6px; font-size: 10px; color: ${s.shortagePenalty > 0 ? '#be123c' : '#64748b'};">
          ${s.shortagePenalty > 0 ? `-${formatRupiah(s.shortagePenalty)}<br/><span style="font-size: 8.5px;">(${s.totalShortageHours}h)</span>` : '-'}
        </td>
        <td style="text-align: right; padding: 6px 6px; font-size: 10px; color: ${s.noReportPenalty > 0 ? '#be123c' : '#64748b'};">
          ${s.noReportPenalty > 0 ? `-${formatRupiah(s.noReportPenalty)}<br/><span style="font-size: 8.5px;">(${s.noReportDaysCount}x)</span>` : '-'}
        </td>
        <td style="text-align: right; padding: 6px 6px; font-size: 10px; color: ${s.absentPenalty > 0 ? '#be123c' : '#64748b'};">
          ${s.absentPenalty > 0 ? `-${formatRupiah(s.absentPenalty)}<br/><span style="font-size: 8.5px;">(${s.absentDaysCount}d)</span>` : '-'}
        </td>
        <td style="text-align: right; padding: 6px 6px; font-size: 10px; color: ${s.signalCutAmount > 0 ? '#be123c' : '#64748b'};">
          ${s.signalCutAmount > 0 ? `-${formatRupiah(s.signalCutAmount)}<br/><span style="font-size: 8.5px;">(${s.signalCutCount}x)</span>` : '-'}
        </td>
        <td style="text-align: right; padding: 6px 6px; font-size: 10px; font-weight: 700; color: ${s.totalPenalties > 0 ? '#be123c' : '#059669'};">
          ${s.totalPenalties > 0 ? `-${formatRupiah(s.totalPenalties)}` : 'Rp 0'}
        </td>
        <td style="text-align: right; padding: 6px 6px; font-size: 11px; font-weight: 800; color: #047857; background: #f0fdf4;">
          ${formatRupiah(s.netSalary)}
        </td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <title>Casper Signal — Rekap Audit Gaji & Denda Streamer</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #334155; padding: 20px; line-height: 1.35; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #4f46e5; padding-bottom: 10px; margin-bottom: 12px; }
            h1 { font-size: 17px; color: #0f172a; margin: 0; font-weight: 800; text-transform: uppercase; }
            .meta { font-size: 9.5px; color: #64748b; text-align: right; }
            .summary-box { display: flex; gap: 10px; margin-bottom: 14px; }
            .card { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; background: #f8fafc; }
            .card-title { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; }
            .card-val { font-size: 13px; font-weight: 800; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; }
            th { background-color: #f1f5f9; padding: 6px; font-weight: 700; border-bottom: 2px solid #94a3b8; text-align: left; text-transform: uppercase; font-size: 8.5px; color: #334155; }
            .rules { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 12px; font-size: 9.5px; color: #92400e; margin-top: 16px; line-height: 1.4; }
            @media print {
              @page { size: A4 landscape; margin: 8mm; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Casper Signal BI — Rekap Audit Gaji &amp; Denda Streamer</h1>
              <span style="font-size: 10.5px; color: #64748b;">Perhitungan Gaji Pokok, SOP Durasi (4h), Denda Rekap/Absen, &amp; Potongan Sinyal</span>
            </div>
            <div class="meta">
              <strong>Tanggal Cetak:</strong> ${todayStr}<br/>
              <strong>Periode Audit:</strong> ${auditStartDate} s/d ${auditEndDate} (${auditPeriodType === '15th' ? 'Termin 1 (Tgl 15)' : auditPeriodType === '1st' ? 'Termin 2 (Akhir Bln)' : 'Full 1 Bulan'})<br/>
              <strong>Total Streamer:</strong> ${auditData.auditResults.length} Orang
            </div>
          </div>

          <div class="summary-box">
            <div class="card">
              <div class="card-title">Total Gaji Pokok Kotor</div>
              <div class="card-val" style="color: #0f172a;">${formatRupiah(totalBase)}</div>
            </div>
            <div class="card">
              <div class="card-title">Denda Durasi Kurang</div>
              <div class="card-val" style="color: #be123c;">${formatRupiah(totalShortage)}</div>
            </div>
            <div class="card">
              <div class="card-title">Denda Rekap &amp; Absen</div>
              <div class="card-val" style="color: #be123c;">${formatRupiah(totalNoReport + totalAbsent)}</div>
            </div>
            <div class="card">
              <div class="card-title">Potongan Sinyal</div>
              <div class="card-val" style="color: #d97706;">${formatRupiah(totalSignal)}</div>
            </div>
            <div class="card" style="background: #ecfdf5; border-color: #a7f3d0;">
              <div class="card-title" style="color: #047857;">Total Gaji Bersih (Siap Transfer)</div>
              <div class="card-val" style="color: #047857;">${formatRupiah(totalNet)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 25px;">No</th>
                <th>Nama Streamer &amp; Rekening</th>
                <th style="text-align: right;">Gaji Pokok</th>
                <th style="text-align: right;">Kurang Jam (30k)</th>
                <th style="text-align: right;">Telat Rekap (150k)</th>
                <th style="text-align: right;">Absen (60k/sesi)</th>
                <th style="text-align: right;">Sinyal (30k)</th>
                <th style="text-align: right;">Total Denda</th>
                <th style="text-align: right; background: #e2e8f0;">Gaji Bersih</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #cbd5e1;">
                <td colspan="2" style="padding: 8px; font-size: 10px; text-transform: uppercase;">TOTAL KESELURUHAN</td>
                <td style="text-align: right; padding: 8px; font-size: 10px;">${formatRupiah(totalBase)}</td>
                <td style="text-align: right; padding: 8px; font-size: 10px; color: #be123c;">${formatRupiah(totalShortage)}</td>
                <td style="text-align: right; padding: 8px; font-size: 10px; color: #be123c;">${formatRupiah(totalNoReport)}</td>
                <td style="text-align: right; padding: 8px; font-size: 10px; color: #be123c;">${formatRupiah(totalAbsent)}</td>
                <td style="text-align: right; padding: 8px; font-size: 10px; color: #be123c;">${formatRupiah(totalSignal)}</td>
                <td style="text-align: right; padding: 8px; font-size: 10px; color: #be123c;">-${formatRupiah(totalPenaltiesAll)}</td>
                <td style="text-align: right; padding: 8px; font-size: 11.5px; color: #047857; background: #dcfce7;">${formatRupiah(totalNet)}</td>
              </tr>
            </tfoot>
          </table>

          <div class="rules">
            <strong>📌 Ketentuan &amp; Regulasi Penggajian Streamer:</strong><br/>
            1. <strong>Gaji Pokok:</strong> Rp 3.000.000 / bulan (Termin 1 Tgl 15: Rp 1.000.000, Termin 2 Akhir Bulan: Rp 2.000.000).<br/>
            2. <strong>SOP Live:</strong> 4 Jam / hari. Denda Durasi Kurang = Rp 30.000 / Jam kekurangan.<br/>
            3. <strong>Batas Rekap:</strong> Maksimal Jam 08:00 Pagi. Lupa / Telat Rekap = Denda Rp 150.000 / Hari.<br/>
            4. <strong>Absen / Tidak Live:</strong> Denda Rp 60.000 / Sesi (1 Hari 2 Sesi = Rp 120.000).<br/>
            5. <strong>Pembagian Sinyal:</strong> Potongan Rp 30.000 / kejadian.<br/>
            6. <strong>Izin Sah (WhatsApp):</strong> Streamer dengan izin sah yang telah disetujui dibebaskan dari denda (Rp 0).
          </div>

          <div style="margin-top: 30px; display: flex; justify-content: space-between; text-align: center; font-size: 10px;">
            <div>
              Diverifikasi oleh (Admin),<br/><br/><br/><br/>
              <strong>( .................................................. )</strong>
            </div>
            <div>
              Disetujui oleh (Owner / Finance Lead),<br/><br/><br/><br/>
              <strong>( .................................................. )</strong>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const fetchAllData = async () => {
    if (!isUnlocked) return;
    setLoading(true);
    try {
      await Promise.all([
        fetchPenaltyAudit(),
        fetchCashSummary(),
        fetchTransactions(),
        fetchProfiles(),
        fetchPeriods(),
      ]);
    } catch (err) {
      console.error('Error loading finance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCashSummary = async () => {
    try {
      const res = await api.get('/finance/cash/summary');
      setCashSummary(res.data);
    } catch (err) {
      console.error('Error fetching cash summary:', err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await api.get('/finance/cash/transactions', {
        params: {
          tipe: cashFilterType,
          search: cashSearch,
        },
      });
      setTransactions(res.data);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  };

  const fetchProfiles = async () => {
    try {
      const res = await api.get('/finance/profiles');
      setProfiles(res.data);
    } catch (err) {
      console.error('Error fetching profiles:', err);
    }
  };

  const fetchPeriods = async () => {
    try {
      const res = await api.get('/finance/periods');
      setPeriods(res.data);
      if (res.data.length > 0 && !selectedPeriodId) {
        setSelectedPeriodId(res.data[0].id);
      }
    } catch (err) {
      console.error('Error fetching periods:', err);
    }
  };

  const fetchPeriodDetail = async (id) => {
    if (!id) return;
    try {
      const res = await api.get(`/finance/periods/${id}`);
      setCurrentPeriodDetail(res.data);
    } catch (err) {
      console.error('Error fetching period detail:', err);
    }
  };

  useEffect(() => {
    if (isUnlocked) {
      fetchAllData();
    }
  }, [isUnlocked]);

  useEffect(() => {
    if (isUnlocked) {
      fetchTransactions();
    }
  }, [cashFilterType, cashSearch]);

  useEffect(() => {
    if (selectedPeriodId && isUnlocked) {
      fetchPeriodDetail(selectedPeriodId);
    }
  }, [selectedPeriodId, isUnlocked]);

  // ==========================================
  // CASH TRANSACTIONS HANDLERS
  // ==========================================
  const handleOpenCashModal = (type) => {
    setCashModalType(type);
    setCashForm({
      tanggal: new Date().toISOString().split('T')[0],
      tipe: type,
      kategori: type === 'Masuk' ? 'Suntikan Kas Bos' : 'Operasional',
      nominal: '',
      keterangan: '',
    });
    setShowCashModal(true);
  };

  const handleSaveCashTransaction = async (e) => {
    e.preventDefault();
    const cleanNominal = parseCleanNumber(cashForm.nominal);
    if (!cleanNominal || cleanNominal <= 0) {
      alert('Silakan masukkan nominal transaksi yang valid');
      return;
    }

    try {
      await api.post('/finance/cash/transactions', {
        ...cashForm,
        nominal: cleanNominal,
      });
      setShowCashModal(false);
      fetchTransactions();
      fetchCashSummary();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menyimpan transaksi kas');
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!window.confirm('Yakin ingin menghapus catatan transaksi ini?')) return;
    try {
      await api.delete(`/finance/cash/transactions/${id}`);
      fetchTransactions();
      fetchCashSummary();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus transaksi');
    }
  };

  // ==========================================
  // PAYROLL PROFILES HANDLERS
  // ==========================================
  const handleOpenAddProfile = () => {
    setProfileForm({
      id: null,
      name: '',
      role: 'Streamer',
      bank_name: 'BCA',
      bank_account_number: '',
      bank_account_holder: '',
      salary_15: '1.000.000',
      salary_1: '2.000.000',
      is_active: true,
      notes: '',
    });
    setShowProfileModal(true);
  };

  const handleOpenEditProfile = (p) => {
    setProfileForm({
      id: p.id,
      name: p.name,
      role: p.role || 'Streamer',
      bank_name: p.bank_name || 'BCA',
      bank_account_number: p.bank_account_number || '',
      bank_account_holder: p.bank_account_holder || p.name,
      salary_15: formatInputNominal(p.salary_15),
      salary_1: formatInputNominal(p.salary_1),
      is_active: p.is_active,
      notes: p.notes || '',
    });
    setShowProfileModal(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await api.post('/finance/profiles', {
        ...profileForm,
        salary_15: parseCleanNumber(profileForm.salary_15),
        salary_1: parseCleanNumber(profileForm.salary_1),
      });
      setShowProfileModal(false);
      fetchProfiles();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menyimpan profil');
    }
  };

  const handleDeleteProfile = async (id) => {
    if (!window.confirm('Hapus profil penerima gaji ini?')) return;
    try {
      await api.delete(`/finance/profiles/${id}`);
      fetchProfiles();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus profil');
    }
  };

  const handleSyncStreamers = async () => {
    try {
      const res = await api.post('/finance/profiles/sync');
      alert(res.data.message);
      fetchProfiles();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal sinkronisasi data streamer');
    }
  };

  // ==========================================
  // PAYROLL PERIODS HANDLERS
  // ==========================================
  const handleCreatePeriod = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/finance/periods', newPeriodForm);
      setShowNewPeriodModal(false);
      await fetchPeriods();
      if (res.data.period_id) {
        setSelectedPeriodId(res.data.period_id);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal membuat periode gajian');
    }
  };

  const handleDeletePeriod = async (id) => {
    if (!window.confirm('Hapus periode gajian ini beserta seluruh catatannya?')) return;
    try {
      await api.delete(`/finance/periods/${id}`);
      setSelectedPeriodId(null);
      fetchPeriods();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus periode');
    }
  };

  const handleToggleItemStatus = async (item) => {
    const newStatus = item.status === 'Paid' ? 'Pending' : 'Paid';
    try {
      await api.put(`/finance/items/${item.id}`, {
        base_amount: item.base_amount,
        bonus_amount: item.bonus_amount,
        deduction_amount: item.deduction_amount,
        notes: item.notes || '',
        bank_name: item.bank_name || 'BCA',
        bank_account_number: item.bank_account_number || '',
        bank_account_holder: item.bank_account_holder || item.recipient_name,
        status: newStatus,
      });
      fetchPeriodDetail(selectedPeriodId);
      fetchPeriods();
      fetchCashSummary();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengubah status');
    }
  };

  const handleSaveItemEdit = async (e) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      await api.put(`/finance/items/${editingItem.id}`, {
        base_amount: parseCleanNumber(itemEditForm.base_amount),
        bonus_amount: parseCleanNumber(itemEditForm.bonus_amount),
        deduction_amount: parseCleanNumber(itemEditForm.deduction_amount),
        notes: itemEditForm.notes || '',
        bank_name: itemEditForm.bank_name || 'BCA',
        bank_account_number: itemEditForm.bank_account_number || '',
        bank_account_holder: itemEditForm.bank_account_holder || editingItem.recipient_name,
        status: editingItem.status || 'Pending',
      });
      setEditingItem(null);
      fetchPeriodDetail(selectedPeriodId);
      fetchPeriods();
      fetchCashSummary();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal memperbarui item gajian');
    }
  };

  const handleBulkStatus = async (status) => {
    if (!selectedPeriodId) return;
    if (!window.confirm(`Ubah status seluruh penerima di periode ini menjadi ${status}?`)) return;
    try {
      await api.post('/finance/periods/bulk-status', {
        period_id: selectedPeriodId,
        status,
      });
      fetchPeriodDetail(selectedPeriodId);
      fetchPeriods();
      fetchCashSummary();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengubah status massal');
    }
  };

  const generateWhatsAppSlip = (item, period) => {
    const bank = item.bank_name || 'Bank';
    const acc = item.bank_account_number || '-';
    const nominal = formatRupiah(item.final_amount);
    const title = period?.title || 'Penggajian';

    let text = `Halo *${item.recipient_name}*, \n\n`;
    text += `Gaji kamu untuk *${title}* sebesar *${nominal}* telah berhasil ditransfer ke rekening:\n`;
    text += `• Bank: ${bank}\n`;
    text += `• No. Rekening: ${acc}\n`;
    text += `• Atas Nama: ${item.bank_account_holder || item.recipient_name}\n\n`;
    if (parseFloat(item.bonus_amount) > 0) {
      text += `• Tambahan/Bonus: +${formatRupiah(item.bonus_amount)}\n`;
    }
    if (parseFloat(item.deduction_amount) > 0) {
      text += `• Potongan/Kasbon: -${formatRupiah(item.deduction_amount)}\n`;
    }
    if (item.notes) {
      text += `• Keterangan: ${item.notes}\n`;
    }
    text += `\nTerima kasih atas kerja keras & kerjasamanya! 🙏🚀`;

    copyToClipboard(text, `wa-${item.id}`);
  };

  // ============================================================
  // VIEW: PIN SECURITY GATE (IF LOCKED)
  // ============================================================
  if (!isUnlocked) {
    return (
      <div className="flex min-h-[75vh] items-center justify-center p-4">
        <div className="w-full max-w-md bg-dark-card border-3 border-black rounded-2xl p-8 shadow-tactile-lg text-center relative overflow-hidden animate-fade-in">
          {/* Top Decorative accent */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-indigo-500 to-rose-500" />

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-950/80 border-2 border-black text-indigo-400 shadow-tactile-sm mb-5">
            <Lock className="h-8 w-8" />
          </div>

          <h2 className="text-2xl font-extrabold text-white tracking-wide uppercase mb-1.5">
            Brankas Keuangan
          </h2>
          <p className="text-xs text-slate-400 font-medium mb-6 leading-relaxed">
            Halaman ini memuat data rahasia nominal gaji dan kas perusahaan. Silakan masukkan PIN Keamanan Anda untuk membuka akses.
          </p>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="text-left">
              <label className="block text-[11px] font-extrabold text-slate-300 uppercase tracking-wider mb-2">
                PIN Otorisasi (Default: 888888)
              </label>
              <div className="relative">
                <input
                  type="password"
                  maxLength={12}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="••••••"
                  autoFocus
                  className="w-full rounded-xl bg-dark-panel border-2 border-black px-4 py-3 text-center text-2xl font-mono tracking-widest text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none shadow-inset-screen"
                />
                <KeyRound className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 pointer-events-none" />
              </div>
              {pinError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400 font-bold mt-2 animate-bounce">
                  <AlertCircle className="h-4 w-4" />
                  <span>{pinError}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={pinLoading || !pinInput}
              className="w-full py-3.5 px-4 rounded-xl font-extrabold text-sm text-black bg-tactile-yellow border-2 border-black shadow-tactile-sm hover:bg-amber-400 hover:-translate-y-0.5 hover:shadow-tactile-md active:translate-y-0.5 active:shadow-tactile-pressed transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {pinLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Unlock className="h-4 w-4" />
                  <span>Buka Akses Brankas</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t-2 border-slate-800 text-[10px] text-slate-500">
            <span>🔒 Dilindungi proteksi lapis ganda & sesi otomatis terkunci.</span>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // VIEW: MAIN UNLOCKED FINANCE DASHBOARD
  // ============================================================
  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── TOP BAR: Header & Saldo Widgets ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-dark-card border-2 border-black rounded-2xl p-5 shadow-tactile-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 border-2 border-black text-white shadow-tactile-sm">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold text-white uppercase tracking-wide">
                Manajemen Keuangan
              </h1>
              <p className="text-xs text-indigo-400 font-bold">
                Buku Uang Kas, Pengeluaran Operasional & Siklus Payroll
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowChangePinModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-slate-300 bg-dark-panel border-2 border-black hover:text-white hover:bg-slate-800 shadow-tactile-sm transition-all"
          >
            <KeyRound className="h-3.5 w-3.5 text-amber-400" />
            <span>Ganti PIN</span>
          </button>

          <button
            onClick={handleLock}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-rose-300 bg-rose-950/30 border-2 border-black hover:bg-rose-600 hover:text-black shadow-tactile-sm transition-all"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Kunci Layar</span>
          </button>
        </div>
      </div>

      {/* ── SUMMARY STAT CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Saldo Uang Kas */}
        <div className="bg-dark-card border-2 border-black rounded-2xl p-5 shadow-tactile-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Saldo Uang Kas (Petty Cash)
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Landmark className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-400 tracking-tight mb-2">
            {formatRupiah(cashSummary.saldo_kas)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
            <span>Total Masuk: <strong className="text-slate-200">{formatRupiah(cashSummary.total_masuk)}</strong></span>
            <span>Total Keluar: <strong className="text-rose-400">{formatRupiah(cashSummary.total_keluar)}</strong></span>
          </div>
        </div>

        {/* Card 2: Pengeluaran Bulan Berjalan */}
        <div className="bg-dark-card border-2 border-black rounded-2xl p-5 shadow-tactile-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Pengeluaran Bulan Ini
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <TrendingDown className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-rose-400 tracking-tight mb-2">
            {formatRupiah(cashSummary.bulan_keluar)}
          </div>
          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800">
            <span>Kas Masuk Bulan Ini: <strong className="text-emerald-400">{formatRupiah(cashSummary.bulan_masuk)}</strong></span>
          </div>
        </div>

        {/* Card 3: Total Realisasi Gaji */}
        <div className="bg-dark-card border-2 border-black rounded-2xl p-5 shadow-tactile-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Total Realisasi Gaji Cair
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <DollarSign className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-indigo-400 tracking-tight mb-2">
            {formatRupiah(cashSummary.total_payroll_paid)}
          </div>
          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
            <span>Terdaftar: <strong className="text-slate-200">{profiles.length} Anggota Tim</strong></span>
            <span>Total Siklus: <strong className="text-slate-200">{periods.length} Periode</strong></span>
          </div>
        </div>
      </div>

      {/* ── TAB NAVIGATOR ── */}
      <div className="flex items-center gap-2 border-b-2 border-black pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all border-2 ${activeTab === 'audit'
            ? 'bg-tactile-yellow text-black border-black shadow-tactile-sm -translate-y-0.5'
            : 'bg-dark-panel text-slate-400 border-black hover:text-white hover:bg-slate-800'
            }`}
        >
          <Calculator className="h-4 w-4 text-amber-500" />
          <span>⚡ Audit Denda &amp; Gaji Otomatis</span>
        </button>

        <button
          onClick={() => setActiveTab('payroll')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all border-2 ${activeTab === 'payroll'
            ? 'bg-tactile-yellow text-black border-black shadow-tactile-sm -translate-y-0.5'
            : 'bg-dark-panel text-slate-400 border-black hover:text-white hover:bg-slate-800'
            }`}
        >
          <DollarSign className="h-4 w-4" />
          <span>Penggajian (Payroll)</span>
        </button>

        <button
          onClick={() => setActiveTab('cash')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all border-2 ${activeTab === 'cash'
            ? 'bg-tactile-yellow text-black border-black shadow-tactile-sm -translate-y-0.5'
            : 'bg-dark-panel text-slate-400 border-black hover:text-white hover:bg-slate-800'
            }`}
        >
          <Landmark className="h-4 w-4" />
          <span>Pengeluaran &amp; Uang Kas</span>
        </button>

        <button
          onClick={() => setActiveTab('profiles')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all border-2 ${activeTab === 'profiles'
            ? 'bg-tactile-yellow text-black border-black shadow-tactile-sm -translate-y-0.5'
            : 'bg-dark-panel text-slate-400 border-black hover:text-white hover:bg-slate-800'
            }`}
        >
          <Users className="h-4 w-4" />
          <span>Master Profil &amp; Rate Gaji</span>
        </button>
      </div>

      {/* ============================================================
          TAB 0: AUTOMATED SALARY & PENALTY AUDIT
          ============================================================ */}
      {activeTab === 'audit' && (
        <div className="space-y-6 animate-fade-in">
          {/* ── FILTER & CONTROLS BAR ── */}
          <div className="bg-dark-card border-2 border-black rounded-2xl p-5 shadow-tactile-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Month Picker & Period Fast Switcher */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-dark-panel border-2 border-black px-3 py-1.5 rounded-xl">
                  <Calendar className="h-4 w-4 text-indigo-400" />
                  <input
                    type="month"
                    value={auditMonth}
                    onChange={(e) => handleMonthChange(e.target.value)}
                    className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-dark-panel border-2 border-black p-1 rounded-xl">
                  <button
                    onClick={() => handlePeriodTypeChange('15th')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                      auditPeriodType === '15th'
                        ? 'bg-tactile-yellow text-black shadow-tactile-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Termin 1 (Tgl 1 - 15) • Rp 1 Jt
                  </button>

                  <button
                    onClick={() => handlePeriodTypeChange('1st')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                      auditPeriodType === '1st'
                        ? 'bg-tactile-yellow text-black shadow-tactile-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Termin 2 (Tgl 16 - Akhir) • Rp 2 Jt
                  </button>

                  <button
                    onClick={() => handlePeriodTypeChange('full')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                      auditPeriodType === 'full'
                        ? 'bg-tactile-yellow text-black shadow-tactile-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Full 1 Bulan • Rp 3 Jt
                  </button>

                  <button
                    onClick={() => setAuditPeriodType('custom')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                      auditPeriodType === 'custom'
                        ? 'bg-tactile-yellow text-black shadow-tactile-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Custom
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchPenaltyAudit()}
                  disabled={auditLoading}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 bg-dark-panel border-2 border-black hover:text-white hover:bg-slate-800 shadow-tactile-sm transition-all disabled:opacity-50"
                  title="Refresh Audit Data"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${auditLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={handleExportAuditPdf}
                  disabled={!auditData || auditLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-indigo-600 border-2 border-black shadow-tactile-sm hover:bg-indigo-500 hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
                >
                  <Printer className="h-4 w-4" />
                  <span>Cetak / Export PDF</span>
                </button>
              </div>
            </div>

            {/* Custom Date Range Picker (Only if Custom selected) */}
            {auditPeriodType === 'custom' && (
              <div className="flex items-center gap-3 pt-3 border-t border-slate-800 flex-wrap">
                <span className="text-xs font-bold text-slate-400">Rentang Tanggal Custom:</span>
                <input
                  type="date"
                  value={auditStartDate}
                  onChange={(e) => setAuditStartDate(e.target.value)}
                  className="bg-dark-panel border-2 border-black rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                />
                <span className="text-slate-500">s/d</span>
                <input
                  type="date"
                  value={auditEndDate}
                  onChange={(e) => setAuditEndDate(e.target.value)}
                  className="bg-dark-panel border-2 border-black rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                />
                <button
                  onClick={() => fetchPenaltyAudit(auditStartDate, auditEndDate, 'custom')}
                  className="px-4 py-1.5 rounded-xl text-xs font-extrabold text-black bg-tactile-yellow border-2 border-black shadow-tactile-sm"
                >
                  Terapkan Filter
                </button>
              </div>
            )}
          </div>

          {/* ── RULES & SOP ACCORDION BANNER ── */}
          <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-rose-500/10 border-2 border-black rounded-2xl p-4 shadow-tactile-sm">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-amber-400 uppercase tracking-wider">
                <ShieldCheck className="h-4 w-4" />
                <span>Ketentuan Skema Gaji &amp; Aturan Denda Otomatis</span>
              </div>
              <span className="text-[10px] bg-amber-400/20 text-amber-300 font-bold px-2 py-0.5 rounded-md border border-amber-400/30">
                SOP Aktif
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 text-[11px] text-slate-300 pt-1">
              <div className="bg-dark-card/80 border border-slate-700/60 rounded-xl p-2.5">
                <div className="font-extrabold text-white mb-0.5">💰 Gaji Pokok 3 Juta</div>
                <div className="text-[10px] text-slate-400">Tgl 15: Rp 1jt • Akhir Bln: Rp 2jt</div>
              </div>
              <div className="bg-dark-card/80 border border-slate-700/60 rounded-xl p-2.5">
                <div className="font-extrabold text-rose-300 mb-0.5">⏱️ Durasi SOP 4 Jam</div>
                <div className="text-[10px] text-slate-400">Kurang durasi: -Rp 30.000 / Jam</div>
              </div>
              <div className="bg-dark-card/80 border border-slate-700/60 rounded-xl p-2.5">
                <div className="font-extrabold text-rose-300 mb-0.5">📝 Batas Rekap 08:00</div>
                <div className="text-[10px] text-slate-400">Telat: -Rp 150.000 (Bebas denda durasi)</div>
              </div>
              <div className="bg-dark-card/80 border border-slate-700/60 rounded-xl p-2.5">
                <div className="font-extrabold text-rose-300 mb-0.5">🚫 Absen / Bolos</div>
                <div className="text-[10px] text-slate-400">Tidak live: -Rp 60.000 / Sesi (2 sesi)</div>
              </div>
              <div className="bg-dark-card/80 border border-slate-700/60 rounded-xl p-2.5">
                <div className="font-extrabold text-amber-300 mb-0.5">📉 Pembagian Sinyal</div>
                <div className="text-[10px] text-slate-400">Potongan: -Rp 30.000 / kejadian</div>
              </div>
            </div>
          </div>

          {/* ── KPI METRICS CARDS ── */}
          {auditData && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* 1. Total Gaji Pokok */}
              <div className="bg-dark-card border-2 border-black rounded-2xl p-4 shadow-tactile-sm">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                  Total Gaji Pokok Kotor
                </span>
                <div className="text-xl font-black text-white tracking-tight">
                  {formatRupiah(auditData.auditResults.reduce((acc, s) => acc + s.baseSalary, 0))}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {auditData.auditResults.length} Streamer Terdaftar
                </div>
              </div>

              {/* 2. Total Denda Durasi */}
              <div className="bg-dark-card border-2 border-black rounded-2xl p-4 shadow-tactile-sm">
                <span className="text-[10px] font-extrabold text-rose-400 uppercase tracking-wider block mb-1">
                  Denda Durasi Kurang
                </span>
                <div className="text-xl font-black text-rose-400 tracking-tight">
                  {formatRupiah(auditData.auditResults.reduce((acc, s) => acc + s.shortagePenalty, 0))}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {auditData.auditResults.reduce((acc, s) => acc + s.totalShortageHours, 0).toFixed(1)} Jam Kekurangan
                </div>
              </div>

              {/* 3. Total Denda Rekap & Absen */}
              <div className="bg-dark-card border-2 border-black rounded-2xl p-4 shadow-tactile-sm">
                <span className="text-[10px] font-extrabold text-rose-400 uppercase tracking-wider block mb-1">
                  Denda Rekap &amp; Absen
                </span>
                <div className="text-xl font-black text-rose-400 tracking-tight">
                  {formatRupiah(auditData.auditResults.reduce((acc, s) => acc + s.noReportPenalty + s.absentPenalty, 0))}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {auditData.auditResults.reduce((acc, s) => acc + s.noReportDaysCount, 0)}x Telat/No Rekap
                </div>
              </div>

              {/* 4. Total Potongan Sinyal */}
              <div className="bg-dark-card border-2 border-black rounded-2xl p-4 shadow-tactile-sm">
                <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider block mb-1">
                  Potongan Sinyal
                </span>
                <div className="text-xl font-black text-amber-400 tracking-tight">
                  {formatRupiah(auditData.auditResults.reduce((acc, s) => acc + s.signalCutAmount, 0))}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {auditData.auditResults.reduce((acc, s) => acc + s.signalCutCount, 0)}x Kejadian
                </div>
              </div>

              {/* 5. Total Gaji Bersih Siap Transfer */}
              <div className="bg-emerald-950/40 border-2 border-emerald-500/50 rounded-2xl p-4 shadow-tactile-sm">
                <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider block mb-1">
                  Total Bersih Siap Transfer
                </span>
                <div className="text-xl font-black text-emerald-400 tracking-tight">
                  {formatRupiah(auditData.auditResults.reduce((acc, s) => acc + s.netSalary, 0))}
                </div>
                <div className="text-[10px] text-emerald-300/70 mt-1">
                  Total Potongan: -{formatRupiah(auditData.auditResults.reduce((acc, s) => acc + s.totalPenalties, 0))}
                </div>
              </div>
            </div>
          )}

          {/* ── TABLE SEARCH, FILTER & VERIFICATION PROGRESS BAR ── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-dark-card border-2 border-black rounded-2xl p-3.5 shadow-tactile-sm">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Cari nama streamer..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full bg-dark-panel border-2 border-black rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-inset-screen"
                />
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 bg-dark-panel border-2 border-black p-1 rounded-xl">
                <button
                  onClick={() => setAuditFilterStatus('All')}
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all ${
                    auditFilterStatus === 'All'
                      ? 'bg-tactile-yellow text-black shadow-tactile-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Semua ({auditData?.auditResults?.length || 0})
                </button>
                <button
                  onClick={() => setAuditFilterStatus('Pending')}
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1 ${
                    auditFilterStatus === 'Pending'
                      ? 'bg-amber-400 text-black shadow-tactile-xs'
                      : 'text-amber-400/70 hover:text-amber-300'
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  <span>Belum Di-Check ({(auditData?.auditResults || []).filter((s) => !s.isVerified).length})</span>
                </button>
                <button
                  onClick={() => setAuditFilterStatus('Verified')}
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1 ${
                    auditFilterStatus === 'Verified'
                      ? 'bg-emerald-400 text-black shadow-tactile-xs'
                      : 'text-emerald-400/70 hover:text-emerald-300'
                  }`}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Sudah Selesai ({(auditData?.auditResults || []).filter((s) => s.isVerified).length})</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer bg-dark-panel border-2 border-black px-3 py-1.5 rounded-xl shadow-tactile-xs">
                <input
                  type="checkbox"
                  checked={auditFilterPenaltyOnly}
                  onChange={(e) => setAuditFilterPenaltyOnly(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0 focus:outline-none cursor-pointer"
                />
                <span>Hanya yang Ada Denda</span>
              </label>
            </div>
          </div>

          {/* ── MAIN AUDIT TABLE ── */}
          <div className="bg-dark-card border-2 border-black rounded-2xl shadow-tactile-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-dark-panel border-b-2 border-black text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-3 text-center w-10">No</th>
                    <th className="py-3 px-4">Streamer &amp; Rekening</th>
                    <th className="py-3 px-3 text-center">Status Audit</th>
                    <th className="py-3 px-3 text-right">Gaji Pokok</th>
                    <th className="py-3 px-3 text-center">Hari Live</th>
                    <th className="py-3 px-3 text-right">Kurang Jam</th>
                    <th className="py-3 px-3 text-right">Telat Rekap</th>
                    <th className="py-3 px-3 text-right">Absen Live</th>
                    <th className="py-3 px-3 text-center">Potong Sinyal</th>
                    <th className="py-3 px-3 text-right">Total Denda</th>
                    <th className="py-3 px-4 text-right bg-emerald-950/20 text-emerald-400">Gaji Bersih</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs">
                  {auditLoading ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate-400">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-400 mb-2" />
                        <span>Menghitung denda &amp; audit gaji streamer...</span>
                      </td>
                    </tr>
                  ) : !auditData || auditData.auditResults.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-slate-400">
                        Tidak ada data streamer pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    auditData.auditResults
                      .filter((s) => {
                        const matchName = s.nama.toLowerCase().includes(auditSearch.toLowerCase());
                        const matchPenalty = !auditFilterPenaltyOnly || s.totalPenalties > 0;
                        const matchStatus =
                          auditFilterStatus === 'All' ||
                          (auditFilterStatus === 'Verified' && s.isVerified) ||
                          (auditFilterStatus === 'Pending' && !s.isVerified);
                        return matchName && matchPenalty && matchStatus;
                      })
                      .map((s, idx) => (
                        <tr
                          key={s.streamerId}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            s.isVerified ? 'bg-emerald-950/5' : ''
                          }`}
                        >
                          <td className="py-3.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-extrabold text-white text-sm flex items-center gap-1.5">
                              <span>{s.nama}</span>
                              {s.isVerified && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" title="Sudah Selesai Diperiksa" />
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                                {s.bankName}: {s.bankAccountNumber}
                              </span>
                              <span>({s.bankAccountHolder})</span>
                            </div>
                          </td>
                          {/* Status Audit Checklist Badge */}
                          <td className="py-3.5 px-3 text-center">
                            <button
                              onClick={() => handleToggleVerify(s)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold transition-all border shadow-tactile-xs ${
                                s.isVerified
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40'
                                  : 'bg-dark-panel text-amber-400/80 border-slate-700 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40'
                              }`}
                              title={s.isVerified ? 'Klik untuk membatalkan status diperiksa' : 'Klik untuk menandai sudah selesai diperiksa'}
                            >
                              {s.isVerified ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                  <span>Sudah Di-Check</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                                  <span>Tandai Selesai</span>
                                </>
                              )}
                            </button>
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-200">
                            {formatRupiah(s.baseSalary)}
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span className="font-bold text-slate-300">
                              {s.liveDaysCount} hari
                            </span>
                            <div className="text-[10px] text-slate-500 font-mono">
                              ({s.totalLiveDuration}h)
                            </div>
                          </td>
                          {/* Kurang Jam */}
                          <td className="py-3.5 px-3 text-right font-mono">
                            {s.shortagePenalty > 0 ? (
                              <div className="text-rose-400 font-bold">
                                -{formatRupiah(s.shortagePenalty)}
                                <div className="text-[9.5px] text-rose-300/70 font-normal">
                                  {s.totalShortageHours}h ({s.under4hCount}x)
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          {/* Telat Rekap */}
                          <td className="py-3.5 px-3 text-right font-mono">
                            {s.noReportPenalty > 0 ? (
                              <div className="text-rose-400 font-bold">
                                -{formatRupiah(s.noReportPenalty)}
                                <div className="text-[9.5px] text-rose-300/70 font-normal">
                                  {s.noReportDaysCount} hari
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          {/* Absen */}
                          <td className="py-3.5 px-3 text-right font-mono">
                            {s.absentPenalty > 0 ? (
                              <div className="text-rose-400 font-bold">
                                -{formatRupiah(s.absentPenalty)}
                                <div className="text-[9.5px] text-rose-300/70 font-normal">
                                  {s.absentDaysCount} hari
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          {/* Potongan Sinyal (Interactive Counter) */}
                          <td className="py-3.5 px-3 text-center">
                            <div className="inline-flex items-center gap-1.5 bg-dark-panel border-2 border-black px-2 py-1 rounded-xl shadow-tactile-xs">
                              <button
                                onClick={() => handleSignalCutChange(s, -1)}
                                disabled={savingAdjStreamerId === s.streamerId || (s.signalCutCount || 0) <= 0}
                                className="h-5 w-5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-center font-black disabled:opacity-30"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="font-mono font-black text-amber-400 w-5 text-center text-xs">
                                {s.signalCutCount || 0}
                              </span>
                              <button
                                onClick={() => handleSignalCutChange(s, 1)}
                                disabled={savingAdjStreamerId === s.streamerId}
                                className="h-5 w-5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/40 hover:text-white flex items-center justify-center font-black disabled:opacity-30"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            {s.signalCutAmount > 0 && (
                              <div className="text-[9.5px] font-mono text-amber-400 mt-0.5">
                                -{formatRupiah(s.signalCutAmount)}
                              </div>
                            )}
                          </td>
                          {/* Total Denda */}
                          <td className="py-3.5 px-3 text-right font-mono font-black">
                            {s.totalPenalties > 0 ? (
                              <span className="text-rose-400">-{formatRupiah(s.totalPenalties)}</span>
                            ) : (
                              <span className="text-emerald-400">Rp 0</span>
                            )}
                          </td>
                          {/* Gaji Bersih */}
                          <td className="py-3.5 px-4 text-right font-mono font-black text-sm text-emerald-400 bg-emerald-950/15">
                            {formatRupiah(s.netSalary)}
                          </td>
                          {/* Aksi */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setDrilldownStreamer(s)}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-indigo-300 bg-indigo-950/40 border border-indigo-500/40 hover:bg-indigo-600 hover:text-white shadow-tactile-xs transition-all"
                                title="Lihat Rincian Harian & Dispensasi Izin"
                              >
                                <span>Detail</span>
                              </button>

                              <button
                                onClick={() => generateStreamerAuditWaSlip(s)}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 ${
                                  copiedKey === `audit-wa-${s.streamerId}`
                                    ? 'bg-emerald-600 text-black border-black font-extrabold'
                                    : 'text-emerald-300 bg-emerald-950/40 border-emerald-500/40 hover:bg-emerald-600 hover:text-black'
                                }`}
                                title="Salin Slip Gaji untuk WhatsApp"
                              >
                                {copiedKey === `audit-wa-${s.streamerId}` ? (
                                  <>
                                    <Check className="h-3 w-3" />
                                    <span>Tersalin!</span>
                                  </>
                                ) : (
                                  <>
                                    <MessageSquare className="h-3 w-3" />
                                    <span>Slip WA</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          TAB 1: PAYROLL (PENGGAJIAN)
          ============================================================ */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
          {/* Top Period Selector Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-dark-card border-2 border-black rounded-2xl p-4 shadow-tactile-sm">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-indigo-400" />
                <span>Pilih Periode:</span>
              </label>
              <select
                value={selectedPeriodId || ''}
                onChange={(e) => setSelectedPeriodId(Number(e.target.value))}
                className="bg-dark-panel border-2 border-black rounded-xl px-4 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 shadow-inset-screen min-w-[240px]"
              >
                {periods.length === 0 ? (
                  <option value="">Belum ada periode gajian</option>
                ) : (
                  periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.period_type === '15th' ? 'Tgl 15' : 'Tgl 1'}) — {p.paid_recipients_count}/{p.total_recipients} Paid
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNewPeriodModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold text-black bg-tactile-yellow border-2 border-black shadow-tactile-sm hover:bg-amber-400 hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Buat Periode Baru</span>
              </button>

              {currentPeriodDetail && (
                <button
                  onClick={() => handleDeletePeriod(currentPeriodDetail.period.id)}
                  title="Hapus Periode Ini"
                  className="p-2 rounded-xl text-slate-400 bg-dark-panel border-2 border-black hover:text-rose-400 hover:bg-rose-950/20 shadow-tactile-sm transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Period Details & Quick Action Stats */}
          {currentPeriodDetail ? (
            <div className="space-y-4">
              {/* Period Stats Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-dark-panel border-2 border-black rounded-2xl p-4 shadow-inset-screen">
                <div>
                  <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Total Anggaran Gaji
                  </span>
                  <span className="text-lg font-black text-white">
                    {formatRupiah(currentPeriodDetail.period.total_amount)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Realisasi Cair (Sudah Ditransfer)
                  </span>
                  <span className="text-lg font-black text-emerald-400">
                    {formatRupiah(currentPeriodDetail.period.paid_amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      Status Transfer
                    </span>
                    <span className="text-xs font-extrabold text-indigo-400">
                      {currentPeriodDetail.items.filter((i) => i.status === 'Paid').length} / {currentPeriodDetail.items.length} Orang Lunas
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleBulkStatus('Paid')}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-emerald-300 bg-emerald-950/40 border border-emerald-500/40 hover:bg-emerald-500 hover:text-black transition-all"
                    >
                      Lunas Semua
                    </button>
                    <button
                      onClick={() => handleBulkStatus('Pending')}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-slate-400 bg-slate-800 border border-black hover:bg-slate-700 transition-all"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {/* Recipients Table */}
              <div className="bg-dark-card border-2 border-black rounded-2xl shadow-tactile-sm overflow-hidden">
                <div className="p-4 border-b-2 border-black flex justify-between items-center bg-dark-panel">
                  <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <span>📋 Daftar Penerima Gaji</span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px]">
                      {currentPeriodDetail.items.length} Orang
                    </span>
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b-2 border-black bg-dark-panel/80 text-slate-400 text-[10px] uppercase tracking-wider font-extrabold">
                        <th className="py-3 px-4">Nama & Role</th>
                        <th className="py-3 px-4">Rekening Bank</th>
                        <th className="py-3 px-4 text-right">Gaji Pokok</th>
                        <th className="py-3 px-4 text-right">Bonus / Potongan</th>
                        <th className="py-3 px-4 text-right">Total Transfer</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-center">Aksi Cepat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {currentPeriodDetail.items.map((item) => {
                        const isPaid = item.status === 'Paid';
                        return (
                          <tr
                            key={item.id}
                            className={`transition-all hover:bg-slate-900/60 ${isPaid ? 'bg-emerald-950/10' : ''
                              }`}
                          >
                            {/* Name & Role */}
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-white text-sm">{item.recipient_name}</div>
                              <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide border ${getRoleBadgeClass(item.role)}`}>
                                {item.role}
                              </span>
                              {item.notes && (
                                <div className="text-[10px] text-amber-400 mt-0.5 italic">
                                  📝 {item.notes}
                                </div>
                              )}
                            </td>

                            {/* Bank Details & Copy */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5">
                                <span className="font-extrabold text-indigo-400 uppercase">
                                  {item.bank_name || 'BCA'}
                                </span>
                                <span className="font-mono text-slate-200">
                                  {item.bank_account_number || '-'}
                                </span>
                                {item.bank_account_number && (
                                  <button
                                    onClick={() => copyToClipboard(item.bank_account_number, `acc-${item.id}`)}
                                    title="Salin No Rekening"
                                    className="p-1 rounded bg-dark-panel hover:bg-indigo-600 hover:text-white border border-slate-700 transition-all text-slate-400"
                                  >
                                    {copiedKey === `acc-${item.id}` ? (
                                      <Check className="h-3 w-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[160px]">
                                a/n {item.bank_account_holder || item.recipient_name}
                              </div>
                            </td>

                            {/* Base Amount */}
                            <td className="py-3.5 px-4 text-right font-medium text-slate-300">
                              {formatRupiah(item.base_amount)}
                            </td>

                            {/* Adjustments */}
                            <td className="py-3.5 px-4 text-right">
                              {parseFloat(item.bonus_amount) > 0 && (
                                <div className="text-[11px] font-bold text-emerald-400">
                                  +{formatRupiah(item.bonus_amount)}
                                </div>
                              )}
                              {parseFloat(item.deduction_amount) > 0 && (
                                <div className="text-[11px] font-bold text-rose-400">
                                  -{formatRupiah(item.deduction_amount)}
                                </div>
                              )}
                              {parseFloat(item.bonus_amount) === 0 && parseFloat(item.deduction_amount) === 0 && (
                                <span className="text-slate-500">-</span>
                              )}
                            </td>

                            {/* Final Amount & Copy */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="font-extrabold text-sm text-white">
                                  {formatRupiah(item.final_amount)}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(item.final_amount, `nom-${item.id}`)}
                                  title="Salin Nominal Transfer"
                                  className="p-1 rounded bg-dark-panel hover:bg-tactile-yellow hover:text-black border border-slate-700 transition-all text-slate-400"
                                >
                                  {copiedKey === `nom-${item.id}` ? (
                                    <Check className="h-3 w-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4 text-center">
                              <button
                                onClick={() => handleToggleItemStatus(item)}
                                className={`px-3 py-1.5 rounded-xl font-extrabold text-[10px] uppercase tracking-wider border-2 transition-all shadow-tactile-sm ${isPaid
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500 hover:text-black'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-400 hover:text-black'
                                  }`}
                              >
                                {isPaid ? '✓ LUNAS (PAID)' : '⏳ PENDING'}
                              </button>
                            </td>

                            {/* Quick Actions */}
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingItem(item);
                                    setItemEditForm({
                                      base_amount: formatInputNominal(item.base_amount),
                                      bonus_amount: formatInputNominal(item.bonus_amount),
                                      deduction_amount: formatInputNominal(item.deduction_amount),
                                      notes: item.notes || '',
                                      bank_name: item.bank_name || 'BCA',
                                      bank_account_number: item.bank_account_number || '',
                                      bank_account_holder: item.bank_account_holder || item.recipient_name,
                                    });
                                  }}
                                  title="Edit Bonus/Potongan/Rekening"
                                  className="p-1.5 rounded-lg bg-dark-panel border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  onClick={() => generateWhatsAppSlip(item, currentPeriodDetail.period)}
                                  title="Salin Slip WA Siap Kirim"
                                  className="p-1.5 rounded-lg bg-dark-panel border border-slate-700 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all"
                                >
                                  {copiedKey === `wa-${item.id}` ? (
                                    <Check className="h-3.5 w-3.5" />
                                  ) : (
                                    <MessageSquare className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-dark-card border-2 border-black rounded-2xl p-12 text-center shadow-tactile-sm">
              <DollarSign className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-extrabold text-white uppercase mb-1">Belum Ada Periode Gajian</h3>
              <p className="text-xs text-slate-400 mb-5">
                Klik tombol "Buat Periode Baru" untuk otomatis men-generate daftar gajian Tgl 15 atau Tgl 1.
              </p>
              <button
                onClick={() => setShowNewPeriodModal(true)}
                className="px-5 py-2.5 rounded-xl font-extrabold text-xs text-black bg-tactile-yellow border-2 border-black shadow-tactile-sm hover:bg-amber-400 transition-all"
              >
                + Buat Periode Gajian Sekarang
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          TAB 2: PENGELUARAN & UANG KAS (PETTY CASH)
          ============================================================ */}
      {activeTab === 'cash' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-dark-card border-2 border-black rounded-2xl p-4 shadow-tactile-sm">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Type Filter */}
              <div className="flex items-center bg-dark-panel border-2 border-black rounded-xl p-1 shadow-inset-screen">
                {['All', 'Masuk', 'Keluar'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setCashFilterType(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all ${cashFilterType === t
                      ? 'bg-tactile-yellow text-black shadow-tactile-sm'
                      : 'text-slate-400 hover:text-white'
                      }`}
                  >
                    {t === 'All' ? 'Semua' : t === 'Masuk' ? '🟢 Kas Masuk' : '🔴 Pengeluaran'}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari keterangan / kategori..."
                  value={cashSearch}
                  onChange={(e) => setCashSearch(e.target.value)}
                  className="bg-dark-panel border-2 border-black rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-inset-screen w-52"
                />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenCashModal('Masuk')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold text-emerald-300 bg-emerald-950/40 border-2 border-emerald-500/40 hover:bg-emerald-500 hover:text-black shadow-tactile-sm transition-all"
              >
                <ArrowDownLeft className="h-4 w-4" />
                <span>+ Catat Kas Masuk (Bos)</span>
              </button>

              <button
                onClick={() => handleOpenCashModal('Keluar')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold text-rose-300 bg-rose-950/40 border-2 border-rose-500/40 hover:bg-rose-500 hover:text-black shadow-tactile-sm transition-all"
              >
                <ArrowUpRight className="h-4 w-4" />
                <span>+ Catat Pengeluaran</span>
              </button>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-dark-card border-2 border-black rounded-2xl shadow-tactile-sm overflow-hidden">
            <div className="p-4 border-b-2 border-black bg-dark-panel flex justify-between items-center">
              <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <span>📖 Buku Arus Uang Kas & Pengeluaran</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                  {transactions.length} Transaksi
                </span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-black bg-dark-panel/80 text-slate-400 text-[10px] uppercase tracking-wider font-extrabold">
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Tipe</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Keterangan</th>
                    <th className="py-3 px-4 text-right">Nominal</th>
                    <th className="py-3 px-4">Dicatat Oleh</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-slate-500">
                        Belum ada catatan transaksi uang kas.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => {
                      const isIncome = tx.tipe === 'Masuk';
                      return (
                        <tr key={tx.id} className="hover:bg-slate-900/60 transition-all">
                          <td className="py-3.5 px-4 font-mono text-slate-300">
                            {new Date(tx.tanggal).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${isIncome
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                }`}
                            >
                              {isIncome ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                              {tx.tipe}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-200">
                            {tx.kategori}
                          </td>
                          <td className="py-3.5 px-4 text-slate-300">
                            {tx.keterangan || '-'}
                          </td>
                          <td className={`py-3.5 px-4 text-right font-mono font-bold text-sm ${isIncome ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                            {isIncome ? '+' : '-'}{formatRupiah(tx.nominal)}
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                            {tx.created_by || 'Admin'}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleDeleteTransaction(tx.id)}
                              className="p-1.5 rounded-lg bg-dark-panel border border-slate-700 text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 transition-all"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          TAB 3: MASTER PROFIL & RATE GAJI
          ============================================================ */}
      {activeTab === 'profiles' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-dark-card border-2 border-black rounded-2xl p-4 shadow-tactile-sm">
            <div>
              <h2 className="text-sm font-extrabold text-white uppercase tracking-wide">
                Master Data Tim & Standar Gaji
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Atur nominal rate gajian Tgl 15 (Standar 1jt) dan Tgl 1 (Custom sesuai arahan bos).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncStreamers}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-300 bg-dark-panel border-2 border-black hover:text-white hover:bg-slate-800 shadow-tactile-sm transition-all"
              >
                <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
                <span>Tarik Data Streamer</span>
              </button>

              <button
                onClick={handleOpenAddProfile}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold text-black bg-tactile-yellow border-2 border-black shadow-tactile-sm hover:bg-amber-400 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>+ Tambah Anggota</span>
              </button>
            </div>
          </div>

          <div className="bg-dark-card border-2 border-black rounded-2xl shadow-tactile-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-black bg-dark-panel/80 text-slate-400 text-[10px] uppercase tracking-wider font-extrabold">
                    <th className="py-3 px-4">Nama Anggota</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Rekening Bank</th>
                    <th className="py-3 px-4 text-right">Gaji Tgl 15</th>
                    <th className="py-3 px-4 text-right">Gaji Tgl 1 (Custom)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {profiles.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-900/60 transition-all">
                      <td className="py-3.5 px-4 font-bold text-white text-sm">
                        {p.name}
                        {p.notes && <div className="text-[10px] text-slate-400 font-normal">{p.notes}</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border ${getRoleBadgeClass(p.role)}`}>
                          {p.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-slate-200">
                          <strong className="text-indigo-400">{p.bank_name || 'BCA'}</strong> {p.bank_account_number || '-'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          a/n {p.bank_account_holder || p.name}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-200">
                        {formatRupiah(p.salary_15)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-amber-400">
                        {formatRupiah(p.salary_1)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${p.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}
                        >
                          {p.is_active ? 'Aktif' : 'Non-Aktif'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditProfile(p)}
                            className="p-1.5 rounded-lg bg-dark-panel border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProfile(p.id)}
                            className="p-1.5 rounded-lg bg-dark-panel border border-slate-700 text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODALS SECTION
          ============================================================ */}

      {/* MODAL 1: BUAT PERIODE BARU */}
      {showNewPeriodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-dark-card border-3 border-black rounded-2xl p-6 shadow-tactile-lg relative">
            <div className="flex justify-between items-center pb-3 border-b-2 border-black mb-4">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-400" />
                <span>Buat Siklus Gajian Baru</span>
              </h3>
              <button
                onClick={() => setShowNewPeriodModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePeriod} className="space-y-4">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1.5">
                  Tipe Siklus Gajian
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setNewPeriodForm({
                        ...newPeriodForm,
                        period_type: '15th',
                        title: `Gaji Tgl 15 - ${new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`,
                      })
                    }
                    className={`p-3 rounded-xl border-2 text-left font-bold text-xs transition-all ${newPeriodForm.period_type === '15th'
                      ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-tactile-sm'
                      : 'bg-dark-panel border-black text-slate-400 hover:text-white'
                      }`}
                  >
                    <div className="text-sm text-indigo-400 font-extrabold">Gajian Tgl 15</div>
                    <div className="text-[10px] text-slate-400 mt-1">Menggunakan Rate Tgl 15 (Standar 1 Juta)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setNewPeriodForm({
                        ...newPeriodForm,
                        period_type: '1st',
                        title: `Gaji Tgl 1 - ${new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`,
                      })
                    }
                    className={`p-3 rounded-xl border-2 text-left font-bold text-xs transition-all ${newPeriodForm.period_type === '1st'
                      ? 'bg-amber-950/60 border-amber-500 text-white shadow-tactile-sm'
                      : 'bg-dark-panel border-black text-slate-400 hover:text-white'
                      }`}
                  >
                    <div className="text-sm text-amber-400 font-extrabold">Gajian Tgl 1</div>
                    <div className="text-[10px] text-slate-400 mt-1">Menggunakan Rate Tgl 1 (Custom 2jt, 3jt, 4jt)</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                  Tanggal Penggajian
                </label>
                <input
                  type="date"
                  required
                  value={newPeriodForm.period_date}
                  onChange={(e) => setNewPeriodForm({ ...newPeriodForm, period_date: e.target.value })}
                  className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 shadow-inset-screen"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                  Judul Periode (Otomatis)
                </label>
                <input
                  type="text"
                  required
                  value={newPeriodForm.title}
                  onChange={(e) => setNewPeriodForm({ ...newPeriodForm, title: e.target.value })}
                  placeholder="Contoh: Gaji Tgl 15 Agustus 2026"
                  className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 shadow-inset-screen"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  value={newPeriodForm.notes}
                  onChange={(e) => setNewPeriodForm({ ...newPeriodForm, notes: e.target.value })}
                  placeholder="Keterangan khusus dari bos..."
                  className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 shadow-inset-screen"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setShowNewPeriodModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-dark-panel border-2 border-black hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-extrabold text-black bg-tactile-yellow border-2 border-black shadow-tactile-sm hover:bg-amber-400"
                >
                  Generate Periode Ini
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CATAT KAS MASUK / PENGELUARAN */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-dark-card border-3 border-black rounded-2xl p-6 shadow-tactile-lg relative">
            <div className="flex justify-between items-center pb-3 border-b-2 border-black mb-4">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-2">
                {cashModalType === 'Masuk' ? (
                  <>
                    <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
                    <span>Catat Uang Kas Masuk (Dari Bos)</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="h-4 w-4 text-rose-400" />
                    <span>Catat Pengeluaran Operasional</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setShowCashModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCashTransaction} className="space-y-4">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                  Tanggal
                </label>
                <input
                  type="date"
                  required
                  value={cashForm.tanggal}
                  onChange={(e) => setCashForm({ ...cashForm, tanggal: e.target.value })}
                  className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 shadow-inset-screen"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                  Kategori
                </label>
                <select
                  value={cashForm.kategori}
                  onChange={(e) => setCashForm({ ...cashForm, kategori: e.target.value })}
                  className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 shadow-inset-screen"
                >
                  {cashModalType === 'Masuk' ? (
                    <>
                      <option value="Suntikan Kas Bos">Suntikan Kas Bos</option>
                      <option value="Pengembalian Kasbon">Pengembalian Kasbon</option>
                      <option value="Pendapatan Lain">Pendapatan Lain</option>
                    </>
                  ) : (
                    <>
                      <option value="Operasional">Operasional Harian</option>
                      <option value="Internet / Kuota">Internet / Kuota</option>
                      <option value="Beli Akun / Tools">Beli Akun / Tools</option>
                      <option value="Snack / Konsumsi">Snack / Konsumsi</option>
                      <option value="Kasbon Karyawan">Kasbon Karyawan</option>
                      <option value="Lainnya">Lainnya</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                  Nominal (Rp)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={cashForm.nominal}
                  onChange={(e) => setCashForm({ ...cashForm, nominal: formatInputNominal(e.target.value) })}
                  placeholder="Contoh: 1.300.000"
                  className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-base font-mono font-bold text-white focus:outline-none focus:border-indigo-500 shadow-inset-screen"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                  Keterangan / Catatan
                </label>
                <textarea
                  rows={3}
                  value={cashForm.keterangan}
                  onChange={(e) => setCashForm({ ...cashForm, keterangan: e.target.value })}
                  placeholder="Deskripsi transaksi..."
                  className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 shadow-inset-screen resize-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setShowCashModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-dark-panel border-2 border-black hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl text-xs font-extrabold text-black border-2 border-black shadow-tactile-sm transition-all ${cashModalType === 'Masuk'
                    ? 'bg-emerald-400 hover:bg-emerald-300'
                    : 'bg-rose-400 hover:bg-rose-300'
                    }`}
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: TAMBAH / EDIT PROFIL TIM */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-dark-card border-3 border-black rounded-2xl p-6 shadow-tactile-lg relative">
            <div className="flex justify-between items-center pb-3 border-b-2 border-black mb-4">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-400" />
                <span>{profileForm.id ? 'Edit Profil Anggota' : 'Tambah Anggota Baru'}</span>
              </h3>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                  Nama Lengkap / Panggilan
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  placeholder="Contoh: Aline"
                  className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 shadow-inset-screen"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                    Role
                  </label>
                  <select
                    value={profileForm.role}
                    onChange={(e) => setProfileForm({ ...profileForm, role: e.target.value })}
                    className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs font-bold text-white focus:outline-none shadow-inset-screen"
                  >
                    <option value="Streamer">Streamer</option>
                    <option value="Editor">Editor</option>
                    <option value="Analyst">Analyst</option>
                    <option value="Admin">Admin</option>
                    <option value="Staff">Staff</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                    Nama Bank
                  </label>
                  <select
                    value={profileForm.bank_name}
                    onChange={(e) => setProfileForm({ ...profileForm, bank_name: e.target.value })}
                    className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs font-bold text-white focus:outline-none shadow-inset-screen"
                  >
                    <option value="BCA">BCA</option>
                    <option value="Mandiri">Mandiri</option>
                    <option value="BRI">BRI</option>
                    <option value="BNI">BNI</option>
                    <option value="BSI">BSI</option>
                    <option value="SeaBank">SeaBank</option>
                    <option value="Jago">Bank Jago</option>
                    <option value="DANA">DANA</option>
                    <option value="GoPay">GoPay</option>
                    <option value="OVO">OVO</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                    No. Rekening
                  </label>
                  <input
                    type="text"
                    value={profileForm.bank_account_number}
                    onChange={(e) => setProfileForm({ ...profileForm, bank_account_number: e.target.value })}
                    placeholder="1234567890"
                    className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs font-mono text-white focus:outline-none shadow-inset-screen"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                    Atas Nama Rekening
                  </label>
                  <input
                    type="text"
                    value={profileForm.bank_account_holder}
                    onChange={(e) => setProfileForm({ ...profileForm, bank_account_holder: e.target.value })}
                    placeholder="Nama di buku tabungan"
                    className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs text-white focus:outline-none shadow-inset-screen"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                    Rate Gaji Tgl 15 (Rp)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={profileForm.salary_15}
                    onChange={(e) => setProfileForm({ ...profileForm, salary_15: formatInputNominal(e.target.value) })}
                    placeholder="1.000.000"
                    className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs font-mono font-bold text-white focus:outline-none shadow-inset-screen"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-amber-400 uppercase mb-1">
                    Rate Gaji Tgl 1 (Rp)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={profileForm.salary_1}
                    onChange={(e) => setProfileForm({ ...profileForm, salary_1: formatInputNominal(e.target.value) })}
                    placeholder="2.000.000"
                    className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs font-mono font-bold text-amber-400 focus:outline-none shadow-inset-screen"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-dark-panel border-2 border-black hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-extrabold text-black bg-tactile-yellow border-2 border-black shadow-tactile-sm hover:bg-amber-400"
                >
                  Simpan Profil
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: EDIT PENYESUAIAN ITEM (BONUS / POTONGAN KASBON) */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-dark-card border-3 border-black rounded-2xl p-6 shadow-tactile-lg relative">
            <div className="flex justify-between items-center pb-3 border-b-2 border-black mb-4">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wide">
                Penyesuaian Gaji: <span className="text-indigo-400">{editingItem.recipient_name}</span>
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItemEdit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                  Gaji Pokok (Rp)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={itemEditForm.base_amount}
                  onChange={(e) => setItemEditForm({ ...itemEditForm, base_amount: formatInputNominal(e.target.value) })}
                  placeholder="1.000.000"
                  className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs font-mono font-bold text-white focus:outline-none shadow-inset-screen"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-extrabold text-emerald-400 uppercase mb-1">
                    + Bonus / Tambahan (Rp)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={itemEditForm.bonus_amount}
                    onChange={(e) => setItemEditForm({ ...itemEditForm, bonus_amount: formatInputNominal(e.target.value) })}
                    placeholder="0"
                    className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs font-mono font-bold text-emerald-400 focus:outline-none shadow-inset-screen"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-rose-400 uppercase mb-1">
                    - Potongan / Kasbon (Rp)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={itemEditForm.deduction_amount}
                    onChange={(e) => setItemEditForm({ ...itemEditForm, deduction_amount: formatInputNominal(e.target.value) })}
                    placeholder="0"
                    className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs font-mono font-bold text-rose-400 focus:outline-none shadow-inset-screen"
                  />
                </div>
              </div>

              <div className="p-3 bg-dark-panel border-2 border-black rounded-xl flex justify-between items-center">
                <span className="text-xs font-bold text-slate-300">Total Akhir Transfer:</span>
                <span className="text-base font-black text-white">
                  {formatRupiah(
                    Math.max(
                      0,
                      parseCleanNumber(itemEditForm.base_amount) +
                      parseCleanNumber(itemEditForm.bonus_amount) -
                      parseCleanNumber(itemEditForm.deduction_amount)
                    )
                  )}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                    Bank
                  </label>
                  <input
                    type="text"
                    value={itemEditForm.bank_name || ''}
                    onChange={(e) => setItemEditForm({ ...itemEditForm, bank_name: e.target.value })}
                    placeholder="BCA / Mandiri"
                    className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs text-white focus:outline-none shadow-inset-screen"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                    No. Rekening
                  </label>
                  <input
                    type="text"
                    value={itemEditForm.bank_account_number || ''}
                    onChange={(e) => setItemEditForm({ ...itemEditForm, bank_account_number: e.target.value })}
                    placeholder="1234567890"
                    className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs font-mono text-white focus:outline-none shadow-inset-screen"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                    Atas Nama
                  </label>
                  <input
                    type="text"
                    value={itemEditForm.bank_account_holder || ''}
                    onChange={(e) => setItemEditForm({ ...itemEditForm, bank_account_holder: e.target.value })}
                    placeholder="Nama Pemilik"
                    className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs text-white focus:outline-none shadow-inset-screen"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                  Catatan / Keterangan Penyesuaian
                </label>
                <input
                  type="text"
                  value={itemEditForm.notes}
                  onChange={(e) => setItemEditForm({ ...itemEditForm, notes: e.target.value })}
                  placeholder="Misal: Bonus performa live / Potong kasbon tgl 5"
                  className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs text-white focus:outline-none shadow-inset-screen"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-dark-panel border-2 border-black hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-extrabold text-black bg-tactile-yellow border-2 border-black shadow-tactile-sm hover:bg-amber-400"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AUDIT 1: DRILLDOWN RINCIAN HARIAN & DISPENSASI IZIN */}
      {drilldownStreamer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-4xl max-h-[90vh] bg-dark-card border-3 border-black rounded-2xl shadow-tactile-lg flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b-2 border-black flex justify-between items-start bg-dark-panel">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 border-2 border-black text-white font-extrabold text-xs">
                    {drilldownStreamer.nama.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-white uppercase tracking-wide flex items-center gap-2">
                      <span>Rincian Audit Kedisiplinan: {drilldownStreamer.nama}</span>
                      {drilldownStreamer.isVerified ? (
                        <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Sudah Di-Check</span>
                        </span>
                      ) : (
                        <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>Belum Di-Check</span>
                        </span>
                      )}
                    </h3>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      {drilldownStreamer.bankName}: {drilldownStreamer.bankAccountNumber} ({drilldownStreamer.bankAccountHolder}) • Periode: {auditStartDate} s/d {auditEndDate}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setDrilldownStreamer(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Quick Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 bg-dark-card border-b-2 border-black text-xs">
              <div className="bg-dark-panel p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold block">Gaji Pokok</span>
                <span className="font-bold text-white font-mono">{formatRupiah(drilldownStreamer.baseSalary)}</span>
              </div>
              <div className="bg-dark-panel p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-rose-400 font-bold block">Total Denda Disiplin</span>
                <span className="font-bold text-rose-400 font-mono">
                  -{formatRupiah(drilldownStreamer.shortagePenalty + drilldownStreamer.noReportPenalty + drilldownStreamer.absentPenalty)}
                </span>
              </div>
              <div className="bg-dark-panel p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-amber-400 font-bold block">Potongan Sinyal ({drilldownStreamer.signalCutCount}x)</span>
                <span className="font-bold text-amber-400 font-mono">-{formatRupiah(drilldownStreamer.signalCutAmount)}</span>
              </div>
              <div className="bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/40">
                <span className="text-[10px] text-emerald-400 font-bold block">Gaji Bersih Diterima</span>
                <span className="font-extrabold text-emerald-400 font-mono">{formatRupiah(drilldownStreamer.netSalary)}</span>
              </div>
            </div>

            {/* Daily Table Body */}
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-dark-panel border-b-2 border-black text-[10px] font-extrabold text-slate-400 uppercase tracking-wider sticky top-0">
                    <th className="py-2.5 px-3">Tanggal</th>
                    <th className="py-2.5 px-3">Status / Durasi</th>
                    <th className="py-2.5 px-3 text-right">Denda Durasi (30k)</th>
                    <th className="py-2.5 px-3 text-right">Telat Rekap (150k)</th>
                    <th className="py-2.5 px-3 text-right">Absen (60k/sesi)</th>
                    <th className="py-2.5 px-3 text-right">Total Hari Ini</th>
                    <th className="py-2.5 px-3 text-center">Dispensasi Izin WA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {drilldownStreamer.dailyBreakdown?.map((day) => (
                    <tr
                      key={day.dateStr}
                      className={`hover:bg-slate-800/30 transition-colors ${
                        day.isSunday ? 'bg-slate-900/40' : day.totalDayPenalty > 0 ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-mono font-bold text-slate-200">
                        {day.shortDate}
                        {day.isSunday && <span className="ml-1.5 text-[9.5px] text-amber-400 font-normal">(Minggu)</span>}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{day.statusLabel}</span>
                            </div>
                            {day.hasReport && day.liveDuration > 0 && (
                              <span className="text-[10px] text-slate-300 font-mono block mt-0.5">
                                Aktual: {day.liveDuration} Jam Live
                              </span>
                            )}
                            {/* Timestamp Submission */}
                            {!day.isSunday && (
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                {day.submittedAt ? (
                                  <span className="text-[9.5px] text-indigo-300 font-mono flex items-center gap-1 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-500/30">
                                    <Clock className="h-2.5 w-2.5 text-indigo-400" />
                                    <span>Kirim: {formatSubmittedAt(day.submittedAt)}</span>
                                  </span>
                                ) : (
                                  <span className="text-[9.5px] text-rose-400 font-mono flex items-center gap-1 bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-500/30">
                                    <span>❌ Tidak kirim bot</span>
                                  </span>
                                )}

                                {day.rawMessage && day.rawMessage !== '[Manual Input]' && (
                                  <button
                                    onClick={() =>
                                      setViewingRawMessage({
                                        date: day.shortDate,
                                        streamer: drilldownStreamer.nama,
                                        message: day.rawMessage,
                                        time: formatSubmittedAt(day.submittedAt),
                                      })
                                    }
                                    className="text-[9.5px] text-amber-400 hover:text-amber-300 underline font-mono cursor-pointer"
                                    title="Lihat pesan rekapan asli bot"
                                  >
                                    [Lihat Chat]
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {!day.isSunday && (
                            <button
                              onClick={() => handleUpdateDailyLiveDuration(day)}
                              className="px-2 py-1 rounded-lg text-[10.5px] font-extrabold text-indigo-300 bg-indigo-950/60 border border-indigo-500/40 hover:bg-indigo-600 hover:text-white shadow-tactile-xs transition-all flex items-center gap-1 shrink-0"
                              title="Ubah durasi live tanggal ini (otomatis sinkron ke Daily Report & Audit)"
                            >
                              <Edit3 className="h-3 w-3 text-amber-400" />
                              <span>{day.liveDuration > 0 ? `${day.liveDuration} Jam` : 'Set Durasi'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        {day.shortagePenalty > 0 ? (
                          <span className="text-rose-400 font-bold">-{formatRupiah(day.shortagePenalty)}</span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        {day.noReportPenalty > 0 ? (
                          <span className="text-rose-400 font-bold">-{formatRupiah(day.noReportPenalty)}</span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        {day.absentPenalty > 0 ? (
                          <span className="text-rose-400 font-bold">-{formatRupiah(day.absentPenalty)}</span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        {day.totalDayPenalty > 0 ? (
                          <span className="text-rose-400">-{formatRupiah(day.totalDayPenalty)}</span>
                        ) : (
                          <span className="text-emerald-400">Rp 0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {day.isSunday ? (
                          <span className="text-[10px] text-slate-500 font-bold">Libur Rutin</span>
                        ) : day.isExcused ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-[10px] text-amber-400 font-extrabold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">
                              ✅ Izin Sah (Rp 0)
                            </span>
                            <button
                              onClick={() => handleToggleDailyExcuse(day)}
                              className="text-[10px] text-slate-400 hover:text-rose-400 underline ml-1"
                              title="Batalkan Dispensasi Izin"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleToggleDailyExcuse(day)}
                            className="px-2 py-1 rounded text-[10.5px] font-extrabold text-amber-300 bg-amber-950/40 border border-amber-500/40 hover:bg-amber-500 hover:text-black transition-all"
                            title="Tandai izin sah via WA agar bebas denda"
                          >
                            + ACC Izin WA
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t-2 border-black bg-dark-panel flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => generateStreamerAuditWaSlip(drilldownStreamer)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold text-emerald-300 bg-emerald-950/50 border border-emerald-500/50 hover:bg-emerald-600 hover:text-black shadow-tactile-sm transition-all"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Salin Slip WA</span>
                </button>

                <button
                  onClick={() => handleToggleVerify(drilldownStreamer)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all border shadow-tactile-sm ${
                    drilldownStreamer.isVerified
                      ? 'bg-rose-950/40 text-rose-300 border-rose-500/40 hover:bg-rose-600 hover:text-white'
                      : 'bg-emerald-950/50 text-emerald-300 border-emerald-500/50 hover:bg-emerald-600 hover:text-black'
                  }`}
                >
                  {drilldownStreamer.isVerified ? (
                    <>
                      <X className="h-4 w-4" />
                      <span>Batalkan Status Di-Check</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>Tandai Selesai Di-Check</span>
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={() => setDrilldownStreamer(null)}
                className="px-5 py-2 rounded-xl text-xs font-extrabold text-black bg-tactile-yellow border-2 border-black shadow-tactile-sm hover:bg-amber-400"
              >
                Selesai &amp; Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: GANTI PIN KEAMANAN */}
      {showChangePinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-dark-card border-3 border-black rounded-2xl p-6 shadow-tactile-lg relative">
            <div className="flex justify-between items-center pb-3 border-b-2 border-black mb-4">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-amber-400" />
                <span>Ganti PIN Keamanan</span>
              </h3>
              <button
                onClick={() => setShowChangePinModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleChangePin} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                  PIN Lama
                </label>
                <input
                  type="password"
                  required
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value)}
                  placeholder="PIN saat ini"
                  className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs text-center font-mono text-white focus:outline-none shadow-inset-screen"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                  PIN Baru (4 - 12 digit)
                </label>
                <input
                  type="password"
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="PIN baru"
                  className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs text-center font-mono text-white focus:outline-none shadow-inset-screen"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                  Konfirmasi PIN Baru
                </label>
                <input
                  type="password"
                  required
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="Ketik ulang PIN baru"
                  className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs text-center font-mono text-white focus:outline-none shadow-inset-screen"
                />
              </div>

              {changePinError && (
                <div className="text-xs text-rose-400 font-bold text-center">
                  {changePinError}
                </div>
              )}
              {changePinSuccess && (
                <div className="text-xs text-emerald-400 font-bold text-center">
                  {changePinSuccess}
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setShowChangePinModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-dark-panel border-2 border-black hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-extrabold text-black bg-tactile-yellow border-2 border-black shadow-tactile-sm hover:bg-amber-400"
                >
                  Simpan PIN Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AUDIT 2: LIHAT TEKS REKAPAN ASLI BOT */}
      {viewingRawMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-dark-card border-3 border-black rounded-2xl p-6 shadow-tactile-lg relative">
            <div className="flex justify-between items-start pb-3 border-b-2 border-black mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-indigo-400" />
                  <span>Pesan Rekapan Asli: {viewingRawMessage.streamer}</span>
                </h3>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  Tanggal Laporan: {viewingRawMessage.date} • Waktu Kirim: {viewingRawMessage.time || '-'}
                </div>
              </div>
              <button
                onClick={() => setViewingRawMessage(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-dark-panel border-2 border-black rounded-xl p-4 font-mono text-xs text-emerald-300 whitespace-pre-wrap max-h-96 overflow-y-auto shadow-inset-screen">
              {viewingRawMessage.message}
            </div>

            <div className="pt-4 flex justify-end gap-2 border-t-2 border-black mt-4">
              <button
                type="button"
                onClick={() => setViewingRawMessage(null)}
                className="px-5 py-2 rounded-xl text-xs font-extrabold text-black bg-tactile-yellow border-2 border-black shadow-tactile-sm hover:bg-amber-400"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Finance;
