import React from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  Trophy, 
  Users, 
  LogOut, 
  Shield, 
  Sparkles,
  Menu,
  X,
  Target,
  TrendingUp,
  Video,
  Calendar,
  Upload,
  FileText,
  Bell
} from 'lucide-react';

const Layout = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = React.useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
      setUnreadCount(res.data.filter(n => !n.is_read).length);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  React.useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/all/read');
      fetchNotifications();
    } catch (err) {
      console.error('Error marking all notifications read:', err);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      fetchNotifications();
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Performance', path: '/performance', icon: TrendingUp },
    { name: 'Daily Reports', path: '/reports', icon: FileSpreadsheet },
    { name: 'Leaderboard', path: '/leaderboard', icon: Trophy },
    { name: 'Target Tracking', path: '/targets', icon: Target },
    { name: 'Content Library', path: '/contents', icon: Video },
    { name: 'Schedules', path: '/schedules', icon: Calendar },
    { name: 'Import Laporan', path: '/import', icon: Upload },
    { name: 'Rapor Mingguan', path: '/evaluations', icon: FileText },
    { name: 'Streamers', path: '/streamers', icon: Users },
  ];

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Analytics Dashboard';
      case '/reports': return 'Daily Recaps Ledger';
      case '/leaderboard': return 'Streamer Leaderboard';
      case '/evaluations': return 'Weekly Evaluations';
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
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-dark-bg text-gray-200">
      
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-dark-card border-r-3 border-black relative z-30">
        {/* Brand Logo */}
        <div className="flex h-20 items-center gap-3 px-6 border-b-2 border-black bg-dark-panel">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 border-2 border-black shadow-tactile-sm">
            <Sparkles className="h-5.5 w-5.5 text-white" />
          </div>
          <div>
            <span className="text-base font-extrabold text-white tracking-wider uppercase block">
              CASPER SIGNAL
            </span>
            <span className="block text-[9px] text-indigo-400 font-extrabold tracking-widest uppercase">
              Global Analytics
            </span>
          </div>
        </div>

        {/* Sidebar Menu */}
        <nav className="flex-1 space-y-2 px-4 py-6 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            
            // Check access control
            if (item.adminOnly && !isAdmin) return null;

            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-lg font-bold text-sm transition-all duration-150 border-2 group relative ${
                  isActive 
                    ? 'bg-dark-panel text-indigo-400 border-black shadow-inset-screen' 
                    : 'text-slate-400 border-transparent hover:bg-slate-900/50 hover:text-white hover:border-black hover:shadow-tactile-sm hover:-translate-y-0.5'
                }`}
              >
                {isActive && (
                  <span className="absolute left-1.5 w-1 h-4 rounded bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                )}
                <item.icon className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-indigo-400' : 'text-gray-400 group-hover:text-white'}`} />
                <span>{item.name}</span>
                {item.adminOnly && (
                  <span className="ml-auto text-[8px] font-extrabold px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-500 uppercase tracking-wide">
                    Admin
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Info & Logout Footer */}
        <div className="p-4 border-t-2 border-black bg-dark-panel">
          <div className="flex items-center gap-3 mb-3.5 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-950 border-2 border-black text-indigo-400 font-bold shadow-tactile-sm">
              {user?.nama?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden">
              <span className="block text-sm font-bold text-white truncate">{user?.nama}</span>
              <span className="flex items-center gap-1 text-[9px] font-extrabold text-indigo-400 uppercase tracking-wider">
                <Shield className="h-3 w-3" />
                {user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-3 px-4 py-2.5 rounded-lg text-sm font-bold text-red-400 bg-red-950/15 border-2 border-black shadow-tactile-sm hover:bg-red-500 hover:text-black hover:-translate-y-0.5 hover:shadow-tactile-md active:translate-y-0.5 active:shadow-tactile-pressed transition-all duration-100"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Header and Sidebar Menu */}
      <div className="md:hidden flex flex-col w-full z-20">
        {/* Mobile top bar */}
        <header className="flex h-16 items-center justify-between px-6 bg-dark-card border-b-3 border-black shadow-tactile-sm relative z-20">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 border-2 border-black shadow-tactile-sm">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-base font-extrabold text-white tracking-wide uppercase">CASPER SIGNAL</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg text-gray-200 hover:text-black hover:bg-tactile-yellow border-2 border-black shadow-tactile-sm active:translate-y-0.5 active:shadow-tactile-pressed transition-all"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </header>

        {/* Mobile Menu Backdrop & Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 flex">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/75 backdrop-blur-xs" 
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* Drawer Content */}
            <div className="relative flex flex-col w-64 bg-dark-card border-r-3 border-black h-full p-4 animate-fade-in shadow-2xl z-50">
              <div className="flex h-14 items-center gap-2.5 px-2 mb-6 border-b-2 border-black">
                <Sparkles className="h-5 w-5 text-indigo-400" />
                <span className="text-base font-bold text-white">Global Menu</span>
              </div>
              <nav className="flex-1 space-y-2 overflow-y-auto">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  if (item.adminOnly && !isAdmin) return null;
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3.5 px-4 py-3 rounded-lg font-bold text-sm transition-all border-2 ${
                        isActive 
                          ? 'bg-dark-panel text-indigo-300 border-black shadow-inset-screen' 
                          : 'text-slate-400 border-transparent hover:bg-slate-900/50 hover:text-white hover:border-black hover:shadow-tactile-sm'
                      }`}
                    >
                      <item.icon className="h-5 w-5 text-gray-400" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="pt-4 border-t-2 border-black">
                <div className="flex items-center gap-3 mb-4 px-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-950 border-2 border-black text-indigo-400 font-bold text-sm">
                    {user?.nama?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-white truncate">{user?.nama}</span>
                    <span className="block text-[9px] text-gray-400 uppercase tracking-widest">{user?.role}</span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-3 px-4 py-2 rounded-lg text-sm font-bold text-red-400 bg-red-950/15 border-2 border-black shadow-tactile-sm hover:bg-red-500 hover:text-black transition-all"
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
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Top Header - Desktop only */}
        <header className="hidden md:flex h-20 items-center justify-between px-8 bg-dark-card border-b-3 border-black shadow-tactile-sm relative z-20">
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-wide uppercase">{getPageTitle()}</h1>
            <p className="text-xs text-indigo-400 font-bold tracking-wide">{currentDate}</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="relative p-2.5 text-slate-200 hover:text-black bg-slate-800 hover:bg-tactile-yellow border-2 border-black rounded-lg shadow-tactile-sm active:translate-y-0.5 active:shadow-tactile-pressed transition-all flex items-center justify-center"
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5.5 w-5.5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-extrabold text-white leading-none border-2 border-black">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifDropdown(false)} />
                  <div className="absolute right-0 mt-3 w-80 bg-dark-panel border-2 border-black rounded-xl shadow-tactile-lg p-4 z-50 animate-fade-in text-left">
                    <div className="flex justify-between items-center border-b-2 border-slate-800 pb-2.5 mb-2.5">
                      <strong className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <span>🔔</span> Alarm & Peringatan
                      </strong>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold"
                        >
                          Tandai semua dibaca
                        </button>
                      )}
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {notifications.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-4">Tidak ada alarm/notifikasi.</p>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => {
                              handleMarkRead(n.id);
                              setShowNotifDropdown(false);
                            }}
                            className={`p-2.5 rounded-lg border-2 transition-all cursor-pointer text-xs ${
                              n.is_read
                                ? 'bg-slate-900/45 border-slate-850 text-slate-400'
                                : 'bg-indigo-950/40 border-black text-slate-200 hover:-translate-y-0.5 hover:shadow-tactile-sm'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-1">
                              <span className="line-clamp-2 leading-relaxed font-medium">{n.message}</span>
                              {!n.is_read && (
                                <span className="h-2 w-2 rounded-full bg-rose-500 border border-black shrink-0 mt-1" />
                              )}
                            </div>
                            <span className="block text-[9px] text-slate-500 mt-1.5 font-bold">
                              {new Date(n.created_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Role pill badge */}
            <div className={`tactile-sticker font-extrabold ${
              isAdmin ? 'tactile-sticker-orange text-white' : 'tactile-sticker-cyan text-black'
            }`}>
              <div className={`h-1.5 w-1.5 rounded-full border border-black ${isAdmin ? 'bg-amber-300 animate-pulse' : 'bg-indigo-300 animate-pulse'}`} />
              <span>{user?.role}</span>
            </div>
            
            {/* Simple profile card */}
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg border-2 border-black bg-dark-panel shadow-tactile-sm">
              <span className="text-sm font-bold text-slate-300">Welcome, <strong className="text-tactile-yellow font-extrabold">{user?.nama.split(' ')[0]}</strong></span>
            </div>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-dark-bg noise-overlay tactile-grid-lines">
          <Outlet />
        </main>
      </div>

    </div>
  );
};

export default Layout;

