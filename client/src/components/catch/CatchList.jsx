import { useCatches } from '../../hooks/useCatches';
import { getSpeciesGerman } from '../../utils/fishSpecies';
import { Link } from 'react-router-dom';

export default function CatchList() {
  const { catches, loading, deleteCatch } = useCatches();

  const handleDelete = async (id, name) => {
    if (window.confirm(`Fang "${name}" wirklich loeschen?`)) {
      await deleteCatch(id);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 md:py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Fangbuch</h1>
        <Link to="/fang/neu" className="btn-primary text-sm">+ Neuer Fang</Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : catches.length === 0 ? (
        <div className="text-center py-12 card">
          <p className="text-gray-500">Noch keine Faenge eingetragen.</p>
          <Link to="/fang/neu" className="inline-block mt-3 btn-primary text-sm">
            Ersten Fang eintragen
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {catches.map((c) => (
            <div key={c.id} className="card flex items-center gap-3">
              {c.photo_url ? (
                <img src={c.photo_url} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-800">
                  {c.german_name || getSpeciesGerman(c.fish_species)}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(c.catch_date).toLocaleDateString('de-AT')}
                  {c.length_cm && ` · ${c.length_cm} cm`}
                  {c.weight_kg && ` · ${c.weight_kg} kg`}
                </p>
                <p className="text-xs text-gray-400">
                  {c.technique && `${c.technique} · `}
                  {c.kept ? 'entnommen' : 'zurueckgesetzt'}
                </p>
              </div>
              <button
                onClick={() => handleDelete(c.id, c.german_name || c.fish_species)}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                title="Loeschen"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
