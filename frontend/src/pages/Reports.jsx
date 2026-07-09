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
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newReport, setNewReport] = useState({
    streamer_id: '',
    tanggal: new Date().toISOString().split('T')[0],
    kategori: 'Streaming',
    tiktok_upload: 0,
    youtube_upload: 0,
    instagram_upload: 0,
    facebook_upload: 0,
    live_duration: 0.0,
    chat_count: 0,
    registration_count: 0,
    ftd_count: 0
  });
  const [streamers, setStreamers] = useState([]);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // Fetch streamers on mount
  useEffect(() => {
    const fetchStreamers = async () => {
      try {
        const res = await api.get('/streamers');
        setStreamers(res.data);
      } catch (err) {
        console.error('Error fetching streamers list:', err);
      }
    };
    fetchStreamers();
  }, []);

  const handleOpenAddModal = () => {
    setNewReport({
      streamer_id: streamers.length > 0 ? streamers[0].id : '',
      tanggal: new Date().toISOString().split('T')[0],
      kategori: 'Streaming',
      tiktok_upload: 0,
      youtube_upload: 0,
      instagram_upload: 0,
      facebook_upload: 0,
      live_duration: 0.0,
      chat_count: 0,
      registration_count: 0,
      ftd_count: 0
    });
    setModalError('');
    setModalSuccess('');
    setAddModalOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');

    if (!newReport.streamer_id || !newReport.tanggal) {
      setModalError('Streamer dan Tanggal wajib diisi!');
      return;
    }

    try {
      await api.post('/reports', newReport);
      setModalSuccess('Laporan harian berhasil ditambahkan secara manual!');
      fetchReports();
      setTimeout(() => {
        setAddModalOpen(false);
      }, 1000);
    } catch (err) {
      console.error('Error creating report:', err);
      setModalError(err.response?.data?.message || 'Gagal menambahkan laporan.');
    }
  };

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

    // 1. Sheet 1: Daily Reports Log
    const logData = reports.map((r, index) => ({
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
    const logWorksheet = XLSX.utils.json_to_sheet(logData);

    // 2. Sheet 2: Streamer Summary Aggregates
    const uniqueStreamers = [...new Set(reports.map(r => r.streamer_name))];
    const summaryData = uniqueStreamers.map((name, index) => {
      const streamerReports = reports.filter(r => r.streamer_name === name);
      const hours = streamerReports.reduce((sum, r) => sum + parseFloat(r.live_duration), 0);
      const uploads = streamerReports.reduce((sum, r) => sum + r.tiktok_upload + r.youtube_upload + r.instagram_upload + r.facebook_upload, 0);
      const chats = streamerReports.reduce((sum, r) => sum + r.chat_count, 0);
      const regs = streamerReports.reduce((sum, r) => sum + r.registration_count, 0);
      const ftds = streamerReports.reduce((sum, r) => sum + r.ftd_count, 0);
      const regRate = chats > 0 ? parseFloat(((regs / chats) * 100).toFixed(1)) : 0.0;
      const ftdConv = regs > 0 ? parseFloat(((ftds / regs) * 100).toFixed(1)) : 0.0;

      return {
        'No': index + 1,
        'Nama Streamer': name,
        'Total Jam Live': hours,
        'Total Upload Konten': uploads,
        'Total Chat Masuk': chats,
        'Total Registrasi': regs,
        'Total FTD': ftds,
        'Registration Rate (%)': regRate,
        'FTD Conversion (%)': ftdConv
      };
    });
    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);

    // Create workbook and append sheets
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, logWorksheet, "Laporan Harian");
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Ringkasan Streamer");

    // Write file
    XLSX.writeFile(workbook, "Casper_Signal_BI_Report.xlsx");
  };

  const handleExportPdf = () => {
    if (reports.length === 0) {
      alert("No data available to export.");
      return;
    }

    const printWindow = window.open('', '_blank');
    const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    let tableRows = '';
    reports.forEach((r, idx) => {
      const convRate = r.registration_count > 0 ? Math.round((r.ftd_count / r.registration_count) * 100) : 0;
      tableRows += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px; text-align: center;">${idx + 1}</td>
          <td style="padding: 8px;">${r.tanggal ? r.tanggal.split('T')[0] : ''}</td>
          <td style="padding: 8px; font-weight: bold;">${r.streamer_name}</td>
          <td style="padding: 8px; text-align: center;">${r.kategori}</td>
          <td style="padding: 8px; text-align: center;">${parseFloat(r.live_duration).toFixed(1)} hrs</td>
          <td style="padding: 8px; text-align: center;">${r.tiktok_upload + r.youtube_upload + r.instagram_upload + r.facebook_upload}</td>
          <td style="padding: 8px; text-align: right;">${r.chat_count.toLocaleString()}</td>
          <td style="padding: 8px; text-align: right;">${r.registration_count}</td>
          <td style="padding: 8px; text-align: right; color: #10b981; font-weight: bold;">${r.ftd_count}</td>
          <td style="padding: 8px; text-align: right; font-weight: bold;">${convRate}%</td>
        </tr>
      `;
    });

    const htmlContent = `
      <html>
        <head>
          <title>Casper Signal BI Report - PDF</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #334155; padding: 25px; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 15px; margin-bottom: 20px; }
            h1 { font-size: 22px; color: #0f172a; margin: 0; }
            .meta { font-size: 11px; color: #64748b; text-align: right; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
            th { background-color: #f8fafc; padding: 10px 8px; font-weight: bold; border-bottom: 2px solid #cbd5e1; text-align: left; text-transform: uppercase; font-size: 9px; color: #64748b; }
            tr:nth-child(even) { background-color: #f8fafc; }
            @media print {
              @page { size: landscape; margin: 1cm; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Casper Signal Analytics Dashboard</h1>
              <span style="font-size: 11px; color: #64748b;">Laporan Buku Besar Harian (Daily Recaps Ledger)</span>
            </div>
            <div class="meta">
              <strong>Tanggal Cetak:</strong> ${todayStr}<br/>
              <strong>Total Baris Laporan:</strong> ${reports.length}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 40px;">No</th>
                <th style="width: 80px;">Tanggal</th>
                <th>Nama Streamer</th>
                <th style="text-align: center;">Kategori</th>
                <th style="text-align: center;">Live Durasi</th>
                <th style="text-align: center;">Uploads</th>
                <th style="text-align: right;">Chat Masuk</th>
                <th style="text-align: right;">Registrasi</th>
                <th style="text-align: right;">FTD</th>
                <th style="text-align: right;">Conv Rate</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
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

    printWindow.document.write(htmlContent);
    printWindow.document.close();
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
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportPdf}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/10 active:translate-y-px transition-all duration-200"
          >
            <Download className="h-4.5 w-4.5" />
            Export to PDF
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/10 active:translate-y-px transition-all duration-200"
          >
            <Download className="h-4.5 w-4.5" />
            Export to Excel
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/10 active:translate-y-px transition-all duration-200"
          >
            <Plus className="h-4.5 w-4.5" />
            Tambah Laporan Baru
          </button>
        </div>
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
                  <td colSpan="11" className="py-12 text-center text-indigo-400">
                    <div className="flex justify-center items-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent"></div>
                      <span>Updating reports ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan="11" className="py-12 text-center text-gray-500">
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

      {/* Add Report Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs" onClick={() => setAddModalOpen(false)} />
          
          <div className="relative w-full max-w-lg p-6 md:p-8 rounded-2xl border border-dark-border bg-slate-950 shadow-2xl z-10 animate-scale-up">
            <button
              onClick={() => setAddModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-900 text-gray-400 hover:text-white border border-dark-border"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-6">Tambah Laporan Harian Baru</h3>

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

            <form onSubmit={handleAddSubmit} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Streamer</label>
                  <select
                    value={newReport.streamer_id}
                    onChange={(e) => setNewReport({ ...newReport, streamer_id: e.target.value })}
                    className="w-full p-2.5 text-sm rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none"
                  >
                    {streamers.map(s => (
                      <option key={s.id} value={s.id} className="bg-slate-950">{s.nama}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Tanggal</label>
                  <input
                    type="date"
                    value={newReport.tanggal}
                    onChange={(e) => setNewReport({ ...newReport, tanggal: e.target.value })}
                    className="w-full p-2.5 text-sm rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Uploads Breakdown */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Content Uploads</label>
                <div className="grid grid-cols-4 gap-2.5">
                  <div className="space-y-1">
                    <span className="block text-[9px] font-semibold text-gray-400 text-center">TikTok</span>
                    <input
                      type="number"
                      value={newReport.tiktok_upload}
                      onChange={(e) => setNewReport({ ...newReport, tiktok_upload: parseInt(e.target.value) || 0 })}
                      className="w-full text-center p-2 text-xs rounded-lg border border-dark-border bg-slate-900 text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-[9px] font-semibold text-gray-400 text-center">YouTube</span>
                    <input
                      type="number"
                      value={newReport.youtube_upload}
                      onChange={(e) => setNewReport({ ...newReport, youtube_upload: parseInt(e.target.value) || 0 })}
                      className="w-full text-center p-2 text-xs rounded-lg border border-dark-border bg-slate-900 text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-[9px] font-semibold text-gray-400 text-center">Instagram</span>
                    <input
                      type="number"
                      value={newReport.instagram_upload}
                      onChange={(e) => setNewReport({ ...newReport, instagram_upload: parseInt(e.target.value) || 0 })}
                      className="w-full text-center p-2 text-xs rounded-lg border border-dark-border bg-slate-900 text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-[9px] font-semibold text-gray-400 text-center">Facebook</span>
                    <input
                      type="number"
                      value={newReport.facebook_upload}
                      onChange={(e) => setNewReport({ ...newReport, facebook_upload: parseInt(e.target.value) || 0 })}
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
                    value={newReport.live_duration}
                    onChange={(e) => setNewReport({ ...newReport, live_duration: parseFloat(e.target.value) || 0.0 })}
                    className="w-full p-2.5 text-sm rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Chats Received</label>
                  <input
                    type="number"
                    value={newReport.chat_count}
                    onChange={(e) => setNewReport({ ...newReport, chat_count: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 text-sm rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Registrations</label>
                  <input
                    type="number"
                    value={newReport.registration_count}
                    onChange={(e) => setNewReport({ ...newReport, registration_count: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 text-sm rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">FTDs Created</label>
                  <input
                    type="number"
                    value={newReport.ftd_count}
                    onChange={(e) => setNewReport({ ...newReport, ftd_count: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 text-sm rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                className="w-full mt-4 py-3 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white text-sm tracking-wide transition-colors"
              >
                Simpan Laporan
              </button>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Reports;
