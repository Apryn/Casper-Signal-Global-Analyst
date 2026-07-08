import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  Download, 
  Edit2, 
  Trash2, 
  Filter, 
  Calendar,
  X,
  Plus,
  Video,
  MessageSquare,
  UserCheck,
  Coins,
  CheckCircle2,
  Tv
} from 'lucide-react';
import * as XLSX from 'xlsx';

const Reports = () => {
  const { isAdmin } = useAuth();
  
  // Filtering states
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [kategori, setKategori] = useState('');
  
  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (searchName) queryParams.append('streamerName', searchName);
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);
      if (kategori) queryParams.append('kategori', kategori);

      const res = await api.get(`/reports?${queryParams.toString()}`);
      setReports(res.data);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Bounce fetch requests slightly if typing name
    const delayDebounceFn = setTimeout(() => {
      fetchReports();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchName, startDate, endDate, kategori]);

  const handleExportExcel = () => {
    if (reports.length === 0) {
      alert("No data available to export.");
      return;
    }

    // Format columns to Indonesian
    const exportData = reports.map((r, index) => ({
      'No': index + 1,
      'Tanggal': r.tanggal ? r.tanggal.split('T')[0] : '',
      'Nama Streamer': r.streamer_name,
      'Kategori': r.kategori,
      'TikTok Upload': r.tiktok_upload,
      'YouTube Upload': r.youtube_upload,
      'Instagram Upload': r.instagram_upload,
      'Facebook Upload': r.facebook_upload,
      'Durasi Live (Jam)': parseFloat(r.live_duration),
      'Chat Masuk': r.chat_count,
      'Registrasi': r.registration_count,
      'FTD': r.ftd_count,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Auto-fit column widths
    const maxLens = {};
    exportData.forEach(row => {
      Object.keys(row).forEach(key => {
        const valStr = String(row[key]);
        maxLens[key] = Math.max(maxLens[key] || 0, valStr.length, key.length);
      });
    });
    worksheet['!cols'] = Object.keys(maxLens).map(key => ({
      wch: maxLens[key] + 3
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Reports Log");
    XLSX.writeFile(workbook, "Casper_Signal_Analytics_Daily_Reports.xlsx");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this report? This action is permanent.")) {
      return;
    }

    try {
      await api.delete(`/reports/${id}`);
      fetchReports();
    } catch (error) {
      console.error('Failed to delete report:', error);
      alert(error.response?.data?.message || 'Failed to delete report');
    }
  };

  const handleEditClick = (report) => {
    setEditingReport({
      ...report,
      tanggal: report.tanggal ? report.tanggal.split('T')[0] : ''
    });
    setModalError('');
    setModalSuccess('');
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');

    try {
      await api.put(`/reports/${editingReport.id}`, editingReport);
      setModalSuccess('Report updated successfully!');
      
      // Reload reports and close modal after 1s
      fetchReports();
      setTimeout(() => {
        setEditModalOpen(false);
      }, 1000);
    } catch (error) {
      console.error('Error updating report:', error);
      setModalError(error.response?.data?.message || 'Failed to update report. Please verify inputs.');
    }
  };

  const handleResetFilters = () => {
    setSearchName('');
    setStartDate('');
    setEndDate('');
    setKategori('');
  };

  return (
    <div className="space-y-6">
      
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Daily Recaps Ledger</h2>
          <p className="text-sm text-gray-400">Search, filter, edit, and export structured daily streamer reports.</p>
        </div>
        
        <button
          onClick={handleExportExcel}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/10 active:translate-y-px transition-all duration-200"
        >
          <Download className="h-4.5 w-4.5" />
          Export to Excel
        </button>
      </div>

      {/* Filter Control Bar */}
      <div className="glass-panel p-5 rounded-2xl border bg-slate-950/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        
        {/* Name Search */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest">Streamer Name</label>
          <div className="relative">
            <Search className="absolute inset-y-0 left-0 pl-3.5 h-full w-4.5 text-gray-500 flex items-center pointer-events-none" />
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Search by name..."
              className="block w-full pl-10 pr-3 py-2 text-sm rounded-xl border border-dark-border bg-slate-900/60 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Start Date */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest">Start Date</label>
          <div className="relative">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full px-3.5 py-2 text-sm rounded-xl border border-dark-border bg-slate-900/60 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
            />
          </div>
        </div>

        {/* End Date */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest">End Date</label>
          <div className="relative">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full px-3.5 py-2 text-sm rounded-xl border border-dark-border bg-slate-900/60 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest">Category</label>
          <select
            value={kategori}
            onChange={(e) => setKategori(e.target.value)}
            className="block w-full px-3 py-2 text-sm rounded-xl border border-dark-border bg-slate-900/60 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Categories</option>
            <option value="Streaming">Streaming</option>
            <option value="Non Streaming">Non Streaming</option>
          </select>
        </div>

        {/* Reset button */}
        <button
          onClick={handleResetFilters}
          className="w-full py-2 px-4 rounded-xl border border-dark-border hover:bg-slate-950 text-sm font-semibold text-gray-300 hover:text-white transition-colors h-10"
        >
          Reset Filters
        </button>

      </div>

      {/* Main Table */}
      <div className="glass-panel rounded-2xl border bg-slate-950/20 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-dark-border bg-slate-950/50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <th className="py-4.5 px-6">Tanggal</th>
                <th className="py-4.5 px-4">Nama</th>
                <th className="py-4.5 px-4">Kategori</th>
                <th className="py-4.5 px-4 text-center">TikTok</th>
                <th className="py-4.5 px-4 text-center">Youtube</th>
                <th className="py-4.5 px-4 text-center">Instagram</th>
                <th className="py-4.5 px-4 text-center">Facebook</th>
                <th className="py-4.5 px-4 text-center">Live</th>
                <th className="py-4.5 px-4 text-right">Chats</th>
                <th className="py-4.5 px-4 text-right">Regs</th>
                <th className="py-4.5 px-4 text-right">FTD</th>
                <th className="py-4.5 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/40 text-sm text-gray-300">
              {loading ? (
                <tr>
                  <td colSpan="12" className="py-12 text-center text-indigo-400">
                    <div className="flex justify-center items-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent"></div>
                      <span>Updating reports ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan="12" className="py-12 text-center text-gray-500">
                    No reports match selected filters.
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-900/25 transition-colors group">
                    {/* Date */}
                    <td className="py-4 px-6 text-xs font-mono font-medium text-white">
                      {report.tanggal ? report.tanggal.split('T')[0] : '-'}
                    </td>
                    
                    {/* Name */}
                    <td className="py-4 px-4 font-semibold text-white">
                      {report.streamer_name}
                      <span className="block text-[10px] text-gray-400 font-normal">{report.streamer_platform}</span>
                    </td>
                    
                    {/* Category */}
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        report.kategori === 'Streaming' 
                          ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                          : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                      }`}>
                        {report.kategori}
                      </span>
                    </td>

                    {/* Uploads Breakdown */}
                    <td className="py-4 px-4 text-center font-semibold text-white">{report.tiktok_upload || '-'}</td>
                    <td className="py-4 px-4 text-center font-semibold text-white">{report.youtube_upload || '-'}</td>
                    <td className="py-4 px-4 text-center font-semibold text-white">{report.instagram_upload || '-'}</td>
                    <td className="py-4 px-4 text-center font-semibold text-white">{report.facebook_upload || '-'}</td>

                    {/* Live Hours */}
                    <td className="py-4 px-4 text-center font-mono font-bold text-indigo-400">
                      {report.live_duration > 0 ? `${report.live_duration}h` : '-'}
                    </td>

                    {/* Engagement Counts */}
                    <td className="py-4 px-4 text-right font-mono font-medium">{report.chat_count.toLocaleString()}</td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-amber-500">{report.registration_count}</td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-emerald-400">{report.ftd_count}</td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-2.5">
                        <button
                          onClick={() => handleEditClick(report)}
                          className="p-1.5 rounded-lg border border-dark-border hover:border-indigo-500/40 hover:bg-indigo-500/10 text-gray-400 hover:text-indigo-400 transition-all duration-200"
                          title="Edit Report"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(report.id)}
                            className="p-1.5 rounded-lg border border-dark-border hover:border-red-500/40 hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-all duration-200"
                            title="Delete Report"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Report Modal */}
      {editModalOpen && editingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs" onClick={() => setEditModalOpen(false)} />
          
          <div className="relative w-full max-w-lg p-6 md:p-8 rounded-2xl border border-dark-border bg-slate-950 shadow-2xl z-10 animate-scale-up">
            <button
              onClick={() => setEditModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-900 text-gray-400 hover:text-white border border-dark-border"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">Edit Daily Report</h3>
            <p className="text-xs text-indigo-400 font-semibold mb-6">
              Streamer: {editingReport.streamer_name} &bull; Date: {editingReport.tanggal}
            </p>

            {modalError && (
              <div className="flex items-center gap-2 p-3 mb-5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs">
                <span>{modalError}</span>
              </div>
            )}

            {modalSuccess && (
              <div className="flex items-center gap-2 p-3 mb-5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">
                <CheckCircle2 className="h-4 w-4" />
                <span>{modalSuccess}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              
              {/* Category selector */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Category</label>
                <select
                  value={editingReport.kategori}
                  onChange={(e) => setEditingReport({ ...editingReport, kategori: e.target.value })}
                  className="w-full p-2.5 text-sm rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Streaming">Streaming</option>
                  <option value="Non Streaming">Non Streaming</option>
                </select>
              </div>

              {/* Uploads Breakdown */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Content Uploads</label>
                <div className="grid grid-cols-4 gap-2.5">
                  <div className="space-y-1">
                    <span className="block text-[9px] font-semibold text-gray-400 text-center">TikTok</span>
                    <input
                      type="number"
                      value={editingReport.tiktok_upload}
                      onChange={(e) => setEditingReport({ ...editingReport, tiktok_upload: parseInt(e.target.value) || 0 })}
                      className="w-full text-center p-2 text-xs rounded-lg border border-dark-border bg-slate-900 text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-[9px] font-semibold text-gray-400 text-center">YouTube</span>
                    <input
                      type="number"
                      value={editingReport.youtube_upload}
                      onChange={(e) => setEditingReport({ ...editingReport, youtube_upload: parseInt(e.target.value) || 0 })}
                      className="w-full text-center p-2 text-xs rounded-lg border border-dark-border bg-slate-900 text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-[9px] font-semibold text-gray-400 text-center">Instagram</span>
                    <input
                      type="number"
                      value={editingReport.instagram_upload}
                      onChange={(e) => setEditingReport({ ...editingReport, instagram_upload: parseInt(e.target.value) || 0 })}
                      className="w-full text-center p-2 text-xs rounded-lg border border-dark-border bg-slate-900 text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-[9px] font-semibold text-gray-400 text-center">Facebook</span>
                    <input
                      type="number"
                      value={editingReport.facebook_upload}
                      onChange={(e) => setEditingReport({ ...editingReport, facebook_upload: parseInt(e.target.value) || 0 })}
                      className="w-full text-center p-2 text-xs rounded-lg border border-dark-border bg-slate-900 text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Engagement Parameters */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Live Hours</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingReport.live_duration}
                    disabled={editingReport.kategori === 'Non Streaming'}
                    onChange={(e) => setEditingReport({ ...editingReport, live_duration: parseFloat(e.target.value) || 0.0 })}
                    className="w-full p-2.5 text-sm rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Chats Received</label>
                  <input
                    type="number"
                    value={editingReport.chat_count}
                    onChange={(e) => setEditingReport({ ...editingReport, chat_count: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 text-sm rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Registrations</label>
                  <input
                    type="number"
                    value={editingReport.registration_count}
                    onChange={(e) => setEditingReport({ ...editingReport, registration_count: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 text-sm rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">FTDs Created</label>
                  <input
                    type="number"
                    value={editingReport.ftd_count}
                    onChange={(e) => setEditingReport({ ...editingReport, ftd_count: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 text-sm rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                className="w-full mt-4 py-3 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white text-sm tracking-wide transition-colors"
              >
                Save Changes
              </button>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Reports;
