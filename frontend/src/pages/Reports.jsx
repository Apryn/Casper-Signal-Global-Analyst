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
  Tv,
  Send
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

  // Telegram status states
  const [telegramSending, setTelegramSending] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState({ type: '', message: '' });
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

  const handleSendTelegramReminder = async () => {
    if (!window.confirm("Apakah Anda yakin ingin mengirimkan pengingat laporan ke grup Telegram sekarang?")) {
      return;
    }

    setTelegramSending(true);
    setTelegramStatus({ type: '', message: '' });

    try {
      const res = await api.post('/reports/telegram-reminder');
      setTelegramStatus({
        type: 'success',
        message: `Pengingat berhasil dikirim! (${res.data.recipientCount} streamer belum melapor)`
      });
      setTimeout(() => {
        setTelegramStatus({ type: '', message: '' });
      }, 8000);
    } catch (err) {
      console.error('Error sending telegram reminder:', err);
      setTelegramStatus({
        type: 'error',
        message: err.response?.data?.message || 'Gagal mengirimkan pengingat ke Telegram.'
      });
    } finally {
      setTelegramSending(false);
    }
  };

  const totalTiktok = reports.reduce((sum, r) => sum + (r.tiktok_upload || 0), 0);
  const totalYoutube = reports.reduce((sum, r) => sum + (r.youtube_upload || 0), 0);
  const totalInstagram = reports.reduce((sum, r) => sum + (r.instagram_upload || 0), 0);
  const totalFacebook = reports.reduce((sum, r) => sum + (r.facebook_upload || 0), 0);
  const totalLive = reports.reduce((sum, r) => sum + parseFloat(r.live_duration || 0), 0);
  const totalChats = reports.reduce((sum, r) => sum + (r.chat_count || 0), 0);
  const totalRegs = reports.reduce((sum, r) => sum + (r.registration_count || 0), 0);
  const totalFtds = reports.reduce((sum, r) => sum + (r.ftd_count || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <span>Daily Recaps Ledger</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {reports.length} Records
            </span>
          </h2>
          <p className="text-sm text-slate-400">Monitoring & audit log performa harian streamer, live streaming, dan konversi FTD.</p>
        </div>
        
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleExportPdf}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600/90 hover:bg-rose-500 text-white shadow-md transition-all duration-200 active:scale-95"
          >
            <Download className="h-4 w-4" />
            Export PDF
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-md transition-all duration-200 active:scale-95"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>

          <button
            onClick={handleSendTelegramReminder}
            disabled={telegramSending}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-md transition-all duration-200 active:scale-95 ${
              telegramSending 
                ? 'bg-sky-700/50 cursor-not-allowed opacity-75' 
                : 'bg-sky-600 hover:bg-sky-500'
            }`}
          >
            {telegramSending ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Pengingat Telegram
              </>
            )}
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all duration-200 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Tambah Laporan
          </button>
        </div>
      </div>

      {telegramStatus.message && (
        <div className={`p-4 rounded-xl border flex items-center justify-between transition-all duration-300 ${
          telegramStatus.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          <div className="flex items-center gap-2.5">
            {telegramStatus.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <X className="h-5 w-5 shrink-0 cursor-pointer" onClick={() => setTelegramStatus({ type: '', message: '' })} />
            )}
            <span className="text-sm font-medium">{telegramStatus.message}</span>
          </div>
          <button 
            onClick={() => setTelegramStatus({ type: '', message: '' })}
            className="text-xs font-semibold opacity-70 hover:opacity-100 transition-opacity"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stat Cards Overview Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Reports */}
        <div className="glass-panel p-4.5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg relative overflow-hidden group hover:border-indigo-500/30 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Laporan</p>
              <h3 className="text-2xl font-bold text-white mt-1">{reports.length} <span className="text-xs text-slate-500 font-normal">rekap</span></h3>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Tv className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
              {reports.filter(r => r.kategori === 'Streaming').length} Streaming
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-medium border border-slate-700/50">
              {reports.filter(r => r.kategori === 'Non Streaming').length} Off
            </span>
          </div>
        </div>

        {/* Card 2: Total Live Hours */}
        <div className="glass-panel p-4.5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg relative overflow-hidden group hover:border-purple-500/30 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Jam Live</p>
              <h3 className="text-2xl font-bold text-purple-300 mt-1">{totalLive.toFixed(1)} <span className="text-xs text-slate-500 font-normal">Jam</span></h3>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Video className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-xs text-purple-300/80 font-medium">
            Akumulasi durasi tayang live streamer
          </div>
        </div>

        {/* Card 3: Total Registrations & Chats */}
        <div className="glass-panel p-4.5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg relative overflow-hidden group hover:border-indigo-500/30 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Registrasi & Chat</p>
              <h3 className="text-2xl font-bold text-indigo-300 mt-1">{totalRegs.toLocaleString()} <span className="text-xs text-slate-500 font-normal">Regs</span></h3>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-400 flex items-center justify-between">
            <span>Total Chat Masuk:</span>
            <span className="font-semibold text-slate-200">{totalChats.toLocaleString()}</span>
          </div>
        </div>

        {/* Card 4: Total FTD */}
        <div className="glass-panel p-4.5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-amber-950/20 shadow-lg relative overflow-hidden group hover:border-amber-400/50 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/90">Total FTD (Deposit Baru)</p>
              <h3 className="text-3xl font-extrabold text-amber-400 mt-1 tracking-tight drop-shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                {totalFtds.toLocaleString()} <span className="text-xs text-amber-300 font-normal">FTD</span>
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shadow-inner">
              <Coins className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-3 text-xs text-amber-400/90 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            Puncak pencapaian konversi
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-950/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        
        {/* Name Search */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">Cari Streamer</label>
          <div className="relative">
            <Search className="absolute inset-y-0 left-0 pl-3 h-full w-4 text-slate-500 flex items-center pointer-events-none" />
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Nama streamer..."
              className="block w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-800 bg-slate-900/80 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Start Date */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">Mulai Tanggal</label>
          <div className="relative">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full px-3 py-2 text-xs rounded-xl border border-slate-800 bg-slate-900/80 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
            />
          </div>
        </div>

        {/* End Date */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">Sampai Tanggal</label>
          <div className="relative">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full px-3 py-2 text-xs rounded-xl border border-slate-800 bg-slate-900/80 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">Kategori Status</label>
          <select
            value={kategori}
            onChange={(e) => setKategori(e.target.value)}
            className="block w-full px-3 py-2 text-xs rounded-xl border border-slate-800 bg-slate-900/80 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
          >
            <option value="">Semua Kategori</option>
            <option value="Streaming">Streaming Only</option>
            <option value="Non Streaming">Non Streaming Only</option>
          </select>
        </div>

        {/* Reset button */}
        <button
          onClick={handleResetFilters}
          className="w-full py-2 px-4 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-colors h-9"
        >
          Reset Filters
        </button>

      </div>

      {/* ========== CARD VIEW - Grouped by Date ========== */}
      {(() => {
        const MIN_LIVE_HOURS = 2; // Target minimum jam live per hari

        // Group reports by date, sort dates descending
        const groupedByDate = reports.reduce((groups, report) => {
          const date = report.tanggal ? report.tanggal.split('T')[0] : 'Unknown';
          if (!groups[date]) groups[date] = [];
          groups[date].push(report);
          return groups;
        }, {});
        const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));

        // Work status helper
        const getWorkStatus = (report) => {
          const isStreaming = report.kategori === 'Streaming';
          const liveHours = parseFloat(report.live_duration || 0);
          const liveMet = liveHours >= MIN_LIVE_HOURS;

          if (!isStreaming) {
            return {
              icon: '📴',
              label: 'Non-Streaming',
              sub: 'Hari tidak live',
              bgColor: 'bg-slate-800/60',
              borderColor: 'border-slate-700/40',
              textColor: 'text-slate-400',
              dotColor: 'bg-slate-500',
            };
          }
          if (liveMet) {
            return {
              icon: '✅',
              label: 'Sudah Bekerja',
              sub: `Rekap ✓ · Live ${liveHours.toFixed(1)}h/${MIN_LIVE_HOURS}h ✓`,
              bgColor: 'bg-emerald-950/40',
              borderColor: 'border-emerald-700/30',
              textColor: 'text-emerald-400',
              dotColor: 'bg-emerald-400',
            };
          }
          return {
            icon: '⚠️',
            label: 'Live Kurang',
            sub: `Rekap ✓ · Live ${liveHours.toFixed(1)}h/${MIN_LIVE_HOURS}h`,
            bgColor: 'bg-amber-950/30',
            borderColor: 'border-amber-700/30',
            textColor: 'text-amber-400',
            dotColor: 'bg-amber-400',
          };
        };

        // Format date to Indonesian
        const formatDate = (dateStr) => {
          const d = new Date(dateStr + 'T00:00:00');
          return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        };

        if (loading) {
          return (
            <div className="flex justify-center items-center gap-3 py-20 text-indigo-400">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent"></div>
              <span className="text-sm">Memuat data laporan harian...</span>
            </div>
          );
        }

        if (reports.length === 0) {
          return (
            <div className="py-20 text-center text-slate-500 text-sm">
              Tidak ada laporan yang sesuai dengan filter.
            </div>
          );
        }

        return (
          <div className="space-y-6">
            {sortedDates.map((date) => {
              const dayReports = groupedByDate[date];
              const dayFtds = dayReports.reduce((s, r) => s + (r.ftd_count || 0), 0);
              const dayRegs = dayReports.reduce((s, r) => s + (r.registration_count || 0), 0);
              const dayLive = dayReports.reduce((s, r) => s + parseFloat(r.live_duration || 0), 0);
              const doneCount = dayReports.filter(r => {
                const isStreaming = r.kategori === 'Streaming';
                const liveMet = parseFloat(r.live_duration || 0) >= MIN_LIVE_HOURS;
                return !isStreaming || liveMet;
              }).length;

              return (
                <div key={date} className="space-y-3">
                  {/* Date Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white tracking-wide">{formatDate(date)}</span>
                        <span className="text-[11px] text-slate-500">{dayReports.length} streamer melapor</span>
                      </div>
                      <div className="h-px flex-1 min-w-8 bg-slate-800"></div>
                    </div>
                    {/* Day Summary Pills */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50 font-mono">
                        ⏱ {dayLive.toFixed(1)}h live
                      </span>
                      {dayRegs > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                          👤 {dayRegs} reg
                        </span>
                      )}
                      {dayFtds > 0 ? (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25 font-bold font-mono shadow-[0_0_8px_rgba(245,158,11,0.15)]">
                          ✨ {dayFtds} FTD
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-600 border border-slate-800 font-mono">
                          0 FTD
                        </span>
                      )}
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                        {doneCount}/{dayReports.length} selesai
                      </span>
                    </div>
                  </div>

                  {/* Streamer Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {dayReports.map((report) => {
                      const status = getWorkStatus(report);
                      const totalUploads = (report.tiktok_upload || 0) + (report.youtube_upload || 0) + (report.instagram_upload || 0) + (report.facebook_upload || 0);
                      return (
                        <div
                          key={report.id}
                          className={`relative rounded-xl border ${status.borderColor} ${status.bgColor} p-4 transition-all hover:scale-[1.01] hover:shadow-lg`}
                        >
                          {/* Card Top: Streamer Name + Action */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {/* Status dot */}
                              <span className={`w-2 h-2 rounded-full ${status.dotColor} mt-0.5 shrink-0`}></span>
                              <div>
                                <p className="font-bold text-white text-sm leading-tight">{report.streamer_name}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">{report.streamer_platform}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleEditClick(report)}
                              className="p-1 rounded-lg border border-slate-700/40 hover:border-indigo-500/50 hover:bg-indigo-500/10 text-slate-600 hover:text-indigo-300 transition-all shrink-0"
                              title="Edit"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Work Status Banner */}
                          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg mb-3 border ${status.borderColor} bg-black/20`}>
                            <span className="text-xs">{status.icon}</span>
                            <div className="min-w-0">
                              <p className={`text-[11px] font-bold ${status.textColor} leading-tight`}>{status.label}</p>
                              <p className="text-[10px] text-slate-500 leading-tight truncate">{status.sub}</p>
                            </div>
                          </div>

                          {/* Metrics Grid */}
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            {/* Live Duration */}
                            <div className="text-center">
                              <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Live</p>
                              {parseFloat(report.live_duration) > 0 ? (
                                <p className="text-xs font-bold text-violet-300 font-mono">{report.live_duration}h</p>
                              ) : (
                                <p className="text-xs text-slate-600">—</p>
                              )}
                            </div>
                            {/* Registrasi */}
                            <div className="text-center">
                              <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Reg</p>
                              {report.registration_count > 0 ? (
                                <p className="text-xs font-bold text-indigo-300 font-mono">{report.registration_count}</p>
                              ) : (
                                <p className="text-xs text-slate-600">—</p>
                              )}
                            </div>
                            {/* FTD */}
                            <div className="text-center">
                              <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">FTD</p>
                              {report.ftd_count > 0 ? (
                                <p className="text-xs font-extrabold text-amber-300 font-mono drop-shadow-[0_0_4px_rgba(245,158,11,0.4)]">{report.ftd_count}</p>
                              ) : (
                                <p className="text-xs text-slate-600">—</p>
                              )}
                            </div>
                          </div>

                          {/* Upload Sosmed pills */}
                          {totalUploads > 0 ? (
                            <div className="flex flex-wrap gap-1 border-t border-slate-800/60 pt-2.5">
                              {report.tiktok_upload > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono border border-slate-700/50">TT·{report.tiktok_upload}</span>
                              )}
                              {report.youtube_upload > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950/80 text-rose-300 font-mono border border-rose-800/40">YT·{report.youtube_upload}</span>
                              )}
                              {report.instagram_upload > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-pink-950/80 text-pink-300 font-mono border border-pink-800/40">IG·{report.instagram_upload}</span>
                              )}
                              {report.facebook_upload > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-950/80 text-blue-300 font-mono border border-blue-800/40">FB·{report.facebook_upload}</span>
                              )}
                            </div>
                          ) : (
                            <div className="border-t border-slate-800/60 pt-2.5">
                              <span className="text-[10px] text-slate-700">Tidak ada upload konten</span>
                            </div>
                          )}

                          {/* Delete button for admin */}
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(report.id)}
                              className="absolute top-3 right-8 p-1 rounded text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                              title="Hapus"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

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
