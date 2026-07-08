import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Trophy, 
  Coins, 
  UserCheck, 
  MessageSquare, 
  Tv, 
  Video, 
  Calendar,
  Sparkles,
  Award,
  ArrowRight
} from 'lucide-react';

const Leaderboard = () => {
  const [range, setRange] = useState('30days');
  const [sortBy, setSortBy] = useState('ftds'); // 'ftds' | 'registrations' | 'chats' | 'liveHours' | 'uploads'
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/dashboard/leaderboard?range=${range}&limit=15`);
      setLeaderboard(res.data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [range]);

  // Sort local copy of data to support instantaneous metric switching without hitting DB again
  const getSortedLeaderboard = () => {
    const list = [...leaderboard];
    return list.sort((a, b) => {
      switch (sortBy) {
        case 'ftds':
          return b.ftds - a.ftds || b.registrations - a.registrations;
        case 'registrations':
          return b.registrations - a.registrations || b.ftds - a.ftds;
        case 'chats':
          return b.chats - a.chats;
        case 'liveHours':
          return b.liveHours - a.liveHours;
        case 'uploads':
          return b.uploads - a.uploads;
        default:
          return b.ftds - a.ftds;
      }
    }).map((item, idx) => ({
      ...item,
      currentRank: idx + 1
    }));
  };

  const sortedList = getSortedLeaderboard();
  const podiumTop3 = sortedList.slice(0, 3);
  const remainingList = sortedList.slice(3);

  const metricTabs = [
    { id: 'ftds', label: 'Most FTDs', icon: Coins },
    { id: 'registrations', label: 'Most Registrations', icon: UserCheck },
    { id: 'chats', label: 'Most Chats', icon: MessageSquare },
    { id: 'liveHours', label: 'Most Live Hours', icon: Tv },
    { id: 'uploads', label: 'Most Content', icon: Video },
  ];

  return (
    <div className="space-y-8">
      
      {/* Header filter row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Streamer Rankings Leaderboard</h2>
          <p className="text-sm text-gray-400">Discover and compare the highest-converting affiliate streamers.</p>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 rounded-xl border border-dark-border self-start sm:self-center">
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
      </div>

      {/* Sorting Tabs Bar */}
      <div className="flex flex-wrap gap-2.5 border-b border-dark-border/40 pb-4">
        {metricTabs.map((tab) => {
          const isSelected = sortBy === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSortBy(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 border ${
                isSelected 
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/10' 
                  : 'bg-slate-900/40 border-dark-border text-gray-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-indigo-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent"></div>
          <span className="ml-3 text-sm">Compiling rankings data...</span>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Podium for top 3 - Glowing glass panel setup */}
          {podiumTop3.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Rank 2 (left on desktop, first on mobile) */}
              {podiumTop3[1] && (
                <div className="order-2 md:order-1 glass-panel border bg-gradient-to-b from-slate-950 to-slate-900/20 p-6 rounded-2xl flex flex-col items-center justify-between text-center relative overflow-hidden h-64">
                  <div className="absolute top-0 left-0 w-full h-1 bg-slate-400/50" />
                  <div className="absolute top-3 left-4 text-[10px] text-gray-500 font-bold uppercase tracking-widest">Rank 2</div>
                  
                  <div className="mt-2 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 border border-slate-700 text-slate-400 text-xl font-bold">
                    🥈
                  </div>
                  <div className="mt-3">
                    <h4 className="font-bold text-white text-base">{podiumTop3[1].nama}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">{podiumTop3[1].platform}</p>
                  </div>
                  <div className="mt-4 flex gap-4 text-xs">
                    <div>
                      <span className="block text-gray-500 font-medium text-[9px] uppercase">FTD</span>
                      <strong className="text-white text-sm">{podiumTop3[1].ftds}</strong>
                    </div>
                    <div className="border-r border-dark-border h-8 self-center" />
                    <div>
                      <span className="block text-gray-500 font-medium text-[9px] uppercase">Regs</span>
                      <strong className="text-white text-sm">{podiumTop3[1].registrations}</strong>
                    </div>
                    <div className="border-r border-dark-border h-8 self-center" />
                    <div>
                      <span className="block text-gray-500 font-medium text-[9px] uppercase">Live</span>
                      <strong className="text-indigo-400 text-sm">{podiumTop3[1].liveHours}h</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Rank 1 (centered, taller) */}
              {podiumTop3[0] && (
                <div className="order-1 md:order-2 glass-panel border-indigo-500/30 bg-gradient-to-b from-slate-950 to-indigo-950/10 p-6 rounded-2xl flex flex-col items-center justify-between text-center relative overflow-hidden h-72 shadow-[0_0_30px_rgba(99,102,241,0.06)]">
                  <div className="absolute top-0 left-0 w-full h-1 bg-amber-500" />
                  <div className="absolute top-3 left-4 text-[10px] text-amber-500 font-bold uppercase tracking-widest flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Winner
                  </div>
                  
                  <div className="mt-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-950 border border-indigo-500/40 text-amber-400 text-2xl font-bold shadow-lg shadow-indigo-500/20">
                    👑
                  </div>
                  <div className="mt-3">
                    <h4 className="font-extrabold text-white text-lg tracking-wide">{podiumTop3[0].nama}</h4>
                    <p className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase mt-0.5">{podiumTop3[0].platform}</p>
                  </div>
                  <div className="mt-4 flex gap-5 text-xs bg-indigo-950/30 px-5 py-2.5 rounded-xl border border-indigo-500/10">
                    <div>
                      <span className="block text-indigo-300 font-medium text-[9px] uppercase">FTD</span>
                      <strong className="text-emerald-400 text-base">{podiumTop3[0].ftds}</strong>
                    </div>
                    <div className="border-r border-indigo-500/20 h-8 self-center" />
                    <div>
                      <span className="block text-indigo-300 font-medium text-[9px] uppercase">Regs</span>
                      <strong className="text-white text-base">{podiumTop3[0].registrations}</strong>
                    </div>
                    <div className="border-r border-indigo-500/20 h-8 self-center" />
                    <div>
                      <span className="block text-indigo-300 font-medium text-[9px] uppercase">Live</span>
                      <strong className="text-indigo-400 text-base">{podiumTop3[0].liveHours}h</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Rank 3 (right on desktop, third on mobile) */}
              {podiumTop3[2] && (
                <div className="order-3 glass-panel border bg-gradient-to-b from-slate-950 to-slate-900/20 p-6 rounded-2xl flex flex-col items-center justify-between text-center relative overflow-hidden h-64">
                  <div className="absolute top-0 left-0 w-full h-1 bg-amber-700/50" />
                  <div className="absolute top-3 left-4 text-[10px] text-gray-500 font-bold uppercase tracking-widest">Rank 3</div>
                  
                  <div className="mt-2 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 border border-slate-700 text-amber-700 text-xl font-bold">
                    🥉
                  </div>
                  <div className="mt-3">
                    <h4 className="font-bold text-white text-base">{podiumTop3[2].nama}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">{podiumTop3[2].platform}</p>
                  </div>
                  <div className="mt-4 flex gap-4 text-xs">
                    <div>
                      <span className="block text-gray-500 font-medium text-[9px] uppercase">FTD</span>
                      <strong className="text-white text-sm">{podiumTop3[2].ftds}</strong>
                    </div>
                    <div className="border-r border-dark-border h-8 self-center" />
                    <div>
                      <span className="block text-gray-500 font-medium text-[9px] uppercase">Regs</span>
                      <strong className="text-white text-sm">{podiumTop3[2].registrations}</strong>
                    </div>
                    <div className="border-r border-dark-border h-8 self-center" />
                    <div>
                      <span className="block text-gray-500 font-medium text-[9px] uppercase">Live</span>
                      <strong className="text-indigo-400 text-sm">{podiumTop3[2].liveHours}h</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Leaderboard Table list */}
          <div className="glass-panel rounded-2xl border bg-slate-950/20 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-dark-border bg-slate-950/50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="py-4.5 px-6 text-center w-16">Rank</th>
                    <th className="py-4.5 px-4">Nama Streamer</th>
                    <th className="py-4.5 px-4 text-center">Live Hours</th>
                    <th className="py-4.5 px-4 text-center">Uploads</th>
                    <th className="py-4.5 px-4 text-right">Chats</th>
                    <th className="py-4.5 px-4 text-right">Registrations</th>
                    <th className="py-4.5 px-4 text-right font-medium text-emerald-400">FTD Count</th>
                    <th className="py-4.5 px-6 text-right">Conversion Ratio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border/40 text-sm text-gray-300">
                  {sortedList.map((item) => {
                    // Calculate Conversion Rate
                    const convRate = item.registrations > 0 
                      ? Math.round((item.ftds / item.registrations) * 100) 
                      : 0;

                    return (
                      <tr 
                        key={item.id} 
                        className={`hover:bg-slate-900/25 transition-colors ${
                          item.currentRank <= 3 ? 'bg-indigo-500/[0.01]' : ''
                        }`}
                      >
                        {/* Rank Badge */}
                        <td className="py-4 px-6 text-center font-bold">
                          {item.currentRank === 1 ? '🥇' : 
                           item.currentRank === 2 ? '🥈' : 
                           item.currentRank === 3 ? '🥉' : 
                           item.currentRank}
                        </td>

                        {/* Name */}
                        <td className="py-4 px-4">
                          <strong className="text-white block">{item.nama}</strong>
                          <span className="text-[10px] text-gray-400">{item.platform}</span>
                        </td>

                        {/* Live hours */}
                        <td className="py-4 px-4 text-center font-mono font-semibold text-indigo-400">
                          {item.liveHours > 0 ? `${item.liveHours.toFixed(1)} hrs` : '-'}
                        </td>

                        {/* Content uploads */}
                        <td className="py-4 px-4 text-center font-mono text-white">
                          {item.uploads} vids
                        </td>

                        {/* Chats count */}
                        <td className="py-4 px-4 text-right font-mono text-gray-300">
                          {item.chats.toLocaleString()}
                        </td>

                        {/* Reg count */}
                        <td className="py-4 px-4 text-right font-mono text-white font-semibold">
                          {item.registrations}
                        </td>

                        {/* FTD count */}
                        <td className="py-4 px-4 text-right font-mono text-emerald-400 font-extrabold">
                          {item.ftds}
                        </td>

                        {/* Conversion Rate */}
                        <td className="py-4 px-6 text-right font-semibold">
                          <div className="flex items-center justify-end gap-2">
                            <span className={convRate >= 35 ? 'text-emerald-400' : convRate >= 15 ? 'text-indigo-400' : 'text-gray-400'}>
                              {convRate}%
                            </span>
                            
                            {/* Conversion Bar */}
                            <div className="w-16 bg-slate-950 h-1.5 rounded-full overflow-hidden border border-white/5 hidden sm:block">
                              <div 
                                className={`h-full rounded-full ${
                                  convRate >= 35 ? 'bg-emerald-500' : convRate >= 15 ? 'bg-indigo-500' : 'bg-gray-500'
                                }`} 
                                style={{ width: `${Math.min(100, convRate)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};

export default Leaderboard;
