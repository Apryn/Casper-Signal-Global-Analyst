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
  Trash2,
  UserCheck,
  UserX
} from 'lucide-react';

const Schedules = () => {
  const [schedules, setSchedules] = useState([]);
  const [streamers, setStreamers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Tab state: YYYY-MM-DD
  const [activeDateStr, setActiveDateStr] = useState('');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStreamerId, setSelectedStreamerId] = useState('');
  const [platform, setPlatform] = useState('YouTube');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formError, setFormError] = useState('');

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

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const today = new Date();
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
    
    // Set default active tab to Today's date in local YYYY-MM-DD format
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    setActiveDateStr(todayStr);
  }, []);

  const handleOpenModal = () => {
    setPlatform('YouTube');
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

  const handleSubstituteChange = async (scheduleId, substituteId) => {
    const parsedId = substituteId === '' ? null : parseInt(substituteId, 10);
    try {
      await api.put(`/schedule/${scheduleId}`, { substitute_streamer_id: parsedId });
      fetchSchedules();
    } catch (err) {
      console.error('Error updating substitute streamer:', err);
      alert(err.response?.data?.message || 'Failed to update substitute streamer.');
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

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Scheduled':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Live':
        return 'bg-rose-500 text-white border-rose-600 animate-pulse';
      case 'Completed':
        return 'bg-emerald-500/10 text-emerald-450 border-emerald-550/20';
      case 'Cancelled':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  // Get active schedules for active date
  const filteredSchedules = schedules.filter(sc => {
    const scDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(sc.start_time));
    return scDateStr === activeDateStr;
  });

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-wide uppercase">Live Stream Timetables</h2>
          <p className="text-sm text-gray-400">Plan streamer sessions, swap schedule substitutes, and track real-time broadcast statuses.</p>
        </div>

        <button
          onClick={handleOpenModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-extrabold uppercase bg-indigo-600 hover:bg-indigo-500 text-white border-2 border-black shadow-tactile-sm active:translate-y-0.5 active:shadow-tactile-pressed transition-all duration-100"
        >
          <Plus className="h-4.5 w-4.5" />
          Schedule Live Stream
        </button>
      </div>

      {/* Date Rolling Tabs Selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b-2 border-black/40">
        {weeklyDates.map((dateObj, idx) => {
          const dateStr = new Intl.DateTimeFormat('en-CA', {
            year: 'numeric', month: '2-digit', day: '2-digit'
          }).format(dateObj);

          const todayStr = new Intl.DateTimeFormat('en-CA', {
            year: 'numeric', month: '2-digit', day: '2-digit'
          }).format(new Date());

          const isToday = todayStr === dateStr;
          const isActive = activeDateStr === dateStr;

          // Count schedules for this day
          const dayCount = schedules.filter(sc => {
            const scDateStr = new Intl.DateTimeFormat('en-CA', {
              timeZone: 'Asia/Jakarta',
              year: 'numeric', month: '2-digit', day: '2-digit'
            }).format(new Date(sc.start_time));
            return scDateStr === dateStr;
          }).length;

          return (
            <button
              key={idx}
              onClick={() => setActiveDateStr(dateStr)}
              className={`flex flex-col items-center justify-center min-w-[75px] sm:min-w-[95px] p-2.5 rounded-xl border-2 uppercase tracking-wide transition-all duration-100 cursor-pointer active:translate-y-0.5 select-none ${
                isActive 
                  ? 'bg-indigo-600 text-white border-black shadow-tactile-sm' 
                  : isToday
                    ? 'bg-slate-900/60 text-indigo-400 border-indigo-500/30'
                    : 'bg-dark-card/60 text-slate-400 border-black hover:border-slate-800'
              }`}
            >
              <span className="text-[10px] font-black leading-none">
                {dateObj.toLocaleDateString('id-ID', { weekday: 'short' })}
              </span>
              <span className="text-sm font-extrabold mt-1 leading-none">
                {dateObj.toLocaleDateString('id-ID', { day: 'numeric' })} {dateObj.toLocaleDateString('id-ID', { month: 'short' })}
              </span>
              {dayCount > 0 && (
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full mt-1.5 border ${
                  isActive ? 'bg-indigo-850 text-white border-indigo-500/50' : 'bg-slate-950 text-indigo-400 border-indigo-900/40'
                }`}>
                  {dayCount} Sesi
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-indigo-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent"></div>
          <span className="ml-3 text-xs">Compiling live timetables...</span>
        </div>
      ) : (
        /* Wide Grid Cards List for the Selected Day */
        <div className="space-y-4">
          {filteredSchedules.length === 0 ? (
            <div className="tactile-card p-12 text-center text-slate-500 border-2 border-black bg-dark-card flex flex-col items-center justify-center">
              <Calendar className="h-10 w-10 text-slate-700 mb-2" />
              <p className="text-xs font-bold uppercase tracking-wider">Tidak ada jadwal live terdaftar untuk hari ini.</p>
              <p className="text-[10px] text-slate-500 mt-1">Gunakan tombol "Schedule Live Stream" di kanan atas untuk membuat jadwal baru.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSchedules.map((sc) => {
                const startTimeStr = new Date(sc.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                const endTimeStr = new Date(sc.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                const isLive = sc.status === 'Live';

                return (
                  <div 
                    key={sc.id} 
                    className={`tactile-card p-5 border-2 border-black bg-dark-card relative group flex flex-col justify-between min-h-[220px] transition-all duration-200 ${
                      isLive ? 'shadow-[0_0_18px_rgba(244,63,94,0.18)] border-rose-500 bg-gradient-to-br from-rose-950/10 via-dark-card to-dark-card' : ''
                    }`}
                  >
                    {/* Top Action Header */}
                    <div className="flex items-start justify-between border-b-2 border-black/45 pb-3">
                      <div>
                        <strong className="block text-white text-base font-black">{sc.streamer_name}</strong>
                        <span className="inline-flex items-center gap-1 mt-1 text-[9px] uppercase font-black text-indigo-400 tracking-widest">{sc.platform}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Status badge / toggle select */}
                        <select
                          value={sc.status}
                          onChange={(e) => handleStatusChange(sc.id, e.target.value)}
                          className={`text-[9px] font-black uppercase p-1.5 rounded-lg border-2 border-black cursor-pointer focus:outline-none shadow-tactile-sm ${getStatusBadgeStyle(sc.status)}`}
                        >
                          <option value="Scheduled" className="bg-slate-950 text-blue-400">Scheduled</option>
                          <option value="Live" className="bg-slate-950 text-rose-450 font-black">Live</option>
                          <option value="Completed" className="bg-slate-950 text-emerald-450">Completed</option>
                          <option value="Cancelled" className="bg-slate-950 text-slate-400">Cancelled</option>
                        </select>

                        {/* Delete Schedule Button */}
                        <button
                          onClick={() => handleDeleteSchedule(sc.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-500 rounded-lg hover:bg-slate-900 border border-transparent hover:border-black transition-all cursor-pointer"
                          title="Delete Schedule"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </div>

                    {/* Middle Section: Time details */}
                    <div className="py-3 flex items-center gap-2 text-xs text-slate-300 font-bold">
                      <Clock className="h-4.5 w-4.5 text-indigo-400" />
                      <span>Jam Live: <strong className="text-white font-mono">{startTimeStr} - {endTimeStr} WIB</strong></span>
                    </div>

                    {/* Bottom Section: Streamer Swap Substitute Selector */}
                    <div className="border-t-2 border-black/45 pt-3.5 mt-auto bg-slate-950/20 p-2.5 rounded-xl border border-black/20">
                      <label className="block text-[8px] font-black text-slate-450 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <UserCheck className="h-3 w-3 text-emerald-500" />
                        <span>Streamer Pengganti (Substitute)</span>
                      </label>
                      <select
                        value={sc.substitute_streamer_id || ''}
                        onChange={(e) => handleSubstituteChange(sc.id, e.target.value)}
                        className={`w-full p-2 text-[10px] font-bold rounded-lg border-2 bg-slate-900 text-white focus:outline-none cursor-pointer ${
                          sc.substitute_streamer_id 
                            ? 'border-emerald-500 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.1)]' 
                            : 'border-black hover:border-slate-800'
                        }`}
                      >
                        <option value="" className="bg-slate-950 text-slate-500">-- Tidak Ada Pengganti (Normal) --</option>
                        {streamers
                          .filter(s => s.id !== sc.streamer_id) // Jangan tampilkan streamer asli di pilihan pengganti
                          .map(s => (
                            <option key={s.id} value={s.id} className="bg-slate-950 text-white">
                              {s.nama} (Gantikan)
                            </option>
                          ))}
                      </select>

                      {sc.substitute_streamer_id && (
                        <span className="block text-[8px] font-black text-emerald-450 uppercase tracking-widest mt-1.5">
                          ⚠️ digantikan oleh pengganti terdaftar
                        </span>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Schedule Live Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs" onClick={() => setModalOpen(false)} />
          
          <div className="relative w-full max-w-md p-6 md:p-8 rounded-2xl border-3 border-black bg-dark-card shadow-tactile-lg z-10 animate-scale-up">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-900 text-gray-400 hover:text-white border-2 border-black cursor-pointer shadow-tactile-sm active:translate-y-px"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <h3 className="text-lg font-black text-white mb-6 uppercase tracking-wide">Schedule Live Broadcast</h3>

            {formError && (
              <div className="p-3.5 mb-4 rounded-xl text-xs bg-rose-500/10 text-rose-450 border-2 border-rose-500/20 flex items-start gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 mb-4 rounded-xl text-xs bg-emerald-500/10 text-emerald-450 border-2 border-emerald-500/20 flex items-center gap-1.5">
                <CheckCircle2 className="h-4.5 w-4.5" />
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleCreateSchedule} className="space-y-4 text-sm font-bold">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-gray-450 uppercase tracking-widest mb-1.5">Streamer</label>
                  <select
                    value={selectedStreamerId}
                    onChange={(e) => setSelectedStreamerId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border-2 border-black bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-inset-screen"
                  >
                    {streamers.map(s => (
                      <option key={s.id} value={s.id} className="bg-slate-950">{s.nama}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-black text-gray-450 uppercase tracking-widest mb-1.5">Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full p-2.5 rounded-xl border-2 border-black bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-inset-screen"
                  >
                    <option value="YouTube">YouTube</option>
                    <option value="TikTok">TikTok</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-gray-450 uppercase tracking-widest mb-1.5">Start Time</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-2.5 rounded-xl border-2 border-black bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-inset-screen"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-gray-450 uppercase tracking-widest mb-1.5">End Time</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full p-2.5 rounded-xl border-2 border-black bg-slate-900 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-inset-screen"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 mt-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-extrabold text-white tracking-wide border-2 border-black shadow-tactile-sm active:translate-y-0.5 active:shadow-tactile-pressed transition-all duration-100 text-xs uppercase"
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
