import React from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  Trophy, 
  Users, 
  LogOut, 
  Shield, 
  Sparkles,
  Menu,
  X
} from 'lucide-react';

const Layout = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Daily Reports', path: '/reports', icon: FileSpreadsheet },
    { name: 'Leaderboard', path: '/leaderboard', icon: Trophy },
    { name: 'Streamers', path: '/streamers', icon: Users },
  ];

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Analytics Dashboard';
      case '/reports': return 'Daily Recaps Ledger';
      case '/leaderboard': return 'Streamer Leaderboard';
      case '/streamers': return 'Streamer Management';
      default: return 'Casper Analytics';
    }
  };

  // Get current date formatted nicely
  const currentDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex h-screen overflow-hidden bg-dark-bg text-gray-200">
      
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-slate-950/70 border-r border-dark-border backdrop-blur-md">
        {/* Brand Logo */}
        <div className="flex h-20 items-center gap-3 px-6 border-b border-dark-border">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 shadow-md shadow-indigo-600/30">
            <Sparkles className="h-5.5 w-5.5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold text-white tracking-wider bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
              CASPER SIGNAL
            </span>
            <span className="block text-[10px] text-indigo-400 font-semibold tracking-widest uppercase">
              Global Analytics
            </span>
          </div>
        </div>

        {/* Sidebar Menu */}
        <nav className="flex-1 space-y-1.5 px-4 py-6 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            
            // Check access control
            if (item.adminOnly && !isAdmin) return null;

            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl font-medium text-sm transition-all duration-200 group ${
                  isActive 
                    ? 'bg-gradient-to-r from-indigo-600/20 to-indigo-900/10 text-indigo-300 border-l-4 border-indigo-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] shadow-indigo-500/5' 
                    : 'text-gray-400 hover:bg-slate-900/50 hover:text-white hover:translate-x-1'
                }`}
              >
                <item.icon className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-indigo-400' : 'text-gray-400 group-hover:text-white'}`} />
                <span>{item.name}</span>
                {item.adminOnly && (
                  <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    Admin
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Info & Logout Footer */}
        <div className="p-4 border-t border-dark-border bg-slate-950/40">
          <div className="flex items-center gap-3 mb-3.5 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-950/80 border border-indigo-500/20 text-indigo-400 font-semibold">
              {user?.nama?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden">
              <span className="block text-sm font-semibold text-white truncate">{user?.nama}</span>
              <span className="flex items-center gap-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                <Shield className="h-3 w-3 text-indigo-400" />
                {user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400/90 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Header and Sidebar Menu */}
      <div className="md:hidden flex flex-col w-full h-screen overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-16 items-center justify-between px-6 bg-slate-950 border-b border-dark-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-cyan-500">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-base font-bold text-white tracking-wide">CASPER SIGNAL</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-slate-900 border border-dark-border"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </header>

        {/* Mobile Menu Backdrop & Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 flex">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-xs" 
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* Drawer Content */}
            <div className="relative flex flex-col w-64 bg-slate-950 border-r border-dark-border h-full p-4 animate-fade-in shadow-2xl z-50">
              <div className="flex h-14 items-center gap-2.5 px-2 mb-6 border-b border-dark-border">
                <Sparkles className="h-5 w-5 text-indigo-400" />
                <span className="text-base font-bold text-white">Global Menu</span>
              </div>
              <nav className="flex-1 space-y-1.5">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  if (item.adminOnly && !isAdmin) return null;
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition-colors ${
                        isActive ? 'bg-indigo-600/20 text-indigo-300 border-l-4 border-indigo-500' : 'text-gray-400 hover:bg-slate-900'
                      }`}
                    >
                      <item.icon className="h-5 w-5 text-gray-400" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="pt-4 border-t border-dark-border">
                <div className="flex items-center gap-3 mb-4 px-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-950 text-indigo-400 font-semibold text-sm">
                    {user?.nama?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-white truncate">{user?.nama}</span>
                    <span className="block text-[9px] text-gray-400 uppercase tracking-widest">{user?.role}</span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-2 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area - Desktop & Mobile */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header - Desktop only */}
        <header className="hidden md:flex h-20 items-center justify-between px-8 bg-slate-950/20 border-b border-dark-border/40 backdrop-blur-xs">
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">{getPageTitle()}</h1>
            <p className="text-xs text-indigo-400 font-medium tracking-wide">{currentDate}</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Role pill badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide border ${
              isAdmin 
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]' 
                : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.1)]'
            }`}>
              <div className={`h-1.5 w-1.5 rounded-full ${isAdmin ? 'bg-amber-400 animate-pulse' : 'bg-indigo-400 animate-pulse'}`} />
              <span>{user?.role}</span>
            </div>
            
            {/* Simple profile card */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-dark-border/50 bg-slate-950/30">
              <span className="text-sm font-medium text-slate-300">Welcome, <strong className="text-white font-semibold">{user?.nama.split(' ')[0]}</strong></span>
            </div>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-gradient-to-b from-dark-bg via-[#0c0e17] to-dark-bg">
          <Outlet />
        </main>
      </div>

    </div>
  );
};

export default Layout;
