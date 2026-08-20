import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileText,
  Calendar,
  User,
  Clock,
  AlertCircle,
  CheckCircle2,
  Send,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  RefreshCw,
  Zap,
  Check
} from 'lucide-react';

const CATEGORIES = [
  {
    id: 'Kendala Akun',
    label: 'Kendala Akun / Teknis',
    desc: 'Akun kena limit, banned sementara, device error, mati lampu, internet down',
    icon: '🔴',
    color: 'border-rose-500/50 bg-rose-950/20 text-rose-300',
    badge: 'bg-rose-500/20 text-rose-400'
  },
  {
    id: 'Kompensasi Jam',
    label: 'Kompensasi Ganti Jam',
    desc: 'Kurang jam live & bersedia mengganti durasi di hari berikutnya',
    icon: '🔄',
    color: 'border-cyan-500/50 bg-cyan-950/20 text-cyan-300',
    badge: 'bg-cyan-500/20 text-cyan-400'
  },
  {
    id: 'Sakit',
    label: 'Sakit / Medis',
    desc: 'Kondisi kesehatan tidak memungkinkan untuk live',
    icon: '🟡',
    color: 'border-amber-500/50 bg-amber-950/20 text-amber-300',
    badge: 'bg-amber-500/20 text-amber-400'
  },
  {
    id: 'Izin Khusus',
    label: 'Izin Khusus / Darurat',
    desc: 'Urusan keluarga mendesak atau keperluan penting yang telah di ACC',
    icon: '🔵',
    color: 'border-indigo-500/50 bg-indigo-950/20 text-indigo-300',
    badge: 'bg-indigo-500/20 text-indigo-400'
  }
];

