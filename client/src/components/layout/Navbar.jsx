import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard' },
  { path: '/fang/neu', label: 'Neuer Fang' },
  { path: '/fangbuch', label: 'Fangbuch' },
  { path: '/erkennung', label: 'Fisch-ID' },
  { path: '/schonzeiten', label: 'Schonzeiten' },
  { path: '/regeln', label: 'Regeln' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <nav className="bg-primary-700 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <svg className="w-7 h-7" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="30" fill="currentColor" opacity="0.2" />
              <path d="M16 36c4-8 12-14 20-10s8 12 4 18c-2-4-6-6-10-6s-10 2-14-2z"
                    fill="currentColor" opacity="0.6" />
            </svg>
            <span className="hidden sm:inline">Hauserwasser</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-white/20 text-white'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* User */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-white/80">
              {user?.firstName}
            </span>
            <button
              onClick={logout}
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Abmelden
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
