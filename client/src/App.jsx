import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Navbar from './components/layout/Navbar';
import MobileNav from './components/layout/MobileNav';
import Dashboard from './components/dashboard/Dashboard';
import CatchForm from './components/catch/CatchForm';
import CatchList from './components/catch/CatchList';
import ImageUpload from './components/fish-id/ImageUpload';
import Regulations from './components/knowledge/Regulations';
import ClosedSeasons from './components/knowledge/ClosedSeasons';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import AdminDashboard from './components/admin/AdminDashboard';
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
  if (user.role !== 'admin') return <Navigate to="/" />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {user && <Navbar />}

      <main className={user ? 'pb-20 md:pb-6' : ''}>
        <Routes>
          {/* Auth */}
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />

          {/* App */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/fang/neu" element={<ProtectedRoute><CatchForm /></ProtectedRoute>} />
          <Route path="/fangbuch" element={<ProtectedRoute><CatchList /></ProtectedRoute>} />
          <Route path="/erkennung" element={<ProtectedRoute><ImageUpload /></ProtectedRoute>} />
          <Route path="/regeln" element={<ProtectedRoute><Regulations /></ProtectedRoute>} />
          <Route path="/schonzeiten" element={<ProtectedRoute><ClosedSeasons /></ProtectedRoute>} />
          <Route path="/profil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      {user && <MobileNav />}
      {user && <InstallPrompt />}
    </div>
  );
}
