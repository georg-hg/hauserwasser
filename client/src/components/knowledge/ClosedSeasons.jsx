import { useState, useEffect } from 'react';
import { api } from '../../api/client';

export default function ClosedSeasons() {
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/seasons')
      .then(setSeasons)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 md:py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Schonzeiten & Mindestmasse</h1>
      <p className="text-sm text-gray-500 mb-4">
        Gem. Fischereierlaubnis Hauserwasser 2026 (mit Sondermassen)
      </p>

      {/* Tabelle Desktop */}
      <div className="hidden md:block card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left p-3 font-semibold text-gray-700">Fischart</th>
              <th className="text-center p-3 font-semibold text-gray-700">Mindestmass</th>
              <th className="text-center p-3 font-semibold text-gray-700">Schonzeit</th>
              <th className="text-center p-3 font-semibold text-gray-700">Status</th>
              <th className="text-center p-3 font-semibold text-gray-700">Limit</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map((s) => (
              <tr key={s.id} className="border-b border-gray-100 last:border-0">
                <td className="p-3">
                  <span className="font-medium">{s.german_name}</span>
                </td>
                <td className="p-3 text-center">
                  {s.min_size_cm ? `${s.min_size_cm} cm` : '-'}
                </td>
                <td className="p-3 text-center text-gray-600">
                  {s.year_round
                    ? 'Ganzjaehrig'
                    : `${formatDate(s.season_start)} - ${formatDate(s.season_end)}`}
                </td>
                <td className="p-3 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    s.isCurrentlyClosed
                      ? 'bg-red-100 text-red-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {s.statusText}
                  </span>
                </td>
                <td className="p-3 text-center text-xs text-gray-500">
                  {formatLimit(s)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Karten Mobile */}
      <div className="md:hidden space-y-2">
        {seasons.map((s) => (
          <div key={s.id} className={`card p-3 border-l-4 ${
            s.isCurrentlyClosed ? 'border-l-red-400' : 'border-l-green-400'
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">{s.german_name}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                s.isCurrentlyClosed
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {s.statusText}
              </span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-x-4 text-xs text-gray-600">
              <span>Mindestmass: {s.min_size_cm ? `${s.min_size_cm} cm` : '-'}</span>
              <span>
                {s.year_round
                  ? 'Ganzjaehrig geschont'
                  : `${formatDate(s.season_start)} - ${formatDate(s.season_end)}`}
              </span>
            </div>
            {s.notes && <p className="mt-1 text-xs text-gray-400">{s.notes}</p>}
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
        <p className="text-sm text-red-700 font-medium">
          Huchen ist ganzjaehrig geschont und darf nicht entnommen werden!
        </p>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Quelle: Fischereierlaubnis Hauserwasser 2026. Es gelten die Schonzeiten gem.
        OOe Lizenzbuch mit Ausnahme Forelle & Saibling (Sondermass 26 cm).
        Weitere Infos: lfvooe.at
      </p>
    </div>
  );
}

function formatDate(mmdd) {
  if (!mmdd) return '';
  const [m, d] = mmdd.split('-');
  return `${d}.${m}.`;
}

function formatLimit(s) {
  const parts = [];
  if (s.max_per_day) parts.push(`${s.max_per_day}/Tag`);
  if (s.max_per_year) parts.push(`${s.max_per_year}/Jahr`);
  return parts.join(', ') || 'unbegr.';
}
