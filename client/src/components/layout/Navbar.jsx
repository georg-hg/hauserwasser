import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';

const FISHER_ITEMS = [
  { path: '/', label: 'Dashboard' },
  { path: '/fang/neu', label: 'Neuer Fang' },
  { path: '/fangbuch', label: 'Fangbuch' },
  { path: '/erkennung', label: 'Fisch-ID' },
  { path: '/schonzeiten', label: 'Schonzeiten' },
  { path: '/regeln', label: 'Regeln' },
];

const ADMIN_ITEMS = [
  { path: '/admin', label: 'Admin' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const navItems = isAdmin ? [...FISHER_ITEMS, ...ADMIN_ITEMS] : FISHER_ITEMS;
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnread = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const data = await api.get('/api/admin/notifications/unread-count');
      setUnreadCount(data.count);
    } catch {}
  }, [isAdmin]);

  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, [loadUnread]);

  return (
    <nav className="bg-primary-700 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <img src="/icons/icon-96x96.png" alt="Hauserwasser" className="w-8 h-8 rounded-full" />
            <span className="hidden sm:inline">Hauserwasser</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-white/20 text-white'
                    : item.path === '/admin'
                      ? 'text-amber-300 hover:text-amber-200 hover:bg-white/10'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                {item.label}
                {item.path === '/admin' && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-red-500 text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* User & Schnellzugriff */}
          <div className="flex items-center gap-2">
            <Link
              to="/profil"
              className="hidden sm:flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors group"
              title="Profil bearbeiten"
            >
              <svg className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {user?.firstName}
            </Link>

            <div className="w-px h-5 bg-white/20 hidden sm:block" />

            {/* Fischereiordnung */}
            <Link
              to="/regeln"
              className={`p-1.5 rounded-lg transition-colors ${
                location.pathname === '/regeln'
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
              title="Fischereiordnung"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </Link>

            {/* Schonzeiten */}
            <Link
              to="/schonzeiten"
              className={`p-1.5 rounded-lg transition-colors ${
                location.pathname === '/schonzeiten'
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
              title="Schonzeiten"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
              </svg>
            </Link>

            <div className="w-px h-5 bg-white/20" />

            {/* Logout */}
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Abmelden"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
