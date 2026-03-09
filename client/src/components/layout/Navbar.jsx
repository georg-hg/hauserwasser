import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

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
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-white/20 text-white'
                    : item.path === '/admin'
                      ? 'text-amber-300 hover:text-amber-200 hover:bg-white/10'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* User */}
          <div className="flex items-center gap-3">
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
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors group"
              title="Abmelden"
            >
              <svg className="w-5 h-5 text-white/50 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              <span className="hidden sm:inline">Abmelden</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
