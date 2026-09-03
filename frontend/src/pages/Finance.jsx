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
  Filter,
  Settings,
  ExternalLink,
  MessageCircle
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

  // Date & Period Helpers
  const getCurrentMonthStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const getLastDayOfMonth = (yearMonth) => {
    if (!yearMonth) {
      const d = new Date();
      yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
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

  const getInitialAuditConfig = () => {
    const d = new Date();
    const currentYearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const day = d.getDate();
    // In day 1-15, default to '15th' (Termin 1: 1-15). In day 16+, default to '1st' (Termin 2: 16-akhir).
    const defaultPeriodType = day <= 15 ? '15th' : '1st';
    const dates = getDatesForPeriod(currentYearMonth, defaultPeriodType);
    return {
      month: currentYearMonth,
      type: defaultPeriodType,
      start: dates.start,
      end: dates.end,
    };
  };

  // ==========================================
  // AUTOMATED SALARY & PENALTY AUDIT STATES
  // ==========================================
  const initialAudit = getInitialAuditConfig();
  const [auditPeriodType, setAuditPeriodType] = useState(initialAudit.type); // '15th' | '1st' | 'full' | 'custom'
  const [auditMonth, setAuditMonth] = useState(initialAudit.month);
  const [auditStartDate, setAuditStartDate] = useState(initialAudit.start);
  const [auditEndDate, setAuditEndDate] = useState(initialAudit.end);
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
  // EXCUSE / COMPENSATION REQUESTS & APPROVAL STATES
  // ==========================================
  const [excuseRequests, setExcuseRequests] = useState([]);
  const [excuseStats, setExcuseStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [excuseLoading, setExcuseLoading] = useState(false);
  const [excuseFilterStatus, setExcuseFilterStatus] = useState('Pending'); // 'All' | 'Pending' | 'Approved' | 'Rejected'
  const [excuseSearch, setExcuseSearch] = useState('');
  const [processingExcuseId, setProcessingExcuseId] = useState(null);

  // ==========================================
  // DATA STATES (OTHER TABS)
  // ==========================================
  const [loading, setLoading] = useState(false);

  // Cash Summary & Transactions
  const [cashMonth, setCashMonth] = useState(getCurrentMonthStr());
  const [cashSummary, setCashSummary] = useState({
    total_masuk: 0,
    total_keluar: 0,
    saldo_kas: 0,
    bulan_masuk: 0,
    bulan_keluar: 0,
    bulan_saldo: 0,
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
  const [payrollFilterStatus, setPayrollFilterStatus] = useState('All'); // 'All', 'Paid', 'Pending'
  const [payrollSearch, setPayrollSearch] = useState('');
  const [syncingAudit, setSyncingAudit] = useState(false);
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

  // Finance Rules / SOP Settings
  const [financeRules, setFinanceRules] = useState({
    baseSalary15th: 1000000,
    baseSalaryMonthEnd: 2000000,
    standardLiveDurationHours: 4.0,
    durationShortagePenaltyPerHour: 30000,
    recapDeadlineTime: '08:00',
    noReportPenaltyPerDay: 150000,
    absentPenaltyPerSession: 60000,
    sessionsPerDay: 2,
    signalCutPenaltyPerEvent: 30000,
  });
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [editingRules, setEditingRules] = useState({
    baseSalary15th: 1000000,
    baseSalaryMonthEnd: 2000000,
    standardLiveDurationHours: 4.0,
    durationShortagePenaltyPerHour: 30000,
    recapDeadlineTime: '08:00',
    noReportPenaltyPerDay: 150000,
    absentPenaltyPerSession: 60000,
    sessionsPerDay: 2,
    signalCutPenaltyPerEvent: 30000,
  });
  const [isSavingRules, setIsSavingRules] = useState(false);

  // WhatsApp Slip Preview Modal
  const [previewWaSlip, setPreviewWaSlip] = useState(null);

  // ==========================================
  // HELPERS
  // ==========================================
  const formatMonthName = (monthStr) => {
    if (!monthStr || monthStr === 'All') return 'Semua Periode';
    const parts = monthStr.split('-');
    if (parts.length !== 2) return monthStr;
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const mIndex = parseInt(parts[1], 10) - 1;
    return `${monthNames[mIndex] || parts[1]} ${parts[0]}`;
  };

  const getPreviousMonthStr = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const formatRupiah = (val) => {
    const num = parseFloat(val) || 0;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const fallbackCopyTextToClipboard = (text, key) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = String(text);
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      textArea.style.pointerEvents = 'none';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 1800);
      }
    } catch (err) {
      console.warn('Fallback copy failed:', err);
    }
  };

  const copyToClipboard = (text, key) => {
    if (!text && text !== 0) return;
    const str = String(text);
    if (navigator?.clipboard?.writeText && window.isSecureContext) {
      navigator.clipboard.writeText(str)
        .then(() => {
          setCopiedKey(key);
          setTimeout(() => setCopiedKey(null), 1800);
        })
        .catch(() => {
          fallbackCopyTextToClipboard(str, key);
        });
    } else {
      fallbackCopyTextToClipboard(str, key);
    }
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
        statusIzin: targetStatus ? 'Izin' : 'Normal',
        catatan: note || (targetStatus ? 'Dispensasi Izin WA' : '')
      });
      await fetchPenaltyAudit();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengubah status izin');
    }
  };

  const handleSetDailyCompensation = async (day) => {
    if (!drilldownStreamer) return;
    const defaultShort = day.shortageHours > 0 ? `${day.shortageHours} Jam` : '2 Jam';
    const input = prompt(
      `Masukkan catatan hutang kompensasi jam untuk ${drilldownStreamer.nama} tgl ${day.shortDate}:\n(Contoh: Kurang ${defaultShort} (Kendala akun, janji ganti tgl 16)):`,
      `Kurang ${defaultShort} (Kendala akun, janji ganti hari berikutnya)`
    );
    if (input === null) return; // User cancelled

    try {
      await api.post('/finance/penalty-audit/toggle-excuse', {
        streamerId: drilldownStreamer.streamerId,
        tanggal: day.dateStr,
        statusIzin: 'Kompensasi',
        catatan: input || 'Hutang Kompensasi Jam'
      });
      await fetchPenaltyAudit();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menyimpan catatan kompensasi');
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
    text += `*Ringkasan Denda & Potongan:*\n`;
    
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

    // Detail Per Tanggal (Rincian untuk cross-check streamer)
    const absentDates = s.dailyBreakdown?.filter(d => d.absentPenalty > 0) || [];
    const shortageDates = s.dailyBreakdown?.filter(d => d.shortagePenalty > 0) || [];
    const noReportDates = s.dailyBreakdown?.filter(d => d.noReportPenalty > 0) || [];
    const excuseDates = s.dailyBreakdown?.filter(d => !d.isSunday && (d.isExcused || d.isCompensated)) || [];

    if (absentDates.length > 0 || shortageDates.length > 0 || noReportDates.length > 0) {
      text += `\n📋 *RINCIAN TANGGAL PELANGGARAN:*\n`;
      
      if (absentDates.length > 0) {
        text += `🔴 *Absen / Tidak Live (${absentDates.length} Hari):*\n`;
        absentDates.forEach(d => {
          text += `  - ${d.shortDate} (-${formatRupiah(d.absentPenalty)})\n`;
        });
      }

      if (shortageDates.length > 0) {
        text += `⏱️ *Durasi Kurang (${shortageDates.length} Hari):*\n`;
        shortageDates.forEach(d => {
          text += `  - ${d.shortDate}: Live ${d.liveDuration}h (Kurang -${d.shortageHours}h -> -${formatRupiah(d.shortagePenalty)})\n`;
        });
      }

      if (noReportDates.length > 0) {
        text += `📝 *Telat / Tidak Rekap (${noReportDates.length} Hari):*\n`;
        noReportDates.forEach(d => {
          text += `  - ${d.shortDate} (-${formatRupiah(d.noReportPenalty)})\n`;
        });
      }
    }

    if (excuseDates.length > 0) {
      text += `\n📌 *IZIN & KOMPENSASI DISETUJUI:*\n`;
      excuseDates.forEach(d => {
        text += `  - ${d.shortDate}: ${d.statusLabel || d.catatanIzin || 'Izin Sah'} (Bebas Denda)\n`;
      });
    }

    text += `------------------------------------\n`;
    text += `🔴 *Total Potongan:* -${formatRupiah(s.totalPenalties)}\n`;
    text += `💰 *GAJI BERSIH (TAKE HOME PAY): ${formatRupiah(s.netSalary)}*\n\n`;
    text += `_Mohon dicek kembali rincian tanggal di atas. Jika ada kendala/sanggahan, silakan hubungi admin. Tetap semangat & salam profit! 🚀_`;

    copyToClipboard(text, `audit-wa-${s.streamerId}`);
    setPreviewWaSlip({
      title: 'Slip Gaji & Audit Kedisiplinan',
      recipient: s.nama,
      text,
      key: `audit-wa-${s.streamerId}`
    });
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
        <td style="text-align: center; padding: 3.5px 4px; font-size: 9px;">${idx + 1}</td>
        <td style="padding: 3.5px 6px; font-size: 9.5px; font-weight: 700; color: #0f172a;">
          ${s.nama}
          <div style="font-size: 8px; color: #64748b; font-weight: normal;">${s.bankName} - ${s.bankAccountNumber} (${s.bankAccountHolder})</div>
        </td>
        <td style="text-align: right; padding: 3.5px 6px; font-size: 9px; font-weight: 600;">${formatRupiah(s.baseSalary)}</td>
        <td style="text-align: right; padding: 3.5px 6px; font-size: 9px; color: ${s.shortagePenalty > 0 ? '#be123c' : '#64748b'};">
          ${s.shortagePenalty > 0 ? `-${formatRupiah(s.shortagePenalty)}<br/><span style="font-size: 7.5px;">(${s.totalShortageHours}h)</span>` : '-'}
        </td>
        <td style="text-align: right; padding: 3.5px 6px; font-size: 9px; color: ${s.noReportPenalty > 0 ? '#be123c' : '#64748b'};">
          ${s.noReportPenalty > 0 ? `-${formatRupiah(s.noReportPenalty)}<br/><span style="font-size: 7.5px;">(${s.noReportDaysCount}x)</span>` : '-'}
        </td>
        <td style="text-align: right; padding: 3.5px 6px; font-size: 9px; color: ${s.absentPenalty > 0 ? '#be123c' : '#64748b'};">
          ${s.absentPenalty > 0 ? `-${formatRupiah(s.absentPenalty)}<br/><span style="font-size: 7.5px;">(${s.absentDaysCount}d)</span>` : '-'}
        </td>
        <td style="text-align: right; padding: 3.5px 6px; font-size: 9px; color: ${s.signalCutAmount > 0 ? '#be123c' : '#64748b'};">
          ${s.signalCutAmount > 0 ? `-${formatRupiah(s.signalCutAmount)}<br/><span style="font-size: 7.5px;">(${s.signalCutCount}x)</span>` : '-'}
        </td>
        <td style="text-align: right; padding: 3.5px 6px; font-size: 9px; font-weight: 700; color: ${s.totalPenalties > 0 ? '#be123c' : '#059669'};">
          ${s.totalPenalties > 0 ? `-${formatRupiah(s.totalPenalties)}` : 'Rp 0'}
        </td>
        <td style="text-align: right; padding: 3.5px 6px; font-size: 9.5px; font-weight: 800; color: #047857; background: #f0fdf4;">
          ${formatRupiah(s.netSalary)}
        </td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <title>Casper Signal — Rekap Audit Gaji & Denda Streamer</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #334155; padding: 12px 16px; margin: 0; line-height: 1.25; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #4f46e5; padding-bottom: 6px; margin-bottom: 8px; }
            h1 { font-size: 14px; color: #0f172a; margin: 0; font-weight: 800; text-transform: uppercase; }
            .meta { font-size: 8.5px; color: #64748b; text-align: right; line-height: 1.3; }
            .summary-box { display: flex; gap: 6px; margin-bottom: 8px; }
            .card { flex: 1; border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px 8px; background: #f8fafc; }
            .card-title { font-size: 7.5px; text-transform: uppercase; color: #64748b; font-weight: 700; }
            .card-val { font-size: 11px; font-weight: 800; margin-top: 1px; }
            table { width: 100%; border-collapse: collapse; margin-top: 2px; }
            th { background-color: #f1f5f9; padding: 4px 6px; font-weight: 700; border-bottom: 1.5px solid #94a3b8; text-align: left; text-transform: uppercase; font-size: 7.5px; color: #334155; }
            .rules { background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 5px 8px; font-size: 8px; color: #92400e; margin-top: 8px; line-height: 1.35; page-break-inside: avoid; }
            .rules-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; margin-top: 2px; }
            @media print {
              @page { size: A4 landscape; margin: 5mm 6mm; }
              body { padding: 0; margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Casper Signal BI — Rekap Audit Gaji &amp; Denda Streamer</h1>
              <span style="font-size: 9px; color: #64748b;">Perhitungan Gaji Pokok, SOP Durasi (4h), Denda Rekap/Absen, &amp; Potongan Sinyal</span>
            </div>
            <div class="meta">
              <strong>Tanggal Cetak:</strong> ${todayStr}<br/>
              <strong>Periode Audit:</strong> ${auditStartDate} s/d ${auditEndDate} (${auditPeriodType === '15th' ? 'Termin 1 (Tgl 15)' : auditPeriodType === '1st' ? 'Termin 2 (Akhir Bln)' : 'Full 1 Bulan'}) | <strong>Total:</strong> ${auditData.auditResults.length} Streamer
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
                <th style="text-align: center; width: 22px;">No</th>
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
              <tr style="background: #f8fafc; font-weight: 800; border-top: 1.5px solid #cbd5e1;">
                <td colspan="2" style="padding: 5px; font-size: 8.5px; text-transform: uppercase;">TOTAL KESELURUHAN</td>
                <td style="text-align: right; padding: 5px; font-size: 8.5px;">${formatRupiah(totalBase)}</td>
                <td style="text-align: right; padding: 5px; font-size: 8.5px; color: #be123c;">${formatRupiah(totalShortage)}</td>
                <td style="text-align: right; padding: 5px; font-size: 8.5px; color: #be123c;">${formatRupiah(totalNoReport)}</td>
                <td style="text-align: right; padding: 5px; font-size: 8.5px; color: #be123c;">${formatRupiah(totalAbsent)}</td>
                <td style="text-align: right; padding: 5px; font-size: 8.5px; color: #be123c;">${formatRupiah(totalSignal)}</td>
                <td style="text-align: right; padding: 5px; font-size: 8.5px; color: #be123c;">-${formatRupiah(totalPenaltiesAll)}</td>
                <td style="text-align: right; padding: 5px; font-size: 9.5px; color: #047857; background: #dcfce7;">${formatRupiah(totalNet)}</td>
              </tr>
            </tfoot>
          </table>

          <div class="rules">
            <strong>📌 Ketentuan &amp; Regulasi Penggajian Streamer:</strong>
            <div class="rules-grid">
              <div>
                1. <strong>Gaji Pokok:</strong> Rp 3.000.000 / bulan (Termin 1: Rp 1.000.000, Termin 2: Rp 2.000.000).<br/>
                2. <strong>SOP Live:</strong> 4 Jam / hari. Denda Durasi Kurang = Rp 30.000 / Jam kekurangan.<br/>
                3. <strong>Batas Rekap:</strong> Maksimal Jam 08:00 Pagi. Lupa / Telat Rekap = Denda Rp 150.000 / Hari.
              </div>
              <div>
                4. <strong>Absen / Tidak Live:</strong> Denda Rp 60.000 / Sesi (1 Hari 2 Sesi = Rp 120.000).<br/>
                5. <strong>Pembagian Sinyal:</strong> Potongan Rp 30.000 / kejadian.<br/>
                6. <strong>Izin Sah:</strong> Streamer dengan izin sah yang telah disetujui dibebaskan dari denda (Rp 0).
              </div>
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

  const handleExportPayrollPdf = () => {
    if (!currentPeriodDetail || !currentPeriodDetail.items) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up terblokir. Harap izinkan pop-up untuk mencetak laporan PDF.');
      return;
    }

    const todayStr = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const period = currentPeriodDetail.period;
    const items = currentPeriodDetail.items;

    const totalBase = items.reduce((acc, i) => acc + (parseFloat(i.base_amount) || 0), 0);
    const totalBonus = items.reduce((acc, i) => acc + (parseFloat(i.bonus_amount) || 0), 0);
    const totalDeduction = items.reduce((acc, i) => acc + (parseFloat(i.deduction_amount) || 0), 0);
    const totalFinal = items.reduce((acc, i) => acc + (parseFloat(i.final_amount) || 0), 0);

    const paidItems = items.filter(i => i.status === 'Paid');
    const pendingItems = items.filter(i => i.status !== 'Paid');

    const totalPaid = paidItems.reduce((acc, i) => acc + (parseFloat(i.final_amount) || 0), 0);
    const totalPending = pendingItems.reduce((acc, i) => acc + (parseFloat(i.final_amount) || 0), 0);

    const renderItemRow = (item, idx) => {
      const isPaid = item.status === 'Paid';
      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="text-align: center; padding: 4.5px 5px; font-size: 8.5px; color: #64748b;">${idx + 1}</td>
          <td style="padding: 4.5px 6px; font-size: 9px; font-weight: 700; color: #0f172a;">
            ${item.recipient_name}
            <span style="display: inline-block; margin-left: 3px; padding: 0.5px 3.5px; border-radius: 2px; font-size: 7.5px; font-weight: 600; background: #f1f5f9; color: #475569; text-transform: uppercase;">${item.role}</span>
            ${item.notes ? `<div style="font-size: 7.5px; color: #b45309; font-weight: normal;">• ${item.notes}</div>` : ''}
          </td>
          <td style="padding: 4.5px 6px; font-size: 8.5px; color: #334155;">
            <strong>${item.bank_name || 'BCA'}</strong> ${item.bank_account_number || '-'}<br/>
            <span style="font-size: 7.5px; color: #64748b;">a/n ${item.bank_account_holder || item.recipient_name}</span>
          </td>
          <td style="text-align: right; padding: 4.5px 6px; font-size: 8.5px;">${formatRupiah(item.base_amount)}</td>
          <td style="text-align: right; padding: 4.5px 6px; font-size: 8px;">
            ${parseFloat(item.bonus_amount) > 0 ? `<span style="color: #16a34a; font-weight: 600;">+${formatRupiah(item.bonus_amount)}</span>` : ''}
            ${parseFloat(item.bonus_amount) > 0 && parseFloat(item.deduction_amount) > 0 ? '<br/>' : ''}
            ${parseFloat(item.deduction_amount) > 0 ? `<span style="color: #dc2626; font-weight: 600;">-${formatRupiah(item.deduction_amount)}</span>` : ''}
            ${parseFloat(item.bonus_amount) === 0 && parseFloat(item.deduction_amount) === 0 ? '-' : ''}
          </td>
          <td style="text-align: right; padding: 4.5px 6px; font-size: 9px; font-weight: 700; color: #0f172a;">
            ${formatRupiah(item.final_amount)}
          </td>
          <td style="text-align: center; padding: 4.5px 6px;">
            <span style="display: inline-block; padding: 1.5px 6px; border-radius: 3px; font-size: 8px; font-weight: 700; text-transform: uppercase; ${
              isPaid 
                ? 'background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;' 
                : 'background: #fef3c7; color: #b45309; border: 1px solid #fde68a;'
            }">
              ${isPaid ? '✓ Lunas' : '⏳ Belum Dibayar'}
            </span>
          </td>
        </tr>
      `;
    };

    const rowsHtml = items.map((item, idx) => renderItemRow(item, idx)).join('');

    const html = `
      <html>
        <head>
          <title>Casper Signal — Rekap Penggajian & Kas</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 12px 16px; margin: 0; line-height: 1.3; }
            .header-bar { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 8px; }
            .title { font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin: 0; }
            .subtitle { font-size: 8.5px; color: #64748b; margin-top: 1px; }
            .meta { font-size: 8.5px; color: #475569; text-align: right; line-height: 1.35; }
            .summary-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 10px; margin-bottom: 8px; }
            .summary-item { text-align: left; }
            .summary-label { font-size: 7.5px; text-transform: uppercase; color: #64748b; font-weight: 700; }
            .summary-value { font-size: 10.5px; font-weight: 800; color: #0f172a; margin-top: 1px; }
            table { width: 100%; border-collapse: collapse; margin-top: 2px; }
            th { background: #f1f5f9; padding: 4px 6px; font-weight: 700; border-bottom: 1.5px solid #94a3b8; text-align: left; text-transform: uppercase; font-size: 7.5px; color: #334155; }
            @media print {
              @page { size: A4 portrait; margin: 8mm 10mm; }
              body { padding: 0; margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <h1 class="title">Casper Signal — Rekap Penggajian &amp; Status Transfer</h1>
              <div class="subtitle">Periode: <strong>${period.title}</strong> (${period.period_type === '15th' ? 'Termin 1 - Tgl 15' : 'Termin 2 - Tgl 1'})</div>
            </div>
            <div class="meta">
              <strong>Tgl Cetak:</strong> ${todayStr}<br/>
              <strong>Total Tim:</strong> ${items.length} Orang (${paidItems.length} Lunas / ${pendingItems.length} Belum)
            </div>
          </div>

          <div class="summary-bar">
            <div class="summary-item">
              <div class="summary-label">Total Anggaran</div>
              <div class="summary-value">${formatRupiah(totalFinal)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label" style="color: #166534;">Sudah Ditransfer (Lunas)</div>
              <div class="summary-value" style="color: #166534;">${formatRupiah(totalPaid)} <span style="font-size: 8px; font-weight: normal;">(${paidItems.length} org)</span></div>
            </div>
            <div class="summary-item">
              <div class="summary-label" style="color: #b45309;">Sisa Belum Ditransfer</div>
              <div class="summary-value" style="color: #b45309;">${formatRupiah(totalPending)} <span style="font-size: 8px; font-weight: normal;">(${pendingItems.length} org)</span></div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Saldo Uang Kas (Petty Cash)</div>
              <div class="summary-value">${formatRupiah(cashSummary.saldo_kas)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 22px;">No</th>
                <th>Nama Anggota &amp; Role</th>
                <th>Rekening Bank Tujuan</th>
                <th style="text-align: right;">Gaji Pokok</th>
                <th style="text-align: right;">Bonus / Potongan</th>
                <th style="text-align: right; background: #e2e8f0;">Total Transfer</th>
                <th style="text-align: center; width: 120px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr style="background: #f8fafc; font-weight: 800; border-top: 1.5px solid #0f172a;">
                <td colspan="3" style="padding: 5px; font-size: 8.5px; text-transform: uppercase;">TOTAL KESELURUHAN</td>
                <td style="text-align: right; padding: 5px; font-size: 8.5px;">${formatRupiah(totalBase)}</td>
                <td style="text-align: right; padding: 5px; font-size: 8px;">
                  ${totalBonus > 0 ? `+${formatRupiah(totalBonus)}` : ''} 
                  ${totalDeduction > 0 ? `-${formatRupiah(totalDeduction)}` : ''}
                </td>
                <td style="text-align: right; padding: 5px; font-size: 9.5px; color: #0f172a; background: #e2e8f0;">${formatRupiah(totalFinal)}</td>
                <td style="text-align: center; padding: 5px; font-size: 8px; color: #166534;">
                  ${paidItems.length} Lunas / ${pendingItems.length} Pending
                </td>
              </tr>
            </tfoot>
          </table>

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

  const handleExportCashPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up terblokir. Harap izinkan pop-up untuk mencetak laporan PDF.');
      return;
    }

    const todayStr = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const filteredTx = transactions.filter(t => {
      if (cashFilterType === 'Masuk' && t.tipe !== 'Masuk') return false;
      if (cashFilterType === 'Keluar' && t.tipe !== 'Keluar') return false;
      if (cashSearch) {
        const q = cashSearch.toLowerCase();
        return (
          t.keterangan?.toLowerCase().includes(q) ||
          t.kategori?.toLowerCase().includes(q) ||
          t.created_by?.toLowerCase().includes(q)
        );
      }
      return true;
    });

    const totalMasukFiltered = filteredTx.filter(t => t.tipe === 'Masuk').reduce((a, b) => a + parseFloat(b.nominal || 0), 0);
    const totalKeluarFiltered = filteredTx.filter(t => t.tipe === 'Keluar').reduce((a, b) => a + parseFloat(b.nominal || 0), 0);
    const netFlowFiltered = totalMasukFiltered - totalKeluarFiltered;
    const periodLabel = formatMonthName(cashMonth);

    const rowsHtml = filteredTx.map((tx, idx) => {
      const isIncome = tx.tipe === 'Masuk';
      const dateFormatted = new Date(tx.tanggal).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="text-align: center; padding: 4.5px 5px; font-size: 8.5px; color: #64748b;">${idx + 1}</td>
          <td style="padding: 4.5px 6px; font-size: 8.5px; font-family: monospace;">${dateFormatted}</td>
          <td style="text-align: center; padding: 4.5px 6px;">
            <span style="display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 8px; font-weight: 700; text-transform: uppercase; ${
              isIncome 
                ? 'background: #dcfce7; color: #166534;' 
                : 'background: #fee2e2; color: #991b1b;'
            }">
              ${isIncome ? '🟢 Kas Masuk' : '🔴 Pengeluaran'}
            </span>
          </td>
          <td style="padding: 4.5px 6px; font-size: 8.5px; font-weight: 700; color: #1e293b;">${tx.kategori}</td>
          <td style="padding: 4.5px 6px; font-size: 8.5px; color: #334155;">${tx.keterangan || '-'}</td>
          <td style="padding: 4.5px 6px; font-size: 8px; color: #64748b;">${tx.created_by || 'Admin'}</td>
          <td style="text-align: right; padding: 4.5px 6px; font-size: 9px; font-weight: 700; font-family: monospace; color: ${isIncome ? '#166534' : '#991b1b'};">
            ${isIncome ? '+' : '-'}${formatRupiah(tx.nominal)}
          </td>
        </tr>
      `;
    }).join('');

    const html = `
      <html>
        <head>
          <title>Casper Signal — Laporan Uang Kas & Pengeluaran (${periodLabel})</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 12px 16px; margin: 0; line-height: 1.3; }
            .header-bar { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 8px; }
            .title { font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin: 0; }
            .subtitle { font-size: 8.5px; color: #64748b; margin-top: 1px; }
            .meta { font-size: 8.5px; color: #475569; text-align: right; line-height: 1.35; }
            .summary-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 10px; margin-bottom: 8px; }
            .summary-item { text-align: left; }
            .summary-label { font-size: 7.5px; text-transform: uppercase; color: #64748b; font-weight: 700; }
            .summary-value { font-size: 10.5px; font-weight: 800; color: #0f172a; margin-top: 1px; }
            table { width: 100%; border-collapse: collapse; margin-top: 2px; }
            th { background: #f1f5f9; padding: 4px 6px; font-weight: 700; border-bottom: 1.5px solid #94a3b8; text-align: left; text-transform: uppercase; font-size: 7.5px; color: #334155; }
            @media print {
              @page { size: A4 portrait; margin: 8mm 10mm; }
              body { padding: 0; margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <h1 class="title">Casper Signal — Laporan Uang Kas &amp; Pengeluaran</h1>
              <div class="subtitle">Periode: <strong>${periodLabel}</strong> • Mutasi Petty Cash &amp; Pengeluaran Operasional</div>
            </div>
            <div class="meta">
              <strong>Tgl Cetak:</strong> ${todayStr}<br/>
              <strong>Filter:</strong> ${cashFilterType === 'All' ? 'Semua Transaksi' : cashFilterType === 'Masuk' ? 'Hanya Kas Masuk' : 'Hanya Pengeluaran'} (${filteredTx.length} baris)
            </div>
          </div>

          <div class="summary-bar">
            <div class="summary-item">
              <div class="summary-label">Kas Masuk (${periodLabel})</div>
              <div class="summary-value" style="color: #166534;">${formatRupiah(totalMasukFiltered)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Pengeluaran (${periodLabel})</div>
              <div class="summary-value" style="color: #991b1b;">${formatRupiah(totalKeluarFiltered)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Arus Bersih (${periodLabel})</div>
              <div class="summary-value" style="color: ${netFlowFiltered >= 0 ? '#166534' : '#991b1b'};">
                ${netFlowFiltered >= 0 ? '+' : ''}${formatRupiah(netFlowFiltered)}
              </div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Saldo Akumulasi Kas</div>
              <div class="summary-value" style="color: ${cashSummary.saldo_kas < 0 ? '#991b1b' : '#0f172a'};">${formatRupiah(cashSummary.saldo_kas)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 22px;">No</th>
                <th style="width: 75px;">Tanggal</th>
                <th style="text-align: center; width: 95px;">Tipe</th>
                <th>Kategori</th>
                <th>Keterangan</th>
                <th style="width: 85px;">Pencatat</th>
                <th style="text-align: right; width: 110px;">Nominal</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTx.length === 0 ? `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 15px; color: #94a3b8; font-style: italic;">
                    Tidak ada catatan transaksi uang kas untuk periode ${periodLabel}.
                  </td>
                </tr>
              ` : rowsHtml}
            </tbody>
            <tfoot>
              <tr style="background: #f8fafc; font-weight: 800; border-top: 1.5px solid #0f172a;">
                <td colspan="3" style="padding: 5px; font-size: 8.5px; text-transform: uppercase;">TOTAL PERIODE INI</td>
                <td colspan="3" style="padding: 5px; font-size: 8px; color: #64748b;">
                  Masuk: <strong style="color: #166534;">+${formatRupiah(totalMasukFiltered)}</strong> | 
                  Keluar: <strong style="color: #991b1b;">-${formatRupiah(totalKeluarFiltered)}</strong>
                </td>
                <td style="text-align: right; padding: 5px; font-size: 9.5px; color: #0f172a; background: #e2e8f0;">
                  ${formatRupiah(netFlowFiltered)}
                </td>
              </tr>
            </tfoot>
          </table>

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

  const fetchFinanceRules = async () => {
    try {
      const res = await api.get('/finance/rules');
      if (res.data?.rules) {
        setFinanceRules(res.data.rules);
      }
    } catch (err) {
      console.error('Error fetching finance rules:', err);
    }
  };

  const handleSaveFinanceRules = async (e) => {
    e.preventDefault();
    setIsSavingRules(true);
    try {
      const res = await api.post('/finance/rules', { rules: editingRules });
      if (res.data?.success) {
        setFinanceRules(res.data.rules);
        setShowRulesModal(false);
        await fetchPenaltyAudit(auditStartDate, auditEndDate, auditPeriodType);
      }
    } catch (err) {
      console.error('Error saving finance rules:', err);
      alert(err.response?.data?.message || 'Gagal menyimpan ketentuan aturan.');
    } finally {
      setIsSavingRules(false);
    }
  };

  const fetchAllData = async () => {
    if (!isUnlocked) return;
    setLoading(true);
    try {
      await Promise.all([
        fetchFinanceRules(),
        fetchPenaltyAudit(),
        fetchCashSummary(cashMonth),
        fetchTransactions(cashMonth, cashFilterType, cashSearch),
        fetchProfiles(),
        fetchPeriods(),
      ]);
    } catch (err) {
      console.error('Error loading finance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCashSummary = async (targetMonth = cashMonth) => {
    try {
      const res = await api.get('/finance/cash/summary', {
        params: { month: targetMonth },
      });
      setCashSummary(res.data);
    } catch (err) {
      console.error('Error fetching cash summary:', err);
    }
  };

  const fetchTransactions = async (targetMonth = cashMonth, targetType = cashFilterType, targetSearch = cashSearch) => {
    try {
      const res = await api.get('/finance/cash/transactions', {
        params: {
          tipe: targetType,
          search: targetSearch,
          month: targetMonth,
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

  const fetchExcuseRequests = async () => {
    try {
      setExcuseLoading(true);
      const res = await api.get('/excuses/list');
      setExcuseRequests(res.data.requests || []);
      setExcuseStats(res.data.stats || { pending: 0, approved: 0, rejected: 0, total: 0 });
    } catch (err) {
      console.error('Failed to fetch excuse requests:', err);
    } finally {
      setExcuseLoading(false);
    }
  };

  const handleApproveExcuse = async (req) => {
    if (!window.confirm(`Setujui (ACC) permohonan izin ${req.streamerNama} untuk tanggal ${req.tanggalIzin}?\n\nDenda durasi & rekap pada tanggal ini otomatis menjadi Rp 0 (Bebas Denda).`)) {
      return;
    }
    try {
      setProcessingExcuseId(req.id);
      const res = await api.post(`/excuses/approve/${req.id}`, { adminNotes: 'Disetujui Admin via Web Hub' });
      alert(res.data.message || 'Izin berhasil disetujui');
      await fetchExcuseRequests();
      await fetchPenaltyAudit();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menyetujui izin');
    } finally {
      setProcessingExcuseId(null);
    }
  };

  const handleRejectExcuse = async (req) => {
    const reason = prompt(`Masukkan alasan penolakan izin ${req.streamerNama} tgl ${req.tanggalIzin} (denda tetap berlaku):`, 'Tidak memenuhi syarat izin');
    if (reason === null) return;
    try {
      setProcessingExcuseId(req.id);
      const res = await api.post(`/excuses/reject/${req.id}`, { adminNotes: reason || 'Ditolak Admin' });
      alert(res.data.message || 'Izin ditolak');
      await fetchExcuseRequests();
      await fetchPenaltyAudit();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menolak izin');
    } finally {
      setProcessingExcuseId(null);
    }
  };

  const handleCopyFormLink = () => {
    const url = `${window.location.origin}/form-izin`;
    copyToClipboard(url, 'form-izin-link');
    alert(`Link Form Pengajuan Izin Streamer berhasil disalin:\n\n${url}\n\nSilakan bagikan link ini ke grup streamer agar mereka bisa mengisi kendala akun/izin secara langsung!`);
  };

  useEffect(() => {
    if (isUnlocked) {
      fetchAllData();
      fetchExcuseRequests();
    }
  }, [isUnlocked]);

  useEffect(() => {
    if (isUnlocked) {
      fetchTransactions(cashMonth, cashFilterType, cashSearch);
      fetchCashSummary(cashMonth);
    }
  }, [cashFilterType, cashSearch, cashMonth, isUnlocked]);

  useEffect(() => {
    if (selectedPeriodId && isUnlocked) {
      fetchPeriodDetail(selectedPeriodId);
    }
  }, [selectedPeriodId, isUnlocked]);

  // ==========================================
  // CASH TRANSACTIONS HANDLERS
  // ==========================================
  const handleOpenCashModal = (type, tx = null) => {
    if (tx) {
      setCashModalType(tx.tipe);
      setCashForm({
        id: tx.id,
        tanggal: new Date(tx.tanggal).toISOString().split('T')[0],
        tipe: tx.tipe,
        kategori: tx.kategori || (tx.tipe === 'Masuk' ? 'Suntikan Kas Bos' : 'Operasional'),
        nominal: formatInputNominal(String(tx.nominal || '')),
        keterangan: tx.keterangan || '',
      });
    } else {
      setCashModalType(type);
      setCashForm({
        id: null,
        tanggal: new Date().toISOString().split('T')[0],
        tipe: type,
        kategori: type === 'Masuk' ? 'Suntikan Kas Bos' : 'Operasional',
        nominal: '',
        keterangan: '',
      });
    }
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
      if (cashForm.id) {
        await api.put(`/finance/cash/transactions/${cashForm.id}`, {
          ...cashForm,
          nominal: cleanNominal,
        });
      } else {
        await api.post('/finance/cash/transactions', {
          ...cashForm,
          nominal: cleanNominal,
        });
      }
      setShowCashModal(false);
      fetchTransactions(cashMonth, cashFilterType, cashSearch);
      fetchCashSummary(cashMonth);
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menyimpan transaksi kas');
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!window.confirm('Yakin ingin menghapus catatan transaksi ini?')) return;
    try {
      await api.delete(`/finance/cash/transactions/${id}`);
      fetchTransactions(cashMonth, cashFilterType, cashSearch);
      fetchCashSummary(cashMonth);
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

  const handleSyncAuditToPayroll = async (periodId) => {
    if (!periodId) return;
    const period = periods.find((p) => p.id === periodId);
    const periodTitle = period?.title || 'Periode Ini';

    if (!window.confirm(`Tarik dan sinkronkan otomatis seluruh potongan denda streamer dari hasil Audit ke "${periodTitle}"?\n\nNominal denda, kekurangan jam, dan rincian denda akan otomatis masuk ke tabel penggajian.`)) {
      return;
    }

    try {
      setSyncingAudit(true);
      const res = await api.post(`/finance/periods/${periodId}/sync-audit`, {
        startDate: auditStartDate,
        endDate: auditEndDate,
        periodType: auditPeriodType,
      });
      alert(res.data.message || 'Berhasil mensinkronkan denda dari hasil audit!');
      await fetchPeriodDetail(periodId);
      await fetchPeriods();
      await fetchCashSummary();
    } catch (err) {
      console.error('Failed to sync audit to payroll:', err);
      alert(err.response?.data?.message || 'Gagal mensinkronkan denda dari audit');
    } finally {
      setSyncingAudit(false);
    }
  };

  const handleApplyAuditToSelectedPayroll = async () => {
    if (periods.length === 0) {
      alert('Belum ada periode penggajian yang dibuat. Silakan buat periode penggajian terlebih dahulu di tab Penggajian.');
      return;
    }

    const targetPeriod = selectedPeriodId ? periods.find((p) => p.id === selectedPeriodId) : periods[0];
    if (!targetPeriod) return;

    if (!window.confirm(`Terapkan hasil audit periode ${auditStartDate} s/d ${auditEndDate} ke siklus penggajian:\n"${targetPeriod.title}"?\n\nSeluruh potongan denda dan bonus streamer akan otomatis disinkronkan.`)) {
      return;
    }

    try {
      setSyncingAudit(true);
      const res = await api.post(`/finance/periods/${targetPeriod.id}/sync-audit`, {
        startDate: auditStartDate,
        endDate: auditEndDate,
        periodType: auditPeriodType,
      });
      alert(res.data.message || 'Hasil audit berhasil diterapkan ke siklus penggajian!');
      await fetchPeriodDetail(targetPeriod.id);
      await fetchPeriods();
      await fetchCashSummary();
      setActiveTab('payroll');
    } catch (err) {
      console.error('Failed to apply audit to payroll:', err);
      alert(err.response?.data?.message || 'Gagal menerapkan audit ke penggajian');
    } finally {
      setSyncingAudit(false);
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
    setPreviewWaSlip({
      title: `Slip Gaji — ${title}`,
      recipient: item.recipient_name,
      text,
      key: `wa-${item.id}`
    });
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

        <button
          onClick={() => {
            setActiveTab('excuses');
            fetchExcuseRequests();
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all border-2 ${activeTab === 'excuses'
            ? 'bg-tactile-yellow text-black border-black shadow-tactile-sm -translate-y-0.5'
            : 'bg-dark-panel text-slate-400 border-black hover:text-white hover:bg-slate-800'
            }`}
        >
          <FileText className="h-4 w-4 text-cyan-400" />
          <span>📋 Persetujuan Izin Streamer</span>
          {excuseStats.pending > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
              {excuseStats.pending} Menunggu
            </span>
          )}
        </button>
      </div>

      {/* ============================================================
          TAB 0: AUTOMATED SALARY & PENALTY AUDIT
          ============================================================ */}
      {activeTab === 'audit' && (
        <div className="space-y-6 animate-fade-in">
          {/* PENDING EXCUSES ALERT BANNER */}
          {excuseStats.pending > 0 && (
            <div className="bg-amber-950/40 border-2 border-amber-500/50 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-tactile-sm animate-fade-in">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                  <AlertCircle className="h-5 w-5 animate-bounce" />
                </span>
                <div>
                  <div className="font-extrabold text-sm text-white flex items-center gap-2">
                    <span>Ada {excuseStats.pending} Pengajuan Izin Streamer Menunggu Persetujuan (ACC)!</span>
                  </div>
                  <p className="text-xs text-amber-200/80">
                    Streamer mengisi permohonan via Form Izin. Silakan tinjau dan ACC agar denda otomatis disesuaikan (Rp 0).
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveTab('excuses');
                  fetchExcuseRequests();
                }}
                className="px-4 py-2 rounded-xl text-xs font-black text-black bg-tactile-yellow hover:bg-amber-400 border-2 border-black shadow-tactile-xs shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Buka Antrean ACC ({excuseStats.pending})</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

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
                  onClick={handleApplyAuditToSelectedPayroll}
                  disabled={!auditData || auditLoading || syncingAudit}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold text-black bg-tactile-yellow border-2 border-black shadow-tactile-sm hover:bg-amber-400 hover:-translate-y-0.5 active:translate-y-0.5 transition-all disabled:opacity-50"
                  title="Terapkan dan kirim seluruh hasil potongan denda audit ini langsung ke siklus Penggajian"
                >
                  <Sparkles className={`h-4 w-4 ${syncingAudit ? 'animate-spin' : ''}`} />
                  <span>{syncingAudit ? 'Menerapkan...' : 'Terapkan ke Payroll'}</span>
                </button>

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
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs font-extrabold text-amber-400 uppercase tracking-wider">
                <ShieldCheck className="h-4 w-4" />
                <span>Ketentuan Skema Gaji &amp; Aturan Denda Otomatis</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-amber-400/20 text-amber-300 font-bold px-2 py-0.5 rounded-md border border-amber-400/30">
                  SOP Aktif
                </span>
                <button
                  onClick={() => {
                    setEditingRules({ ...financeRules });
                    setShowRulesModal(true);
                  }}
                  className="flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1 bg-amber-400 text-black border-2 border-black rounded-xl shadow-tactile-sm hover:bg-amber-300 active:scale-95 transition-all"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Ubah Ketentuan SOP</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 text-[11px] text-slate-300 pt-1">
              <div className="bg-dark-card/80 border border-slate-700/60 rounded-xl p-2.5">
                <div className="font-extrabold text-white mb-0.5">💰 Gaji Pokok {((financeRules.baseSalary15th + financeRules.baseSalaryMonthEnd) / 1000000).toLocaleString('id-ID')} Juta</div>
                <div className="text-[10px] text-slate-400">Tgl 15: {formatRupiah(financeRules.baseSalary15th)} • Akhir Bln: {formatRupiah(financeRules.baseSalaryMonthEnd)}</div>
              </div>
              <div className="bg-dark-card/80 border border-slate-700/60 rounded-xl p-2.5">
                <div className="font-extrabold text-rose-300 mb-0.5">⏱️ Durasi SOP {financeRules.standardLiveDurationHours} Jam</div>
                <div className="text-[10px] text-slate-400">Kurang durasi: -{formatRupiah(financeRules.durationShortagePenaltyPerHour)} / Jam</div>
              </div>
              <div className="bg-dark-card/80 border border-slate-700/60 rounded-xl p-2.5">
                <div className="font-extrabold text-rose-300 mb-0.5">📝 Batas Rekap {financeRules.recapDeadlineTime}</div>
                <div className="text-[10px] text-slate-400">Telat: -{formatRupiah(financeRules.noReportPenaltyPerDay)} (Bebas denda durasi)</div>
              </div>
              <div className="bg-dark-card/80 border border-slate-700/60 rounded-xl p-2.5">
                <div className="font-extrabold text-rose-300 mb-0.5">🚫 Absen / Bolos</div>
                <div className="text-[10px] text-slate-400">Tidak live: -{formatRupiah(financeRules.absentPenaltyPerSession)} / Sesi ({financeRules.sessionsPerDay} sesi = -{formatRupiah(financeRules.absentPenaltyPerSession * financeRules.sessionsPerDay)})</div>
              </div>
              <div className="bg-dark-card/80 border border-slate-700/60 rounded-xl p-2.5">
                <div className="font-extrabold text-amber-300 mb-0.5">📉 Pembagian Sinyal</div>
                <div className="text-[10px] text-slate-400">Potongan: -{formatRupiah(financeRules.signalCutPenaltyPerEvent)} / kejadian</div>
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
              {currentPeriodDetail && (
                <button
                  onClick={() => handleSyncAuditToPayroll(currentPeriodDetail.period.id)}
                  disabled={syncingAudit}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold text-amber-300 bg-amber-950/40 border-2 border-amber-500/50 hover:bg-amber-400 hover:text-black shadow-tactile-sm transition-all disabled:opacity-50"
                  title="Tarik & sinkronkan otomatis potongan denda streamer dari hasil Audit Denda"
                >
                  <Sparkles className={`h-4 w-4 ${syncingAudit ? 'animate-spin' : 'text-amber-400'}`} />
                  <span>{syncingAudit ? 'Menyinkronkan...' : 'Sinkronkan Denda Audit'}</span>
                </button>
              )}

              {currentPeriodDetail && (
                <button
                  onClick={handleExportPayrollPdf}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold text-indigo-300 bg-indigo-950/40 border-2 border-indigo-500/40 hover:bg-indigo-600 hover:text-white shadow-tactile-sm transition-all"
                  title="Cetak / Export PDF Laporan Penggajian & Kas"
                >
                  <Printer className="h-4 w-4" />
                  <span>Cetak / Export PDF</span>
                </button>
              )}

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
                <div className="p-4 border-b-2 border-black flex flex-col md:flex-row md:items-center justify-between gap-3 bg-dark-panel">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <span>📋 Daftar Penerima Gaji</span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px]">
                        {currentPeriodDetail.items.length} Orang
                      </span>
                    </h3>

                    {/* Filter Status: All / Paid / Pending */}
                    <div className="flex items-center bg-dark-card border-2 border-black rounded-xl p-0.5 shadow-inset-screen ml-1">
                      <button
                        onClick={() => setPayrollFilterStatus('All')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all ${
                          payrollFilterStatus === 'All'
                            ? 'bg-tactile-yellow text-black shadow-tactile-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Semua ({currentPeriodDetail.items.length})
                      </button>
                      <button
                        onClick={() => setPayrollFilterStatus('Paid')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all ${
                          payrollFilterStatus === 'Paid'
                            ? 'bg-emerald-500 text-black shadow-tactile-sm'
                            : 'text-emerald-400 hover:text-emerald-300'
                        }`}
                      >
                        ✓ Lunas ({currentPeriodDetail.items.filter((i) => i.status === 'Paid').length})
                      </button>
                      <button
                        onClick={() => setPayrollFilterStatus('Pending')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all ${
                          payrollFilterStatus === 'Pending'
                            ? 'bg-amber-400 text-black shadow-tactile-sm'
                            : 'text-amber-400 hover:text-amber-300'
                        }`}
                      >
                        ⏳ Belum Dibayar ({currentPeriodDetail.items.filter((i) => i.status !== 'Paid').length})
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Cari penerima / rekening..."
                        value={payrollSearch}
                        onChange={(e) => setPayrollSearch(e.target.value)}
                        className="bg-dark-card border-2 border-black rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-inset-screen w-48"
                      />
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                    </div>

                    <button
                      onClick={handleExportPayrollPdf}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-extrabold text-indigo-300 bg-indigo-950/40 border-2 border-indigo-500/40 hover:bg-indigo-600 hover:text-white shadow-tactile-sm transition-all shrink-0"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>Export PDF</span>
                    </button>
                  </div>
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
                      {(() => {
                        const filtered = currentPeriodDetail.items.filter((item) => {
                          if (payrollFilterStatus === 'Paid' && item.status !== 'Paid') return false;
                          if (payrollFilterStatus === 'Pending' && item.status === 'Paid') return false;
                          if (payrollSearch) {
                            const q = payrollSearch.toLowerCase();
                            return (
                              item.recipient_name?.toLowerCase().includes(q) ||
                              item.role?.toLowerCase().includes(q) ||
                              item.bank_name?.toLowerCase().includes(q) ||
                              item.bank_account_number?.toLowerCase().includes(q) ||
                              item.notes?.toLowerCase().includes(q)
                            );
                          }
                          return true;
                        });

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan="7" className="text-center py-8 text-slate-500">
                                Tidak ada data penerima gaji sesuai filter status / pencarian.
                              </td>
                            </tr>
                          );
                        }

                        return filtered.map((item) => {
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
                        });
                      })()}
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
          {/* Action & Filter Bar */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-dark-card border-2 border-black rounded-2xl p-4 shadow-tactile-sm">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Month Filter Picker */}
              <div className="flex items-center gap-1.5 bg-dark-panel border-2 border-black rounded-xl px-3 py-1.5 shadow-inset-screen">
                <Calendar className="h-4 w-4 text-indigo-400 shrink-0" />
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Bulan:</span>
                <input
                  type="month"
                  value={cashMonth === 'All' ? '' : cashMonth}
                  onChange={(e) => setCashMonth(e.target.value || 'All')}
                  className="bg-transparent text-white font-black text-xs focus:outline-none cursor-pointer"
                />
              </div>

              {/* Quick Month Presets */}
              <div className="flex items-center bg-dark-panel border-2 border-black rounded-xl p-1 shadow-inset-screen text-xs">
                <button
                  onClick={() => setCashMonth(getCurrentMonthStr())}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all ${
                    cashMonth === getCurrentMonthStr()
                      ? 'bg-indigo-600 text-white shadow-tactile-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Bulan Ini
                </button>
                <button
                  onClick={() => setCashMonth(getPreviousMonthStr())}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all ${
                    cashMonth === getPreviousMonthStr()
                      ? 'bg-indigo-600 text-white shadow-tactile-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Bulan Lalu
                </button>
                <button
                  onClick={() => setCashMonth('All')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all ${
                    cashMonth === 'All'
                      ? 'bg-indigo-600 text-white shadow-tactile-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Semua
                </button>
              </div>

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
                    {t === 'All' ? 'Semua Tipe' : t === 'Masuk' ? '🟢 Kas Masuk' : '🔴 Pengeluaran'}
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
                  className="bg-dark-panel border-2 border-black rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-inset-screen w-48"
                />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleExportCashPdf}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold text-indigo-300 bg-indigo-950/40 border-2 border-indigo-500/40 hover:bg-indigo-600 hover:text-white shadow-tactile-sm transition-all cursor-pointer"
                title="Cetak / Download Laporan PDF Arus Uang Kas Bulan Ini"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak Laporan Bulanan</span>
              </button>

              <button
                onClick={() => handleOpenCashModal('Masuk')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold text-emerald-300 bg-emerald-950/40 border-2 border-emerald-500/40 hover:bg-emerald-500 hover:text-black shadow-tactile-sm transition-all cursor-pointer"
              >
                <ArrowDownLeft className="h-4 w-4" />
                <span>+ Kas Masuk (Bos)</span>
              </button>

              <button
                onClick={() => handleOpenCashModal('Keluar')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold text-rose-300 bg-rose-950/40 border-2 border-rose-500/40 hover:bg-rose-500 hover:text-black shadow-tactile-sm transition-all cursor-pointer"
              >
                <ArrowUpRight className="h-4 w-4" />
                <span>+ Pengeluaran</span>
              </button>
            </div>
          </div>

          {/* Monthly Mini Stats Card Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-dark-panel/60 border-2 border-black rounded-2xl p-4 shadow-inset-screen">
            <div className="p-3 bg-dark-card border border-slate-800 rounded-xl">
              <div className="text-[10px] uppercase font-bold text-slate-400">Periode Terpilih</div>
              <div className="text-sm font-extrabold text-indigo-400 mt-0.5 truncate">
                {formatMonthName(cashMonth)}
              </div>
            </div>
            <div className="p-3 bg-dark-card border border-slate-800 rounded-xl">
              <div className="text-[10px] uppercase font-bold text-emerald-400">Kas Masuk Periode</div>
              <div className="text-sm font-black text-emerald-400 mt-0.5">
                +{formatRupiah(cashSummary.bulan_masuk)}
              </div>
            </div>
            <div className="p-3 bg-dark-card border border-slate-800 rounded-xl">
              <div className="text-[10px] uppercase font-bold text-rose-400">Pengeluaran Periode</div>
              <div className="text-sm font-black text-rose-400 mt-0.5">
                -{formatRupiah(cashSummary.bulan_keluar)}
              </div>
            </div>
            <div className="p-3 bg-dark-card border border-slate-800 rounded-xl">
              <div className="text-[10px] uppercase font-bold text-slate-400">Arus Bersih Periode</div>
              <div className={`text-sm font-black mt-0.5 ${
                (cashSummary.bulan_saldo || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {(cashSummary.bulan_saldo || 0) >= 0 ? '+' : ''}{formatRupiah(cashSummary.bulan_saldo || 0)}
              </div>
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
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenCashModal(tx.tipe, tx)}
                                className="p-1.5 rounded-lg bg-dark-panel border border-slate-700 text-slate-400 hover:text-amber-400 hover:bg-amber-950/20 transition-all cursor-pointer"
                                title="Edit Transaksi Kas"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(tx.id)}
                                className="p-1.5 rounded-lg bg-dark-panel border border-slate-700 text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 transition-all cursor-pointer"
                                title="Hapus Transaksi"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
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
          TAB 4: PUSAT APPROVAL & PERSETUJUAN IZIN STREAMER
          ============================================================ */}
      {activeTab === 'excuses' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header & Link Share Bar */}
          <div className="bg-dark-card border-2 border-black rounded-2xl p-5 shadow-tactile-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-950/80 text-cyan-400 border border-cyan-500/30">
                  <FileText className="h-4 w-4" />
                </span>
                <h2 className="text-base font-extrabold text-white uppercase tracking-wide">
                  Pusat Persetujuan Izin &amp; Kompensasi Streamer
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Semua permohonan kendala akun, sakit, dan kompensasi jam dari Google Form Streamer masuk ke sini. Klik <strong>ACC (Setujui)</strong> agar denda otomatis Rp 0 di rekapan gaji.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handleCopyFormLink}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-black bg-tactile-yellow border-2 border-black shadow-tactile-sm hover:bg-amber-400 transition-all cursor-pointer"
                title="Salin link Google Form khusus streamer untuk dibagikan ke grup"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Salin Link Form Izin</span>
              </button>

              <a
                href="/form-izin"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-300 bg-dark-panel border-2 border-black hover:text-white hover:bg-slate-800 shadow-tactile-sm transition-all"
                title="Buka form izin di tab baru"
              >
                <ArrowUpRight className="h-3.5 w-3.5 text-cyan-400" />
                <span>Buka Form</span>
              </a>

              <button
                onClick={fetchExcuseRequests}
                disabled={excuseLoading}
                className="p-2 rounded-xl text-xs font-bold text-slate-300 bg-dark-panel border-2 border-black hover:text-white hover:bg-slate-800 shadow-tactile-sm transition-all disabled:opacity-50"
                title="Muat ulang permohonan"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-indigo-400 ${excuseLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-dark-card border-2 border-black rounded-2xl p-4 shadow-tactile-sm">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase">Total Pengajuan</span>
              <div className="text-xl font-black text-white mt-1">{excuseStats.total}</div>
            </div>

            <div className={`border-2 border-black rounded-2xl p-4 shadow-tactile-sm ${excuseStats.pending > 0 ? 'bg-amber-950/30 ring-2 ring-amber-500/40' : 'bg-dark-card'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-amber-400 uppercase">Menunggu ACC</span>
                {excuseStats.pending > 0 && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
              </div>
              <div className="text-xl font-black text-amber-300 mt-1">{excuseStats.pending}</div>
            </div>

            <div className="bg-dark-card border-2 border-black rounded-2xl p-4 shadow-tactile-sm">
              <span className="text-[10px] font-extrabold text-emerald-400 uppercase">Disetujui (ACC)</span>
              <div className="text-xl font-black text-emerald-400 mt-1">{excuseStats.approved}</div>
            </div>

            <div className="bg-dark-card border-2 border-black rounded-2xl p-4 shadow-tactile-sm">
              <span className="text-[10px] font-extrabold text-rose-400 uppercase">Ditolak</span>
              <div className="text-xl font-black text-rose-400 mt-1">{excuseStats.rejected}</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-dark-card border-2 border-black rounded-2xl p-4 shadow-tactile-sm">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {['Pending', 'All', 'Approved', 'Rejected'].map((st) => (
                <button
                  key={st}
                  onClick={() => setExcuseFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all border ${
                    excuseFilterStatus === st
                      ? 'bg-tactile-yellow text-black border-black shadow-tactile-xs'
                      : 'bg-dark-panel text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {st === 'Pending' ? `Menunggu ACC (${excuseStats.pending})` : st === 'All' ? `Semua (${excuseStats.total})` : st === 'Approved' ? `Disetujui (${excuseStats.approved})` : `Ditolak (${excuseStats.rejected})`}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={excuseSearch}
                onChange={(e) => setExcuseSearch(e.target.value)}
                placeholder="Cari nama streamer..."
                className="w-full bg-dark-panel border-2 border-black rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Requests Table */}
          <div className="bg-dark-card border-2 border-black rounded-2xl shadow-tactile-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-black bg-dark-panel/80 text-slate-400 text-[10px] uppercase tracking-wider font-extrabold">
                    <th className="py-3 px-4">Streamer</th>
                    <th className="py-3 px-4">Tgl Kendala</th>
                    <th className="py-3 px-4">Jenis Izin</th>
                    <th className="py-3 px-4">Durasi &amp; Kompensasi</th>
                    <th className="py-3 px-4">Keterangan / Alasan</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Aksi / Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {excuseRequests
                    .filter((r) => {
                      if (excuseFilterStatus !== 'All' && r.status !== excuseFilterStatus) return false;
                      if (excuseSearch) {
                        const q = excuseSearch.toLowerCase();
                        return r.streamerNama?.toLowerCase().includes(q) || r.keterangan?.toLowerCase().includes(q);
                      }
                      return true;
                    })
                    .map((req) => (
                      <tr key={req.id} className="hover:bg-slate-900/60 transition-all">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white text-sm">{req.streamerNama}</div>
                          <span className="text-[10px] text-indigo-400 font-mono">{req.platform}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-200">
                          {req.tanggalIzin}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                            req.kategori === 'Kendala Akun'
                              ? 'bg-rose-950/60 text-rose-300 border-rose-500/40'
                              : req.kategori === 'Kompensasi Jam'
                              ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
                              : req.kategori === 'Sakit'
                              ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                              : 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40'
                          }`}>
                            {req.kategori}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {req.durasiKurang > 0 && (
                            <div className="text-[11px] font-mono text-rose-300">
                              Kurang: <strong>{req.durasiKurang} Jam</strong>
                            </div>
                          )}
                          {req.tanggalGanti ? (
                            <div className="text-[10px] font-mono text-cyan-300 mt-0.5">
                              🔄 Ganti di: <strong>{req.tanggalGanti}</strong>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <p className="text-xs text-slate-300 leading-relaxed font-sans line-clamp-3" title={req.keterangan}>
                            {req.keterangan}
                          </p>
                          {req.adminNotes && (
                            <div className="mt-1 text-[10px] text-amber-400/90 font-mono italic">
                              Catatan Admin: {req.adminNotes}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {req.status === 'Pending' ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              ⏳ Menunggu ACC
                            </span>
                          ) : req.status === 'Approved' ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              ✅ Disetujui (ACC)
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              ❌ Ditolak
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {req.status === 'Pending' ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                disabled={processingExcuseId === req.id}
                                onClick={() => handleApproveExcuse(req)}
                                className="px-3 py-1.5 rounded-xl text-xs font-black text-emerald-950 bg-emerald-400 hover:bg-emerald-300 border border-emerald-600 shadow-tactile-xs transition-all disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                                title="ACC permohonan izin (Otomatis bebas denda di tanggal tersebut)"
                              >
                                <Check className="h-3 w-3 stroke-[3]" />
                                <span>ACC</span>
                              </button>
                              <button
                                disabled={processingExcuseId === req.id}
                                onClick={() => handleRejectExcuse(req)}
                                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-400 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 transition-all disabled:opacity-50 cursor-pointer"
                                title="Tolak permohonan izin"
                              >
                                <X className="h-3 w-3" />
                                <span>Tolak</span>
                              </button>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 font-mono">
                              {req.reviewedAt ? new Date(req.reviewedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}

                  {excuseRequests.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-40 text-slate-400" />
                        <div className="font-bold text-sm text-slate-400">Belum Ada Pengajuan Izin Streamer</div>
                        <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                          Bagikan link form izin di atas kepada streamer agar mereka dapat mengajukan kendala akun &amp; kompensasi jam secara resmi.
                        </p>
                      </td>
                    </tr>
                  )}
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

      {/* MODAL 2: CATAT / EDIT KAS MASUK / PENGELUARAN */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-dark-card border-3 border-black rounded-2xl p-6 shadow-tactile-lg relative">
            <div className="flex justify-between items-center pb-3 border-b-2 border-black mb-4">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-2">
                {cashForm.id ? (
                  <>
                    <Edit3 className="h-4 w-4 text-amber-400" />
                    <span>Edit Transaksi Kas ({cashModalType === 'Masuk' ? '🟢 Kas Masuk' : '🔴 Pengeluaran'})</span>
                  </>
                ) : cashModalType === 'Masuk' ? (
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
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCashTransaction} className="space-y-4">
              {cashForm.id && (
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                    Tipe Transaksi
                  </label>
                  <select
                    value={cashForm.tipe}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setCashModalType(newType);
                      setCashForm({
                        ...cashForm,
                        tipe: newType,
                        kategori: newType === 'Masuk' ? 'Suntikan Kas Bos' : 'Operasional',
                      });
                    }}
                    className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 shadow-inset-screen"
                  >
                    <option value="Masuk">🟢 Kas Masuk (Dari Bos / Kasbon / Lainnya)</option>
                    <option value="Keluar">🔴 Pengeluaran Operasional</option>
                  </select>
                </div>
              )}

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
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-dark-panel border-2 border-black hover:bg-slate-800 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl text-xs font-extrabold text-black border-2 border-black shadow-tactile-sm transition-all cursor-pointer ${
                    cashForm.id
                      ? 'bg-amber-400 hover:bg-amber-300'
                      : cashModalType === 'Masuk'
                      ? 'bg-emerald-400 hover:bg-emerald-300'
                      : 'bg-rose-400 hover:bg-rose-300'
                  }`}
                >
                  {cashForm.id ? 'Simpan Perubahan' : 'Simpan Transaksi'}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-4xl max-h-[92vh] bg-[#0c101d] border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800/80 flex justify-between items-center bg-slate-900/40">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 font-black text-xs border border-indigo-500/20">
                  {drilldownStreamer.nama.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base font-bold text-white tracking-wide">
                      Audit Kedisiplinan: <span className="text-indigo-400">{drilldownStreamer.nama}</span>
                    </h3>
                    {drilldownStreamer.isVerified ? (
                      <span className="text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Sudah Di-Check</span>
                      </span>
                    ) : (
                      <span className="text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Belum Di-Check</span>
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 font-sans">
                    <span>{drilldownStreamer.bankName}: <span className="text-slate-300 font-mono">{drilldownStreamer.bankAccountNumber}</span> ({drilldownStreamer.bankAccountHolder})</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400">Periode: <span className="font-mono text-slate-300">{auditStartDate} s/d {auditEndDate}</span></span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setDrilldownStreamer(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
                title="Tutup Modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Clean KPI Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3.5 bg-slate-900/20 border-b border-slate-800/80 text-xs">
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-400 mb-0.5">Gaji Pokok</span>
                <span className="text-sm font-bold text-white font-mono">{formatRupiah(drilldownStreamer.baseSalary)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-400 mb-0.5">Total Denda Disiplin</span>
                <span className="text-sm font-bold text-rose-400 font-mono">
                  -{formatRupiah(drilldownStreamer.shortagePenalty + drilldownStreamer.noReportPenalty + drilldownStreamer.absentPenalty)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-400 mb-0.5">Potongan Sinyal ({drilldownStreamer.signalCutCount}x)</span>
                <span className="text-sm font-bold text-slate-300 font-mono">-{formatRupiah(drilldownStreamer.signalCutAmount)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-emerald-400 font-semibold mb-0.5">Gaji Bersih Diterima</span>
                <span className="text-base font-extrabold text-emerald-400 font-mono">{formatRupiah(drilldownStreamer.netSalary)}</span>
              </div>
            </div>

            {/* Daily Table Body */}
            <div className="flex-1 overflow-y-auto px-6 py-2 custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider sticky top-0 bg-[#0c101d] z-10">
                    <th className="py-3 px-3 w-28">Tanggal</th>
                    <th className="py-3 px-3">Aktivitas &amp; Durasi</th>
                    <th className="py-3 px-3">Keterangan Denda</th>
                    <th className="py-3 px-3 text-right w-36">Total Denda</th>
                    <th className="py-3 px-3 text-center w-36">Dispensasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 font-sans">
                  {drilldownStreamer.dailyBreakdown?.map((day) => {
                    const hasPenalty = day.totalDayPenalty > 0;
                    return (
                      <tr
                        key={day.dateStr}
                        className={`transition-colors ${
                          day.isSunday
                            ? 'bg-slate-900/10 text-slate-500'
                            : hasPenalty
                            ? 'bg-rose-950/10 hover:bg-rose-950/20'
                            : 'hover:bg-slate-800/20'
                        }`}
                      >
                        {/* 1. Tanggal */}
                        <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                          <span className={`font-semibold ${day.isSunday ? 'text-slate-400' : 'text-white'}`}>
                            {day.shortDate?.includes(',')
                              ? day.shortDate
                              : `${['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date(day.dateStr + 'T12:00:00').getDay()]}, ${day.shortDate}`}
                          </span>
                        </td>

                        {/* 2. Aktivitas & Durasi */}
                        <td className="py-2.5 px-3">
                          {day.isSunday ? (
                            <span className="text-slate-500 text-xs">Libur Rutin</span>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              {day.liveDuration >= 4.0 ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400 font-medium text-xs">
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                  <span>{day.liveDuration} Jam Live</span>
                                </span>
                              ) : day.liveDuration > 0 ? (
                                <span className="inline-flex items-center gap-1 text-amber-400 font-medium text-xs">
                                  <Clock className="h-3.5 w-3.5 shrink-0" />
                                  <span>{day.liveDuration} Jam Live (Kurang {(4.0 - day.liveDuration).toFixed(1)}h)</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">Tidak Live / Absen</span>
                              )}

                              {/* Quick Edit Durasi Link */}
                              <button
                                onClick={() => handleUpdateDailyLiveDuration(day)}
                                className="text-[10px] text-slate-500 hover:text-indigo-400 hover:underline flex items-center gap-0.5 ml-1 transition-colors"
                                title="Ubah durasi live"
                              >
                                <Edit3 className="h-2.5 w-2.5" />
                                <span>Edit</span>
                              </button>

                              {/* Timestamp / Bot Chat button */}
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
                                  className="text-[10px] text-indigo-400/80 hover:text-indigo-300 underline font-mono ml-auto"
                                  title="Lihat pesan bot asli"
                                >
                                  [Chat Bot]
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 3. Keterangan Denda */}
                        <td className="py-2.5 px-3">
                          {day.isSunday ? (
                            <span className="text-slate-600">-</span>
                          ) : hasPenalty ? (
                            <div className="text-xs text-rose-400/90 font-mono flex items-center gap-1.5 flex-wrap">
                              {day.shortagePenalty > 0 && <span>Durasi Kurang (-{formatRupiah(day.shortagePenalty)})</span>}
                              {day.noReportPenalty > 0 && <span>• Telat/Lupa Rekap (-{formatRupiah(day.noReportPenalty)})</span>}
                              {day.absentPenalty > 0 && <span>• Absen (-{formatRupiah(day.absentPenalty)})</span>}
                            </div>
                          ) : (
                            <span className="text-slate-500 text-xs">SOP Terpenuhi (Rp 0)</span>
                          )}
                        </td>

                        {/* 4. Total Denda (Single line nowrap) */}
                        <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                          {hasPenalty ? (
                            <span className="font-bold text-rose-400">-{formatRupiah(day.totalDayPenalty)}</span>
                          ) : (
                            <span className="text-slate-500">Rp 0</span>
                          )}
                        </td>

                        {/* 5. Dispensasi / Aksi */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {day.isSunday ? (
                            <span className="text-slate-600 text-xs">-</span>
                          ) : day.isCompensated ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950/40 text-cyan-300 text-[11px] font-medium border border-cyan-500/20">
                              <span>🔄 Kompensasi</span>
                              <button
                                onClick={() => handleToggleDailyExcuse(day)}
                                className="text-slate-400 hover:text-rose-400 ml-1 font-bold text-xs"
                                title="Batalkan Kompensasi"
                              >
                                ×
                              </button>
                            </span>
                          ) : day.isExcused ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/40 text-amber-300 text-[11px] font-medium border border-amber-500/20">
                              <span>✅ Izin Bebas Denda</span>
                              <button
                                onClick={() => handleToggleDailyExcuse(day)}
                                className="text-slate-400 hover:text-rose-400 ml-1 font-bold text-xs"
                                title="Batalkan Izin"
                              >
                                ×
                              </button>
                            </span>
                          ) : hasPenalty ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => handleToggleDailyExcuse(day)}
                                className="px-2 py-0.5 rounded text-[11px] text-amber-400 hover:bg-amber-950/40 hover:text-amber-300 transition-colors"
                                title="Tandai izin sah via WA agar bebas denda"
                              >
                                + Izin
                              </button>
                              <span className="text-slate-700">|</span>
                              <button
                                onClick={() => handleSetDailyCompensation(day)}
                                className="px-2 py-0.5 rounded text-[11px] text-cyan-400 hover:bg-cyan-950/40 hover:text-cyan-300 transition-colors"
                                title="Tandai janji ganti jam live"
                              >
                                Kompensasi
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => generateStreamerAuditWaSlip(drilldownStreamer)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-600 hover:text-black transition-all"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Salin Slip WA</span>
                </button>

                <button
                  onClick={() => handleToggleVerify(drilldownStreamer)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    drilldownStreamer.isVerified
                      ? 'bg-rose-950/30 text-rose-300 border-rose-500/30 hover:bg-rose-600 hover:text-white'
                      : 'bg-indigo-950/40 text-indigo-300 border-indigo-500/30 hover:bg-indigo-600 hover:text-white'
                  }`}
                >
                  {drilldownStreamer.isVerified ? (
                    <>
                      <X className="h-3.5 w-3.5" />
                      <span>Batalkan Status Di-Check</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Tandai Selesai Di-Check</span>
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={() => setDrilldownStreamer(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
              >
                Tutup
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

      {/* MODAL AUDIT 3: EDIT KETENTUAN SKEMA GAJI & DENDA SOP */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-2xl bg-dark-card border-3 border-black rounded-2xl p-6 shadow-tactile-lg relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start pb-3 border-b-2 border-black mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-amber-400" />
                  <span>Ubah Ketentuan Skema Gaji &amp; Aturan Denda SOP</span>
                </h3>
                <div className="text-xs text-slate-400 mt-0.5">
                  Sesuaikan nilai denda, batas waktu rekap, dan skema gaji default streamer.
                </div>
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFinanceRules} className="space-y-4">
              {/* Section 1: Skema Gaji Pokok Default */}
              <div className="bg-dark-panel border-2 border-black rounded-xl p-3.5 space-y-3">
                <div className="text-[11px] font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>1. Skema Gaji Pokok Default (Standar 3 Juta / Bulan)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-300 mb-1">
                      Termin 1 (Tgl 15) — Default Rp
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="50000"
                      required
                      value={editingRules.baseSalary15th}
                      onChange={(e) => setEditingRules({ ...editingRules, baseSalary15th: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-dark-card border-2 border-black rounded-xl p-2 text-xs font-mono text-white focus:outline-none"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">Saat ini: {formatRupiah(editingRules.baseSalary15th)}</div>
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-300 mb-1">
                      Termin 2 (Akhir Bulan) — Default Rp
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="50000"
                      required
                      value={editingRules.baseSalaryMonthEnd}
                      onChange={(e) => setEditingRules({ ...editingRules, baseSalaryMonthEnd: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-dark-card border-2 border-black rounded-xl p-2 text-xs font-mono text-white focus:outline-none"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">Saat ini: {formatRupiah(editingRules.baseSalaryMonthEnd)}</div>
                  </div>
                </div>
              </div>

              {/* Section 2: Durasi SOP & Denda Kekurangan Durasi */}
              <div className="bg-dark-panel border-2 border-black rounded-xl p-3.5 space-y-3">
                <div className="text-[11px] font-extrabold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>2. Durasi SOP Live &amp; Denda Kurang Durasi</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-300 mb-1">
                      Target Durasi SOP Live Harian (Jam)
                    </label>
                    <input
                      type="number"
                      min="0.5"
                      max="24"
                      step="0.5"
                      required
                      value={editingRules.standardLiveDurationHours}
                      onChange={(e) => setEditingRules({ ...editingRules, standardLiveDurationHours: parseFloat(e.target.value) || 4.0 })}
                      className="w-full bg-dark-card border-2 border-black rounded-xl p-2 text-xs font-mono text-white focus:outline-none"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">Standar SOP: {editingRules.standardLiveDurationHours} Jam / hari</div>
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-300 mb-1">
                      Denda Kurang Durasi per Jam (Rp)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="5000"
                      required
                      value={editingRules.durationShortagePenaltyPerHour}
                      onChange={(e) => setEditingRules({ ...editingRules, durationShortagePenaltyPerHour: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-dark-card border-2 border-black rounded-xl p-2 text-xs font-mono text-white focus:outline-none"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">Potongan: {formatRupiah(editingRules.durationShortagePenaltyPerHour)} / jam</div>
                  </div>
                </div>
              </div>

              {/* Section 3: Batas Rekap & Denda Tidak Kirim Rekap */}
              <div className="bg-dark-panel border-2 border-black rounded-xl p-3.5 space-y-3">
                <div className="text-[11px] font-extrabold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>3. Batas Waktu Rekapan &amp; Denda Telat/Tidak Rekap</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-300 mb-1">
                      Batas Jam Rekapan Harian (WIB)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="08:00"
                      value={editingRules.recapDeadlineTime}
                      onChange={(e) => setEditingRules({ ...editingRules, recapDeadlineTime: e.target.value })}
                      className="w-full bg-dark-card border-2 border-black rounded-xl p-2 text-xs font-mono text-white focus:outline-none"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">Format: 08:00 (Pagi WIB)</div>
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-300 mb-1">
                      Denda Tidak Rekap / Telat Rekap per Hari (Rp)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="10000"
                      required
                      value={editingRules.noReportPenaltyPerDay}
                      onChange={(e) => setEditingRules({ ...editingRules, noReportPenaltyPerDay: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-dark-card border-2 border-black rounded-xl p-2 text-xs font-mono text-white focus:outline-none"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">Denda: {formatRupiah(editingRules.noReportPenaltyPerDay)} / hari</div>
                  </div>
                </div>
              </div>

              {/* Section 4: Denda Absen (Tidak Live) & Potongan Sinyal */}
              <div className="bg-dark-panel border-2 border-black rounded-xl p-3.5 space-y-3">
                <div className="text-[11px] font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>4. Denda Absen / Bolos &amp; Potongan Sinyal</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-300 mb-1">
                      Denda Absen per Sesi (Rp)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="5000"
                      required
                      value={editingRules.absentPenaltyPerSession}
                      onChange={(e) => setEditingRules({ ...editingRules, absentPenaltyPerSession: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-dark-card border-2 border-black rounded-xl p-2 text-xs font-mono text-white focus:outline-none"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">Per Sesi: {formatRupiah(editingRules.absentPenaltyPerSession)}</div>
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-300 mb-1">
                      Jumlah Sesi per Hari
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      step="1"
                      required
                      value={editingRules.sessionsPerDay}
                      onChange={(e) => setEditingRules({ ...editingRules, sessionsPerDay: parseInt(e.target.value, 10) || 1 })}
                      className="w-full bg-dark-card border-2 border-black rounded-xl p-2 text-xs font-mono text-white focus:outline-none"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">Total Absen 1 Hari: {formatRupiah(editingRules.absentPenaltyPerSession * editingRules.sessionsPerDay)}</div>
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-300 mb-1">
                      Denda Sinyal per Kejadian (Rp)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="5000"
                      required
                      value={editingRules.signalCutPenaltyPerEvent}
                      onChange={(e) => setEditingRules({ ...editingRules, signalCutPenaltyPerEvent: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-dark-card border-2 border-black rounded-xl p-2 text-xs font-mono text-white focus:outline-none"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">Potongan: {formatRupiah(editingRules.signalCutPenaltyPerEvent)} / kejadian</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex justify-end gap-2 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setShowRulesModal(false)}
                  disabled={isSavingRules}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-dark-panel border-2 border-black hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingRules}
                  className="px-5 py-2 rounded-xl text-xs font-extrabold text-black bg-tactile-yellow border-2 border-black shadow-tactile-sm hover:bg-amber-400 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSavingRules ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Simpan Ketentuan SOP</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AUDIT 4: PREVIEW & SALIN SLIP WHATSAPP */}
      {previewWaSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-dark-card border-3 border-black rounded-2xl p-6 shadow-tactile-lg relative max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start pb-3 border-b-2 border-black mb-3">
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-emerald-400" />
                  <span>{previewWaSlip.title}</span>
                </h3>
                <div className="text-xs text-slate-400 mt-0.5">
                  Penerima: <strong className="text-white">{previewWaSlip.recipient}</strong>
                </div>
              </div>
              <button
                onClick={() => setPreviewWaSlip(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 rounded-xl px-3 py-2 mb-3 flex items-center justify-between">
              <span>✅ Teks slip sudah disalin otomatis ke clipboard!</span>
              <span className="font-bold">Siap kirim</span>
            </div>

            <div className="flex-1 bg-dark-panel border-2 border-black rounded-xl p-3.5 font-mono text-xs text-slate-200 whitespace-pre-wrap overflow-y-auto max-h-72 shadow-inset-screen select-all">
              {previewWaSlip.text}
            </div>

            <div className="pt-4 flex flex-wrap justify-between items-center gap-2 border-t-2 border-black mt-3">
              <button
                type="button"
                onClick={() => copyToClipboard(previewWaSlip.text, previewWaSlip.key)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-dark-panel border-2 border-black hover:bg-slate-800 flex items-center gap-1.5"
              >
                {copiedKey === previewWaSlip.key ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-extrabold">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Salin Teks Lagi</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(previewWaSlip.text)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-emerald-600 border-2 border-black shadow-tactile-sm hover:bg-emerald-500 flex items-center gap-1.5 transition-all"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>Kirim ke WhatsApp</span>
                  <ExternalLink className="h-3 w-3" />
                </a>

                <button
                  type="button"
                  onClick={() => setPreviewWaSlip(null)}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold text-black bg-tactile-yellow border-2 border-black shadow-tactile-sm hover:bg-amber-400"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Finance;
