import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
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

// ── Besatz-Daten (statisch) ──
const BESATZ_PLAN = {
  datum: '10.04.2026',
  status: 'geplant',
  fische: [
    { art: 'Regenbogenforelle', menge_kg: 120 },
    { art: 'Bachforelle', menge_kg: 30 },
  ],
  stellen: [
    { label: 'Stelle 1', lat: 48.1255, lng: 14.2125, beschreibung: 'Naehe Jagingerbach-Muendung' },
    { label: 'Stelle 2', lat: 48.1230, lng: 14.2165, beschreibung: 'Suedlich B139 Bruecke' },
    { label: 'Stelle 3', lat: 48.1225, lng: 14.2195, beschreibung: 'Flussmitte Hoehe Mueller' },
    { label: 'Stelle 4', lat: 48.1245, lng: 14.2210, beschreibung: 'Noerdlich Krems-Bogen' },
    { label: 'Stelle 5', lat: 48.1270, lng: 14.2195, beschreibung: 'Hoehe Mietgaragen' },
    { label: 'Stelle 6', lat: 48.1280, lng: 14.2165, beschreibung: 'Oberer Abschnitt Nord' },
  ],
};

function BesatzSection() {
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const gesamtKg = BESATZ_PLAN.fische.reduce((sum, f) => sum + f.menge_kg, 0);

  // Static Map via Backend-Proxy (nutzt serverseitigen GOOGLE_MAPS_API_KEY)
  const API_URL = import.meta.env.VITE_API_URL
    ? `https://${import.meta.env.VITE_API_URL}`
    : '';
  const markersParams = BESATZ_PLAN.stellen
    .map((s, i) => `markers=${encodeURIComponent(`color:red|label:${i + 1}|${s.lat},${s.lng}`)}`)
    .join('&');
  const staticMapUrl = `${API_URL}/api/revier/static-map?size=600x400&maptype=satellite&${markersParams}`;
  const staticMapUrlHD = `${API_URL}/api/revier/static-map?size=1280x1024&scale=2&maptype=satellite&${markersParams}`;

  // Google Maps Embed mit allen Stellen als Wegpunkte
  const daysUntil = Math.ceil((new Date('2026-04-10') - new Date()) / (1000 * 60 * 60 * 24));
  const isPast = daysUntil < 0;

  return (
    <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-5 border-b border-blue-100">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            Besatz
          </h2>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            isPast
              ? 'bg-green-100 text-green-700 border border-green-200'
              : 'bg-blue-100 text-blue-700 border border-blue-200'
          }`}>
            {isPast ? 'durchgefuehrt' : `in ${daysUntil} Tagen`}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Termin & Menge */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-500 uppercase tracking-wide">Termin</p>
            <p className="text-lg font-bold text-blue-800 mt-0.5">{BESATZ_PLAN.datum}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-500 uppercase tracking-wide">Gesamt</p>
            <p className="text-lg font-bold text-blue-800 mt-0.5">{gesamtKg} kg</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center col-span-2 sm:col-span-1">
            <p className="text-xs text-blue-500 uppercase tracking-wide">Stellen</p>
            <p className="text-lg font-bold text-blue-800 mt-0.5">{BESATZ_PLAN.stellen.length}</p>
          </div>
        </div>

        {/* Fischarten */}
        <div className="space-y-2">
          {BESATZ_PLAN.fische.map((f, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
              <span className="font-medium text-gray-800 text-sm">{f.art}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${(f.menge_kg / gesamtKg) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-gray-700 w-16 text-right">{f.menge_kg} kg</span>
              </div>
            </div>
          ))}
        </div>

        {/* Besatzstellen-Karte */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Besatzstellen</p>
          <div className="relative rounded-lg overflow-hidden border border-gray-200 group cursor-pointer"
               onClick={() => setMapFullscreen(true)}>
            <img
              src={staticMapUrl}
              alt="Besatzstellen Krems"
              className="w-full h-auto"
              loading="lazy"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            {/* Vollbild-Button */}
            <button
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Vollbild"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            </button>
          </div>

          {/* Stellen-Liste */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {BESATZ_PLAN.stellen.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="flex-shrink-0 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                  {i + 1}
                </span>
                <span className="text-gray-700">{s.beschreibung}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Vollbild-Overlay */}
        {mapFullscreen && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex flex-col"
            onClick={() => setMapFullscreen(false)}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/50">
              <h3 className="text-white font-medium text-sm">Besatzstellen Krems</h3>
              <button
                onClick={() => setMapFullscreen(false)}
                className="text-white/80 hover:text-white p-1"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Karte (HD) */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-auto"
                 onClick={e => e.stopPropagation()}>
              <img
                src={staticMapUrlHD}
                alt="Besatzstellen Krems (Vollbild)"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>

            {/* Stellen-Legende */}
            <div className="px-4 py-3 bg-black/50 flex flex-wrap gap-3 justify-center">
              {BESATZ_PLAN.stellen.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-white/90">
                  <span className="flex-shrink-0 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-bold">
                    {i + 1}
                  </span>
                  {s.beschreibung}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ManualAnalysisForm({ onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    name: 'Krems (OÖ)',
    region: 'Oberösterreich',
    fischregion: 'Hyporhithral',
    charakteristik: '',
    fischarten: 'Bachforelle;Salmo trutta fario;natürlich;hoch;Leitfischart\nRegenbogenforelle;Oncorhynchus mykiss;Besatz;mittel;Besatzfisch\nÄsche;Thymallus thymallus;natürlich;mittel;Bestandsaufbau\nBachsaibling;Salvelinus fontinalis;Besatz;niedrig;Zurückhaltend besetzen',
    empfehlungen: '',
    prognose: '',
  });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border-b border-blue-100">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
          Manuelle Revier-Analyse
        </h2>
        <p className="text-sm text-gray-500 mt-1">Daten direkt eingeben statt KI-Analyse</p>
      </div>

      <div className="p-5 space-y-4">
        {/* Gewässer-Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Gewässer</label>
            <input
              type="text" value={form.name} onChange={e => set('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Region</label>
            <input
              type="text" value={form.region} onChange={e => set('region', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fischregion</label>
            <input
              type="text" value={form.fischregion} onChange={e => set('fischregion', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Charakteristik</label>
          <textarea
            value={form.charakteristik} onChange={e => set('charakteristik', e.target.value)}
            rows={2} placeholder="Beschreibung des Gewässerabschnitts..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          />
        </div>

        {/* Fischarten */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Fischarten <span className="text-gray-400 font-normal">(eine pro Zeile: Name;Wiss. Name;Vorkommen;Besatz;Hinweis)</span>
          </label>
          <textarea
            value={form.fischarten} onChange={e => set('fischarten', e.target.value)}
            rows={6} placeholder="Bachforelle;Salmo trutta fario;natürlich;hoch;Leitfischart"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          />
          <p className="text-xs text-gray-400 mt-1">Vorkommen: natürlich/Besatz/selten — Besatz: hoch/mittel/niedrig/nein</p>
        </div>

        {/* Empfehlungen */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Strategische Empfehlungen <span className="text-gray-400 font-normal">(eine pro Zeile)</span>
          </label>
          <textarea
            value={form.empfehlungen} onChange={e => set('empfehlungen', e.target.value)}
            rows={3} placeholder="Regelmäßiger Besatz mit standortgerechten Bachforellen..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          />
        </div>

        {/* Prognose */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Ökologische Zustandsprognose</label>
          <textarea
            value={form.prognose} onChange={e => set('prognose', e.target.value)}
            rows={2} placeholder="Einschätzung des ökologischen Zustands..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.fischarten.trim()}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Speichere...' : 'Analyse speichern'}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Revier() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('besatz');
  const [showManual, setShowManual] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);

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

  async function saveManualAnalysis(formData) {
    try {
      setManualSaving(true);
      // Fischarten aus Textarea parsen (eine pro Zeile: Name, Wiss. Name, Vorkommen, Besatz, Hinweis)
      const fischarten = formData.fischarten
        .split('\n')
        .filter(l => l.trim())
        .map(line => {
          const [name, wissenschaftlicher_name, vorkommen, besatz_empfehlung, management_hinweis] =
            line.split(';').map(s => s.trim());
          return {
            name: name || '',
            wissenschaftlicher_name: wissenschaftlicher_name || '',
            vorkommen: vorkommen || 'natürlich',
            besatz_empfehlung: besatz_empfehlung || 'mittel',
            management_hinweis: management_hinweis || '',
          };
        });

      const empfehlungen = formData.empfehlungen
        .split('\n')
        .filter(l => l.trim());

      const analysis = {
        gewaesser_info: {
          name: formData.name || 'Krems (OÖ)',
          region: formData.region || 'Oberösterreich',
          fischregion_typ: formData.fischregion || 'Hyporhithral',
          charakteristik: formData.charakteristik || '',
        },
        fischarten_inventar: fischarten,
        strategische_empfehlungen: empfehlungen,
        oekologischer_zustand_prognose: formData.prognose || '',
      };

      const result = await api.post('/api/revier/analyse', { analysis });
      setData(result);
      setError(null);
      setShowManual(false);
    } catch (err) {
      setError('Speichern fehlgeschlagen: ' + err.message);
    } finally {
      setManualSaving(false);
    }
  }

  // Analyse nur laden wenn Tab gewechselt wird
  useEffect(() => {
    if (activeTab === 'analyse' && !data && !loading) {
      loadAnalysis();
    }
  }, [activeTab]);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.893 13.393l-1.135-1.135a2.252 2.252 0 01-.421-.585l-1.08-2.16a.414.414 0 00-.663-.107.827.827 0 01-.812.21l-1.273-.363a.89.89 0 00-.738 1.595l.587.39c.59.395.674 1.23.172 1.732l-.2.2c-.212.212-.33.498-.33.796v.41c0 .409-.11.809-.32 1.158l-1.315 2.191a2.11 2.11 0 01-1.81 1.025 1.055 1.055 0 01-1.055-1.055v-1.172c0-.92-.56-1.747-1.414-2.089l-.655-.261a2.25 2.25 0 01-1.383-2.46l.007-.042a2.25 2.25 0 01.29-.787l.09-.15a2.25 2.25 0 012.37-1.048l1.178.236a1.125 1.125 0 001.302-.795l.208-.73a1.125 1.125 0 00-.578-1.315l-.665-.332-.091.091a2.25 2.25 0 01-1.591.659h-.18c-.249 0-.487.1-.662.274a.931.931 0 01-1.458-1.137l1.411-2.353a2.25 2.25 0 00.286-.76M11.25 2.25c5.385 0 9.75 4.365 9.75 9.75s-4.365 9.75-9.75 9.75S1.5 17.385 1.5 12 5.865 2.25 11.25 2.25z" />
            </svg>
            Revier
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Besatzmanagement & KI-Analyse
          </p>
        </div>
      </div>

      {/* Tabs: Besatz / Analyse */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('besatz')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'besatz'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          Besatz
        </button>
        <button
          onClick={() => { setActiveTab('analyse'); if (!data && !error) loadAnalysis(); }}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'analyse'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
          </svg>
          KI-Analyse
        </button>
      </div>

      {/* Besatz-Tab */}
      {activeTab === 'besatz' && <BesatzSection />}

      {/* Analyse-Tab */}
      {activeTab === 'analyse' && loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
          <p className="text-gray-500 text-sm">Revier-Analyse wird erstellt...</p>
          <p className="text-gray-400 text-xs">Dies kann bis zu 30 Sekunden dauern.</p>
        </div>
      )}

      {activeTab === 'analyse' && error && !showManual && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <svg className="w-10 h-10 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-red-700 font-medium mb-2">Analyse fehlgeschlagen</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => loadAnalysis(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
            >
              Erneut versuchen
            </button>
            <button
              onClick={() => setShowManual(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              Manuell eingeben
            </button>
          </div>
        </div>
      )}

      {activeTab === 'analyse' && showManual && (
        <ManualAnalysisForm
          onSave={saveManualAnalysis}
          onCancel={() => setShowManual(false)}
          saving={manualSaving}
        />
      )}

      {activeTab === 'analyse' && data && (() => {
        const { analysis, analyzedAt, cached } = data;
        const { gewaesser_info, fischarten_inventar, strategische_empfehlungen, oekologischer_zustand_prognose } = analysis;
        return (
          <div className="space-y-6">
            {/* Aktualisieren-Button + Zeitstempel */}
            <div className="flex items-center justify-between">
              {analyzedAt && (
                <p className="text-xs text-gray-400">
                  Analyse vom {new Date(analyzedAt).toLocaleString('de-AT')}
                  {cached && ' (gecacht)'}
                </p>
              )}
              <button
                onClick={() => loadAnalysis(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50"
              >
                <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                {refreshing ? 'Aktualisiere...' : 'Aktualisieren'}
              </button>
            </div>

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
      })()}
    </div>
  );
}