const StreamerExcuseForm = () => {
  const [streamers, setStreamers] = useState([]);
  const [loadingStreamers, setLoadingStreamers] = useState(true);

  // Form State
  const [selectedStreamerId, setSelectedStreamerId] = useState('');
  const [tanggalIzin, setTanggalIzin] = useState(new Date().toISOString().split('T')[0]);
  const [kategori, setKategori] = useState('Kendala Akun');
  const [durasiKurang, setDurasiKurang] = useState(2);
  const [tanggalGanti, setTanggalGanti] = useState('');
  const [keterangan, setKeterangan] = useState('');

  // Submit State
  const [submitting, setSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch Streamers list
  useEffect(() => {
    const fetchStreamers = async () => {
      try {
        setLoadingStreamers(true);
        // Uses relative path or direct API base URL
        const apiUrl = import.meta.env.VITE_API_URL || '/api';
        const res = await axios.get(`${apiUrl}/excuses/public-streamers`);
        if (res.data && res.data.streamers) {
          setStreamers(res.data.streamers);
        }
      } catch (err) {
        console.error('Failed to load streamers:', err);
        setErrorMsg('Gagal memuat daftar nama streamer. Silakan refresh halaman.');
      } finally {
        setLoadingStreamers(false);
      }
    };
    fetchStreamers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStreamerId) {
      alert('Pilih nama streamer terlebih dahulu.');
      return;
    }
    if (!keterangan.trim()) {
      alert('Keterangan / penjelasan kendala wajib diisi.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      const res = await axios.post(`${apiUrl}/excuses/submit`, {
        streamerId: parseInt(selectedStreamerId, 10),
        tanggalIzin,
        kategori,
        durasiKurang: parseFloat(durasiKurang || 0),
        tanggalGanti: (kategori === 'Kompensasi Jam' || tanggalGanti) ? tanggalGanti : null,
        keterangan: keterangan.trim()
      });

      const streamerObj = streamers.find(s => String(s.id) === String(selectedStreamerId));
      setSubmittedData({
        ...res.data.request,
        streamerNama: streamerObj ? streamerObj.nama : 'Streamer'
      });
    } catch (err) {
      console.error('Submit error:', err);
      setErrorMsg(err.response?.data?.message || 'Terjadi kesalahan saat mengirim pengajuan. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedData(null);
    setKeterangan('');
    setTanggalGanti('');
    setDurasiKurang(2);
    setKategori('Kendala Akun');
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white font-sans py-8 px-4 sm:px-6 relative overflow-hidden">
      {/* Background Neon Grid Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-2xl w-full mx-auto relative z-10">
        {/* Top Header Card */}
        <div className="bg-[#0f1422] border-2 border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl mb-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-amber-400 to-cyan-400" />
          
          <div className="flex items-center gap-3 mb-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 shadow-inner">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <span className="text-[11px] font-mono font-extrabold uppercase tracking-widest text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-500/30">
                Casper Signal Internal Portal
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
                Form Pengajuan Izin & Kompensasi
              </h1>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Isi formulir ini jika Anda mengalami kendala akun, sakit, atau memerlukan dispensasi live.
            Pengajuan akan langsung masuk ke antrean persetujuan (ACC) Owner/Admin.
          </p>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2 text-[11px] text-amber-300/90 font-medium">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Kompensasi / Dispensasi hanya berlaku sah setelah disetujui (ACC) oleh Admin.</span>
          </div>
        </div>

        {/* SUBMITTED SUCCESS VIEW */}
        {submittedData ? (
          <div className="bg-[#0f1422] border-2 border-emerald-500/40 rounded-3xl p-8 shadow-2xl animate-fade-in text-center">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/50 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-tactile-sm animate-bounce">
              <Check className="h-8 w-8 stroke-[3]" />
            </div>

            <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30">
              Pengajuan Terkirim
            </span>

            <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-3">
              Permohonan Berhasil Dikirim! 🚀
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-md mx-auto">
              Laporan izin Anda telah tercatat di sistem dengan status <strong className="text-amber-300 font-mono">⏳ Menunggu ACC Admin</strong>.
            </p>

            {/* Ticket Summary Box */}
            <div className="bg-[#090d16] border border-slate-800 rounded-2xl p-5 my-6 text-left space-y-3 font-mono text-xs shadow-inner">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                <span className="text-slate-400">Nama Streamer:</span>
                <span className="font-bold text-white text-sm">{submittedData.streamerNama}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                <span className="text-slate-400">Tanggal Kendala:</span>
                <span className="font-bold text-indigo-300">{submittedData.tanggal_izin}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                <span className="text-slate-400">Kategori Izin:</span>
                <span className="font-bold text-amber-300">{submittedData.kategori}</span>
              </div>
              {submittedData.durasi_kurang > 0 && (
                <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                  <span className="text-slate-400">Durasi Kurang:</span>
                  <span className="font-bold text-rose-300">{submittedData.durasi_kurang} Jam</span>
                </div>
              )}
              {submittedData.tanggal_ganti && (
                <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                  <span className="text-slate-400">Rencana Ganti:</span>
                  <span className="font-bold text-cyan-300">{submittedData.tanggal_ganti}</span>
                </div>
              )}
              <div className="pt-1">
                <span className="text-slate-400 block mb-1">Keterangan:</span>
                <p className="text-slate-200 font-sans text-xs bg-[#0f1422] p-2.5 rounded-lg border border-slate-800">
                  {submittedData.keterangan}
                </p>
              </div>
            </div>

            <button
              onClick={handleResetForm}
              className="w-full py-3.5 px-6 rounded-2xl font-black text-sm text-black bg-amber-400 hover:bg-amber-300 border-2 border-black shadow-tactile-sm transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Kirim Pengajuan Izin Lain</span>
            </button>
          </div>
        ) : (
          /* FORM VIEW */
          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMsg && (
              <div className="bg-rose-950/50 border-2 border-rose-500/50 rounded-2xl p-4 flex items-center gap-3 text-xs sm:text-sm text-rose-300 font-medium animate-fade-in">
                <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Step 1: Pilih Nama Streamer */}
            <div className="bg-[#0f1422] border-2 border-slate-800 rounded-3xl p-6 shadow-xl hover:border-slate-700 transition-all">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-2">
                <User className="h-4 w-4 text-indigo-400" />
                <span>1. Pilih Nama Streamer <span className="text-rose-400">*</span></span>
              </label>

              {loadingStreamers ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-3">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Memuat daftar streamer...</span>
                </div>
              ) : (
                <select
                  required
                  value={selectedStreamerId}
                  onChange={(e) => setSelectedStreamerId(e.target.value)}
                  className="w-full bg-[#090d16] border-2 border-slate-800 rounded-xl px-4 py-3.5 text-sm font-bold text-white focus:border-indigo-500 focus:outline-none transition-all shadow-inner"
                >
                  <option value="">-- Pilih Nama Anda --</option>
                  {streamers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama} ({s.platform})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Step 2: Tanggal Kendala */}
            <div className="bg-[#0f1422] border-2 border-slate-800 rounded-3xl p-6 shadow-xl hover:border-slate-700 transition-all">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-400" />
                <span>2. Tanggal Izin / Kendala <span className="text-rose-400">*</span></span>
              </label>
              <input
                type="date"
                required
                value={tanggalIzin}
                onChange={(e) => setTanggalIzin(e.target.value)}
                className="w-full bg-[#090d16] border-2 border-slate-800 rounded-xl px-4 py-3.5 text-sm font-mono font-bold text-white focus:border-indigo-500 focus:outline-none transition-all shadow-inner"
              />
            </div>

            {/* Step 3: Kategori Izin */}
            <div className="bg-[#0f1422] border-2 border-slate-800 rounded-3xl p-6 shadow-xl hover:border-slate-700 transition-all">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-indigo-400" />
                <span>3. Jenis Kendala / Izin <span className="text-rose-400">*</span></span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CATEGORIES.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => setKategori(cat.id)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      kategori === cat.id
                        ? `${cat.color} ring-2 ring-indigo-500/50 shadow-lg scale-[1.01]`
                        : 'border-slate-800 bg-[#090d16]/60 text-slate-400 hover:border-slate-700 hover:bg-[#090d16]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xl">{cat.icon}</span>
                      <input
                        type="radio"
                        name="kategori"
                        checked={kategori === cat.id}
                        onChange={() => setKategori(cat.id)}
                        className="accent-indigo-500"
                      />
                    </div>
                    <div>
                      <div className="font-extrabold text-sm text-white mb-0.5">{cat.label}</div>
                      <div className="text-[11px] text-slate-400 leading-tight">{cat.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 4: Durasi Kurang & Tanggal Kompensasi (Ganti) */}
            <div className="bg-[#0f1422] border-2 border-slate-800 rounded-3xl p-6 shadow-xl hover:border-slate-700 transition-all space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-indigo-400" />
                  <span>4. Berapa Jam Live yang Kurang / Tidak Dijalankan?</span>
                </label>
                <div className="flex items-center gap-3">
                  {[1, 2, 3, 4].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setDurasiKurang(h)}
                      className={`flex-1 py-2.5 px-3 rounded-xl font-mono font-bold text-xs border-2 transition-all ${
                        Number(durasiKurang) === h
                          ? 'bg-indigo-600 border-indigo-400 text-white shadow-tactile-xs'
                          : 'bg-[#090d16] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      {h} Jam {h === 4 ? '(Full)' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rencana Tanggal Kompensasi */}
              <div className="pt-3 border-t border-slate-800/80">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-1 flex items-center gap-2">
                  <span className="text-cyan-400">🔄</span>
                  <span>Rencana Tanggal Kompensasi (Ganti Jam)</span>
                  <span className="text-[10px] text-slate-500 font-normal lowercase">(opsional jika belum pasti)</span>
                </label>
                <p className="text-[11px] text-slate-400 mb-2">
                  Pilih tanggal di mana kamu akan menambahkan jam live pengganti:
                </p>
                <input
                  type="date"
                  value={tanggalGanti}
                  onChange={(e) => setTanggalGanti(e.target.value)}
                  className="w-full bg-[#090d16] border-2 border-slate-800 rounded-xl px-4 py-3 text-xs font-mono font-bold text-cyan-300 focus:border-cyan-500 focus:outline-none transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Step 5: Keterangan / Kronologi */}
            <div className="bg-[#0f1422] border-2 border-slate-800 rounded-3xl p-6 shadow-xl hover:border-slate-700 transition-all">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-400" />
                <span>5. Keterangan / Kronologi Kendala <span className="text-rose-400">*</span></span>
              </label>
              <textarea
                required
                rows={3}
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Contoh: Sesi 2 tidak bisa live karena akun kena limit 24 jam. Bersedia kompensasi 2 jam di hari berikutnya..."
                className="w-full bg-[#090d16] border-2 border-slate-800 rounded-xl p-4 text-xs font-medium text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none transition-all shadow-inner leading-relaxed"
              />
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 px-6 rounded-2xl font-black text-sm text-black bg-amber-400 hover:bg-amber-300 border-2 border-black shadow-tactile-md hover:shadow-tactile-lg active:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Mengirim Pengajuan...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>KIRIM PENGAJUAN IZIN 🚀</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer info */}
        <div className="mt-8 text-center text-[11px] text-slate-500">
          <p>© {new Date().getFullYear()} Casper Signal Global Analyst • Sistem Kedisiplinan & Payroll Streamer</p>
        </div>
      </div>
    </div>
  );
};

export default StreamerExcuseForm;
