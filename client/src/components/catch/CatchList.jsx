import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { TECHNIQUES } from '../../utils/fishSpecies';

export default function CatchList() {
  const [fishingDays, setFishingDays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/fishing-days')
      .then(data => setFishingDays(data.fishingDays))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getTechnique = (key) => TECHNIQUES.find(t => t.key === key)?.label || '';

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 md:py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Fangbuch</h1>
        <Link to="/fischtag/neu" className="btn-primary text-sm">+ Fischtag</Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : fishingDays.length === 0 ? (
        <div className="text-center py-12 card">
          <p className="text-gray-500">Noch keine Fischtage eingetragen.</p>
          <Link to="/fischtag/neu" className="inline-block mt-3 btn-primary text-sm">
            Ersten Fischtag anlegen
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {fishingDays.map((day) => {
            const dateStr = new Date(day.fishing_date).toLocaleDateString('de-AT', {
              weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
            });
            const technique = getTechnique(day.technique);
            const catchCount = parseInt(day.catch_count) || 0;
            const keptCount = parseInt(day.kept_count) || 0;

            return (
              <Link
                key={day.id}
                to={`/fischtag/${day.id}`}
                className="card flex items-center gap-3 hover:bg-gray-50 transition-colors"
              >
                {/* Datum-Badge */}
                <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-primary-50 border border-primary-200 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-primary-700 leading-none">
                    {new Date(day.fishing_date).getDate()}
                  </span>
                  <span className="text-[10px] text-primary-500 uppercase">
                    {new Date(day.fishing_date).toLocaleDateString('de-AT', { month: 'short' })}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800">{dateStr}</p>
                  <p className="text-xs text-gray-500">
                    {catchCount === 0 ? 'Kein Fang' : `${catchCount} Fang${catchCount > 1 ? '/Fänge' : ''}`}
                    {keptCount > 0 && ` · ${keptCount} entnommen`}
                    {technique && ` · ${technique}`}
                  </p>
                  {day.notes && (
                    <p className="text-xs text-gray-400 truncate">{day.notes}</p>
                  )}
                </div>

                {/* Status */}
                <div className="flex-shrink-0">
                  {day.completed ? (
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
