import { useState, useEffect } from 'react';
import { api } from '../../api/client';

// Farben für Besatzempfehlung
const BESATZ_COLORS = {
  hoch: 'bg-green-100 text-green-800 border-green-300',
  mittel: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  niedrig: 'bg-orange-100 text-orange-800 border-orange-300',
  nein: 'bg-red-100 text-red-800 border-red-300',
};

const VORKOMMEN_BADGE = {
  'natürlich': 'bg-emerald-50 text-emerald-700',
  'Besatz': 'bg-blue-50 text-blue-700',
  'selten': 'bg-amber-50 text-amber-700',
};

export default function Revier() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadAnalysis(forceRefresh = false) {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const url = forceRefresh ? '/api/revier/analyse?refresh=true' : '/api/revier/analyse';
      const result = await api.get(url);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadAnalysis();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
          <p className="text-gray-500 text-sm">Revier-Analyse wird erstellt...</p>
          <p className="text-gray-400 text-xs">Dies kann bis zu 30 Sekunden dauern.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <svg className="w-10 h-10 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-red-700 font-medium mb-2">Analyse fehlgeschlagen</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={() => loadAnalysis(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  const { analysis, analyzedAt, cached } = data;
  const { gewaesser_info, fischarten_inventar, strategische_empfehlungen, oekologischer_zustand_prognose } = analysis;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.893 13.393l-1.135-1.135a2.252 2.252 0 01-.421-.585l-1.08-2.16a.414.414 0 00-.663-.107.827.827 0 01-.812.21l-1.273-.363a.89.89 0 00-.738 1.595l.587.39c.59.395.674 1.23.172 1.732l-.2.2c-.212.212-.33.498-.33.796v.41c0 .409-.11.809-.32 1.158l-1.315 2.191a2.11 2.11 0 01-1.81 1.025 1.055 1.055 0 01-1.055-1.055v-1.172c0-.92-.56-1.747-1.414-2.089l-.655-.261a2.25 2.25 0 01-1.383-2.46l.007-.042a2.25 2.25 0 01.29-.787l.09-.15a2.25 2.25 0 012.37-1.048l1.178.236a1.125 1.125 0 001.302-.795l.208-.73a1.125 1.125 0 00-.578-1.315l-.665-.332-.091.091a2.25 2.25 0 01-1.591.659h-.18c-.249 0-.487.1-.662.274a.931.931 0 01-1.458-1.137l1.411-2.353a2.25 2.25 0 00.286-.76M11.25 2.25c5.385 0 9.75 4.365 9.75 9.75s-4.365 9.75-9.75 9.75S1.5 17.385 1.5 12 5.865 2.25 11.25 2.25z" />
            </svg>
            Revier-Analyse
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            KI-gestützte Analyse für nachhaltiges Besatzmanagement
          </p>
        </div>
        <button
          onClick={() => loadAnalysis(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
          {refreshing ? 'Wird aktualisiert...' : 'Aktualisieren'}
        </button>
      </div>

      {/* Zeitstempel */}
      {analyzedAt && (
        <p className="text-xs text-gray-400">
          Analyse vom {new Date(analyzedAt).toLocaleString('de-AT')}
          {cached && ' (gecacht)'}
        </p>
      )}

      {/* Gewässer-Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          {gewaesser_info.name}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-50 rounded-lg p-3">
            <span className="text-gray-500 text-xs uppercase tracking-wide">Region</span>
            <p className="font-medium text-gray-800 mt-0.5">{gewaesser_info.region}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <span className="text-gray-500 text-xs uppercase tracking-wide">Fischregion</span>
            <p className="font-medium text-gray-800 mt-0.5">{gewaesser_info.fischregion_typ}</p>
          </div>
        </div>
        {gewaesser_info.charakteristik && (
          <p className="text-sm text-gray-600 mt-3 leading-relaxed">{gewaesser_info.charakteristik}</p>
        )}

        {/* Karte Embed */}
        <div className="mt-4 rounded-lg overflow-hidden border border-gray-200">
          <iframe
            title="Reviergebiet Krems"
            width="100%"
            height="250"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps/embed/v1/directions?key=${import.meta.env.VITE_GOOGLE_MAPS_KEY || ''}&origin=48.117156,14.210667&destination=48.130520,14.225703&mode=walking&zoom=14`}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Oberkante (Piberbach/Kematen) bis Unterkante (Neuhofen a.d. Krems)
        </p>
      </div>

      {/* Fischarten-Inventar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
            Fischarten-Inventar
            <span className="text-sm font-normal text-gray-400 ml-1">({fischarten_inventar.length} Arten)</span>
          </h2>
        </div>

        <div className="divide-y divide-gray-100">
          {fischarten_inventar.map((art, i) => (
            <div key={i} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-800">{art.name}</h3>
                    <span className="text-xs italic text-gray-400">{art.wissenschaftlicher_name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${VORKOMMEN_BADGE[art.vorkommen] || 'bg-gray-100 text-gray-600'}`}>
                      {art.vorkommen}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${BESATZ_COLORS[art.besatz_empfehlung] || 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                      Besatz: {art.besatz_empfehlung}
                    </span>
                  </div>
                  {art.management_hinweis && (
                    <p className="text-sm text-gray-500 mt-2 leading-relaxed">{art.management_hinweis}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strategische Empfehlungen */}
      {strategische_empfehlungen && strategische_empfehlungen.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
            </svg>
            Strategische Empfehlungen
          </h2>
          <div className="space-y-3">
            {strategische_empfehlungen.map((emp, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-gray-700 leading-relaxed">{emp}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ökologischer Zustand */}
      {oekologischer_zustand_prognose && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
            Ökologische Zustandsprognose
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">{oekologischer_zustand_prognose}</p>
        </div>
      )}

      {/* Footer */}
      <p className="text-xs text-gray-400 text-center pb-4">
        Analyse erstellt mit Gemini AI. Dient als Entscheidungshilfe und ersetzt keine limnologischen Gutachten.
      </p>
    </div>
  );
}
