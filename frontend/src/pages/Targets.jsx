import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Target, 
  Plus, 
  Coins, 
  UserCheck, 
  Video, 
  Tv,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Info
} from 'lucide-react';

const Targets = () => {
  const [streamers, setStreamers] = useState([]);
  const [targets, setTargets] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodTab, setPeriodTab] = useState('monthly'); // 'daily' | 'weekly' | 'monthly'
  
  // Form states
  const [selectedStreamerId, setSelectedStreamerId] = useState('');
  const [targetType, setTargetType] = useState('ftds');
  const [targetValue, setTargetValue] = useState('');
  const [formPeriod, setFormPeriod] = useState('monthly');
  const [formSuccess, setFormSuccess] = useState('');
  const [formError, setFormError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [streamersRes, targetsRes, reportsRes] = await Promise.all([
        api.get('/streamers'),
        api.get(`/targets?period=${periodTab}`),
        api.get('/reports') // Fetch reports to compute actuals locally
      ]);
      setStreamers(streamersRes.data);
      setTargets(targetsRes.data);
      setReports(reportsRes.data);

      if (streamersRes.data.length > 0 && !selectedStreamerId) {
        setSelectedStreamerId(streamersRes.data[0].id);
      }
    } catch (err) {
      console.error('Error fetching targets view data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [periodTab]);

  const handleSubmitTarget = async (e) => {
    e.preventDefault();
    setFormSuccess('');
    setFormError('');

    if (!selectedStreamerId || !targetValue || isNaN(targetValue) || parseFloat(targetValue) < 0) {
      setFormError('Please select a valid streamer and enter a positive target value.');
      return;
    }

    try {
      await api.post('/targets', {
        streamer_id: selectedStreamerId,
        target_type: targetType,
        target_value: parseFloat(targetValue),
        period: formPeriod
      });

      setFormSuccess('Goal updated successfully!');
      setTargetValue('');
      
      // Reload targets data
      fetchData();
    } catch (err) {
      console.error('Error saving target:', err);
      setFormError(err.response?.data?.message || 'Failed to save target goal.');
    }
  };

  // Helper to filter reports based on period
  const getFilteredReports = (streamerId) => {
    const today = new Date();
    const streamerReports = reports.filter(r => r.streamer_id === streamerId);
    
    if (periodTab === 'daily') {
      const todayStr = today.toISOString().split('T')[0];
      return streamerReports.filter(r => r.tanggal.split('T')[0] === todayStr);
    }
    
    if (periodTab === 'weekly') {
      const start = new Date();
      start.setDate(today.getDate() - 7);
      return streamerReports.filter(r => new Date(r.tanggal) >= start);
    }
    
    // Monthly (current month)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return streamerReports.filter(r => new Date(r.tanggal) >= monthStart);
  };

  // Calculates actual metrics for a streamer based on the current period tab
  const calculateActuals = (streamerId) => {
    const periodReports = getFilteredReports(streamerId);
    
    return {
      ftds: periodReports.reduce((sum, r) => sum + r.ftd_count, 0),
      registrations: periodReports.reduce((sum, r) => sum + r.registration_count, 0),
      uploads: periodReports.reduce((sum, r) => sum + r.tiktok_upload + r.youtube_upload + r.instagram_upload + r.facebook_upload, 0),
      live_duration: periodReports.reduce((sum, r) => sum + parseFloat(r.live_duration), 0)
    };
  };

  // Returns progress color codes
  const getProgressColor = (percent) => {
    if (percent >= 100) return { text: 'text-emerald-400', bg: 'bg-emerald-500', pill: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 };
    if (percent >= 70) return { text: 'text-amber-400', bg: 'bg-amber-500', pill: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: AlertTriangle };
    return { text: 'text-rose-400', bg: 'bg-rose-500', pill: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: XCircle };
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-wide">Target Quotas Tracking</h2>
        <p className="text-sm text-gray-400">Configure streamer quotas and monitor their conversion status.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Set Target Form */}
        <div className="glass-panel p-6 rounded-2xl border bg-slate-950/30 h-fit">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-5 flex items-center gap-2">
            <Target className="h-4.5 w-4.5 text-indigo-400" />
            Set Target Quotas
          </h3>

          {formError && (
            <div className="p-3 mb-4 rounded-xl text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20">
              {formError}
            </div>
          )}

          {formSuccess && (
            <div className="p-3 mb-4 rounded-xl text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              {formSuccess}
            </div>
          )}

          <form onSubmit={handleSubmitTarget} className="space-y-4 text-sm">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Select Streamer</label>
              <select
                value={selectedStreamerId}
                onChange={(e) => setSelectedStreamerId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                {streamers.map(s => (
                  <option key={s.id} value={s.id} className="bg-slate-950">{s.nama} ({s.platform})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Metric Goal</label>
                <select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="ftds">FTD</option>
                  <option value="registrations">Registrations</option>
                  <option value="uploads">Video Uploads</option>
                  <option value="live_duration">Live Hours</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Period</label>
                <select
                  value={formPeriod}
                  onChange={(e) => setFormPeriod(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Target Value</label>
              <input
                type="number"
                step="any"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="Enter number (e.g. 50)"
                className="w-full p-2.5 rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 mt-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white tracking-wide transition-colors text-xs uppercase"
            >
              Update Goal Target
            </button>
          </form>
        </div>

        {/* Targets Progress Board */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Header toggles */}
          <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded-xl border border-dark-border">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest pl-3">Active Tracker</h3>
            <div className="flex rounded-lg p-0.5 bg-slate-900 border border-dark-border">
              {['daily', 'weekly', 'monthly'].map((t) => (
                <button
                  key={t}
                  onClick={() => setPeriodTab(t)}
                  className={`px-4 py-1 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                    periodTab === t 
                      ? 'bg-indigo-600 text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center text-indigo-400">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent"></div>
              <span className="ml-3 text-xs">Compiling targets board...</span>
            </div>
          ) : streamers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No active streamers found.</div>
          ) : (
            <div className="space-y-4">
              {streamers.map((streamer) => {
                // Calculate actual performance for current period
                const actual = calculateActuals(streamer.id);
                
                // Get targets for this streamer from targets array
                const streamerTargets = targets.filter(t => t.streamer_id === streamer.id);

                const getGoalDetails = (type, actualVal) => {
                  const targetObj = streamerTargets.find(t => t.target_type === type);
                  const targetVal = targetObj ? parseFloat(targetObj.target_value) : 0;
                  const percent = targetVal > 0 ? Math.round((actualVal / targetVal) * 100) : 100;
                  return { targetVal, percent };
                };

                const metrics = [
                  { label: 'FTD Goals', actual: actual.ftds, ...getGoalDetails('ftds', actual.ftds), icon: Coins },
                  { label: 'Registrations', actual: actual.registrations, ...getGoalDetails('registrations', actual.registrations), icon: UserCheck },
                  { label: 'Content Uploads', actual: actual.uploads, ...getGoalDetails('uploads', actual.uploads), icon: Video },
                  { label: 'Live Streaming Hours', actual: actual.live_duration, ...getGoalDetails('live_duration', actual.live_duration), icon: Tv }
                ];

                return (
                  <div key={streamer.id} className="glass-panel p-5 rounded-2xl border bg-slate-950/20 space-y-4">
                    <div className="flex items-center justify-between border-b border-dark-border/40 pb-2.5">
                      <div>
                        <h4 className="font-extrabold text-white text-base">{streamer.nama}</h4>
                        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                          Primary: {streamer.platform}
                        </span>
                      </div>
                      <span className="text-[10px] bg-slate-900 border border-dark-border px-3 py-1 rounded-full text-indigo-400 font-bold uppercase tracking-widest">
                        {periodTab} Target
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5 pt-1.5">
                      {metrics.map((m, idx) => {
                        const style = getProgressColor(m.percent);
                        const StyleIcon = style.icon;

                        return (
                          <div key={idx} className="space-y-1.5 p-3 rounded-xl border border-dark-border/40 bg-slate-900/10">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                <m.icon className="h-3.5 w-3.5" />
                                {m.label}
                              </span>
                              <span className={`inline-flex items-center gap-0.5 text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${style.pill}`}>
                                <StyleIcon className="h-3 w-3 shrink-0" />
                                {m.percent}%
                              </span>
                            </div>

                            <div className="flex items-baseline justify-between pt-1">
                              <span className="text-sm font-extrabold text-white">
                                {typeof m.actual === 'number' && !Number.isInteger(m.actual) ? m.actual.toFixed(1) : m.actual}
                                <span className="text-[11px] text-gray-400 font-semibold"> / {m.targetVal > 0 ? (Number.isInteger(m.targetVal) ? m.targetVal : m.targetVal.toFixed(1)) : 'No Goal'}</span>
                              </span>
                            </div>

                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-white/5 mt-1.5">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${style.bg}`} 
                                style={{ width: `${Math.min(100, m.percent)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

    </div>
  );
};

export default Targets;
