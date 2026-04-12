import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';

const BESATZ_COLORS = {
  hoch:    'bg-green-100 text-green-800 border-green-300',
  mittel:  'bg-yellow-100 text-yellow-800 border-yellow-300',
  niedrig: 'bg-orange-100 text-orange-800 border-orange-300',
  nein:    'bg-red-100 text-red-800 border-red-300',
};

const VORKOMMEN_BADGE = {
  'natürlich': 'bg-emerald-50 text-emerald-700',
  'Besatz':    'bg-blue-50 text-blue-700',
  'selten':    'bg-amber-50 text-amber-700',
};

const SPECIES_LABELS = {
  rainbow_trout: 'Regenbogenforelle',
  brown_trout:   'Bachforelle',
  carp:          'Karpfen',
  perch:         'Barsch',
  pike:          'Hecht',
  grayling:      'Äsche',
  char:          'Saibling',
  zander:        'Zander',
  chub:          'Aitel',
  barbel:        'Barbe',
};

function speciesLabel(key) {
  return SPECIES_LABELS[key] || key;
}

function fmtEur(val) {
  if (val == null) return '–';
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(val);
}

function fmtDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Besatz-Management (dynamisch, Admin-Only) ──────────────
function BesatzSection({ isAdmin }) {
  const [stockings, setStockings]   = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [season, setSeason]         = useState(new Date().getFullYear());
  const [showForm, setShowForm]     = useState(false);
  const [editItem, setEditItem]     = useState(null);
  const [saving, setSaving]         = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);

  // Besatzstellen (statisch – GPS-Koordinaten für die Krems)
  const STELLEN = [
    { label: '1', lat: 48.1255, lng: 14.2125, beschreibung: 'Nähe Jagingerbach-Mündung' },
    { label: '2', lat: 48.1230, lng: 14.2165, beschreibung: 'Südlich B139 Brücke' },
    { label: '3', lat: 48.1225, lng: 14.2195, beschreibung: 'Flussmitte Höhe Müller' },
    { label: '4', lat: 48.1245, lng: 14.2210, beschreibung: 'Nördlich Krems-Bogen' },
    { label: '5', lat: 48.1270, lng: 14.2195, beschreibung: 'Höhe Mietgaragen' },
    { label: '6', lat: 48.1280, lng: 14.2165, beschreibung: 'Oberer Abschnitt Nord' },
  ];

  const API_URL = import.meta.env.VITE_API_URL ? `https://${import.meta.env.VITE_API_URL}` : '';
  const markersParams = STELLEN
    .map(s => `markers=${encodeURIComponent(`color:red|label:${s.label}|${s.lat},${s.lng}`)}`)
    .join('&');
  const staticMapUrl   = `${API_URL}/api/revier/static-map?size=600x400&maptype=satellite&${markersParams}`;
  const staticMapUrlHD = `${API_URL}/api/revier/static-map?size=1280x1024&scale=2&maptype=satellite&${markersParams}`;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [s, st] = await Promise.all([
        api.get(`/api/stockings?season=${season}`),
        api.get(`/api/stockings/stats?season=${season}`),
      ]);
      setStockings(s.stockings || []);
      setStats(st);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [season]);

  useEffect(() => { load(); }, [load]);

  const actual  = stockings.filter(s => !s.is_planned);
  const planned = stockings.filter(s => s.is_planned);
  const totalKg  = actual.reduce((sum, s) => sum + parseFloat(s.quantity_kg || 0), 0);
  const totalEur = actual.reduce((sum, s) => sum + parseFloat(s.cost_eur || 0), 0);

  // Planungs-Kosten (nur wenn Preis bekannt)
  const plannedEur = planned.reduce((sum, s) => {
    if (s.price_per_kg_override && s.quantity_kg) return sum + s.price_per_kg_override * s.quantity_kg;
    if (s.cost_eur) return sum + parseFloat(s.cost_eur);
    return sum;
  }, 0);

  async function handleDelete(id) {
    if (!window.confirm('Eintrag löschen?')) return;
    try {
      await api.delete(`/api/stockings/${id}`);
      load();
    } catch (err) {
      alert('Fehler beim Löschen: ' + err.message);
    }
  }

  async function handleConfirm(item) {
    // Planung → Ist umwandeln
    try {
      await api.put(`/api/stockings/${item.id}`, {
        ...item,
        isPlanned: false,
        stockedAt: new Date().toISOString(),
      });
      load();
    } catch (err) {
      alert('Fehler: ' + err.message);
    }
  }

  // Nicht-Admin: nur Ist-Besätze (keine Kosten, kein Edit)
  if (!isAdmin) {
    return (
      <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-5 border-b border-blue-100">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <span>🐟</span> Besatz {season}
          </h2>
        </div>
        <div className="p-5 space-y-3">
          {loading && <p className="text-sm text-gray-400">Lade...</p>}
          {actual.map(s => (
            <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
              <div>
                <p className="font-medium text-sm text-gray-800">{speciesLabel(s.fish_species)}</p>
                <p className="text-xs text-gray-500">{fmtDate(s.stocked_at)} · {s.age_class || ''}</p>
              </div>
              <span className="font-bold text-blue-700">{s.quantity_kg ? `${s.quantity_kg} kg` : '–'}</span>
            </div>
          ))}
          {!loading && actual.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Kein Besatz für {season} eingetragen.</p>
          )}
        </div>
      </div>
    );
  }

  // Admin-Ansicht: vollständig
  return (
    <div className="space-y-5">

      {/* ── Saisonwahl + Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Saison</label>
          <select
            value={season}
            onChange={e => setSeason(parseInt(e.target.value))}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => { setEditItem(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Besatz eintragen
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
      )}

      {/* ── Kennzahlen ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Ist-Besatz', val: `${totalKg} kg`, color: 'blue' },
          { label: 'Ist-Kosten', val: fmtEur(totalEur || null), color: 'emerald' },
          { label: 'Besatzplanungen', val: planned.length, color: 'amber' },
          { label: 'Geplante Kosten', val: plannedEur > 0 ? fmtEur(plannedEur) : '–', color: 'orange' },
        ].map(k => (
          <div key={k.label} className={`bg-${k.color}-50 border border-${k.color}-100 rounded-xl p-3 text-center`}>
            <p className={`text-xs text-${k.color}-500 uppercase tracking-wide`}>{k.label}</p>
            <p className={`text-lg font-bold text-${k.color}-800 mt-0.5`}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* ── Ist-Besätze ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Ist-Besatz {season}
          </h3>
          <span className="text-xs text-gray-400">{actual.length} Einträge · {totalKg} kg · {fmtEur(totalEur || null)}</span>
        </div>

        {loading && <p className="p-5 text-sm text-gray-400">Lade...</p>}
        {!loading && actual.length === 0 && (
          <p className="p-5 text-sm text-gray-400 text-center">Kein Ist-Besatz für {season}.</p>
        )}

        <div className="divide-y divide-gray-100">
          {actual.map(s => {
            const priceKg = s.price_per_kg_override
              ? parseFloat(s.price_per_kg_override)
              : (s.cost_eur && s.quantity_kg ? parseFloat(s.cost_eur) / parseFloat(s.quantity_kg) : null);
            return (
              <div key={s.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800">{speciesLabel(s.fish_species)}</span>
                      {s.age_class && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">{s.age_class}</span>
                      )}
                      {s.source && (
                        <span className="text-xs text-gray-400">{s.source}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-sm">
                      <span className="text-gray-500">{fmtDate(s.stocked_at)}</span>
                      {s.quantity_kg && <span className="font-medium text-gray-700">{s.quantity_kg} kg</span>}
                      {s.quantity_count && <span className="text-gray-500">{s.quantity_count} Stk.</span>}
                      {s.cost_eur && <span className="font-medium text-emerald-700">{fmtEur(s.cost_eur)}</span>}
                      {priceKg && <span className="text-gray-400">{fmtEur(priceKg)}/kg</span>}
                    </div>
                    {s.notes && <p className="text-xs text-gray-400 mt-1">{s.notes}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => { setEditItem(s); setShowForm(true); }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Bearbeiten"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Löschen"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Besatzplanung ── */}
      <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-amber-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            Besatzplanung {season}
          </h3>
          <span className="text-xs text-gray-400">{planned.length} geplant</span>
        </div>

        {!loading && planned.length === 0 && (
          <p className="p-5 text-sm text-gray-400 text-center">Keine Planungseinträge für {season}.</p>
        )}

        <div className="divide-y divide-amber-50">
          {planned.map(s => {
            const priceKg = s.price_per_kg_override ? parseFloat(s.price_per_kg_override) : null;
            return (
              <div key={s.id} className="p-4 hover:bg-amber-50/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800">{speciesLabel(s.fish_species)}</span>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">geplant</span>
                      {s.age_class && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">{s.age_class}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-sm">
                      {s.planned_date
                        ? <span className="text-gray-500">geplant: {fmtDate(s.planned_date)}</span>
                        : <span className="text-gray-400 italic">Termin offen</span>}
                      {s.quantity_kg
                        ? <span className="font-medium text-gray-700">{s.quantity_kg} kg</span>
                        : <span className="text-gray-400 italic">Menge offen</span>}
                      {priceKg && <span className="font-medium text-amber-700">{fmtEur(priceKg)}/kg</span>}
                      {s.cost_eur && <span className="font-medium text-emerald-700">{fmtEur(s.cost_eur)}</span>}
                      {s.source && <span className="text-gray-400">{s.source}</span>}
                    </div>
                    {s.notes && <p className="text-xs text-gray-400 mt-1">{s.notes}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {/* Als durchgeführt markieren */}
                    <button
                      onClick={() => handleConfirm(s)}
                      className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Als durchgeführt markieren"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => { setEditItem(s); setShowForm(true); }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Bearbeiten"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Löschen"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Entnahme-Vergleich (aus Stats) ── */}
      {stats && stats.harvestComparison && stats.harvestComparison.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
              Entnahme-Vergleich {season}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Wieviel wurde eingesetzt vs. entnommen (kept=true)</p>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.harvestComparison.filter(h => h.keptCount > 0).map((h, i) => {
              const stockedKg = stats.actual?.bySpecies?.find(
                b => b.fishSpecies === h.fishSpecies
              )?.totalKg;
              return (
                <div key={i} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{h.germanName}</p>
                    {h.avgLengthKept && (
                      <p className="text-xs text-gray-400">Ø {h.avgLengthKept} cm (entnommen)</p>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-bold text-red-600">{h.keptCount} Stk. entnommen</p>
                    {stockedKg && (
                      <p className="text-xs text-gray-400">{stockedKg} kg eingesetzt</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Besatzstellen-Karte ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Besatzstellen Krems</h3>
        </div>
        <div className="p-4 space-y-3">
          <div
            className="relative rounded-lg overflow-hidden border border-gray-200 group cursor-pointer"
            onClick={() => setMapFullscreen(true)}
          >
            <img
              src={staticMapUrl}
              alt="Besatzstellen"
              className="w-full h-auto"
              loading="lazy"
              onError={e => { e.target.style.display = 'none'; }}
            />
            <button className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {STELLEN.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="flex-shrink-0 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                  {s.label}
                </span>
                <span className="text-gray-600">{s.beschreibung}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Vollbild-Karte ── */}
      {mapFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => setMapFullscreen(false)}>
          <div className="flex items-center justify-between px-4 py-3 bg-black/50">
            <h3 className="text-white font-medium text-sm">Besatzstellen Krems</h3>
            <button onClick={() => setMapFullscreen(false)} className="text-white/80 hover:text-white p-1">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto" onClick={e => e.stopPropagation()}>
            <img src={staticMapUrlHD} alt="Besatzstellen HD" className="max-w-full max-h-full object-contain rounded-lg" />
          </div>
          <div className="px-4 py-3 bg-black/50 flex flex-wrap gap-3 justify-center">
            {STELLEN.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-white/90">
                <span className="flex-shrink-0 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-bold">{s.label}</span>
                {s.beschreibung}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Formular (Neu / Bearbeiten) ── */}
      {showForm && (
        <StockingForm
          item={editItem}
          season={season}
          onSave={async (data) => {
            setSaving(true);
            try {
              if (editItem) {
                await api.put(`/api/stockings/${editItem.id}`, data);
              } else {
                await api.post('/api/stockings', data);
              }
              setShowForm(false);
              setEditItem(null);
              load();
            } catch (err) {
              alert('Fehler: ' + err.message);
            } finally {
              setSaving(false);
            }
          }}
          onCancel={() => { setShowForm(false); setEditItem(null); }}
          saving={saving}
        />
      )}
    </div>
  );
}

// ── Formular für neuen / bearbeiteten Besatz ──────────────
function StockingForm({ item, season, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    fishSpecies:        item?.fish_species        || 'rainbow_trout',
    quantityKg:         item?.quantity_kg         || '',
    quantityCount:      item?.quantity_count      || '',
    costEur:            item?.cost_eur            || '',
    pricePerKgOverride: item?.price_per_kg_override || '',
    source:             item?.source              || '',
    ageClass:           item?.age_class           || 'fangfertig',
    notes:              item?.notes               || '',
    isPlanned:          item?.is_planned          ?? false,
    stockedAt:          item?.stocked_at ? item.stocked_at.slice(0, 16) : new Date().toISOString().slice(0, 16),
    plannedDate:        item?.planned_date         || '',
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Kosten auto-berechnen wenn Kilopreis + Menge gesetzt
  const calcCost = form.pricePerKgOverride && form.quantityKg
    ? (parseFloat(form.pricePerKgOverride) * parseFloat(form.quantityKg)).toFixed(2)
    : null;

  function handleSubmit() {
    onSave({
      fishSpecies:         form.fishSpecies,
      quantityKg:          form.quantityKg || null,
      quantityCount:       form.quantityCount || null,
      costEur:             form.costEur || (calcCost ? calcCost : null),
      pricePerKgOverride:  form.pricePerKgOverride || null,
      source:              form.source || null,
      ageClass:            form.ageClass || null,
      notes:               form.notes || null,
      isPlanned:           form.isPlanned,
      stockedAt:           form.isPlanned ? null : form.stockedAt,
      plannedDate:         form.plannedDate || null,
    });
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-5 border-b border-blue-100">
          <h3 className="font-semibold text-gray-800">
            {item ? 'Besatz bearbeiten' : 'Neuer Besatz'}
          </h3>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Ist / Planung Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => set('isPlanned', false)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${!form.isPlanned ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Ist-Besatz
            </button>
            <button
              onClick={() => set('isPlanned', true)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${form.isPlanned ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Planung
            </button>
          </div>

          {/* Fischart */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fischart *</label>
            <select
              value={form.fishSpecies}
              onChange={e => set('fishSpecies', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {Object.entries(SPECIES_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Datum */}
          {!form.isPlanned ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Datum & Uhrzeit *</label>
              <input type="datetime-local" value={form.stockedAt} onChange={e => set('stockedAt', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Geplantes Datum (optional)</label>
              <input type="date" value={form.plannedDate} onChange={e => set('plannedDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          )}

          {/* Menge + Altersklasse */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Menge (kg)</label>
              <input type="number" step="0.1" value={form.quantityKg} onChange={e => set('quantityKg', e.target.value)}
                placeholder="z.B. 120" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Altersklasse</label>
              <select value={form.ageClass} onChange={e => set('ageClass', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="fangfertig">fangfertig</option>
                <option value="soemmerlinge">Sömmerlinge</option>
                <option value="jungfische">Jungfische</option>
                <option value="">–</option>
              </select>
            </div>
          </div>

          {/* Kosten */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">€/kg (fixer Preis)</label>
              <input type="number" step="0.01" value={form.pricePerKgOverride}
                onChange={e => set('pricePerKgOverride', e.target.value)}
                placeholder="z.B. 9.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Gesamtkosten (EUR)
                {calcCost && <span className="ml-1 text-emerald-600 font-normal">→ {calcCost}</span>}
              </label>
              <input type="number" step="0.01" value={form.costEur}
                onChange={e => set('costEur', e.target.value)}
                placeholder={calcCost || 'z.B. 1580'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>

          {/* Lieferant + Notizen */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Lieferant</label>
            <input type="text" value={form.source} onChange={e => set('source', e.target.value)}
              placeholder="z.B. Fischzucht Maier"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notizen</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={saving || !form.fishSpecies}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Speichere...' : (item ? 'Speichern' : 'Eintragen')}
          </button>
          <button onClick={onCancel}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ManualAnalysisForm (unverändert) ──────────────────────
function ManualAnalysisForm({ onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    name: 'Krems (OÖ)', region: 'Oberösterreich', fischregion: 'Hyporhithral',
    charakteristik: '',
    fischarten: 'Bachforelle;Salmo trutta fario;natürlich;hoch;Leitfischart\nRegenbogenforelle;Oncorhynchus mykiss;Besatz;mittel;Besatzfisch\nÄsche;Thymallus thymallus;natürlich;mittel;Bestandsaufbau\nBachsaibling;Salvelinus fontinalis;Besatz;niedrig;Zurückhaltend besetzen',
    empfehlungen: '', prognose: '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border-b border-blue-100">
        <h2 className="text-lg font-semibold text-gray-800">Manuelle Revier-Analyse</h2>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {['name','region','fischregion'].map(k => (
            <div key={k}>
              <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{k}</label>
              <input type="text" value={form[k]} onChange={e => set(k, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          ))}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Charakteristik</label>
          <textarea value={form.charakteristik} onChange={e => set('charakteristik', e.target.value)}
            rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Fischarten <span className="text-gray-400 font-normal">(Name;Wiss. Name;Vorkommen;Besatz;Hinweis)</span>
          </label>
          <textarea value={form.fischarten} onChange={e => set('fischarten', e.target.value)}
            rows={6} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Empfehlungen (eine pro Zeile)</label>
          <textarea value={form.empfehlungen} onChange={e => set('empfehlungen', e.target.value)}
            rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Zustandsprognose</label>
          <textarea value={form.prognose} onChange={e => set('prognose', e.target.value)}
            rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={() => onSave(form)} disabled={saving}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Speichere...' : 'Analyse speichern'}
          </button>
          <button onClick={onCancel} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm">Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────
export default function Revier() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('besatz');
  const [showManual, setShowManual] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);

  async function loadAnalysis(forceRefresh = false) {
    try {
      if (forceRefresh) setRefreshing(true); else setLoading(true);
      setError(null);
      const result = await api.get(forceRefresh ? '/api/revier/analyse?refresh=true' : '/api/revier/analyse');
      setData(result);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); setRefreshing(false); }
  }

  async function saveManualAnalysis(formData) {
    try {
      setManualSaving(true);
      const fischarten = formData.fischarten.split('\n').filter(l => l.trim()).map(line => {
        const [name, wissenschaftlicher_name, vorkommen, besatz_empfehlung, management_hinweis] = line.split(';').map(s => s.trim());
        return { name: name||'', wissenschaftlicher_name: wissenschaftlicher_name||'', vorkommen: vorkommen||'natürlich', besatz_empfehlung: besatz_empfehlung||'mittel', management_hinweis: management_hinweis||'' };
      });
      const analysis = {
        gewaesser_info: { name: formData.name||'Krems (OÖ)', region: formData.region||'Oberösterreich', fischregion_typ: formData.fischregion||'Hyporhithral', charakteristik: formData.charakteristik||'' },
        fischarten_inventar: fischarten,
        strategische_empfehlungen: formData.empfehlungen.split('\n').filter(l => l.trim()),
        oekologischer_zustand_prognose: formData.prognose||'',
      };
      const result = await api.post('/api/revier/analyse', { analysis });
      setData(result); setError(null); setShowManual(false);
    } catch (err) { setError('Speichern fehlgeschlagen: ' + err.message); }
    finally { setManualSaving(false); }
  }

  useEffect(() => {
    if (activeTab === 'analyse' && !data && !loading) loadAnalysis();
  }, [activeTab]);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Revier</h1>
        <p className="text-sm text-gray-500 mt-1">Besatzmanagement & KI-Analyse</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[
          { id: 'besatz', label: 'Besatz' },
          { id: 'analyse', label: 'KI-Analyse' },
        ].map(tab => (
          <button key={tab.id}
            onClick={() => { setActiveTab(tab.id); if (tab.id === 'analyse' && !data && !error) loadAnalysis(); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'besatz' && <BesatzSection isAdmin={isAdmin} />}

      {activeTab === 'analyse' && loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
          <p className="text-gray-500 text-sm">Revier-Analyse wird erstellt...</p>
        </div>
      )}
      {activeTab === 'analyse' && error && !showManual && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium mb-2">Analyse fehlgeschlagen</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => loadAnalysis(true)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm">Erneut versuchen</button>
            <button onClick={() => setShowManual(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Manuell eingeben</button>
          </div>
        </div>
      )}
      {activeTab === 'analyse' && showManual && (
        <ManualAnalysisForm onSave={saveManualAnalysis} onCancel={() => setShowManual(false)} saving={manualSaving} />
      )}
      {activeTab === 'analyse' && data && (() => {
        const { analysis, analyzedAt, cached } = data;
        const { gewaesser_info, fischarten_inventar, strategische_empfehlungen, oekologischer_zustand_prognose } = analysis;
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              {analyzedAt && <p className="text-xs text-gray-400">Analyse vom {new Date(analyzedAt).toLocaleString('de-AT')}{cached && ' (gecacht)'}</p>}
              <button onClick={() => loadAnalysis(true)} disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 disabled:opacity-50">
                <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                {refreshing ? 'Aktualisiere...' : 'Aktualisieren'}
              </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">{gewaesser_info.name}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3"><span className="text-gray-500 text-xs uppercase">Region</span><p className="font-medium mt-0.5">{gewaesser_info.region}</p></div>
                <div className="bg-gray-50 rounded-lg p-3"><span className="text-gray-500 text-xs uppercase">Fischregion</span><p className="font-medium mt-0.5">{gewaesser_info.fischregion_typ}</p></div>
              </div>
              {gewaesser_info.charakteristik && <p className="text-sm text-gray-600 mt-3">{gewaesser_info.charakteristik}</p>}
              <div className="mt-4 rounded-lg overflow-hidden border border-gray-200">
                <iframe title="Reviergebiet" width="100%" height="250" style={{ border: 0 }} loading="lazy"
                  src={`https://www.google.com/maps/embed/v1/directions?key=${import.meta.env.VITE_GOOGLE_MAPS_KEY||''}&origin=48.117156,14.210667&destination=48.130520,14.225703&mode=walking&zoom=14`} />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-800">Fischarten-Inventar <span className="text-sm font-normal text-gray-400">({fischarten_inventar.length} Arten)</span></h2>
              </div>
              <div className="divide-y divide-gray-100">
                {fischarten_inventar.map((art, i) => (
                  <div key={i} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-800">{art.name}</h3>
                          <span className="text-xs italic text-gray-400">{art.wissenschaftlicher_name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${VORKOMMEN_BADGE[art.vorkommen]||'bg-gray-100 text-gray-600'}`}>{art.vorkommen}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${BESATZ_COLORS[art.besatz_empfehlung]||'bg-gray-100 text-gray-600 border-gray-300'}`}>Besatz: {art.besatz_empfehlung}</span>
                        </div>
                        {art.management_hinweis && <p className="text-sm text-gray-500 mt-2">{art.management_hinweis}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {strategische_empfehlungen?.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Strategische Empfehlungen</h2>
                <div className="space-y-3">
                  {strategische_empfehlungen.map((emp, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="flex-shrink-0 w-6 h-6 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">{i+1}</span>
                      <p className="text-sm text-gray-700">{emp}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {oekologischer_zustand_prognose && (
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-5">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">Ökologische Zustandsprognose</h2>
                <p className="text-sm text-gray-700">{oekologischer_zustand_prognose}</p>
              </div>
            )}
            <p className="text-xs text-gray-400 text-center pb-4">Analyse erstellt mit Gemini AI. Dient als Entscheidungshilfe.</p>
          </div>
        );
      })()}
    </div>
  );
}
