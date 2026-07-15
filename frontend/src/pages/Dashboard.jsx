import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { 
  Users, 
  Tv, 
  Video, 
  MessageSquare, 
  UserCheck, 
  Coins, 
  Sparkles, 
  Play, 
  ArrowRight,
  TrendingUp,
  Calendar,
  Layers,
  Terminal,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

// Chart.js imports
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Dashboard = () => {
  const [range, setRange] = useState('30days');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [chartTab, setChartTab] = useState('daily'); // 'daily' | 'weekly' | 'monthly'
  const [comparison, setComparison] = useState(null);
  const [aiReport, setAiReport] = useState(null);
  
  // Telegram Bot Simulator state
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [rawMessage, setRawMessage] = useState('');
  const [simResult, setSimResult] = useState(null);
  const [simError, setSimError] = useState('');
  const [simLoading, setSimLoading] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [summaryRes, chartsRes, comparisonRes, aiReportRes] = await Promise.all([
        api.get(`/dashboard/summary?range=${range}`),
        api.get('/dashboard/charts'),
        api.get(`/dashboard/comparison?range=${range}`),
        api.get('/analytics/ai-report')
      ]);
      setSummary(summaryRes.data);
      setChartData(chartsRes.data);
      setComparison(comparisonRes.data);
      setAiReport(aiReportRes.data);
    } catch (error) {
      console.error('Error fetching dashboard summary:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [range]);

  const handleSimulateSubmit = async (e) => {
    e.preventDefault();
    if (!rawMessage.trim()) {
      setSimError('Please paste a raw message first.');
      return;
    }

    setSimError('');
    setSimResult(null);
    setSimLoading(true);

    try {
      const res = await api.post('/reports/simulate', { rawText: rawMessage });
      setSimResult(res.data);
      setRawMessage('');
      
      // Reload stats
      await fetchDashboardData();
    } catch (err) {
      console.error('Simulation error:', err);
      setSimError(err.response?.data?.message || 'Failed to parse message. Please check the format.');
    } finally {
      setSimLoading(false);
    }
  };

  if (loading && !summary) {
    return (
      <div className="flex h-96 items-center justify-center text-indigo-400">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent"></div>
        <span className="ml-3 text-lg font-medium">Loading Dashboard Analytics...</span>
      </div>
    );
  }

  // Prep Chart Configurations
  const getChartJsData = () => {
    if (!chartData || !chartData[chartTab]) return { labels: [], datasets: [] };
    
    const points = chartData[chartTab];
    const labels = points.map(p => p.label);
    
    return {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'FTD',
          borderColor: '#10b981', // Emerald
          borderWidth: 3,
          pointBackgroundColor: '#10b981',
          pointHoverRadius: 6,
          tension: 0.35,
          fill: false,
          yAxisID: 'y-ftd',
          data: points.map(p => p.ftds),
        },
        {
          type: 'line',
          label: 'Registrations',
          borderColor: '#6366f1', // Indigo
          borderWidth: 3,
          pointBackgroundColor: '#6366f1',
          pointHoverRadius: 6,
          tension: 0.35,
          fill: true,
          backgroundColor: 'rgba(99, 102, 241, 0.05)',
          yAxisID: 'y-ftd',
          data: points.map(p => p.registrations),
        },
        {
          type: 'bar',
          label: 'Incoming Chats',
          backgroundColor: 'rgba(6, 182, 212, 0.3)', // Cyan semi-transparent
          hoverBackgroundColor: 'rgba(6, 182, 212, 0.6)',
          borderColor: '#06b6d4',
          borderWidth: 1.5,
          yAxisID: 'y-chat',
          data: points.map(p => p.chats),
          barThickness: chartTab === 'daily' ? 12 : 24,
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#e2e8f0',
          font: { family: 'Outfit', size: 12 }
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleFont: { family: 'Outfit', size: 13, weight: 'bold' },
        bodyFont: { family: 'Outfit', size: 12 },
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        padding: 12,
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
      },
      'y-ftd': {
        type: 'linear',
        position: 'left',
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'Outfit' } },
        title: { display: true, text: 'Acquisition (Users)', color: '#94a3b8' }
      },
      'y-chat': {
        type: 'linear',
        position: 'right',
        grid: { drawOnChartArea: false }, // Only show left grid
        ticks: { color: '#06b6d4', font: { family: 'Outfit' } },
        title: { display: true, text: 'Interactions (Chats)', color: '#06b6d4' }
      }
    }
  };

  const statCards = [
    {
      title: 'Active Streamers',
      value: `${summary?.activeStreamers || 0} / ${summary?.totalStreamers || 0}`,
      desc: 'Active in selected range',
      icon: Users,
      accent: 'bg-tactile-blue text-black border-black'
    },
    {
      title: 'Total Live Duration',
      value: `${summary?.rangeMetrics.totalLiveHours.toFixed(1)} hrs`,
      desc: `Today: ${summary?.todayMetrics.liveHours} hrs`,
      icon: Tv,
      accent: 'bg-tactile-purple text-white border-black'
    },
    {
      title: 'Content Uploads',
      value: `${summary?.rangeMetrics.totalUploads} videos`,
      desc: `Today: ${summary?.todayMetrics.uploads} vids`,
      icon: Video,
      accent: 'bg-tactile-pink text-white border-black'
    },
    {
      title: 'Chats Ingested',
      value: (summary?.rangeMetrics.totalChats || 0).toLocaleString('id-ID'),
      desc: `Today: ${summary?.todayMetrics.chats}`,
      icon: MessageSquare,
      accent: 'bg-tactile-teal text-black border-black'
    },
    {
      title: 'Registrations',
      value: (summary?.rangeMetrics.totalRegistrations || 0).toLocaleString('id-ID'),
      desc: `Today: ${summary?.todayMetrics.registrations}`,
      icon: UserCheck,
      accent: 'bg-tactile-yellow text-black border-black'
    },
    {
      title: 'First Time Deposits (FTD)',
      value: (summary?.rangeMetrics.totalFtds || 0).toLocaleString('id-ID'),
      desc: `Today: ${summary?.todayMetrics.ftds}`,
      icon: Coins,
      accent: 'bg-tactile-orange text-black border-black'
    }
  ];

  return (
    <div className="space-y-8">
      
      {/* Top Filter and Actions Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-wide uppercase">Performance Dashboard</h2>
          <p className="text-sm text-slate-400">Monitor affiliate statistics, live streams, and content conversions.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Date Range Selection */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-dark-card border-2 border-black rounded-lg shadow-tactile-sm">
            <Calendar className="h-4.5 w-4.5 text-indigo-400" />
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="bg-transparent text-sm text-gray-250 focus:outline-none border-none cursor-pointer font-bold"
            >
              <option value="today" className="bg-slate-950">Today</option>
              <option value="yesterday" className="bg-slate-950">Yesterday</option>
              <option value="7days" className="bg-slate-950">Last 7 Days</option>
              <option value="30days" className="bg-slate-950">Last 30 Days</option>
              <option value="thisMonth" className="bg-slate-950">This Month</option>
            </select>
          </div>

          {/* Telegram Ingestion Simulator Toggle */}
          <button
            onClick={() => setSimulatorOpen(!simulatorOpen)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-extrabold uppercase border-2 transition-all duration-100 shadow-tactile-sm active:translate-y-0.5 active:shadow-tactile-pressed ${
              simulatorOpen 
                ? 'bg-cyan-500 text-black border-black' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white border-black'
            }`}
          >
            <Terminal className="h-4.5 w-4.5" />
            {simulatorOpen ? 'Hide Simulator' : 'Bot Simulator'}
          </button>
        </div>
      </div>

      {/* Telegram Message Parser Simulator Console */}
      {simulatorOpen && (
        <div className="crt-screen animate-crt-flicker p-6 border-3 border-black bg-black shadow-tactile-lg">
          <div className="flex items-center justify-between mb-4 border-b-2 border-cyan-900 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse border border-black" />
              <h3 className="font-extrabold text-cyan-400 tracking-wider text-sm uppercase">Telegram Message Ingestion Simulator</h3>
            </div>
            <span className="text-[10px] text-cyan-500 font-bold uppercase tracking-wide">Bypasses webhook for direct database processing</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Input Form */}
            <form onSubmit={handleSimulateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-cyan-400 uppercase tracking-widest mb-2">
                  Paste Raw Telegram message
                </label>
                <textarea
                  value={rawMessage}
                  onChange={(e) => setRawMessage(e.target.value)}
                  placeholder={`STREAMING\nTanggal : 20 JUNI 2026\nNama : Tizza\n\nUPLOAD:\nTikTok : 3 video\nYoutube Short : -\nInstagram Reels : 1 video\nFacebook FP : -\n\nLIVE:\n3.5 jam\n\nCHAT:\n220\n\nREGISTRASI:\n24\n\nFTD:\n12`}
                  rows={9}
                  className="w-full p-4 text-xs font-mono rounded-lg border-2 border-cyan-800/80 bg-slate-950/70 text-cyan-300 placeholder-cyan-800/40 focus:outline-none focus:border-cyan-400 shadow-inset-screen"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={simLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-xs uppercase tracking-wider transition-all border-2 border-black shadow-tactile-sm active:translate-y-0.5 active:shadow-tactile-pressed disabled:opacity-50"
                >
                  {simLoading ? 'Parsing...' : 'Execute Parser'}
                  <Play className="h-3.5 w-3.5 fill-black text-black" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRawMessage(`STREAMING\nTanggal : ${new Date().toISOString().split('T')[0]}\nNama : Tizza\n\nUPLOAD:\nTikTok : 2 video\nYoutube Short : 1 video\nInstagram Reels : -\nFacebook FP : -\n\nLIVE:\n2.5 jam\n\nCHAT:\n150 chat masuk\n\nREGISTRASI:\n16 user register\n\nFTD:\n6`);
                  }}
                  className="px-3.5 py-2.5 rounded-lg border-2 border-cyan-850 hover:bg-cyan-950 hover:text-cyan-300 text-cyan-400 text-xs font-bold transition-all shadow-tactile-sm active:translate-y-0.5 active:shadow-tactile-pressed"
                >
                  Load Template
                </button>
              </div>
            </form>

            {/* Parsing Results Panel */}
            <div className="flex flex-col justify-between p-4 rounded-lg border-2 border-cyan-800 bg-slate-950/40 min-h-[200px]">
              {simError && (
                <div className="flex items-start gap-2.5 text-xs text-rose-450 bg-rose-950/30 border-2 border-rose-800 p-3 rounded-lg">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-extrabold block">Parsing Failure</strong>
                    <span>{simError}</span>
                  </div>
                </div>
              )}

              {simResult ? (
                <div className="space-y-4 animate-fade-in text-xs font-mono">
                  <div className="flex items-center gap-2 text-emerald-400 font-extrabold border-b-2 border-cyan-900 pb-2">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>SUCCESFULLY SAVED TO DATABASE</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-cyan-300">
                    <div>Streamer: <strong className="text-white font-bold">{simResult.streamerName}</strong></div>
                    <div>Date: <strong className="text-white font-bold">{simResult.parsedData.tanggal}</strong></div>
                    <div className="col-span-2">Live Duration: <strong className="text-white font-bold">{simResult.parsedData.liveDuration} hours</strong></div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black border-2 border-cyan-900">
                    <div className="font-bold text-cyan-500 mb-1">Uploads Breakdowns:</div>
                    <div className="grid grid-cols-4 gap-1 text-center">
                      <div>TikTok: <strong className="text-white block">{simResult.parsedData.uploads.tiktok}</strong></div>
                      <div>YouTube: <strong className="text-white block">{simResult.parsedData.uploads.youtube}</strong></div>
                      <div>Instagram: <strong className="text-white block">{simResult.parsedData.uploads.instagram}</strong></div>
                      <div>Facebook: <strong className="text-white block">{simResult.parsedData.uploads.facebook}</strong></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-gray-300">
                    <div className="bg-cyan-950/50 p-2 rounded-lg border-2 border-cyan-900 shadow-inset-screen">
                      Chats <strong className="block text-cyan-400 text-sm mt-0.5">{simResult.parsedData.chatCount}</strong>
                    </div>
                    <div className="bg-indigo-950/50 p-2 rounded-lg border-2 border-indigo-900 shadow-inset-screen">
                      Regs <strong className="block text-indigo-400 text-sm mt-0.5">{simResult.parsedData.registrationCount}</strong>
                    </div>
                    <div className="bg-emerald-950/50 p-2 rounded-lg border-2 border-emerald-900 shadow-inset-screen">
                      FTD <strong className="block text-emerald-400 text-sm mt-0.5">{simResult.parsedData.ftdCount}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                !simError && (
                  <div className="flex flex-col items-center justify-center h-full text-center text-cyan-700 font-mono">
                    <Sparkles className="h-8 w-8 text-cyan-800/40 mb-2 animate-pulse" />
                    <p className="text-xs max-w-[280px]">Provide raw message content on the left to review the database parsing extraction structure.</p>
                  </div>
                )
              )}
            </div>

          </div>
        </div>
      )}

      {/* Grid of Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {statCards.map((card, idx) => (
          <div
            key={idx}
            className="tactile-card tactile-card-hover p-6 flex items-center justify-between border-2 border-black bg-dark-card"
          >
            <div className="space-y-1">
              <span className="text-xs font-extrabold text-slate-450 uppercase tracking-wider">{card.title}</span>
              <div className="text-2xl font-black text-white leading-none pt-1">{card.value}</div>
              <span className="block text-[11px] text-slate-400 pt-1 font-bold">{card.desc}</span>
            </div>
            <div className={`p-3 rounded-lg border-2 shadow-tactile-sm ${card.accent}`}>
              <card.icon className="h-6 w-6" />
            </div>
          </div>
        ))}
      </div>

      {/* Today's Streamer Submission Status */}
      <div className="tactile-card p-6 border-2 border-black bg-dark-card">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5 border-b-2 border-black pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-400" />
            <h3 className="text-lg font-black text-white tracking-wide uppercase">Status Setoran Laporan Streamer Hari Ini</h3>
          </div>
          <span className="sm:ml-auto text-xs text-black font-extrabold uppercase bg-tactile-yellow px-3 py-1 border-2 border-black shadow-tactile-sm select-none">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {summary?.todayReportsStatus?.map((item) => (
            <div 
              key={item.streamerId}
              className={`p-3.5 rounded-lg border-2 transition-all duration-200 ${
                item.hasSubmitted 
                  ? 'bg-emerald-950/15 border-emerald-500 shadow-tactile-sm' 
                  : 'bg-rose-950/15 border-rose-500 shadow-tactile-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-white">{item.nama}</span>
                <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded border-2 uppercase tracking-wide ${
                  item.hasSubmitted 
                    ? 'bg-emerald-500 text-black border-black shadow-tactile-sm' 
                    : 'bg-rose-500 text-white border-black shadow-tactile-sm'
                }`}>
                  {item.hasSubmitted ? 'Sudah' : 'Belum'}
                </span>
              </div>
              <div className="mt-2.5 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Platform: <strong className="text-slate-350">{item.platform}</strong></span>
                {item.hasSubmitted && (
                  <span className="font-bold text-slate-300">
                    Live: {item.liveDuration}h &bull; FTD: {item.ftdCount}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Business Analyst Insights Card */}
      {aiReport && (
        <div className="tactile-card p-6 border-2 border-black bg-dark-panel">
          <div className="flex items-center gap-2 mb-4 border-b-2 border-black pb-3">
            <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
            <h3 className="text-sm font-extrabold text-white tracking-wider uppercase">AI Business Analyst Insights</h3>
            <span className={`ml-auto text-[9px] font-extrabold px-2 py-0.5 rounded border-2 uppercase ${
              aiReport.isAI 
                ? 'bg-tactile-purple text-white border-black shadow-tactile-sm' 
                : 'bg-slate-800 text-white border-black shadow-tactile-sm'
            }`}>
              {aiReport.isAI ? 'Gemini AI' : 'Rule-Based Engine'}
            </span>
          </div>
          <div className="text-xs text-gray-300 whitespace-pre-line leading-relaxed font-mono p-4 rounded-lg bg-black border-2 border-black shadow-inset-screen">
            {aiReport.report}
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="tactile-card p-6 border-2 border-black bg-dark-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b-2 border-black pb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-400" />
            <h3 className="text-lg font-black text-white tracking-wide uppercase">Historical Acquisition & Engagement</h3>
          </div>
          
          {/* Chart View Toggles */}
          <div className="flex rounded-lg p-1 bg-slate-950 border-2 border-black shadow-inset-screen shrink-0 self-start sm:self-center">
            {['daily', 'weekly', 'monthly'].map((tab) => (
              <button
                key={tab}
                onClick={() => setChartTab(tab)}
                className={`px-4 py-1.5 rounded-md text-xs font-black uppercase tracking-wider transition-all ${
                  chartTab === tab 
                    ? 'bg-indigo-600 text-white border-2 border-black shadow-tactile-sm' 
                    : 'text-slate-400 hover:text-white border-2 border-transparent'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* The Live Chart Canvas */}
        <div className="h-96 relative p-4 rounded-lg bg-slate-950/60 border-2 border-black shadow-inset-screen">
          {chartData ? (
            <Line data={getChartJsData()} options={chartOptions} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 font-mono">No chart data found.</div>
          )}
        </div>
      </div>

    </div>
  );
};

export default Dashboard;

