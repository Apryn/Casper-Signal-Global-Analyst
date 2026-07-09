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
      color: 'from-blue-500/20 to-indigo-500/10 text-blue-400 border-blue-500/20'
    },
    {
      title: 'Total Live Duration',
      value: `${summary?.rangeMetrics.totalLiveHours.toFixed(1)} hrs`,
      desc: `Today: ${summary?.todayMetrics.liveHours} hrs`,
      icon: Tv,
      color: 'from-indigo-500/20 to-purple-500/10 text-indigo-400 border-indigo-500/20'
    },
    {
      title: 'Content Uploads',
      value: `${summary?.rangeMetrics.totalUploads} videos`,
      desc: `Today: ${summary?.todayMetrics.uploads} vids`,
      icon: Video,
      color: 'from-pink-500/20 to-rose-500/10 text-pink-400 border-pink-500/20'
    },
    {
      title: 'Chats Ingested',
      value: (summary?.rangeMetrics.totalChats || 0).toLocaleString('id-ID'),
      desc: `Today: ${summary?.todayMetrics.chats}`,
      icon: MessageSquare,
      color: 'from-cyan-500/20 to-teal-500/10 text-cyan-400 border-cyan-500/20'
    },
    {
      title: 'Registrations',
      value: (summary?.rangeMetrics.totalRegistrations || 0).toLocaleString('id-ID'),
      desc: `Today: ${summary?.todayMetrics.registrations}`,
      icon: UserCheck,
      color: 'from-amber-500/20 to-orange-500/10 text-amber-400 border-amber-500/20'
    },
    {
      title: 'First Time Deposits (FTD)',
      value: (summary?.rangeMetrics.totalFtds || 0).toLocaleString('id-ID'),
      desc: `Today: ${summary?.todayMetrics.ftds}`,
      icon: Coins,
      color: 'from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/20'
    }
  ];

  return (
    <div className="space-y-8">
      
      {/* Top Filter and Actions Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Performance Dashboard</h2>
          <p className="text-sm text-gray-400">Monitor affiliate statistics, live streams, and content conversions.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Date Range Selection */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 rounded-xl border border-dark-border">
            <Calendar className="h-4.5 w-4.5 text-indigo-400" />
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="bg-transparent text-sm text-gray-300 focus:outline-none border-none cursor-pointer"
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
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border ${
              simulatorOpen 
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent shadow-lg shadow-indigo-600/10'
            }`}
          >
            <Terminal className="h-4.5 w-4.5" />
            {simulatorOpen ? 'Hide Simulator' : 'Bot Simulator'}
          </button>
        </div>
      </div>

      {/* Telegram Message Parser Simulator Console */}
      {simulatorOpen && (
        <div className="p-6 rounded-2xl border border-cyan-500/25 bg-cyan-950/15 backdrop-blur-md animate-slide-in shadow-[0_4px_30px_rgba(6,182,212,0.05)]">
          <div className="flex items-center justify-between mb-4 border-b border-cyan-500/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <h3 className="font-bold text-white tracking-wide text-sm uppercase">Telegram Message Ingestion Simulator</h3>
            </div>
            <span className="text-xs text-cyan-400/80 font-medium">Bypasses webhook for direct database processing</span>
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
                  className="w-full p-4 text-xs font-mono rounded-xl border border-cyan-500/20 bg-slate-950/70 text-cyan-100 placeholder-cyan-500/30 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={simLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                >
                  {simLoading ? 'Parsing...' : 'Execute Parser'}
                  <Play className="h-3.5 w-3.5 fill-slate-950" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRawMessage(`STREAMING\nTanggal : ${new Date().toISOString().split('T')[0]}\nNama : Tizza\n\nUPLOAD:\nTikTok : 2 video\nYoutube Short : 1 video\nInstagram Reels : -\nFacebook FP : -\n\nLIVE:\n2.5 jam\n\nCHAT:\n150 chat masuk\n\nREGISTRASI:\n16 user register\n\nFTD:\n6`);
                  }}
                  className="px-3.5 py-2.5 rounded-xl border border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-400 text-xs font-bold transition-colors"
                >
                  Load Template
                </button>
              </div>
            </form>

            {/* Parsing Results Panel */}
            <div className="flex flex-col justify-between p-4 rounded-xl border border-slate-800 bg-slate-950/50 min-h-[200px]">
              {simError && (
                <div className="flex items-start gap-2.5 text-xs text-red-400 bg-red-950/20 border border-red-500/20 p-3 rounded-lg">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block">Parsing Failure</strong>
                    <span>{simError}</span>
                  </div>
                </div>
              )}

              {simResult ? (
                <div className="space-y-4 animate-fade-in text-xs">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold border-b border-emerald-500/10 pb-2">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>SUCCESFULLY SAVED TO DATABASE</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-gray-300">
                    <div>Streamer: <strong className="text-white">{simResult.streamerName}</strong></div>
                    <div>Date: <strong className="text-white">{simResult.parsedData.tanggal}</strong></div>
                    <div className="col-span-2">Live Duration: <strong className="text-white">{simResult.parsedData.liveDuration} hours</strong></div>
                  </div>

                  <div className="p-2.5 rounded bg-slate-900 border border-dark-border">
                    <div className="font-bold text-gray-400 mb-1">Uploads Breakdowns:</div>
                    <div className="grid grid-cols-4 gap-1 text-center">
                      <div>TikTok: <strong className="text-white block">{simResult.parsedData.uploads.tiktok}</strong></div>
                      <div>YouTube: <strong className="text-white block">{simResult.parsedData.uploads.youtube}</strong></div>
                      <div>Instagram: <strong className="text-white block">{simResult.parsedData.uploads.instagram}</strong></div>
                      <div>Facebook: <strong className="text-white block">{simResult.parsedData.uploads.facebook}</strong></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-gray-300">
                    <div className="bg-cyan-500/5 p-2 rounded border border-cyan-500/10">
                      Chats <strong className="block text-cyan-400 text-sm mt-0.5">{simResult.parsedData.chatCount}</strong>
                    </div>
                    <div className="bg-indigo-500/5 p-2 rounded border border-indigo-500/10">
                      Regs <strong className="block text-indigo-400 text-sm mt-0.5">{simResult.parsedData.registrationCount}</strong>
                    </div>
                    <div className="bg-emerald-500/5 p-2 rounded border border-emerald-500/10">
                      FTD <strong className="block text-emerald-400 text-sm mt-0.5">{simResult.parsedData.ftdCount}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                !simError && (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                    <Sparkles className="h-8 w-8 text-cyan-500/20 mb-2" />
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
            className={`glass-panel glass-panel-hover p-6 rounded-2xl flex items-center justify-between border bg-gradient-to-br ${card.color}`}
          >
            <div className="space-y-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{card.title}</span>
              <div className="text-2xl font-bold text-white leading-none pt-1">{card.value}</div>
              <span className="block text-[11px] text-gray-400 pt-1 font-medium">{card.desc}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 shadow-inner">
              <card.icon className="h-6 w-6" />
            </div>
          </div>
        ))}
      </div>

      {/* AI Business Analyst Insights Card */}
      {aiReport && (
        <div className="glass-panel p-6 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/10 via-slate-950/30 to-cyan-950/5 shadow-[0_0_20px_rgba(99,102,241,0.04)] animate-fade-in">
          <div className="flex items-center gap-2 mb-4 border-b border-indigo-500/10 pb-3">
            <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
            <h3 className="text-sm font-bold text-white tracking-wider uppercase">AI Business Analyst Insights</h3>
            <span className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full border ${
              aiReport.isAI 
                ? 'bg-purple-500/15 text-purple-400 border-purple-500/25 shadow-[0_0_10px_rgba(168,85,247,0.15)]' 
                : 'bg-slate-500/15 text-slate-400 border-slate-500/25'
            }`}>
              {aiReport.isAI ? 'Gemini AI' : 'Rule-Based Engine'}
            </span>
          </div>
          <div className="text-xs text-gray-300 whitespace-pre-line leading-relaxed font-normal">
            {aiReport.report}
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="glass-panel p-6 rounded-2xl border bg-slate-950/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-dark-border pb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-white tracking-wide">Historical Acquisition & Engagement</h3>
          </div>
          
          {/* Chart View Toggles */}
          <div className="flex rounded-lg p-1 bg-slate-900 border border-dark-border shrink-0 self-start sm:self-center">
            {['daily', 'weekly', 'monthly'].map((tab) => (
              <button
                key={tab}
                onClick={() => setChartTab(tab)}
                className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                  chartTab === tab 
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* The Live Chart Canvas */}
        <div className="h-96 relative">
          {chartData ? (
            <Line data={getChartJsData()} options={chartOptions} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">No chart data found.</div>
          )}
        </div>
      </div>

      {/* Streaming vs Non Streaming comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Comparison Header Card */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between bg-slate-950/30">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-5 w-5 text-indigo-400" />
              <h3 className="text-lg font-bold text-white">Streaming vs. Non-Streaming</h3>
            </div>
            <p className="text-sm text-gray-400">
              Analyze performance differences between active livestreams and generic offline uploads.
            </p>
          </div>
          
          <div className="mt-6 space-y-4">
            <div className="flex justify-between border-b border-dark-border pb-2">
              <span className="text-xs text-gray-400">Active Streamers (Streaming)</span>
              <strong className="text-indigo-400 text-sm">{comparison?.streaming?.streamers || 0}</strong>
            </div>
            <div className="flex justify-between border-b border-dark-border pb-2">
              <span className="text-xs text-gray-400">Active Creators (Non-Streaming)</span>
              <strong className="text-cyan-400 text-sm">{comparison?.nonStreaming?.streamers || 0}</strong>
            </div>
            <div className="flex justify-between pb-2">
              <span className="text-xs text-gray-400">Date Range Covered</span>
              <strong className="text-white text-xs uppercase tracking-wider">{range}</strong>
            </div>
          </div>
        </div>

        {/* Details Breakdowns */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-950/30">
          
          {/* FTDs Conversion Ratio */}
          <div className="space-y-4 p-4 rounded-xl border border-dark-border bg-slate-900/20">
            <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
              <Coins className="h-4 w-4" />
              FTD Acquisitions
            </h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-gray-300 mb-1">
                  <span>Streaming</span>
                  <span className="font-bold text-indigo-400">{comparison?.streaming?.ftds || 0} FTDs</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full rounded-full transition-all duration-500" 
                    style={{ 
                      width: `${Math.min(100, ((comparison?.streaming?.ftds || 0) / Math.max(1, (comparison?.streaming?.ftds || 0) + (comparison?.nonStreaming?.ftds || 0))) * 100)}%` 
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-300 mb-1">
                  <span>Non-Streaming</span>
                  <span className="font-bold text-cyan-400">{comparison?.nonStreaming?.ftds || 0} FTDs</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="bg-gradient-to-r from-cyan-400 to-cyan-500 h-full rounded-full transition-all duration-500" 
                    style={{ 
                      width: `${Math.min(100, ((comparison?.nonStreaming?.ftds || 0) / Math.max(1, (comparison?.streaming?.ftds || 0) + (comparison?.nonStreaming?.ftds || 0))) * 100)}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Registrations Comparison */}
          <div className="space-y-4 p-4 rounded-xl border border-dark-border bg-slate-900/20">
            <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
              <UserCheck className="h-4 w-4" />
              Registrations
            </h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-gray-300 mb-1">
                  <span>Streaming</span>
                  <span className="font-bold text-indigo-400">{comparison?.streaming?.registrations || 0} Regs</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full rounded-full transition-all duration-500" 
                    style={{ 
                      width: `${Math.min(100, ((comparison?.streaming?.registrations || 0) / Math.max(1, (comparison?.streaming?.registrations || 0) + (comparison?.nonStreaming?.registrations || 0))) * 100)}%` 
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-300 mb-1">
                  <span>Non-Streaming</span>
                  <span className="font-bold text-cyan-400">{comparison?.nonStreaming?.registrations || 0} Regs</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="bg-gradient-to-r from-cyan-400 to-cyan-500 h-full rounded-full transition-all duration-500" 
                    style={{ 
                      width: `${Math.min(100, ((comparison?.nonStreaming?.registrations || 0) / Math.max(1, (comparison?.streaming?.registrations || 0) + (comparison?.nonStreaming?.registrations || 0))) * 100)}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Chat count comparison */}
          <div className="space-y-4 p-4 rounded-xl border border-dark-border bg-slate-900/20">
            <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-wide flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" />
              Chat Engagement
            </h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-gray-300 mb-1">
                  <span>Streaming</span>
                  <span className="font-bold text-indigo-400">{comparison?.streaming?.chats.toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full rounded-full transition-all duration-500" 
                    style={{ 
                      width: `${Math.min(100, ((comparison?.streaming?.chats || 0) / Math.max(1, (comparison?.streaming?.chats || 0) + (comparison?.nonStreaming?.chats || 0))) * 100)}%` 
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-300 mb-1">
                  <span>Non-Streaming</span>
                  <span className="font-bold text-cyan-400">{comparison?.nonStreaming?.chats.toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="bg-gradient-to-r from-cyan-400 to-cyan-500 h-full rounded-full transition-all duration-500" 
                    style={{ 
                      width: `${Math.min(100, ((comparison?.nonStreaming?.chats || 0) / Math.max(1, (comparison?.streaming?.chats || 0) + (comparison?.nonStreaming?.chats || 0))) * 100)}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Content uploads comparison */}
          <div className="space-y-4 p-4 rounded-xl border border-dark-border bg-slate-900/20">
            <h4 className="text-sm font-bold text-pink-400 uppercase tracking-wide flex items-center gap-1.5">
              <Video className="h-4 w-4" />
              Content Uploads
            </h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-gray-300 mb-1">
                  <span>Streaming</span>
                  <span className="font-bold text-indigo-400">{comparison?.streaming?.uploads} uploads</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full rounded-full transition-all duration-500" 
                    style={{ 
                      width: `${Math.min(100, ((comparison?.streaming?.uploads || 0) / Math.max(1, (comparison?.streaming?.uploads || 0) + (comparison?.nonStreaming?.uploads || 0))) * 100)}%` 
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-300 mb-1">
                  <span>Non-Streaming</span>
                  <span className="font-bold text-cyan-400">{comparison?.nonStreaming?.uploads} uploads</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="bg-gradient-to-r from-cyan-400 to-cyan-500 h-full rounded-full transition-all duration-500" 
                    style={{ 
                      width: `${Math.min(100, ((comparison?.nonStreaming?.uploads || 0) / Math.max(1, (comparison?.streaming?.uploads || 0) + (comparison?.nonStreaming?.uploads || 0))) * 100)}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

export default Dashboard;
