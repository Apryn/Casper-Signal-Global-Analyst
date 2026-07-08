import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Sparkles, AlertCircle } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
    if (!username.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError('');
    setSubmitting(true);

    const result = await login(username, password);
    setSubmitting(false);

    if (!result.success) {
      setError(result.error);
    } else {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="relative flex h-screen w-screen items-center justify-center bg-dark-bg overflow-hidden p-4">
      
      {/* Background Glow effects */}
      <div className="absolute top-1/4 left-1/4 h-[35rem] w-[35rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[120px] animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-[30rem] w-[30rem] translate-x-1/2 translate-y-1/2 rounded-full bg-cyan-500/10 blur-[100px] animate-pulse-slow pointer-events-none" />

      {/* Login Card */}
      <div className="relative w-full max-w-md p-8 rounded-2xl border border-dark-border bg-slate-950/65 shadow-2xl shadow-black/80 backdrop-blur-md">
        
        {/* Logo and Brand Title */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 shadow-lg shadow-indigo-600/30">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-wider text-white bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
            CASPER ANALYTICS
          </h2>
          <p className="text-xs font-semibold text-indigo-400 tracking-widest uppercase mt-1">
            Dashboard Portal
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 p-3.5 mb-6 text-sm rounded-xl bg-red-500/10 text-red-400 border border-red-500/25 animate-shake">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2" htmlFor="username">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                <User className="h-4.5 w-4.5" />
              </div>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="block w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-dark-border bg-slate-900/60 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                <Lock className="h-4.5 w-4.5" />
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="block w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-dark-border bg-slate-900/60 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-3 rounded-xl font-semibold bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 text-white shadow-lg shadow-indigo-600/20 active:translate-y-px transition-all duration-200 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {submitting ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Demo Accounts Quick-Fill Guide */}
        <div className="mt-8 pt-6 border-t border-dark-border text-center">
          <p className="text-xs text-gray-400">
            For evaluation, use the default seeded credentials:
          </p>
          <div className="mt-3 flex flex-wrap gap-2.5 justify-center">
            <button
              onClick={() => {
                setUsername('admin');
                setPassword('password123');
              }}
              className="px-3 py-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20 text-[11px] font-semibold text-indigo-300 transition-colors"
            >
              Fill Admin
            </button>
            <button
              onClick={() => {
                setUsername('analyst');
                setPassword('password123');
              }}
              className="px-3 py-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 hover:bg-cyan-500/20 text-[11px] font-semibold text-cyan-300 transition-colors"
            >
              Fill Analyst
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
