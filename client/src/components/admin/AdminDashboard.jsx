import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';
import AdminFisherList from './AdminFisherList';
import AdminCatchView from './AdminCatchView';
import AdminInbox from './AdminInbox';
import AdminStats from './AdminStats';
import AmWasser from './AmWasser';

const TAB_DEFS = {
  statistik: { id: 'statistik', label: 'Statistik', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z', roles: ['admin', 'kontrolleur'] },
  amwasser: { id: 'amwasser', label: 'Am Wasser', icon: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z', roles: ['admin', 'kontrolleur'] },
  fischkarten: { id: 'fischkarten', label: 'Fischkarten', icon: 'M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z', roles: ['admin'] },
  inbox: { id: 'inbox', label: 'Inbox', icon: 'M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z', roles: ['admin'] },
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const userRole = user?.role || 'fischer';
  const isAdmin = userRole === 'admin';
  const isKontrolleur = user?.isKontrolleur || false;

  // Tabs basierend auf Rolle filtern
  const effectiveRoles = [userRole, ...(isKontrolleur ? ['kontrolleur'] : [])];
  const tabs = Object.values(TAB_DEFS).filter(t => t.roles.some(r => effectiveRoles.includes(r)));

  const [activeTab, setActiveTab] = useState(tabs[0]?.id || 'statistik');
  const [fishers, setFishers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFisher, setSelectedFisher] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const currentYear = new Date().getFullYear();

  const loadFishers = async () => {
    if (!isAdmin) { setLoading(false); return; }
    try {
      const data = await api.get('/api/admin/fishers');
      setFishers(data);
    } catch (err) {
      console.error('Fehler:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const data = await api.get('/api/admin/notifications/unread-count');
      setUnreadCount(data.count);
    } catch (err) {
      console.error('Unread count error:', err);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadFishers();
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  const toggleLicense = async (fisherId, hasLicense) => {
    try {
      if (hasLicense) {
        await api.delete(`/api/admin/fishers/${fisherId}/license?year=${currentYear}`);
      } else {
        await api.post(`/api/admin/fishers/${fisherId}/license`, { year: currentYear });
      }
      loadFishers();
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleBlock = async (fisherId, isBlocked) => {
    try {
      if (isBlocked) {
        await api.put(`/api/admin/fishers/${fisherId}/unblock`);
      } else {
        const reason = prompt('Sperrgrund (optional):');
        await api.put(`/api/admin/fishers/${fisherId}/block`, { reason });
      }
      loadFishers();
    } catch (err) {
      alert(err.message);
    }
  };

  const deleteFisher = async (fisher) => {
    const confirmed = confirm(
      `Fischer "${fisher.lastName} ${fisher.firstName}" wirklich löschen?\n\n` +
      `Dabei werden auch alle Fänge (${fisher.catchCount}), Lizenzen und Benachrichtigungen gelöscht.\n\n` +
      `Diese Aktion kann nicht rückgängig gemacht werden!`
    );
    if (!confirmed) return;

    try {
      const result = await api.delete(`/api/admin/fishers/${fisher.id}`);
      alert(result.message || 'Fischer gelöscht.');
      loadFishers();
    } catch (err) {
      alert('Fehler: ' + err.message);
    }
  };

  const handleResetPassword = async (fisher) => {
    const newPw = prompt(
      `Neues Passwort für "${fisher.lastName} ${fisher.firstName}" eingeben (mind. 8 Zeichen):`
    );
    if (!newPw) return;
    if (newPw.length < 8) {
      alert('Passwort muss mindestens 8 Zeichen haben.');
      return;
    }
    try {
      const result = await api.put(`/api/admin/fishers/${fisher.id}/reset-password`, { newPassword: newPw });
      alert(result.message);
    } catch (err) {
      alert('Fehler: ' + err.message);
    }
  };

  const handleChangeEmail = async (fisher) => {
    const newEmail = prompt(
      `Neue E-Mail-Adresse für "${fisher.lastName} ${fisher.firstName}" eingeben:\n\nAktuell: ${fisher.email}`
    );
    if (!newEmail) return;
    if (!newEmail.includes('@')) {
      alert('Bitte eine gültige E-Mail-Adresse eingeben.');
      return;
    }
    try {
      const result = await api.put(`/api/admin/fishers/${fisher.id}/email`, { newEmail });
      alert(result.message);
      loadFishers();
    } catch (err) {
      alert('Fehler: ' + err.message);
    }
  };

  const handleToggleKontrolleur = async (fisher) => {
    const label = fisher.isKontrolleur ? 'Fischer' : 'Kontrolleur';
    const confirmed = confirm(
      `"${fisher.lastName} ${fisher.firstName}" zum ${label} machen?`
    );
    if (!confirmed) return;
    try {
      const result = await api.put(`/api/admin/fishers/${fisher.id}/kontrolleur`);
      alert(result.message);
      loadFishers();
    } catch (err) {
      alert('Fehler: ' + err.message);
    }
  };

  const handleExport = async (fisherId = null) => {
    setExporting(true);
    try {
      const url = fisherId
        ? `/api/admin/export/catches?season=${currentYear}&fisherId=${fisherId}`
        : `/api/admin/export/catches?season=${currentYear}`;

      const token = localStorage.getItem('hw_token');
      const API_URL = import.meta.env.VITE_API_URL
        ? `https://${import.meta.env.VITE_API_URL}`
        : '';

      const response = await fetch(`${API_URL}${url}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Export fehlgeschlagen');

      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Fangbuch_Hauserwasser_${currentYear}${fisherId ? '_Fischer' : ''}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      alert('Export fehlgeschlagen: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  // Wenn ein Fischer ausgewählt → Fangbuch-Ansicht
  if (selectedFisher) {
    return (
      <AdminCatchView
        fisher={selectedFisher}
        onBack={() => setSelectedFisher(null)}
        onExport={() => handleExport(selectedFisher.id)}
        exporting={exporting}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isAdmin ? 'Admin-Bereich' : isKontrolleur ? 'Kontrolleur' : 'Übersicht'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Saison {currentYear}
            {isAdmin && <> &middot; {fishers.length} registrierte Fischer</>}
          </p>
        </div>
        {activeTab === 'fischkarten' && isAdmin && (
          <button
            onClick={() => handleExport()}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg
                       hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {exporting ? 'Exportiere...' : 'Excel-Export'}
          </button>
        )}
      </div>

      {/* Tab-Navigation */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
            </svg>
            {tab.label}
            {tab.id === 'inbox' && unreadCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-red-500 text-white">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab-Content */}
      {activeTab === 'statistik' && (
        <AdminStats />
      )}

      {activeTab === 'amwasser' && (
        <AmWasser />
      )}

      {activeTab === 'fischkarten' && isAdmin && (
        <AdminFisherList
          fishers={fishers}
          onToggleLicense={toggleLicense}
          onToggleBlock={toggleBlock}
          onDeleteFisher={deleteFisher}
          onSelectFisher={setSelectedFisher}
          onExportFisher={(fisher) => handleExport(fisher.id)}
          onResetPassword={handleResetPassword}
          onChangeEmail={handleChangeEmail}
          onToggleKontrolleur={handleToggleKontrolleur}
          currentYear={currentYear}
        />
      )}

      {activeTab === 'inbox' && isAdmin && (
        <AdminInbox onUnreadChange={setUnreadCount} />
      )}
    </div>
  );
}
