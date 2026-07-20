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
  FileSpreadsheet
} from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';

const Performance = () => {
  const [streamers, setStreamers] = useState([]);
  const [selectedStreamerId, setSelectedStreamerId] = useState('');
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState('30days');

  // New states for Penalty Report
  const [activeTab, setActiveTab] = useState('funnel'); // 'funnel' | 'penalty'
  const [selectedMonth, setSelectedMonth] = useState('');
  const [penaltyData, setPenaltyData] = useState(null);
  const [penaltyLoading, setPenaltyLoading] = useState(false);
  const [basicSalary, setBasicSalary] = useState(3000000); // Gaji Pokok default 3 Juta

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

  // Setup Chart configs
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

  return (
    <div className="space-y-6">
      
      {/* Top Header and Page Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-wide uppercase">Performance & Accountability</h2>
          <p className="text-sm text-gray-400">Monitor conversion funnels and monthly penalty reports for late and absent streamer logs.</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex p-1 rounded-xl bg-slate-950 border-2 border-black shadow-tactile-sm shrink-0 self-start sm:self-center">
          <button
            onClick={() => setActiveTab('funnel')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'funnel' 
                ? 'bg-indigo-600 text-white border-2 border-black shadow-tactile-sm' 
                : 'text-slate-400 hover:text-white border-2 border-transparent'
            }`}
          >
            Performance Funnel
          </button>
          <button
            onClick={() => setActiveTab('penalty')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'penalty' 
                ? 'bg-indigo-600 text-white border-2 border-black shadow-tactile-sm' 
                : 'text-slate-400 hover:text-white border-2 border-transparent'
            }`}
          >
            Rapor Denda & Absensi
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
                    <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">{item.title}</span>
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
                        (stats?.registrationRate || 0) >= 30 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-450 border-rose-500/20'
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
                        (stats?.ftdConversion || 0) >= 10 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-450 border-rose-500/20'
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
              
              {/* Info Banner */}
              <div className="p-3.5 rounded-xl border-2 border-yellow-500/20 bg-yellow-500/5 text-xs text-slate-350 flex items-center gap-2">
                <Info className="h-4.5 w-4.5 text-yellow-500 shrink-0" />
                <span>
                  Sesi **Bolos** adalah jadwal *Scheduled* yang jam selesainya lewat > 2 jam tanpa ada rekaman durasi live/start.
                  Sesi **Izin biasa** memotong gajinya **{formatIDR(rateSwap)}** & otomatis dikirim ke Streamer Pengganti sebagai bonus.
                  Sesi **Sakit (Sick Leave)** **BEBAS DENDA (Rp 0)** bagi streamer asli, namun Streamer Pengganti tetap dapat bonus **{formatIDR(rateSwap)}** dari kas.
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
                      <th className="py-3 px-4 text-right text-emerald-400 font-black">Gaji Pokok</th>
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
                          <td className="py-3.5 px-4 font-black text-white text-sm">{row.nama}</td>
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

    </div>
  );
};

export default Performance;
