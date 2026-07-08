import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Calendar, 
  Plus, 
  Tv, 
  Clock, 
  X, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Trash2
} from 'lucide-react';

const Schedules = () => {
  const [schedules, setSchedules] = useState([]);
  const [streamers, setStreamers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStreamerId, setSelectedStreamerId] = useState('');
  const [platform, setPlatform] = useState('TikTok');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formError, setFormError] = useState('');

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const today = new Date();
      // Fetch schedules from 3 days ago up to 7 days in the future to cover all active weekly items
      const start = new Date();
      start.setDate(today.getDate() - 3);
      const end = new Date();
      end.setDate(today.getDate() + 8);

      const [schedulesRes, streamersRes] = await Promise.all([
        api.get(`/schedule?startDate=${start.toISOString()}&endDate=${end.toISOString()}`),
        api.get('/streamers')
      ]);

      setSchedules(schedulesRes.data);
      setStreamers(streamersRes.data);

      if (streamersRes.data.length > 0 && !selectedStreamerId) {
        setSelectedStreamerId(streamersRes.data[0].id);
      }
    } catch (err) {
      console.error('Error fetching schedules catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleOpenModal = () => {
    setPlatform('TikTok');
    setStartTime('');
    setEndTime('');
    setFormSuccess('');
    setFormError('');
    setModalOpen(true);
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    setFormSuccess('');
    setFormError('');

    if (!selectedStreamerId || !startTime || !endTime) {
      setFormError('Please fill in all scheduling fields.');
      return;
    }

    try {
      await api.post('/schedule', {
        streamer_id: selectedStreamerId,
        platform,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString()
      });

      setFormSuccess('Session scheduled successfully!');
      fetchSchedules();
      
      setTimeout(() => {
        setModalOpen(false);
      }, 1200);
    } catch (err) {
      console.error('Scheduling error:', err);
      // Handles 409 overlap conflicts and other validation errors
      setFormError(err.response?.data?.message || 'Failed to schedule stream.');
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.put(`/schedule/${id}`, { status: newStatus });
      fetchSchedules();
    } catch (err) {
      console.error('Error changing schedule status:', err);
      alert(err.response?.data?.message || 'Failed to update schedule status.');
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (!window.confirm('Delete this scheduled stream session?')) return;
    try {
      await api.delete(`/schedule/${id}`);
      fetchSchedules();
    } catch (err) {
      console.error('Error deleting schedule:', err);
    }
  };

  // Generate rolling weekly list of dates (Yesterday, Today, and next 5 days)
  const getWeeklyDates = () => {
    const dates = [];
    const today = new Date();
    
    // Start from yesterday
    for (let i = -1; i < 6; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weeklyDates = getWeeklyDates();

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Scheduled':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Live':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse';
      case 'Completed':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Cancelled':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Live Stream Timetables</h2>
          <p className="text-sm text-gray-400">Plan streamer sessions, detect overlaps, and track real-time broadcast statuses.</p>
        </div>

        <button
          onClick={handleOpenModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/10 active:translate-y-px transition-all duration-200"
        >
          <Plus className="h-4.5 w-4.5" />
          Schedule Live Stream
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-indigo-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent"></div>
          <span className="ml-3 text-xs">Compiling live timetables...</span>
        </div>
      ) : (
        /* Rolling weekly layout columns grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
          {weeklyDates.map((dateObj, idx) => {
            const dateStr = dateObj.toISOString().split('T')[0];
            const isToday = new Date().toISOString().split('T')[0] === dateStr;

            // Filter schedules for this specific day
            const daySchedules = schedules.filter(sc => sc.start_time.split('T')[0] === dateStr);

            return (
              <div 
                key={idx} 
                className={`glass-panel p-4 rounded-xl border flex flex-col min-h-[350px] ${
                  isToday 
                    ? 'border-indigo-500/35 bg-indigo-950/5 shadow-[0_0_15px_rgba(99,102,241,0.04)]' 
                    : 'bg-slate-950/20'
                }`}
              >
                {/* Column header */}
                <div className="border-b border-dark-border/40 pb-2 mb-3 text-center">
                  <span className={`block text-[11px] font-bold uppercase tracking-wider ${isToday ? 'text-indigo-400 font-extrabold' : 'text-gray-400'}`}>
                    {dateObj.toLocaleDateString('id-ID', { weekday: 'short' })}
                  </span>
                  <span className={`text-base font-extrabold block ${isToday ? 'text-white' : 'text-gray-300'}`}>
                    {dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </span>
                  {isToday && (
                    <span className="inline-block mt-1 text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-widest leading-none">
                      Today
                    </span>
                  )}
                </div>

                {/* Day Schedules lists */}
                <div className="flex-1 space-y-3 overflow-y-auto">
                  {daySchedules.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center text-[10px] text-gray-600 py-8">
                      No live sessions
                    </div>
                  ) : (
                    daySchedules.map((sc) => {
                      const startTimeStr = new Date(sc.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                      const endTimeStr = new Date(sc.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

                      return (
                        <div 
                          key={sc.id} 
                          className="p-3 rounded-lg border border-dark-border/60 bg-slate-900/35 hover:bg-slate-900/60 transition-colors relative group/card"
                        >
                          {/* Delete handle */}
                          <button
                            onClick={() => handleDeleteSchedule(sc.id)}
                            className="absolute top-2 right-2 p-1 text-gray-500 hover:text-red-400 rounded hover:bg-slate-800 opacity-0 group-hover/card:opacity-100 transition-opacity"
                            title="Delete Schedule"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>

                          <strong className="block text-white text-xs font-semibold">{sc.streamer_name}</strong>
                          <span className="block text-[9px] uppercase font-bold text-indigo-400 tracking-wider mb-1.5">{sc.platform}</span>

                          {/* Time */}
                          <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono mb-2">
                            <Clock className="h-3 w-3" />
                            <span>{startTimeStr} - {endTimeStr}</span>
                          </div>

                          {/* Status toggle selection */}
                          <select
                            value={sc.status}
                            onChange={(e) => handleStatusChange(sc.id, e.target.value)}
                            className={`w-full text-[9px] font-bold p-1 rounded border focus:outline-none cursor-pointer ${getStatusBadgeStyle(sc.status)}`}
                          >
                            <option value="Scheduled" className="bg-slate-950 text-blue-400">Scheduled</option>
                            <option value="Live" className="bg-slate-950 text-rose-400">Live</option>
                            <option value="Completed" className="bg-slate-950 text-emerald-400">Completed</option>
                            <option value="Cancelled" className="bg-slate-950 text-slate-400">Cancelled</option>
                          </select>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Live Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs" onClick={() => setModalOpen(false)} />
          
          <div className="relative w-full max-w-md p-6 md:p-8 rounded-2xl border border-dark-border bg-slate-950 shadow-2xl z-10 animate-scale-up">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-900 text-gray-400 hover:text-white border border-dark-border"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-6">Schedule Live Broadcast</h3>

            {formError && (
              <div className="p-3.5 mb-4 rounded-xl text-xs bg-rose-500/10 text-rose-400 border border-rose-500/25 flex items-start gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 mb-4 rounded-xl text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <CheckCircle2 className="h-4.5 w-4.5" />
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleCreateSchedule} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Streamer</label>
                  <select
                    value={selectedStreamerId}
                    onChange={(e) => setSelectedStreamerId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    {streamers.map(s => (
                      <option key={s.id} value={s.id} className="bg-slate-950">{s.nama}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="TikTok">TikTok</option>
                    <option value="YouTube">YouTube</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Start Time</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">End Time</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-dark-border bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 mt-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white tracking-wide transition-colors text-xs uppercase"
              >
                Submit Schedule
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Schedules;
