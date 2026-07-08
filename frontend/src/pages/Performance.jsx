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
  Info
} from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';

const Performance = () => {
  const [streamers, setStreamers] = useState([]);
  const [selectedStreamerId, setSelectedStreamerId] = useState('');
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState('30days');

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
  }, []);

  // Fetch performance details when streamer or range changes
  useEffect(() => {
    if (!selectedStreamerId) return;

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
  }, [selectedStreamerId, range]);

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

  return (
    <div className="space-y-6">
      
      {/* Selector and filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Streamer Performance Analytics</h2>
          <p className="text-sm text-gray-400">Drill down into individual conversion funnels and tracking curves.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Streamer Dropdown */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 rounded-xl border border-dark-border">
            <span className="text-xs font-bold text-indigo-400 uppercase">Streamer:</span>
            <select
              value={selectedStreamerId}
              onChange={(e) => setSelectedStreamerId(e.target.value)}
              className="bg-transparent text-sm text-gray-300 font-semibold focus:outline-none border-none cursor-pointer"
            >
              {streamers.map(s => (
                <option key={s.id} value={s.id} className="bg-slate-950">{s.nama} ({s.platform})</option>
              ))}
            </select>
          </div>

          {/* Date range filter */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 rounded-xl border border-dark-border">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="bg-transparent text-sm text-gray-300 focus:outline-none border-none cursor-pointer"
            >
              <option value="7days" className="bg-slate-950">Last 7 Days</option>
              <option value="30days" className="bg-slate-950">Last 30 Days</option>
              <option value="thisMonth" className="bg-slate-950">This Month</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-96 items-center justify-center text-indigo-400">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent"></div>
          <span className="ml-3 text-lg font-medium">Analyzing streamer statistics...</span>
        </div>
      ) : performance ? (
        <div className="space-y-6">
          
          {/* Streamer stats cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            <div className="glass-panel p-5 rounded-2xl border bg-slate-950/20">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Hours Live</span>
              <strong className="text-xl font-bold text-white block mt-1.5">{stats?.totalLiveHours.toFixed(1)} hrs</strong>
              <span className="text-[10px] text-indigo-400 font-semibold mt-1 block">In selected range</span>
            </div>

            <div className="glass-panel p-5 rounded-2xl border bg-slate-950/20">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Content Uploads</span>
              <strong className="text-xl font-bold text-white block mt-1.5">{stats?.totalUploads} uploads</strong>
              <span className="text-[10px] text-pink-400 font-semibold mt-1 block">Across all platforms</span>
            </div>

            <div className="glass-panel p-5 rounded-2xl border bg-slate-950/20">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Ingested Chats</span>
              <strong className="text-xl font-bold text-white block mt-1.5">{stats?.totalChats.toLocaleString()}</strong>
              <span className="text-[10px] text-cyan-400 font-semibold mt-1 block">Incoming messages</span>
            </div>

            <div className="glass-panel p-5 rounded-2xl border bg-slate-950/20">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Registrations</span>
              <strong className="text-xl font-bold text-white block mt-1.5">{stats?.totalRegistrations}</strong>
              <span className="text-[10px] text-amber-500 font-semibold mt-1 block">Registration conversion</span>
            </div>

            <div className="glass-panel p-5 rounded-2xl border bg-slate-950/20">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">FTD Acquisitions</span>
              <strong className="text-xl font-bold text-white block mt-1.5">{stats?.totalFtds}</strong>
              <span className="text-[10px] text-emerald-400 font-semibold mt-1 block">First Time Deposits</span>
            </div>
          </div>

          {/* Ratios & insights container */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Conversion funnels */}
            <div className="glass-panel p-6 rounded-2xl border bg-slate-950/30 flex flex-col justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-5 flex items-center gap-2">
                <TrendingUp className="h-4.5 w-4.5 text-indigo-400" />
                Conversion Funnel Rates
              </h3>
              
              <div className="space-y-6">
                {/* Reg rate */}
                <div>
                  <div className="flex justify-between text-xs text-gray-300 mb-1.5">
                    <span>Registration Rate (Reg / Chat)</span>
                    <strong className="text-indigo-400 text-sm">{stats?.registrationRate}%</strong>
                  </div>
                  <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5">
                    <div 
                      className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, stats?.registrationRate || 0)}%` }}
                    />
                  </div>
                </div>

                {/* Ftd conversion */}
                <div>
                  <div className="flex justify-between text-xs text-gray-300 mb-1.5">
                    <span>FTD Conversion (FTD / Reg)</span>
                    <strong className="text-emerald-400 text-sm">{stats?.ftdConversion}%</strong>
                  </div>
                  <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, stats?.ftdConversion || 0)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Tips footer */}
              <div className="mt-8 p-3 rounded-lg bg-indigo-950/10 border border-indigo-500/10 text-[11px] text-gray-400 flex items-start gap-2">
                <Info className="h-4.5 w-4.5 text-indigo-400 shrink-0 mt-0.5" />
                <span>Rasio konversi mengindikasikan tingkat efektivitas streamer mengarahkan chat penonton untuk melakukan pendaftaran dan deposit.</span>
              </div>
            </div>

            {/* Rule-based insights card */}
            <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border bg-slate-950/30">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-cyan-400" />
                Performance Insights
              </h3>

              <div className="space-y-4">
                {performance.insights.map((insight, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-dark-border bg-slate-900/30 text-sm text-gray-300 flex items-start gap-3">
                    <div className="h-5 w-5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                      {idx + 1}
                    </div>
                    <p className="leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Registrations and FTDs chart */}
            <div className="glass-panel p-6 rounded-2xl border bg-slate-950/30">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Acquisition History</h3>
              <div className="h-72 relative">
                <Line data={getLineChartData()} options={chartOptions} />
              </div>
            </div>

            {/* Chats chart */}
            <div className="glass-panel p-6 rounded-2xl border bg-slate-950/30">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Chat Engagement History</h3>
              <div className="h-72 relative">
                <Bar data={getBarChartData()} options={chartOptions} />
              </div>
            </div>

          </div>

        </div>
      ) : (
        <div className="text-center text-gray-500 py-12">Failed to load performance analytics.</div>
      )}

    </div>
  );
};

export default Performance;
