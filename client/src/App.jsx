import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import Navbar from './components/layout/Navbar';
import MobileNav from './components/layout/MobileNav';
import Dashboard from './components/dashboard/Dashboard';
import CatchForm from './components/catch/CatchForm';
import CatchList from './components/catch/CatchList';
import FishingDayForm from './components/catch/FishingDayForm';
import FishingDayDetail from './components/catch/FishingDayDetail';
import ImageUpload from './components/fish-id/ImageUpload';
import Regulations from './components/knowledge/Regulations';
import ClosedSeasons from './components/knowledge/ClosedSeasons';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import AdminDashboard from './components/admin/AdminDashboard';
import Renaturierung from './components/renaturierung/Renaturierung';
import Revier from './components/revier/Revier';
import Profile from './components/profile/Profile';
import InstallPrompt from './components/pwa/InstallPrompt';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (!['admin', 'kontrolleur'].includes(user.role)) return <Navigate to="/" />;
  return children;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <ScrollToTop />
      {user && <Navbar />}

      <main className={user ? 'pb-20 md:pb-6' : ''}>
        <Routes>
          {/* Auth */}
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />

          {/* App — Fischer ohne Karte → Profil */}
          <Route path="/" element={
            <ProtectedRoute>
              {user && !['admin', 'kontrolleur'].includes(user.role) && !user.fisherCardUrl
                ? <Navigate to="/profil" />
                : <Dashboard />}
            </ProtectedRoute>
          } />
          <Route path="/fischtag/neu" element={<ProtectedRoute><FishingDayForm /></ProtectedRoute>} />
          <Route path="/fischtag/:id" element={<ProtectedRoute><FishingDayDetail /></ProtectedRoute>} />
          <Route path="/fang/neu" element={<ProtectedRoute><CatchForm /></ProtectedRoute>} />
          <Route path="/fangbuch" element={<ProtectedRoute><CatchList /></ProtectedRoute>} />
          <Route path="/erkennung" element={<ProtectedRoute><ImageUpload /></ProtectedRoute>} />
          <Route path="/regeln" element={<ProtectedRoute><Regulations /></ProtectedRoute>} />
          <Route path="/schonzeiten" element={<ProtectedRoute><ClosedSeasons /></ProtectedRoute>} />
          <Route path="/profil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/renaturierung" element={<ProtectedRoute><Renaturierung /></ProtectedRoute>} />

          {/* Admin + Kontrolleur */}
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          {/* Nur Admin */}
          <Route path="/revier" element={
            <ProtectedRoute>
              {user?.role === 'admin' ? <Revier /> : <Navigate to="/" />}
            </ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      {user && <MobileNav />}
      {user && <InstallPrompt />}
    </div>
  );
}
