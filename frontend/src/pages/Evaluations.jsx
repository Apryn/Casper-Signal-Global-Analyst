import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Printer, 
  Sparkles, 
  Calendar, 
  Users, 
  Activity, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  FileText
} from 'lucide-react';

const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff)).toISOString().split('T')[0];
};

const Evaluations = () => {
  const [streamers, setStreamers] = useState([]);
  const [selectedStreamerId, setSelectedStreamerId] = useState('');
  const [selectedDate, setSelectedDate] = useState(getMonday(new Date()));
  const [loading, setLoading] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [editingFeedback, setEditingFeedback] = useState({
    kelebihan: '',
    kekurangan: '',
    rekomendasi: ''
  });
  const [error, setError] = useState('');

  // Save/History states
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [historyList, setHistoryList] = useState([]);
  const [activeTab, setActiveTab] = useState('generate'); // 'generate' | 'history'

  const fetchHistory = async (streamerId) => {
    if (!streamerId) return;
    try {
      const res = await api.get(`/evaluations/history?streamerId=${streamerId}`);
      setHistoryList(res.data);
    } catch (err) {
      console.error('Error fetching evaluation history:', err);
    }
  };

  // Fetch all streamers
  useEffect(() => {
    const fetchStreamers = async () => {
      try {
        const res = await api.get('/streamers');
        setStreamers(res.data);
        if (res.data.length > 0) {
          const firstId = res.data[0].id;
          setSelectedStreamerId(firstId);
          fetchHistory(firstId);
        }
      } catch (err) {
        console.error('Error fetching streamers:', err);
      }
    };
    fetchStreamers();
  }, []);

  // Refetch history when selected streamer changes
  useEffect(() => {
    if (selectedStreamerId) {
      fetchHistory(selectedStreamerId);
    }
  }, [selectedStreamerId]);

  const handleSave = async () => {
    if (!evaluation) return;
    setSaving(true);
    setSaveSuccess('');
    setError('');

    try {
      await api.post('/evaluations/save', {
        streamerId: selectedStreamerId,
        startDate: evaluation.period.start,
        endDate: evaluation.period.end,
        stats: evaluation.stats,
        targets: evaluation.targets,
        peakHour: evaluation.peakHour,
        kelebihan: editingFeedback.kelebihan,
        kekurangan: editingFeedback.kekurangan,
        rekomendasi: editingFeedback.rekomendasi
      });
      setSaveSuccess('Rapor mingguan berhasil disimpan secara permanen di database!');
      fetchHistory(selectedStreamerId);
      setEvaluation(prev => ({ ...prev, isArchived: true }));
      setTimeout(() => setSaveSuccess(''), 4000);
    } catch (err) {
      console.error('Error saving weekly evaluation:', err);
      setError('Gagal menyimpan evaluasi ke database.');
    } finally {
      setSaving(false);
    }
  };


  const handleGenerate = async () => {
    if (!selectedStreamerId) return;
    setLoading(true);
    setError('');
    setEvaluation(null);

    const monday = getMonday(selectedDate);

    try {
      const res = await api.get(`/evaluations/weekly?streamerId=${selectedStreamerId}&startDate=${monday}`);
      setEvaluation(res.data);
      setEditingFeedback({
        kelebihan: res.data.aiFeedback?.kelebihan || '',
        kekurangan: res.data.aiFeedback?.kekurangan || '',
        rekomendasi: res.data.aiFeedback?.rekomendasi || ''
      });
    } catch (err) {
      console.error('Error fetching evaluation:', err);
      setError(err.response?.data?.message || 'Gagal memproses evaluasi mingguan.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getAchievementIcon = (achievement) => {
    if (achievement >= 100) return <CheckCircle2 size={16} className="text-emerald-500" />;
    if (achievement >= 70) return <AlertTriangle size={16} className="text-amber-500" />;
    return <XCircle size={16} className="text-rose-500" />;
  };

  const getAchievementColor = (achievement) => {
    if (achievement >= 100) return 'text-emerald-400';
    if (achievement >= 70) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* CSS print overrides */}
      <style>{`
        @media print {
          /* Hide sidebar, headers, options bar */
          body * {
            visibility: hidden;
          }
          .printable-slip, .printable-slip * {
            visibility: visible;
          }
          .printable-slip {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          /* Styles for print */
          .printable-slip textarea {
            border: none !important;
            background: transparent !important;
            resize: none !important;
            color: black !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
            font-family: inherit !important;
            font-size: 0.95rem !important;
            line-height: 1.6 !important;
          }
          .printable-slip .bg-slate-900,
          .printable-slip .bg-slate-950,
          .printable-slip .bg-slate-800,
          .printable-slip .bg-slate-900\\/50 {
            background: transparent !important;
            color: black !important;
          }
          .printable-slip .text-gray-400,
          .printable-slip .text-slate-400 {
            color: #4b5563 !important;
          }
          .printable-slip .text-white,
          .printable-slip .text-slate-100 {
            color: black !important;
          }
          .printable-slip .border-slate-800,
          .printable-slip .border-slate-700 {
            border-color: #d1d5db !important;
          }
          .printable-slip .text-indigo-400 {
            color: #312e81 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="mb-6 no-print">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <FileText className="text-indigo-500" />
          Weekly Evaluation & Print Center
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Buat dan cetak rapor evaluasi mingguan taktis untuk dibagikan kepada masing-masing streamer.
        </p>

        {/* Tab Selection */}
        <div className="flex gap-4 border-b border-slate-800 mt-6 pb-px">
          <button
            onClick={() => setActiveTab('generate')}
            className={`pb-3 text-sm font-semibold transition-all border-b-2 px-1 ${
              activeTab === 'generate'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Buat Rapor Baru
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              if (selectedStreamerId) fetchHistory(selectedStreamerId);
            }}
            className={`pb-3 text-sm font-semibold transition-all border-b-2 px-1 ${
              activeTab === 'history'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Histori Rapor Tersimpan ({historyList.length})
          </button>
        </div>
      </div>


      {/* Generate Rapor Panel */}
      {activeTab === 'generate' && (
        <>
          {/* Config Panel */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 mb-6 no-print">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Pilih Streamer
            </label>
            <select
              value={selectedStreamerId}
              onChange={(e) => setSelectedStreamerId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {streamers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama} ({s.platform})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Pilih Minggu (Hari Apa Saja)
            </label>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <button
              onClick={handleGenerate}
              disabled={loading || !selectedStreamerId}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition"
            >
              {loading ? (
                <span>Menganalisis...</span>
              ) : (
                <>
                  <Sparkles size={18} />
                  Jadikan Rapor
                </>
              )}
            </button>
          </div>
        </div>
        {error && <p className="text-rose-400 text-xs mt-3">{error}</p>}
      </div>

      {/* Slip Preview Canvas */}
      {evaluation && (
        <div className="space-y-6">
          
          {/* Options Bar */}
          <div className="flex justify-between items-center no-print">
            <div>
              {evaluation.isArchived ? (
                <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                  ✓ Tersimpan di Database
                </span>
              ) : (
                <span className="text-xs text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                  ⚠️ Draf Belum Disimpan
                </span>
              )}
              {saveSuccess && <span className="text-xs text-emerald-400 ml-3">{saveSuccess}</span>}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
              >
                {saving ? 'Menyimpan...' : 'Simpan Rapor'}
              </button>
              <button
                onClick={handlePrint}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition"
              >
                <Printer size={14} />
                Cetak Rapor (Print / PDF)
              </button>
            </div>
          </div>


          {/* Actual Slip Card */}
          <div className="printable-slip bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl max-w-3xl mx-auto">
            {/* Slip Header */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-6 mb-6">
              <div>
                <span className="text-xs font-bold text-indigo-400 tracking-widest uppercase block">
                  CASPER SIGNAL SYSTEM
                </span>
                <h2 className="text-xl font-bold text-white tracking-wide mt-1">
                  WEEKLY PERFORMANCE EVALUATION SLIP
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Periode Laporan: {evaluation.period.start} s/d {evaluation.period.end}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Nama Streamer</span>
                <span className="text-lg font-bold text-slate-100 block">{evaluation.streamer.nama}</span>
                <span className="text-xs px-2 py-0.5 bg-slate-800 border border-slate-700 text-indigo-400 rounded-full font-semibold inline-block mt-1">
                  {evaluation.streamer.platform}
                </span>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">
                📈 Target vs. Realisasi Mingguan
              </h3>
              <div className="overflow-hidden border border-slate-800 rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-xs font-semibold text-slate-400 border-b border-slate-800">
                      <th className="py-2.5 px-4">Kategori Metric</th>
                      <th className="py-2.5 px-4 text-center">Target</th>
                      <th className="py-2.5 px-4 text-center">Realisasi</th>
                      <th className="py-2.5 px-4 text-right">Pencapaian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-sm text-slate-300">
                    <tr className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-4 flex items-center gap-2">
                        <Clock size={15} className="text-slate-400" />
                        Durasi Live
                      </td>
                      <td className="py-2.5 px-4 text-center">{evaluation.targets.liveDuration} Jam</td>
                      <td className="py-2.5 px-4 text-center">{evaluation.stats.liveDuration} Jam</td>
                      <td className="py-2.5 px-4 text-right flex items-center justify-end gap-1.5 font-semibold">
                        {getAchievementIcon(evaluation.stats.liveAchievement)}
                        <span className={getAchievementColor(evaluation.stats.liveAchievement)}>
                          {evaluation.stats.liveAchievement}%
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-4 flex items-center gap-2">
                        <Activity size={15} className="text-slate-400" />
                        Upload Konten
                      </td>
                      <td className="py-2.5 px-4 text-center">{evaluation.targets.uploads} Video</td>
                      <td className="py-2.5 px-4 text-center">{evaluation.stats.uploads} Video</td>
                      <td className="py-2.5 px-4 text-right flex items-center justify-end gap-1.5 font-semibold">
                        {getAchievementIcon(evaluation.stats.uploadAchievement)}
                        <span className={getAchievementColor(evaluation.stats.uploadAchievement)}>
                          {evaluation.stats.uploadAchievement}%
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-4 flex items-center gap-2">
                        <Users size={15} className="text-slate-400" />
                        Registrasi User
                      </td>
                      <td className="py-2.5 px-4 text-center">{evaluation.targets.registrations} User</td>
                      <td className="py-2.5 px-4 text-center">{evaluation.stats.registrations} User</td>
                      <td className="py-2.5 px-4 text-right flex items-center justify-end gap-1.5 font-semibold">
                        {getAchievementIcon(evaluation.stats.regAchievement)}
                        <span className={getAchievementColor(evaluation.stats.regAchievement)}>
                          {evaluation.stats.regAchievement}%
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-4 flex items-center gap-2">
                        <Sparkles size={15} className="text-slate-400" />
                        FTD (New Depositors)
                      </td>
                      <td className="py-2.5 px-4 text-center">{evaluation.targets.ftds} FTD</td>
                      <td className="py-2.5 px-4 text-center">{evaluation.stats.ftds} FTD</td>
                      <td className="py-2.5 px-4 text-right flex items-center justify-end gap-1.5 font-semibold">
                        {getAchievementIcon(evaluation.stats.ftdAchievement)}
                        <span className={getAchievementColor(evaluation.stats.ftdAchievement)}>
                          {evaluation.stats.ftdAchievement}%
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Daily Minimum Target Violation Warning Banner */}
            {evaluation.stats.daysBelowMinLive > 0 && (
              <div className="mb-6 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg p-3 text-xs flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-500 shrink-0" />
                <span>
                  <strong>Peringatan HO:</strong> Terdeteksi <strong>{evaluation.stats.daysBelowMinLive} hari</strong> di mana streamer melakukan live di bawah batas minimal 4 jam per hari.
                </span>
              </div>
            )}


            {/* Performance Conversion Analytics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Reg Rate</span>
                <span className="block text-lg font-bold text-white mt-0.5">{evaluation.stats.regRate}%</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">FTD Conv. Rate</span>
                <span className="block text-lg font-bold text-white mt-0.5">{evaluation.stats.ftdConversionRate}%</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Jadwal Adherence</span>
                <span className="block text-lg font-bold text-white mt-0.5">{evaluation.stats.adherence}%</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Peak Hour</span>
                <span className="block text-sm font-bold text-indigo-400 mt-1">{evaluation.peakHour}</span>
              </div>
            </div>

            {/* HO Action Plan & Qualitative Assessments (Editable) */}
            <div className="space-y-4 border-t border-slate-800 pt-6">
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                📝 Evaluasi Kualitatif & Action Plan (Dapat Diedit Sebelum Cetak)
              </h3>
              
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold">KELEBIHAN:</label>
                <textarea
                  value={editingFeedback.kelebihan}
                  onChange={(e) => setEditingFeedback({ ...editingFeedback, kelebihan: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Sebutkan kelebihan performa streamer..."
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold">KEKURANGAN:</label>
                <textarea
                  value={editingFeedback.kekurangan}
                  onChange={(e) => setEditingFeedback({ ...editingFeedback, kekurangan: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Sebutkan area yang perlu diperbaiki..."
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold">REKOMENDASI TINDAKAN (ACTION PLAN):</label>
                <textarea
                  value={editingFeedback.rekomendasi}
                  onChange={(e) => setEditingFeedback({ ...editingFeedback, rekomendasi: e.target.value })}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Sebutkan 3 instruksi taktis konkret..."
                />
              </div>
            </div>

            {/* Signature Block (Printed only) */}
            <div className="mt-12 flex justify-between items-end border-t border-slate-800/40 pt-8 text-xs text-slate-400">
              <div>
                <p>Dicetak secara otomatis oleh</p>
                <p className="font-bold text-slate-300 mt-1">Casper Signal Admin System</p>
              </div>
              <div className="text-center w-36 border-t border-slate-700 pt-1">
                <p>Head Office Signature</p>
              </div>
            </div>

          </div>

        </div>
      )}
      </>
      )}

      {/* History Tab Panel */}
      {activeTab === 'history' && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 no-print">
          <h3 className="text-sm font-bold text-white mb-4">Rapor Tersimpan</h3>
          {historyList.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">Belum ada rapor mingguan yang disimpan untuk streamer ini.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {historyList.map((h) => {
                const startStr = h.start_date ? h.start_date.split('T')[0] : '';
                const endStr = h.end_date ? h.end_date.split('T')[0] : '';
                const streamerObj = streamers.find(s => s.id === h.streamer_id) || { nama: 'Streamer', platform: '-' };
                return (
                  <div key={h.id} className="border border-slate-800 rounded-xl p-4 bg-slate-950/40 hover:border-slate-700 transition">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="block text-xs font-semibold text-indigo-400">PERIODE EVALUASI</span>
                        <span className="text-sm font-bold text-slate-100">{startStr} s/d {endStr}</span>
                      </div>
                      <span className="text-[10px] bg-slate-800 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                        Tersimpan
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 line-clamp-2 my-3">
                      <strong>Kelebihan:</strong> {h.kelebihan}
                    </div>
                    <button
                      onClick={() => {
                        setEvaluation({
                          streamer: streamerObj,
                          period: { start: startStr, end: endStr },
                          stats: h.stats,
                          targets: h.targets,
                          peakHour: h.peak_hour,
                          isArchived: true
                        });
                        setEditingFeedback({
                          kelebihan: h.kelebihan,
                          kekurangan: h.kekurangan,
                          rekomendasi: h.rekomendasi
                        });
                        setActiveTab('generate');
                      }}
                      className="text-xs bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 px-3 py-1.5 rounded-lg transition font-semibold"
                    >
                      Buka & Cetak Rapor ↗
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Evaluations;
