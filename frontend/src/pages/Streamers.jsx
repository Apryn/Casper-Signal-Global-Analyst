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
  CheckCircle2
} from 'lucide-react';

const Streamers = () => {
  const [streamers, setStreamers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [currentStreamer, setCurrentStreamer] = useState({ id: '', nama: '', platform: 'TikTok' });
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // Social accounts editor states
  const [accountsModalOpen, setAccountsModalOpen] = useState(false);
  const [activeStreamer, setActiveStreamer] = useState(null);
  const [activeAccounts, setActiveAccounts] = useState([]);
  const [newAccountForm, setNewAccountForm] = useState({ platform: 'TikTok', username: '', link: '' });
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
    setNewAccountForm({ platform: 'TikTok', username: '', link: '' });
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
      await api.post(`/accounts/streamers/${activeStreamer.id}/accounts`, newAccountForm);
      setAccountsSuccess('Akun media sosial berhasil didaftarkan!');
      setNewAccountForm({ platform: 'TikTok', username: '', link: '' });
      fetchActiveAccounts(activeStreamer.id);
    } catch (err) {
      setAccountsError(err.response?.data?.message || 'Gagal menambahkan akun.');
    }
  };

  const handleDeleteAccount = async (accountId) => {
    if (!window.confirm('Hapus akun media sosial ini dari streamer?')) return;
    try {
      await api.delete(`/accounts/accounts/${accountId}`);
      setAccountsSuccess('Akun berhasil dihapus.');
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
    setCurrentStreamer({ id: '', nama: '', platform: 'TikTok' });
    setModalMode('add');
    setModalError('');
    setModalSuccess('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (streamer) => {
    setCurrentStreamer({ id: streamer.id, nama: streamer.nama, platform: streamer.platform });
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

  const handleDelete = async (id, nama) => {
    if (!window.confirm(`Are you sure you want to delete streamer "${nama}"? This will delete all their historical daily reports!`)) {
      return;
    }

    try {
      await api.delete(`/streamers/${id}`);
      fetchStreamers();
    } catch (error) {
      console.error('Failed to delete streamer:', error);
      alert(error.response?.data?.message || 'Failed to delete streamer');
    }
  };

  const filteredStreamers = streamers.filter(s => 
    s.nama.toLowerCase().includes(search.toLowerCase()) ||
    s.platform.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Header and Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Streamer Management</h2>
          <p className="text-sm text-gray-400">Add, edit, or delete affiliate accounts and view their total metrics logs.</p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/10 active:translate-y-px transition-all duration-200"
        >
          <Plus className="h-4.5 w-4.5" />
          Add New Streamer
        </button>
      </div>

      {/* Search Input Filter */}
      <div className="max-w-md">
        <div className="relative">
          <Search className="absolute inset-y-0 left-0 pl-3.5 h-full w-4.5 text-gray-500 flex items-center pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search streamers by name or platform..."
            className="block w-full pl-10 pr-3 py-2 text-sm rounded-xl border border-dark-border bg-slate-900/60 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center text-indigo-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent"></div>
          <span className="ml-3 text-sm">Loading streamers directory...</span>
        </div>
      ) : filteredStreamers.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl text-gray-500">
          No streamers found in database. Add a streamer to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStreamers.map((streamer) => (
            <div
              key={streamer.id}
              className="glass-panel p-6 rounded-2xl border flex flex-col justify-between hover:border-indigo-500/20 hover:-translate-y-1 transition-all duration-300 bg-slate-950/20"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between border-b border-dark-border/40 pb-3 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white leading-tight">{streamer.nama}</h3>
                    <span className="inline-block text-[10px] uppercase font-bold text-indigo-400 tracking-wider mt-0.5">
                      {streamer.platform}
                    </span>
                  </div>
                  
                  {/* Status Indicator */}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    parseInt(streamer.total_reports, 10) > 0
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {parseInt(streamer.total_reports, 10) > 0 ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Statistics counts */}
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Reports Ingested</span>
                    <strong className="text-white font-semibold">{streamer.total_reports} logs</strong>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Cumulative Duration</span>
                    <strong className="text-white font-semibold">{parseFloat(streamer.total_live_hours).toFixed(1)} hours</strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-dark-border/40">
                <button
                  onClick={() => handleOpenAccountsModal(streamer)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-dark-border hover:border-indigo-500/30 hover:bg-indigo-500/10 text-gray-300 hover:text-indigo-400 transition-colors"
                >
                  <Users className="h-3 w-3" />
                  Kelola Akun
                </button>
                <button
                  onClick={() => handleOpenEditModal(streamer)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-dark-border hover:border-indigo-500/30 hover:bg-indigo-500/10 text-gray-300 hover:text-indigo-400 transition-colors"
                >
                  <Edit2 className="h-3 w-3" />
                  Edit
                </button>

                <button
                  onClick={() => handleDelete(streamer.id, streamer.nama)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-dark-border hover:border-red-500/30 hover:bg-red-500/10 text-gray-300 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>

            </div>
          ))}
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

              <button
                type="submit"
                className="w-full mt-4 py-3 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white text-sm tracking-wide transition-colors"
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
                        <span className="font-bold text-indigo-400 mr-2">[{acc.platform}]</span>
                        <span>{acc.username}</span>
                        {acc.link && (
                          <a href={acc.link} target="_blank" rel="noreferrer" className="block text-[10px] text-gray-500 hover:underline mt-0.5">
                            Buka Profil ↗
                          </a>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteAccount(acc.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Add account form */}
            <form onSubmit={handleAddAccountSubmit} className="border-t border-slate-800 pt-5 space-y-4">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Tambah Akun Baru
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Platform</label>
                  <select
                    value={newAccountForm.platform}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, platform: e.target.value })}
                    className="w-full p-2 text-xs rounded-lg border border-dark-border bg-slate-900 text-white cursor-pointer"
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
                <label className="block text-[10px] text-gray-400 mb-1">Link Profil (Opsional)</label>
                <input
                  type="text"
                  value={newAccountForm.link}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, link: e.target.value })}
                  placeholder="https://tiktok.com/@dara_official"
                  className="w-full p-2 text-xs rounded-lg border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-xs transition-colors"
              >
                Tambahkan Akun
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Streamers;

