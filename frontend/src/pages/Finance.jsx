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
  X
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

  // Active Tab: 'payroll' | 'cash' | 'profiles'
  const [activeTab, setActiveTab] = useState('payroll');

  // Copy feedback state
  const [copiedKey, setCopiedKey] = useState(null);

  // ==========================================
  // DATA STATES
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
  const fetchAllData = async () => {
    if (!isUnlocked) return;
    setLoading(true);
    try {
      await Promise.all([
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
    if (!cashForm.nominal || parseFloat(cashForm.nominal) <= 0) return;

    try {
      await api.post('/finance/cash/transactions', cashForm);
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
      salary_15: 1000000,
      salary_1: 2000000,
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
      salary_15: p.salary_15,
      salary_1: p.salary_1,
      is_active: p.is_active,
      notes: p.notes || '',
    });
    setShowProfileModal(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await api.post('/finance/profiles', profileForm);
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
        ...item,
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
        ...editingItem,
        ...itemEditForm,
      });
      setEditingItem(null);
      fetchPeriodDetail(selectedPeriodId);
      fetchPeriods();
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
            Brankas Keuangan & Gaji
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
                Manajemen Keuangan & Penggajian
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
          onClick={() => setActiveTab('payroll')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all border-2 ${
            activeTab === 'payroll'
              ? 'bg-tactile-yellow text-black border-black shadow-tactile-sm -translate-y-0.5'
              : 'bg-dark-panel text-slate-400 border-black hover:text-white hover:bg-slate-800'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          <span>💵 Penggajian (Payroll)</span>
        </button>

        <button
          onClick={() => setActiveTab('cash')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all border-2 ${
            activeTab === 'cash'
              ? 'bg-tactile-yellow text-black border-black shadow-tactile-sm -translate-y-0.5'
              : 'bg-dark-panel text-slate-400 border-black hover:text-white hover:bg-slate-800'
          }`}
        >
          <Landmark className="h-4 w-4" />
          <span>📉 Pengeluaran & Uang Kas</span>
        </button>

        <button
          onClick={() => setActiveTab('profiles')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all border-2 ${
            activeTab === 'profiles'
              ? 'bg-tactile-yellow text-black border-black shadow-tactile-sm -translate-y-0.5'
              : 'bg-dark-panel text-slate-400 border-black hover:text-white hover:bg-slate-800'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>👥 Master Profil & Rate Gaji</span>
        </button>
      </div>

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
                            className={`transition-all hover:bg-slate-900/60 ${
                              isPaid ? 'bg-emerald-950/10' : ''
                            }`}
                          >
                            {/* Name & Role */}
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-white text-sm">{item.recipient_name}</div>
                              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide bg-slate-800 text-slate-300 border border-slate-700">
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
                                className={`px-3 py-1.5 rounded-xl font-extrabold text-[10px] uppercase tracking-wider border-2 transition-all shadow-tactile-sm ${
                                  isPaid
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
                                      base_amount: item.base_amount,
                                      bonus_amount: item.bonus_amount,
                                      deduction_amount: item.deduction_amount,
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
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all ${
                      cashFilterType === t
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
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                                isIncome
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
                          <td className={`py-3.5 px-4 text-right font-mono font-bold text-sm ${
                            isIncome ? 'text-emerald-400' : 'text-rose-400'
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
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide bg-slate-800 text-indigo-300 border border-slate-700">
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
                          className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                            p.is_active
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
                    className={`p-3 rounded-xl border-2 text-left font-bold text-xs transition-all ${
                      newPeriodForm.period_type === '15th'
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
                    className={`p-3 rounded-xl border-2 text-left font-bold text-xs transition-all ${
                      newPeriodForm.period_type === '1st'
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
                  type="number"
                  required
                  min={1000}
                  step={1000}
                  value={cashForm.nominal}
                  onChange={(e) => setCashForm({ ...cashForm, nominal: e.target.value })}
                  placeholder="Contoh: 500000"
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
                  className={`px-5 py-2 rounded-xl text-xs font-extrabold text-black border-2 border-black shadow-tactile-sm transition-all ${
                    cashModalType === 'Masuk'
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
                    type="number"
                    step={50000}
                    value={profileForm.salary_15}
                    onChange={(e) => setProfileForm({ ...profileForm, salary_15: e.target.value })}
                    className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs font-mono font-bold text-white focus:outline-none shadow-inset-screen"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-amber-400 uppercase mb-1">
                    Rate Gaji Tgl 1 (Rp)
                  </label>
                  <input
                    type="number"
                    step={50000}
                    value={profileForm.salary_1}
                    onChange={(e) => setProfileForm({ ...profileForm, salary_1: e.target.value })}
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
                  type="number"
                  value={itemEditForm.base_amount}
                  onChange={(e) => setItemEditForm({ ...itemEditForm, base_amount: e.target.value })}
                  className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs font-mono font-bold text-white focus:outline-none shadow-inset-screen"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-extrabold text-emerald-400 uppercase mb-1">
                    + Bonus / Tambahan (Rp)
                  </label>
                  <input
                    type="number"
                    value={itemEditForm.bonus_amount}
                    onChange={(e) => setItemEditForm({ ...itemEditForm, bonus_amount: e.target.value })}
                    className="w-full bg-dark-panel border-2 border-black rounded-xl p-2.5 text-xs font-mono font-bold text-emerald-400 focus:outline-none shadow-inset-screen"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-rose-400 uppercase mb-1">
                    - Potongan / Kasbon (Rp)
                  </label>
                  <input
                    type="number"
                    value={itemEditForm.deduction_amount}
                    onChange={(e) => setItemEditForm({ ...itemEditForm, deduction_amount: e.target.value })}
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
                      parseFloat(itemEditForm.base_amount || 0) +
                        parseFloat(itemEditForm.bonus_amount || 0) -
                        parseFloat(itemEditForm.deduction_amount || 0)
                    )
                  )}
                </span>
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
    </div>
  );
};

export default Finance;
