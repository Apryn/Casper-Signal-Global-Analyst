import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Sparkles, AlertCircle, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [activationCode, setActivationCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (user) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activationCode.trim()) {
      setError('Masukkan kode aktivasi terlebih dahulu.');
      return;
    }

    setError('');
    setSubmitting(true);

    const result = await login(activationCode.trim());
    setSubmitting(false);

    if (!result.success) {
      setError(result.error);
    } else {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="relative flex h-screen w-screen items-center justify-center bg-dark-bg noise-overlay tactile-grid-lines overflow-hidden p-4">

      {/* Background Glow effects */}
      <div className="absolute top-1/4 left-1/4 h-[35rem] w-[35rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/5 blur-[120px] animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-[30rem] w-[30rem] translate-x-1/2 translate-y-1/2 rounded-full bg-cyan-500/5 blur-[100px] animate-pulse-slow pointer-events-none" />

      {/* Login Card */}
      <div className="relative w-full max-w-sm p-8 rounded-xl border-3 border-black bg-dark-card shadow-tactile-lg z-10">

        {/* Logo and Brand Title */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-indigo-600 border-2 border-black shadow-tactile-sm">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-wide text-white uppercase">
            CASPER ANALYTICS
          </h2>
          <span className="tactile-sticker font-extrabold tactile-sticker-orange text-white mt-2">
            Dashboard Portal
          </span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 p-3.5 mb-6 text-sm rounded-lg bg-red-950/20 text-red-400 border-2 border-red-800 shadow-tactile-sm animate-shake">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="font-bold">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2" htmlFor="activationCode">
              Kode Aktivasi
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                <KeyRound className="h-4 w-4" />
              </div>
              <input
                id="activationCode"
                type={showCode ? 'text' : 'password'}
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value)}
                placeholder="Masukkan kode aktivasi"
                autoComplete="off"
                className="block w-full pl-10 pr-10 py-3 text-sm rounded-lg border-2 border-black bg-slate-950 text-white placeholder-slate-650 focus:outline-none focus:border-indigo-500 shadow-inset-screen transition-all"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowCode((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-200 transition-colors"
              >
                {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-3 rounded-lg font-black uppercase text-sm bg-indigo-600 text-white border-2 border-black shadow-tactile-sm hover:bg-indigo-500 hover:shadow-tactile-md active:translate-y-0.5 active:shadow-tactile-pressed transition-all duration-100 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              'Masuk'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-[10px] font-bold text-slate-500 tracking-wider">
          Casper Signal Global Analyst © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default Login;
