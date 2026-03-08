import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { getSpeciesGerman } from '../../utils/fishSpecies';

export default function AdminCatchView({ fisher, onBack, onExport, exporting }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const season = new Date().getFullYear();

  useEffect(() => {
    api.get(`/api/admin/fishers/${fisher.id}/catches?season=${season}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [fisher.id, season]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  const catches = data?.catches || [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Fangbuch: {fisher.lastName} {fisher.firstName}
            </h1>
            <p className="text-gray-500 text-sm">
              {fisher.email} &middot; Saison {season} &middot; {catches.length} Fänge
            </p>
          </div>
        </div>

        <button
          onClick={onExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg
                     hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {exporting ? 'Exportiere...' : 'Excel Export'}
        </button>
      </div>

      {/* Catch List */}
      {catches.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
          Keine Fänge in dieser Saison.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Datum</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fischart</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Länge</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Gewicht</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Technik</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Entnommen</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Foto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {catches.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">
                      {new Date(c.catch_date).toLocaleDateString('de-AT')}
                      {c.catch_time && (
                        <span className="text-gray-400 ml-1 text-xs">{c.catch_time.slice(0,5)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {c.german_name || getSpeciesGerman(c.fish_species)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {c.length_cm ? `${c.length_cm} cm` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {c.weight_kg ? `${c.weight_kg} kg` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">
                      {c.technique || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.kept ? (
                        <span className="text-green-600 font-medium">Ja</span>
                      ) : (
                        <span className="text-gray-400">Nein</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.photo_url ? (
                        <img src={c.photo_url} alt="" className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
