import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  TrendingUp, 
  Tv, 
  Video, 
  MessageSquare, 
  UserCheck, 
  Coins, 
  Sparkles,
  ArrowRight,
  TrendingDown,
  Info,
  Calendar,
  AlertOctagon,
  Clock,
  UserX,
  PlusCircle,
  FileSpreadsheet,
  X,
  Users
} from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';

const Performance = () => {
  const [streamers, setStreamers] = useState([]);
  const [selectedStreamerId, setSelectedStreamerId] = useState('');
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState('30days');

  // New states for Penalty Report
  const [activeTab, setActiveTab] = useState('funnel'); // 'funnel' | 'penalty' | 'viewer'
  const [selectedMonth, setSelectedMonth] = useState('');
  const [penaltyData, setPenaltyData] = useState(null);
  const [penaltyLoading, setPenaltyLoading] = useState(false);
  const [basicSalary, setBasicSalary] = useState(3000000); // Gaji Pokok default 3 Juta

  // State for detail history modal (Opsi 2)
  const [selectedStreamerDetail, setSelectedStreamerDetail] = useState(null);

  // State for Viewer History analysis (Opsi 3)
  const [viewerHistoryData, setViewerHistoryData] = useState([]);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerDate, setViewerDate] = useState('');
  const [viewerStreamerId, setViewerStreamerId] = useState('all');

  // Rate settings for penalties
  const [rateLate, setRateLate] = useState(2000);     // Rp 2.000 / mnt
  const [rateAbsent, setRateAbsent] = useState(100000); // Rp 100.000 / bolos
  const [rateSwap, setRateSwap] = useState(50000);      // Rp 50.000 / swap izin

  // Fetch streamers list
  useEffect(() => {
    const fetchStreamers = async () => {
      try {
        const res = await api.get('/streamers');
        setStreamers(res.data);
        if (res.data.length > 0) {
          setSelectedStreamerId(res.data[0].id);
        }
      } catch (err) {
        console.error('Error fetching streamers for analytics dropdown:', err);
      }
    };
    fetchStreamers();

    // Set default month to current month (YYYY-MM)
    const today = new Date();
    const curMonth = today.toISOString().slice(0, 7);
    setSelectedMonth(curMonth);

    // Set default date for viewer analysis to today YYYY-MM-DD
    const curDate = today.toISOString().split('T')[0];
    setViewerDate(curDate);
  }, []);

  // Fetch performance details when streamer or range changes
  useEffect(() => {
    if (!selectedStreamerId || activeTab !== 'funnel') return;

    const fetchPerformance = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/analytics/streamer/${selectedStreamerId}?range=${range}`);
        setPerformance(res.data);
      } catch (err) {
        console.error('Error fetching streamer performance details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPerformance();
  }, [selectedStreamerId, range, activeTab]);

  // Fetch monthly penalty report when month or rates change
  const fetchPenaltyReport = async () => {
    if (!selectedMonth || activeTab !== 'penalty') return;
    setPenaltyLoading(true);
    try {
      const res = await api.get(`/analytics/monthly-penalty`, {
        params: {
          month: selectedMonth,
          rateLate,
          rateAbsent,
          rateSwap
        }
      });
      setPenaltyData(res.data);
    } catch (err) {
      console.error('Error fetching penalty report:', err);
    } finally {
      setPenaltyLoading(false);
    }
  };

  useEffect(() => {
    fetchPenaltyReport();
  }, [selectedMonth, activeTab]);

  // Fetch viewer history data
  const fetchViewerHistory = async () => {
    if (!viewerDate || activeTab !== 'viewer') return;
    setViewerLoading(true);
    try {
      const res = await api.get('/analytics/viewer-history', {
        params: {
          date: viewerDate,
          streamerId: viewerStreamerId === 'all' ? undefined : viewerStreamerId
        }
      });
      setViewerHistoryData(res.data);
    } catch (err) {
      console.error('Error fetching viewer history:', err);
    } finally {
      setViewerLoading(false);
    }
  };

  useEffect(() => {
    fetchViewerHistory();
  }, [viewerDate, viewerStreamerId, activeTab]);

  const handleApplyRates = (e) => {
    e.preventDefault();
    fetchPenaltyReport();
  };

  if (streamers.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        No streamers found in the directory. Please add streamers first.
      </div>
    );
  }

  // Setup Chart configs for conversion funnel
  const getLineChartData = () => {
    if (!performance || !performance.dailyTrend) return { labels: [], datasets: [] };
    const points = performance.dailyTrend;
    return {
      labels: points.map(p => p.date),
      datasets: [
        {
          label: 'FTD',
          borderColor: '#10b981',
          backgroundColor: 'transparent',
          borderWidth: 3,
          tension: 0.3,
          pointBackgroundColor: '#10b981',
          data: points.map(p => p.ftds)
        },
        {
          label: 'Registrations',
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.05)',
          borderWidth: 3,
          tension: 0.3,
          fill: true,
          pointBackgroundColor: '#6366f1',
          data: points.map(p => p.regs)
        }
      ]
    };
  };

  const getBarChartData = () => {
    if (!performance || !performance.dailyTrend) return { labels: [], datasets: [] };
    const points = performance.dailyTrend;
    return {
      labels: points.map(p => p.date),
      datasets: [
        {
          label: 'Incoming Chats',
          backgroundColor: 'rgba(6, 182, 212, 0.4)',
          borderColor: '#06b6d4',
          borderWidth: 1.5,
          data: points.map(p => p.chats)
        }
      ]
    };
  };

  // Setup Chart configs for Viewer History per platform
  const getViewerChartData = () => {
    if (viewerHistoryData.length === 0) return { labels: [], datasets: [] };

    // Format timestamps to HH:MM WIB
    const labels = viewerHistoryData.map(h => {
      const d = new Date(h.recorded_at);
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    });

    const ytData = viewerHistoryData.map(h => h.platform === 'YouTube' ? h.viewer_count : null);
    const ttData = viewerHistoryData.map(h => h.platform === 'TikTok' ? h.viewer_count : null);

    return {
      labels,
      datasets: [
        {
          label: 'YouTube Viewers',
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 3.5,
          tension: 0.3,
          pointBackgroundColor: '#10b981',
          spanGaps: true, // Biarkan tersambung jika ada jeda platform
          data: ytData
        },
        {
          label: 'TikTok Viewers',
          borderColor: '#f43f5e',
          backgroundColor: 'rgba(244, 63, 94, 0.1)',
          borderWidth: 3.5,
          tension: 0.3,
          pointBackgroundColor: '#f43f5e',
          spanGaps: true,
          data: ttData
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#94a3b8', font: { family: 'Outfit' } }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.02)' },
        ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
      }
    }
  };

  const stats = performance?.summary;

  // Format currency helpers (IDR)
  const formatIDR = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  };

  // Opsi 1: Fungsi Ekspor Laporan Bulanan ke CSV
  const handleExportCSV = () => {
    if (!penaltyData?.report || penaltyData.report.length === 0) return;

    // Define CSV Headers
    const headers = [
      'Nama Streamer',
      'Platform',
      'Total Sesi Terjadwal',
      'Total Terlambat (Menit)',
      'Jumlah Bolos (Sesi)',
      'Jumlah Izin (Sesi)',
      'Jumlah Sakit (Sesi)',
      'Jumlah Menggantikan (Sesi)',
      'Denda Telat (IDR)',
      'Denda Bolos (IDR)',
      'Denda Izin (IDR)',
      'Bonus Menggantikan (IDR)',
      'Total Net Potongan (IDR)',
      'Gaji Pokok (IDR)',
      'Gaji Akhir Diterima (IDR)'
    ];

    // Build Rows
    const rows = penaltyData.report.map(row => {
      const takeHomePay = Math.max(0, basicSalary - row.financials.netDeduction);
      return [
        `"${row.nama}"`,
        `"${row.platform}"`,
        row.stats.totalScheduled,
        row.stats.lateMinutes,
        row.stats.absentCount,
        row.stats.leaveCount,
        row.stats.sickCount,
        row.stats.substituteCount,
        row.financials.dendaLate,
        row.financials.dendaAbsent,
        row.financials.dendaLeave,
        row.financials.bonusSubstitute,
        row.financials.netDeduction,
        basicSalary,
        takeHomePay
      ];
    });

    // Merge into single CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    // Create file blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Gaji_Denda_${selectedMonth}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header and Page Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-wide uppercase">Performance & Analytics</h2>
          <p className="text-sm text-gray-400">Monitor conversion funnels, monthly denda/payroll reports, and real-time live viewer history.</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex p-1 rounded-xl bg-slate-950 border-2 border-black shadow-tactile-sm shrink-0 self-start sm:self-center overflow-x-auto">
          <button
            onClick={() => setActiveTab('funnel')}
            className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'funnel' 
                ? 'bg-indigo-600 text-white border-2 border-black shadow-tactile-sm' 
                : 'text-slate-400 hover:text-white border-2 border-transparent'
            }`}
          >
            Performance Funnel
          </button>
          <button
            onClick={() => setActiveTab('penalty')}
            className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'penalty' 
                ? 'bg-indigo-600 text-white border-2 border-black shadow-tactile-sm' 
                : 'text-slate-400 hover:text-white border-2 border-transparent'
            }`}
          >
            Rapor Denda &amp; Absensi
          </button>
          <button
            onClick={() => setActiveTab('viewer')}
            className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              activeTab === 'viewer' 
                ? 'bg-indigo-600 text-white border-2 border-black shadow-tactile-sm' 
                : 'text-slate-400 hover:text-white border-2 border-transparent'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Viewer Tracker</span>
          </button>
        </div>
      </div>

      {/* RENDER TAB 1: PERFORMANCE FUNNEL */}
      {activeTab === 'funnel' && (
        <>
          {/* Filters Row */}
          <div className="flex flex-wrap items-center justify-end gap-3 pb-2 border-b-2 border-black/30">
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-dark-card border-2 border-black rounded-lg shadow-tactile-sm">
              <span className="text-xs font-bold text-indigo-400 uppercase">Streamer:</span>
              <select
                value={selectedStreamerId}
                onChange={(e) => setSelectedStreamerId(e.target.value)}
                className="bg-transparent text-xs text-gray-300 font-extrabold focus:outline-none border-none cursor-pointer"
              >
                {streamers.map(s => (
                  <option key={s.id} value={s.id} className="bg-slate-950">{s.nama}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-dark-card border-2 border-black rounded-lg shadow-tactile-sm">
              <span className="text-xs font-bold text-indigo-400 uppercase font-mono">Range:</span>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="bg-transparent text-xs text-gray-300 font-extrabold focus:outline-none border-none cursor-pointer"
              >
                <option value="7days" className="bg-slate-950">Last 7 Days</option>
                <option value="30days" className="bg-slate-950">Last 30 Days</option>
                <option value="thisMonth" className="bg-slate-950">This Month</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex h-96 items-center justify-center text-indigo-400">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent"></div>
              <span className="ml-3 text-sm font-bold uppercase tracking-wider">Analyzing streamer stats...</span>
            </div>
          ) : performance ? (
            <div className="space-y-6">
              
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { title: 'Total Hours Live', value: `${(stats?.totalLiveHours || 0).toFixed(1)} hrs`, desc: 'Active stream time', color: 'text-indigo-400' },
                  { title: 'Content Uploads', value: stats?.totalUploads || 0, desc: 'Tiktok & YouTube shorts', color: 'text-pink-400' },
                  { title: 'Chats Received', value: (stats?.totalChats || 0).toLocaleString('id-ID'), desc: 'Ingested chat records', color: 'text-cyan-400' },
                  { title: 'Registrations', value: (stats?.totalRegistrations || 0).toLocaleString('id-ID'), desc: 'Affiliate registrations', color: 'text-yellow-400' },
                  { title: 'FTD Count', value: (stats?.totalFtds || 0).toLocaleString('id-ID'), desc: 'First time depositors', color: 'text-emerald-400' }
                ].map((item, idx) => (
                  <div key={idx} className="tactile-card p-5 border-2 border-black bg-dark-card">
                    <span className="text-[10px] font-black text-slate-455 uppercase tracking-widest block">{item.title}</span>
                    <strong className="text-2xl font-black text-white block mt-2">{item.value}</strong>
                    <span className={`text-[9px] font-extrabold ${item.color} mt-1.5 block uppercase tracking-wide`}>{item.desc}</span>
                  </div>
                ))}
              </div>

              {/* Conversion funnel indicators bar */}
              <div className="tactile-card p-6 border-2 border-black bg-dark-card">
                <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 border-b-2 border-black pb-2.5">Conversion Rates Funnel</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  <div className="p-4 rounded-xl border border-dark-border/40 bg-slate-950/20 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Chat to Registration Rate</span>
                      <strong className="text-2xl font-black text-white mt-1.5 block">{(stats?.registrationRate || 0).toFixed(1)}%</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-indigo-400 font-extrabold uppercase block font-mono">Target: 30%</span>
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                        (stats?.registrationRate || 0) >= 30 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-455 border-rose-500/20'
                      } inline-block mt-2`}>
                        {(stats?.registrationRate || 0) >= 30 ? 'Good Conversion' : 'Needs attention'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-dark-border/40 bg-slate-950/20 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Registration to FTD Rate</span>
                      <strong className="text-2xl font-black text-white mt-1.5 block">{(stats?.ftdConversion || 0).toFixed(1)}%</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-indigo-400 font-extrabold uppercase block font-mono">Target: 10%</span>
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                        (stats?.ftdConversion || 0) >= 10 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-455 border-rose-500/20'
                      } inline-block mt-2`}>
                        {(stats?.ftdConversion || 0) >= 10 ? 'Good Conversion' : 'Needs attention'}
                      </span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Conversion trend charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="tactile-card p-5 border-2 border-black bg-dark-card">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">Registration and FTD Funnel Curve</h3>
                  <div className="h-72">
                    <Line data={getLineChartData()} options={chartOptions} />
                  </div>
                </div>

                <div className="tactile-card p-5 border-2 border-black bg-dark-card">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">Incoming Daily Ingested Chats</h3>
                  <div className="h-72">
                    <Bar data={getBarChartData()} options={chartOptions} />
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">No performance records compiled for range.</div>
          )}
        </>
      )}

      {/* RENDER TAB 2: RAPOR DENDA & ABSENSI (PENALTY REPORT) */}
      {activeTab === 'penalty' && (
        <div className="space-y-6">
          
          {/* Rate Configuration and Month Selector Row */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 border-b-2 border-black/30 pb-5">
            
            {/* Form Setting Parameter Denda */}
            <form onSubmit={handleApplyRates} className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-xl border-2 border-black bg-dark-panel">
              <div>
                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Gaji Pokok (Rp)</label>
                <input
                  type="number"
                  value={basicSalary}
                  onChange={(e) => setBasicSalary(Math.max(0, parseInt(e.target.value, 10)))}
                  className="w-full p-2 text-xs font-bold rounded-lg border-2 border-black bg-slate-900 text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Late Rate (Rp/Min)</label>
                <input
                  type="number"
                  value={rateLate}
                  onChange={(e) => setRateLate(Math.max(0, parseInt(e.target.value, 10)))}
                  className="w-full p-2 text-xs font-bold rounded-lg border-2 border-black bg-slate-900 text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Absent Rate (Rp/Sesi)</label>
                <input
                  type="number"
                  value={rateAbsent}
                  onChange={(e) => setRateAbsent(Math.max(0, parseInt(e.target.value, 10)))}
                  className="w-full p-2 text-xs font-bold rounded-lg border-2 border-black bg-slate-900 text-white focus:outline-none"
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Swap Leave/Sub Rate (Rp)</label>
                  <input
                    type="number"
                    value={rateSwap}
                    onChange={(e) => setRateSwap(Math.max(0, parseInt(e.target.value, 10)))}
                    className="w-full p-2 text-xs font-bold rounded-lg border-2 border-black bg-slate-900 text-white focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white border-2 border-black text-xs font-black uppercase tracking-wider active:translate-y-px shadow-tactile-sm"
                >
                  Apply
                </button>
              </div>
            </form>

            {/* Filter Bulan */}
            <div className="p-4 rounded-xl border-2 border-black bg-dark-panel flex flex-col justify-center">
              <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                <span>Pilih Bulan Laporan</span>
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full p-2 text-xs font-bold rounded-lg border-2 border-black bg-slate-900 text-white focus:outline-none cursor-pointer"
              />
            </div>

          </div>

          {/* Penalty Data Table */}
          {penaltyLoading ? (
            <div className="flex h-64 items-center justify-center text-indigo-400">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent"></div>
              <span className="ml-3 text-xs">Menghitung akumulasi denda & absensi bulanan...</span>
            </div>
          ) : penaltyData?.report ? (
            <div className="space-y-4">
              
              {/* Table Action Header */}
              <div className="flex items-center justify-between pb-1 border-b border-black/25">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Klik nama streamer untuk melihat rincian detail tanggal kejadian (TikTok bebas KPI denda)
                  </span>
                </div>

                {/* Opsi 1: Tombol Download CSV */}
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-indigo-400 border-2 border-indigo-500/35 hover:bg-indigo-500/10 cursor-pointer shadow-tactile-sm active:translate-y-px transition-colors"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Ekspor CSV (Excel)</span>
                </button>
              </div>

              {/* Info Banner */}
              <div className="p-3.5 rounded-xl border-2 border-yellow-500/20 bg-yellow-500/5 text-xs text-slate-350 flex items-center gap-2">
                <Info className="h-4.5 w-4.5 text-yellow-500 shrink-0" />
                <span>
                  Sesi <strong>Bolos</strong> adalah jadwal Scheduled yang jam selesainya lewat dari 2 jam tanpa ada rekaman durasi live/start.
                  Sesi <strong>Izin biasa</strong> memotong gajinya {formatIDR(rateSwap)} &amp; otomatis dikirim ke Streamer Pengganti sebagai bonus.
                  Sesi <strong>Sakit (Sick Leave)</strong> <strong>BEBAS DENDA (Rp 0)</strong> bagi streamer asli (baik ada pengganti maupun tidak), namun Streamer Pengganti tetap dapat bonus {formatIDR(rateSwap)} dari kas.
                </span>
              </div>

              {/* Main penalty table */}
              <div className="tactile-card overflow-x-auto border-2 border-black bg-dark-card p-4">
                <table className="w-full border-collapse text-left text-xs text-slate-300">
                  <thead>
                    <tr className="border-b-2 border-black text-slate-450 uppercase tracking-widest text-[9px] font-black">
                      <th className="py-3 px-4">Nama Streamer</th>
                      <th className="py-3 px-4 text-center">Total Sesi</th>
                      <th className="py-3 px-4 text-center">Telat (Mnt)</th>
                      <th className="py-3 px-4 text-center">Bolos</th>
                      <th className="py-3 px-4 text-center">Izin</th>
                      <th className="py-3 px-4 text-center">Sakit</th>
                      <th className="py-3 px-4 text-center">Menggantikan</th>
                      <th className="py-3 px-4 text-right">Potongan Telat</th>
                      <th className="py-3 px-4 text-right">Potongan Bolos</th>
                      <th className="py-3 px-4 text-right">Bonus Ganti</th>
                      <th className="py-3 px-4 text-right text-rose-450 font-black">Total Denda</th>
                      <th className="py-3 px-4 text-right text-slate-450 font-black">Gaji Pokok</th>
                      <th className="py-3 px-4 text-right text-white font-extrabold">Gaji Diterima</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/30 font-bold">
                    {penaltyData.report.map((row) => {
                      const netPotongan = row.financials.netDeduction;
                      const takeHomePay = Math.max(0, basicSalary - netPotongan);
                      const hasImpact = netPotongan !== 0 || row.stats.lateMinutes > 0 || row.stats.absentCount > 0;

                      return (
                        <tr 
                          key={row.streamerId}
                          className={`hover:bg-slate-950/20 transition-colors ${
                            hasImpact ? 'bg-rose-950/5' : ''
                          }`}
                        >
                          {/* Opsi 2: Klik nama streamer membuka Modal Detail */}
                          <td 
                            onClick={() => setSelectedStreamerDetail(row)}
                            className="py-3.5 px-4 font-black text-indigo-400 text-sm cursor-pointer hover:text-indigo-300 hover:underline decoration-dotted transition-colors"
                            title="Klik untuk detail rincian tanggal"
                          >
                            {row.nama}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono">{row.stats.totalScheduled} sesi</td>
                          <td className="py-3.5 px-4 text-center text-rose-450 font-mono">
                            {row.stats.lateMinutes > 0 ? (
                              <span className="flex items-center justify-center gap-1">
                                <Clock className="h-3 w-3 shrink-0" />
                                <span>{row.stats.lateMinutes}m</span>
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-center text-rose-500 font-mono">
                            {row.stats.absentCount > 0 ? (
                              <span className="flex items-center justify-center gap-1 font-black bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded text-[10px]">
                                <UserX className="h-3 w-3 shrink-0" />
                                <span>{row.stats.absentCount}x</span>
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-400 font-mono">
                            {row.stats.leaveCount > 0 ? `${row.stats.leaveCount}x` : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-center text-rose-450 font-mono">
                            {row.stats.sickCount > 0 ? (
                              <span className="bg-rose-900/30 text-rose-350 border border-rose-800/35 px-1.5 py-0.5 rounded">
                                {row.stats.sickCount}x
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-center text-emerald-450 font-mono">
                            {row.stats.substituteCount > 0 ? (
                              <span className="flex items-center justify-center gap-1 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px]">
                                <UserCheck className="h-3 w-3 shrink-0" />
                                <span>{row.stats.substituteCount}x</span>
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-right text-rose-450 font-mono">
                            {row.financials.dendaLate > 0 ? formatIDR(row.financials.dendaLate) : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-right text-rose-450 font-mono">
                            {row.financials.dendaAbsent > 0 ? formatIDR(row.financials.dendaAbsent) : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-right text-emerald-400 font-mono">
                            {row.financials.bonusSubstitute > 0 ? `+${formatIDR(row.financials.bonusSubstitute)}` : '-'}
                          </td>
                          <td className={`py-3.5 px-4 text-right font-mono text-sm font-bold ${
                            netPotongan > 0 
                              ? 'text-rose-500' 
                              : netPotongan < 0 
                                ? 'text-emerald-400' 
                                : 'text-slate-400'
                          }`}>
                            {netPotongan !== 0 ? formatIDR(netPotongan) : 'Rp 0'}
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-400 font-mono">{formatIDR(basicSalary)}</td>
                          <td className="py-3.5 px-4 text-right font-mono text-sm font-black text-emerald-400 text-shadow-emerald bg-emerald-950/5">
                            {formatIDR(takeHomePay)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">Tidak ada data absensi/denda untuk bulan terpilih.</div>
          )}

        </div>
      )}

      {/* RENDER TAB 3: VIEWER TRACKER (Opsi Analisis Jam Ramai) */}
      {activeTab === 'viewer' && (
        <div className="space-y-6">
          
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-4 bg-dark-panel p-4 rounded-xl border-2 border-black">
            <div className="flex items-center gap-2">
              <Calendar className="h-4.5 w-4.5 text-indigo-400" />
              <span className="text-xs font-black uppercase text-slate-400">Pilih Tanggal:</span>
              <input
                type="date"
                value={viewerDate}
                onChange={(e) => setViewerDate(e.target.value)}
                className="p-2 text-xs font-bold rounded-lg border-2 border-black bg-slate-900 text-white focus:outline-none cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2">
              <Users className="h-4.5 w-4.5 text-indigo-400" />
              <span className="text-xs font-black uppercase text-slate-400">Streamer:</span>
              <select
                value={viewerStreamerId}
                onChange={(e) => setViewerStreamerId(e.target.value)}
                className="p-2 text-xs font-bold rounded-lg border-2 border-black bg-slate-900 text-white focus:outline-none cursor-pointer"
              >
                <option value="all">-- Semua Streamer --</option>
                {streamers.map(s => (
                  <option key={s.id} value={s.id}>{s.nama}</option>
                ))}
              </select>
            </div>

            <button
              onClick={fetchViewerHistory}
              className="py-2 px-4 ml-auto rounded-lg bg-slate-900 border-2 border-black hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider cursor-pointer shadow-tactile-sm"
            >
              Refresh Data
            </button>
          </div>

          {viewerLoading ? (
            <div className="flex h-72 items-center justify-center text-indigo-400">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent"></div>
              <span className="ml-3 text-xs">Memetakan data history penonton...</span>
            </div>
          ) : viewerHistoryData.length === 0 ? (
            <div className="tactile-card p-12 text-center text-slate-500 border-2 border-black bg-dark-card flex flex-col items-center justify-center">
              <Users className="h-10 w-10 text-slate-700 mb-2" />
              <p className="text-xs font-bold uppercase tracking-wider">Tidak ada data penonton tercatat.</p>
              <p className="text-[10px] text-slate-500 mt-1">Data penonton otomatis terekam setiap 15 menit oleh sistem ketika terdeteksi sedang live.</p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Line Chart */}
              <div className="tactile-card p-6 border-2 border-black bg-dark-card">
                <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 border-b-2 border-black pb-2.5 flex items-center justify-between">
                  <span>Grafik Perbandingan Penonton YouTube vs TikTok</span>
                  <span className="text-[10px] text-slate-400 normal-case">Waktu Indonesia Barat (WIB)</span>
                </h3>
                <div className="h-80">
                  <Line data={getViewerChartData()} options={chartOptions} />
                </div>
              </div>

              {/* Data Table */}
              <div className="tactile-card overflow-x-auto border-2 border-black bg-dark-card p-4">
                <h4 className="text-xs font-black text-white uppercase tracking-wider mb-3">Log Detil Penonton</h4>
                <table className="w-full border-collapse text-left text-xs text-slate-300">
                  <thead>
                    <tr className="border-b-2 border-black text-slate-450 uppercase tracking-widest text-[9px] font-black">
                      <th className="py-2.5 px-4">Recorded At</th>
                      <th className="py-2.5 px-4">Nama Streamer</th>
                      <th className="py-2.5 px-4">Platform</th>
                      <th className="py-2.5 px-4 text-right">Viewer Count</th>
                      <th className="py-2.5 px-4 text-center">Jadwal Sesi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/30 font-bold font-mono">
                    {viewerHistoryData.map((row) => {
                      const dateObj = new Date(row.recorded_at);
                      const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
                      const startStr = new Date(row.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                      const endStr = new Date(row.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

                      return (
                        <tr key={row.id} className="hover:bg-slate-950/20">
                          <td className="py-2.5 px-4 text-slate-400">{timeStr}</td>
                          <td className="py-2.5 px-4 font-black text-white">{row.streamer_name}</td>
                          <td className="py-2.5 px-4">
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${
                              row.platform === 'TikTok' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                              {row.platform}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right text-white font-black text-sm">{row.viewer_count.toLocaleString('id-ID')} views</td>
                          <td className="py-2.5 px-4 text-center text-slate-405">{startStr} - {endStr}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </div>
      )}

      {/* Opsi 2: Modal Detail Riwayat Pelanggaran (Pop-up Modal) */}
      {selectedStreamerDetail && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/85 backdrop-blur-xs" onClick={() => setSelectedStreamerDetail(null)} />
          
          <div className="relative w-full max-w-2xl p-6 md:p-8 rounded-2xl border-3 border-black bg-dark-card shadow-tactile-lg z-10 animate-scale-up">
            <button
              onClick={() => setSelectedStreamerDetail(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-900 text-gray-400 hover:text-white border-2 border-black cursor-pointer shadow-tactile-sm active:translate-y-px"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="border-b-2 border-black pb-4 mb-5">
              <h3 className="text-lg font-black text-white uppercase tracking-wide flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-indigo-400" />
                <span>Riwayat Detil Absensi &amp; Denda</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Streamer: <strong className="text-white text-sm">{selectedStreamerDetail.nama}</strong> ({selectedStreamerDetail.platform}) 
                &bull; Periode: <strong className="text-white">{selectedMonth}</strong>
              </p>
            </div>

            {/* List Riwayat */}
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {selectedStreamerDetail.history.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 font-bold uppercase border-2 border-dashed border-black/40 rounded-xl bg-slate-950/20">
                  Bersih! Tidak ada riwayat keterlambatan, sakit, swap izin, atau bolos pada bulan ini.
                </div>
              ) : (
                selectedStreamerDetail.history.map((h, index) => {
                  // Style based on type
                  let typeBadge = '';
                  if (h.type.startsWith('Late')) typeBadge = 'bg-rose-500/10 text-rose-405 border-rose-500/20';
                  else if (h.type === 'Absent') typeBadge = 'bg-rose-500 text-white border-rose-600 font-black';
                  else if (h.type === 'Leave') typeBadge = 'bg-yellow-500/10 text-yellow-405 border-yellow-500/20';
                  else if (h.type === 'Sick') typeBadge = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                  else typeBadge = 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20';

                  return (
                    <div 
                      key={index} 
                      className="p-3.5 rounded-xl border-2 border-black bg-slate-900/65 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-tactile-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${typeBadge}`}>
                            {h.type}
                          </span>
                          <span className="text-xs font-extrabold text-white font-mono">{h.date}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 font-medium">{h.description}</p>
                      </div>

                      <div className="text-right sm:text-right shrink-0">
                        <span className="text-[9px] text-slate-455 block uppercase tracking-wider font-bold">Jam Sesi</span>
                        <strong className="text-xs text-slate-200 font-mono block mt-0.5">{h.time} WIB</strong>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="border-t-2 border-black pt-4 mt-5 flex items-center justify-between">
              <div>
                <span className="text-[9px] text-slate-455 block uppercase tracking-widest font-black">Net Potongan Gaji</span>
                <strong className={`text-base font-black font-mono ${
                  selectedStreamerDetail.financials.netDeduction > 0 ? 'text-rose-500' : selectedStreamerDetail.financials.netDeduction < 0 ? 'text-emerald-405' : 'text-slate-400'
                }`}>
                  {selectedStreamerDetail.financials.netDeduction !== 0 ? formatIDR(selectedStreamerDetail.financials.netDeduction) : 'Rp 0'}
                </strong>
              </div>

              <button
                onClick={() => setSelectedStreamerDetail(null)}
                className="px-5 py-2 rounded-xl text-xs font-black uppercase bg-slate-900 border-2 border-black hover:bg-slate-800 text-white cursor-pointer active:translate-y-px shadow-tactile-sm"
              >
                Tutup Detail
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Performance;
