import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Users, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Tv, 
  Video, 
  Award,
  Sparkles,
  Search,
  CheckCircle2,
  UserMinus,
  UserCheck,
  ShieldCheck,
  Filter
} from 'lucide-react';

const Streamers = () => {
  const [streamers, setStreamers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'resigned'
  const [actionNotice, setActionNotice] = useState('');
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [currentStreamer, setCurrentStreamer] = useState({ id: '', nama: '', platform: 'TikTok', telegram_username: '', status: 'active' });
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // Social accounts editor states
  const [accountsModalOpen, setAccountsModalOpen] = useState(false);
  const [activeStreamer, setActiveStreamer] = useState(null);
  const [activeAccounts, setActiveAccounts] = useState([]);
  const [newAccountForm, setNewAccountForm] = useState({ platform: 'TikTok', username: '', link: '', channel_id: '' });
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [accountsError, setAccountsError] = useState('');
  const [accountsSuccess, setAccountsSuccess] = useState('');

  const fetchActiveAccounts = async (streamerId) => {
    try {
      const res = await api.get(`/accounts/streamers/${streamerId}/accounts`);
      setActiveAccounts(res.data);
    } catch (err) {
      console.error('Error fetching accounts list:', err);
    }
  };

  const handleOpenAccountsModal = (streamer) => {
    setActiveStreamer(streamer);
    setNewAccountForm({ platform: 'TikTok', username: '', link: '', channel_id: '' });
    setEditingAccountId(null);
    setAccountsError('');
    setAccountsSuccess('');
    fetchActiveAccounts(streamer.id);
    setAccountsModalOpen(true);
  };

  const handleAddAccountSubmit = async (e) => {
    e.preventDefault();
    setAccountsError('');
    setAccountsSuccess('');

    if (!newAccountForm.username.trim()) {
      setAccountsError('Username/Handle wajib diisi.');
      return;
    }

    try {
      if (editingAccountId) {
        await api.put(`/accounts/accounts/${editingAccountId}`, newAccountForm);
        setAccountsSuccess('Akun media sosial berhasil diperbarui!');
        setEditingAccountId(null);
      } else {
        await api.post(`/accounts/streamers/${activeStreamer.id}/accounts`, newAccountForm);
        setAccountsSuccess('Akun media sosial berhasil didaftarkan!');
      }
      setNewAccountForm({ platform: 'TikTok', username: '', link: '', channel_id: '' });
      fetchActiveAccounts(activeStreamer.id);
    } catch (err) {
      setAccountsError(err.response?.data?.message || 'Gagal menyimpan akun.');
    }
  };

  const handleEditAccountClick = (acc) => {
    setEditingAccountId(acc.id);
    setNewAccountForm({
      platform: acc.platform,
      username: acc.username,
      link: acc.link || '',
      channel_id: acc.channel_id || ''
    });
    setAccountsError('');
    setAccountsSuccess('');
  };

  const handleCancelEdit = () => {
    setEditingAccountId(null);
    setNewAccountForm({ platform: 'TikTok', username: '', link: '', channel_id: '' });
    setAccountsError('');
    setAccountsSuccess('');
  };

  const handleDeleteAccount = async (accountId) => {
    if (!window.confirm('Hapus akun media sosial ini dari streamer?')) return;
    try {
      await api.delete(`/accounts/accounts/${accountId}`);
      setAccountsSuccess('Akun berhasil dihapus.');
      if (editingAccountId === accountId) {
        handleCancelEdit();
      }
      fetchActiveAccounts(activeStreamer.id);
    } catch (err) {
      setAccountsError('Gagal menghapus akun.');
    }
  };

  const fetchStreamers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/streamers');
      setStreamers(res.data);
    } catch (error) {
      console.error('Error fetching streamers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreamers();
  }, []);

  const handleOpenAddModal = () => {
    setCurrentStreamer({ id: '', nama: '', platform: 'TikTok', telegram_username: '', status: 'active' });
    setModalMode('add');
    setModalError('');
    setModalSuccess('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (streamer) => {
    setCurrentStreamer({ 
      id: streamer.id, 
      nama: streamer.nama, 
      platform: streamer.platform, 
      telegram_username: streamer.telegram_username || '',
      status: streamer.status || 'active'
    });
    setModalMode('edit');
    setModalError('');
    setModalSuccess('');
    setModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');

    if (!currentStreamer.nama.trim()) {
      setModalError('Streamer name is required.');
      return;
    }

    try {
      if (modalMode === 'add') {
        await api.post('/streamers', currentStreamer);
        setModalSuccess('Streamer added successfully!');
      } else {
        await api.put(`/streamers/${currentStreamer.id}`, currentStreamer);
        setModalSuccess('Streamer details updated!');
      }
      
      fetchStreamers();
      setTimeout(() => {
        setModalOpen(false);
      }, 1000);
    } catch (error) {
      console.error('Error submitting streamer form:', error);
      setModalError(error.response?.data?.message || 'Failed to save streamer. Please check uniqueness.');
    }
  };

  const handleToggleStatus = async (streamer) => {
    const isCurrentlyActive = (streamer.status === 'active' || !streamer.status);
    const targetStatus = isCurrentlyActive ? 'resigned' : 'active';
    const actionText = isCurrentlyActive 
      ? `Tandai streamer "${streamer.nama}" sebagai RESIGN?\n\n🛡️ CATATAN PENTING:\nSeluruh riwayat ${streamer.total_reports || 0} laporan harian, log performa, dan data keuangan AKAN TETAP AMAN TERSIMPAN.`
      : `Aktifkan kembali streamer "${streamer.nama}"?`;

    if (!window.confirm(actionText)) {
      return;
    }

    try {
      const res = await api.patch(`/streamers/${streamer.id}/status`, { status: targetStatus });
      setActionNotice(res.data?.message || `Status streamer berhasil diperbarui ke ${targetStatus}`);
      setTimeout(() => setActionNotice(''), 5000);
      fetchStreamers();
    } catch (error) {
      console.error('Failed to update streamer status:', error);
      alert(error.response?.data?.message || 'Gagal mengubah status streamer');
    }
  };

  const handleDelete = async (id, nama, totalReports) => {
    const promptMsg = `Tandai streamer "${nama}" sebagai Resign?\n\n🛡️ CATATAN PENTING:\nRiwayat ${totalReports || 0} laporan harian & data keuangan TIDAK AKAN DIHAPUS dan tetap aman tersimpan di database.`;
    
    if (!window.confirm(promptMsg)) {
      return;
    }

    try {
      const res = await api.delete(`/streamers/${id}`);
      setActionNotice(res.data?.message || `Streamer "${nama}" berhasil dinonaktifkan (data historis aman).`);
      setTimeout(() => setActionNotice(''), 5000);
      fetchStreamers();
    } catch (error) {
      console.error('Failed to delete/deactivate streamer:', error);
      alert(error.response?.data?.message || 'Failed to update streamer');
    }
  };

  const counts = {
    all: streamers.length,
    active: streamers.filter(s => (s.status === 'active' || !s.status)).length,
    resigned: streamers.filter(s => s.status === 'resigned' || s.status === 'inactive').length,
  };

  const filteredStreamers = streamers.filter(s => {
    const matchesSearch = s.nama.toLowerCase().includes(search.toLowerCase()) ||
      s.platform.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;

    const isActive = (s.status === 'active' || !s.status);
    if (statusFilter === 'active') return isActive;
    if (statusFilter === 'resigned') return !isActive;
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Header and Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Streamer Management</h2>
          <p className="text-sm text-gray-400">Kelola status streamer (Aktif/Resign), akun platform, dan rekap jam live historis.</p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/10 active:translate-y-px transition-all duration-200 cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5" />
          Add New Streamer
        </button>
      </div>

      {/* Action Notification Banner */}
      {actionNotice && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs shadow-lg animate-fade-in">
          <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-dark-border gap-1 text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Semua ({counts.all})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-emerald-400 hover:bg-slate-800'
            }`}
          >
            Aktif ({counts.active})
          </button>
          <button
            onClick={() => setStatusFilter('resigned')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              statusFilter === 'resigned'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-rose-400 hover:bg-slate-800'
            }`}
          >
            Resign / Non-Aktif ({counts.resigned})
          </button>
        </div>

        {/* Search Input Filter */}
        <div className="w-full sm:max-w-xs">
          <div className="relative">
            <Search className="absolute inset-y-0 left-0 pl-3.5 h-full w-4.5 text-gray-500 flex items-center pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search streamer..."
              className="block w-full pl-10 pr-3 py-2 text-sm rounded-xl border border-dark-border bg-slate-900/60 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center text-indigo-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent"></div>
          <span className="ml-3 text-sm">Loading streamers directory...</span>
        </div>
      ) : filteredStreamers.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl text-gray-400 border border-slate-800">
          Tidak ada streamer yang ditemukan dengan filter yang dipilih.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStreamers.map((streamer) => {
            const isActive = (streamer.status === 'active' || !streamer.status);
            const isResigned = streamer.status === 'resigned';
            const isInactive = streamer.status === 'inactive';

            return (
              <div
                key={streamer.id}
                className={`glass-panel p-6 rounded-2xl border flex flex-col justify-between hover:border-indigo-500/30 hover:-translate-y-0.5 transition-all duration-300 ${
                  !isActive ? 'bg-slate-950/40 opacity-80 border-slate-800/60' : 'bg-slate-950/20 border-slate-800'
                }`}
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between border-b border-dark-border/40 pb-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white leading-tight">{streamer.nama}</h3>
                      </div>
                      <span className="inline-block text-[10px] uppercase font-bold text-indigo-400 tracking-wider mt-0.5">
                        {streamer.platform}
                      </span>
                    </div>
                    
                    {/* Status Indicator */}
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : isResigned
                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                    }`}>
                      {isActive ? 'Aktif' : isResigned ? 'Resigned' : 'Non-Aktif'}
                    </span>
                  </div>

                  {/* Statistics counts */}
                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Telegram Handle</span>
                      <strong className="text-indigo-400 font-semibold">{streamer.telegram_username ? `@${streamer.telegram_username}` : '-'}</strong>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Riwayat Laporan</span>
                      <strong className="text-white font-semibold">{streamer.total_reports} logs</strong>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Total Durasi Live</span>
                      <strong className="text-white font-semibold">{parseFloat(streamer.total_live_hours).toFixed(1)} jam</strong>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-4 border-t border-dark-border/40">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenAccountsModal(streamer)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-dark-border hover:border-indigo-500/30 hover:bg-indigo-500/10 text-gray-300 hover:text-indigo-400 transition-colors"
                      title="Kelola Akun Medsos"
                    >
                      <Users className="h-3 w-3" />
                      Akun
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(streamer)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-dark-border hover:border-indigo-500/30 hover:bg-indigo-500/10 text-gray-300 hover:text-indigo-400 transition-colors"
                      title="Edit Detail Streamer"
                    >
                      <Edit2 className="h-3 w-3" />
                      Edit
                    </button>
                  </div>

                  {/* Status Toggle / Resign Button */}
                  <button
                    onClick={() => handleToggleStatus(streamer)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                      isActive
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                    }`}
                    title={isActive ? 'Tandai streamer sebagai resign (riwayat data tetap aman)' : 'Aktifkan kembali streamer'}
                  >
                    {isActive ? (
                      <>
                        <UserMinus className="h-3 w-3" />
                        Tandai Resign
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-3 w-3" />
                        Aktifkan
                      </>
                    )}
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Streamer Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs" onClick={() => setModalOpen(false)} />
          
          <div className="relative w-full max-w-md p-6 md:p-8 rounded-2xl border border-dark-border bg-slate-950 shadow-2xl z-10 animate-scale-up">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-900 text-gray-400 hover:text-white border border-dark-border"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-6">
              {modalMode === 'add' ? 'Add New Streamer Account' : 'Edit Streamer Profile'}
            </h3>

            {modalError && (
              <div className="flex items-center gap-2 p-3.5 mb-5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs">
                <span>{modalError}</span>
              </div>
            )}

            {modalSuccess && (
              <div className="flex items-center gap-2 p-3.5 mb-5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">
                <CheckCircle2 className="h-4.5 w-4.5" />
                <span>{modalSuccess}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Streamer Name</label>
                <input
                  type="text"
                  value={currentStreamer.nama}
                  onChange={(e) => setCurrentStreamer({ ...currentStreamer, nama: e.target.value })}
                  placeholder="Enter streamer display name"
                  className="w-full p-2.5 text-sm rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Primary Platform</label>
                <select
                  value={currentStreamer.platform}
                  onChange={(e) => setCurrentStreamer({ ...currentStreamer, platform: e.target.value })}
                  className="w-full p-2.5 text-sm rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="TikTok">TikTok</option>
                  <option value="YouTube">YouTube</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Twitch">Twitch</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Telegram Username (tanpa @)</label>
                <input
                  type="text"
                  value={currentStreamer.telegram_username}
                  onChange={(e) => setCurrentStreamer({ ...currentStreamer, telegram_username: e.target.value })}
                  placeholder="e.g. brayycandle"
                  className="w-full p-2.5 text-sm rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {modalMode === 'edit' && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Status Keaktifan</label>
                  <select
                    value={currentStreamer.status || 'active'}
                    onChange={(e) => setCurrentStreamer({ ...currentStreamer, status: e.target.value })}
                    className="w-full p-2.5 text-sm rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="active">Aktif (Active)</option>
                    <option value="resigned">Resigned (Resign)</option>
                    <option value="inactive">Non-Aktif (Inactive)</option>
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    Status Resign tidak menghapus riwayat laporan harian & data keuangan.
                  </p>
                </div>
              )}

              <button
                type="submit"
                className="w-full mt-4 py-3 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white text-sm tracking-wide transition-colors cursor-pointer"
              >
                {modalMode === 'add' ? 'Create Account' : 'Save Profiles'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Social Accounts Modal */}
      {accountsModalOpen && activeStreamer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs" onClick={() => setAccountsModalOpen(false)} />
          
          <div className="relative w-full max-w-lg p-6 md:p-8 rounded-2xl border border-dark-border bg-slate-950 shadow-2xl z-10 animate-scale-up">
            <button
              onClick={() => setAccountsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-900 text-gray-400 hover:text-white border border-dark-border"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-2">
              Media Sosial {activeStreamer.nama}
            </h3>
            <p className="text-xs text-gray-400 mb-6">
              Satu streamer bisa mengelola beberapa akun media sosial sekaligus (contoh: 3 akun TikTok berbeda).
            </p>

            {accountsError && (
              <div className="p-3 mb-4 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs">
                {accountsError}
              </div>
            )}

            {accountsSuccess && (
              <div className="p-3 mb-4 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">
                {accountsSuccess}
              </div>
            )}

            {/* List of accounts */}
            <div className="mb-6">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">
                Daftar Akun Terdaftar
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {activeAccounts.length === 0 ? (
                  <p className="text-xs text-gray-500 py-2">Belum ada akun terdaftar.</p>
                ) : (
                  activeAccounts.map((acc) => (
                    <div key={acc.id} className="flex justify-between items-center bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-200">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-indigo-400">[{acc.platform}]</span>
                          <span>{acc.username}</span>
                        </div>
                        {acc.link && (
                          <a href={acc.link} target="_blank" rel="noreferrer" className="block text-[10px] text-indigo-400/80 hover:text-indigo-400 hover:underline mt-0.5">
                            Buka Link Live / Profil ↗
                          </a>
                        )}
                        {acc.platform === 'YouTube' && acc.channel_id && (
                          <span className="block text-[9px] text-slate-500 mt-0.5 font-mono">
                            Channel ID: {acc.channel_id}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditAccountClick(acc)}
                          className="p-1.5 text-gray-400 hover:text-indigo-400 rounded-lg hover:bg-indigo-500/10 transition-colors"
                          title="Edit Akun"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(acc.id)}
                          className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                          title="Hapus Akun"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Add/Edit account form */}
            <form onSubmit={handleAddAccountSubmit} className="border-t border-slate-800 pt-5 space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {editingAccountId ? 'Edit Akun' : 'Tambah Akun Baru'}
                </label>
                {editingAccountId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-[10px] font-semibold text-rose-400 hover:text-rose-350 transition-colors"
                  >
                    Batal Edit
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Platform</label>
                  <select
                    value={newAccountForm.platform}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, platform: e.target.value })}
                    className="w-full p-2 text-xs rounded-lg border border-dark-border bg-slate-900 text-white cursor-pointer"
                    disabled={!!editingAccountId}
                  >
                    <option value="TikTok">TikTok</option>
                    <option value="YouTube">YouTube</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Username / Handle</label>
                  <input
                    type="text"
                    value={newAccountForm.username}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, username: e.target.value })}
                    placeholder="Contoh: @dara_official"
                    className="w-full p-2 text-xs rounded-lg border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Link Live / Profil (Opsional)</label>
                <input
                  type="text"
                  value={newAccountForm.link}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, link: e.target.value })}
                  placeholder={newAccountForm.platform === 'YouTube' ? 'https://youtube.com/channel/UC...' : 'https://tiktok.com/@...'}
                  className="w-full p-2 text-xs rounded-lg border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {newAccountForm.platform === 'YouTube' && (
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">YouTube Channel ID (Opsional untuk Autodetect Live)</label>
                  <input
                    type="text"
                    value={newAccountForm.channel_id}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, channel_id: e.target.value })}
                    placeholder="Contoh: UCbCWUyYnUIpcXaV390r7QAA"
                    className="w-full p-2 text-xs rounded-lg border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}

              <button
                type="submit"
                className={`w-full py-2 text-white rounded-lg font-semibold text-xs transition-colors ${
                  editingAccountId 
                    ? 'bg-amber-600 hover:bg-amber-500' 
                    : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                {editingAccountId ? 'Simpan Perubahan' : 'Tambahkan Akun'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Streamers;

