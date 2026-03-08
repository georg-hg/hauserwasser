import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import AdminFisherList from './AdminFisherList';
import AdminCatchView from './AdminCatchView';

export default function AdminDashboard() {
  const [fishers, setFishers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFisher, setSelectedFisher] = useState(null);
  const [exporting, setExporting] = useState(false);
  const currentYear = new Date().getFullYear();

  const loadFishers = async () => {
    try {
      const data = await api.get('/api/admin/fishers');
      setFishers(data);
    } catch (err) {
      console.error('Fehler:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFishers(); }, []);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin-Bereich</h1>
          <p className="text-gray-500 text-sm mt-1">
            Saison {currentYear} &middot; {fishers.length} registrierte Fischer
          </p>
        </div>
        <button
          onClick={() => handleExport()}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg
                     hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {exporting ? 'Exportiere...' : 'Alle Fangbücher exportieren (Excel)'}
        </button>
      </div>

      <AdminFisherList
        fishers={fishers}
        onToggleLicense={toggleLicense}
        onSelectFisher={setSelectedFisher}
        onExportFisher={(fisher) => handleExport(fisher.id)}
        currentYear={currentYear}
      />
    </div>
  );
}
