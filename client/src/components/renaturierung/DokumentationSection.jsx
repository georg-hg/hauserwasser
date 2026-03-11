import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useGeolocation } from '../../hooks/useGeolocation';
import { api } from '../../api/client';
import MapComponent from '../map/MapComponent';

// ── Konstanten ──
const PREDATOR_TYPES = [
  { key: 'fischotter', label: 'Fischotter', color: '#8B4513' },
  { key: 'kormoran', label: 'Kormoran', color: '#1a1a1a' },
  { key: 'gaensesaeger', label: 'Gänsesäger', color: '#2563EB' },
  { key: 'fischreiher', label: 'Fischreiher', color: '#6B7280' },
  { key: 'graureiher', label: 'Graureiher', color: '#9CA3AF' },
  { key: 'silberreiher', label: 'Silberreiher', color: '#E5E7EB' },
  { key: 'biber', label: 'Biber', color: '#92400E' },
  { key: 'sonstiges', label: 'Sonstiges', color: '#F59E0B' },
];

const BEHAVIORS = [
  { key: 'jagdverhalten', label: 'Jagdverhalten' },
  { key: 'fressend', label: 'Fressend' },
  { key: 'ruhend', label: 'Ruhend' },
  { key: 'fliegend_schwimmend', label: 'Fliegend / Schwimmend' },
  { key: 'sonstiges', label: 'Sonstiges' },
];

function getPredatorColor(type) {
  return PREDATOR_TYPES.find(p => p.key === type)?.color || '#F59E0B';
}

function getPredatorLabel(type) {
  return PREDATOR_TYPES.find(p => p.key === type)?.label || type;
}



function getBehaviorLabel(key) {
  return BEHAVIORS.find(b => b.key === key)?.label || key || '–';
}

// ── Sichtungsformular ──
function SightingForm({ onSubmit, onCancel, position }) {
  const { position: gpsPos } = useGeolocation();
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    sightedDate: new Date().toISOString().split('T')[0],
    sightedTime: new Date().toTimeString().slice(0, 5),
    predatorType: '',
    individualCount: '1',
    behavior: '',
    notes: '',
  });
  const [selectedPos, setSelectedPos] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const currentPos = selectedPos || gpsPos;

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!currentPos) {
      setError('Bitte Sichtungsort auf der Karte markieren oder GPS aktivieren.');
      return;
    }
    if (!form.predatorType) {
      setError('Bitte Art des Prädators auswählen.');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      const sightedAt = new Date(`${form.sightedDate}T${form.sightedTime || '12:00'}`).toISOString();
      formData.append('sightedAt', sightedAt);
      formData.append('latitude', currentPos.lat);
      formData.append('longitude', currentPos.lng);
      formData.append('predatorType', form.predatorType);
      formData.append('individualCount', form.individualCount || '1');
      if (form.behavior) formData.append('behavior', form.behavior);
      if (form.notes) formData.append('notes', form.notes);

      const file = fileRef.current?.files?.[0];
      if (file) formData.append('photo', file);

      await onSubmit(formData);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">{error}</div>
      )}

      {/* Karte */}
      <div className="card p-0 overflow-hidden">
        <div className="p-3 pb-1">
          <p className="text-sm font-medium text-gray-700">Sichtungsort</p>
          <p className="text-xs text-gray-400">Tippe auf die Karte oder nutze GPS</p>
        </div>
        <MapComponent
          onLocationSelect={setSelectedPos}
          selectedPosition={selectedPos}
          currentPosition={gpsPos}
          height="h-[250px] md:h-[350px]"
        />
      </div>

      {/* Datum & Zeit */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Datum *</label>
          <input type="date" value={form.sightedDate} onChange={update('sightedDate')} className="input-field" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Uhrzeit</label>
          <input type="time" value={form.sightedTime} onChange={update('sightedTime')} className="input-field" />
        </div>
      </div>

      {/* Prädator-Art */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Art des Prädators *</label>
        <select value={form.predatorType} onChange={update('predatorType')} className="input-field" required>
          <option value="">Bitte wählen...</option>
          {PREDATOR_TYPES.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Anzahl & Verhalten */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Anzahl Individuen</label>
          <input type="number" min="1" max="999" value={form.individualCount} onChange={update('individualCount')} className="input-field" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Verhalten</label>
          <select value={form.behavior} onChange={update('behavior')} className="input-field">
            <option value="">Keine Angabe</option>
            {BEHAVIORS.map((b) => (
              <option key={b.key} value={b.key}>{b.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Foto */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Foto (optional)</label>
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors"
        >
          {preview ? (
            <img src={preview} alt="Vorschau" className="max-h-40 mx-auto rounded-lg object-contain" />
          ) : (
            <div className="space-y-1">
              <svg className="w-8 h-8 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-xs text-gray-500">Foto aufnehmen oder hochladen</p>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
      </div>

      {/* Notizen */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Bemerkungen</label>
        <textarea value={form.notes} onChange={update('notes')} rows={2} className="input-field" placeholder="Optional..." />
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Abbrechen</button>
        <button type="submit" disabled={saving} className="btn-primary flex-1">
          {saving ? 'Wird gespeichert...' : 'Sichtung speichern'}
        </button>
      </div>
    </form>
  );
}

// ── Sichtungskarte (einzelner Eintrag) ──
function SightingCard({ sighting, onDelete, isAdmin }) {
  const API_URL = import.meta.env.VITE_API_URL ? `https://${import.meta.env.VITE_API_URL}` : '';

  return (
    <div className="card p-3 flex gap-3">
      {/* Icon / Foto */}
      <div className="flex-shrink-0">
        {sighting.photoUrl ? (
          <img
            src={`${API_URL}${sighting.photoUrl}`}
            alt=""
            className="w-14 h-14 rounded-lg object-cover"
          />
        ) : (
          <div
            className="w-14 h-14 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: getPredatorColor(sighting.predatorType) + '20' }}
          >
            <span
              className="w-6 h-6 rounded-full"
              style={{ backgroundColor: getPredatorColor(sighting.predatorType) }}
            />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-sm text-gray-800">
              {getPredatorLabel(sighting.predatorType)}
              <span className="text-gray-400 font-normal ml-1">
                × {sighting.individualCount}
              </span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {new Date(sighting.sightedAt).toLocaleDateString('de-AT', {
                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
              })}
              {' · '}
              {new Date(sighting.sightedAt).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          {!isAdmin && onDelete && (
            <button
              onClick={() => onDelete(sighting.id)}
              className="text-gray-300 hover:text-red-500 transition-colors p-1"
              title="Löschen"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          )}
        </div>

        {sighting.behavior && (
          <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full font-medium">
            {getBehaviorLabel(sighting.behavior)}
          </span>
        )}
        {sighting.notes && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{sighting.notes}</p>
        )}
        {isAdmin && sighting.userName && (
          <p className="text-[10px] text-emerald-600 mt-1 font-medium">{sighting.userName}</p>
        )}
      </div>
    </div>
  );
}

// ── Admin-Kartenansicht ──
function AdminMapView({ sightings }) {
  const [activeId, setActiveId] = useState(null);

  // Sichtungen als "catches"-artige Objekte für MapComponent
  // MapComponent akzeptiert catches-Array, aber wir brauchen eigene Marker
  // → Wir nutzen MapComponent als Basis und rendern Marker manuell
  // Da MapComponent catches mit fish_species erwartet, nutzen wir es ohne catches
  // und bauen die Marker-Logik ins onLoad

  return (
    <div className="space-y-4">
      <div className="card p-0 overflow-hidden">
        <div className="p-3 pb-1">
          <p className="text-sm font-medium text-gray-700">Alle Sichtungen</p>
          <p className="text-xs text-gray-400">{sightings.length} Einträge von allen Fischern</p>
        </div>
        <MapComponent
          catches={sightings.map(s => ({
            id: s.id,
            latitude: s.latitude,
            longitude: s.longitude,
            fish_species: s.predatorType,
            german_name: `${getPredatorLabel(s.predatorType)} × ${s.individualCount}`,
            catch_date: s.sightedAt,
            length_cm: null,
            weight_kg: null,
            photo_url: s.photoUrl,
          }))}
          height="h-[350px] md:h-[500px]"
        />
      </div>

      {/* Legende */}
      <div className="flex flex-wrap gap-2">
        {PREDATOR_TYPES.filter(p => sightings.some(s => s.predatorType === p.key)).map(p => (
          <span key={p.key} className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-full border text-xs">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Statistik-Übersicht ──
function StatsOverview({ stats }) {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <div className="card p-3 text-center">
        <p className="text-2xl font-bold text-gray-800">{stats.total.sightings}</p>
        <p className="text-xs text-gray-500">Sichtungen</p>
      </div>
      <div className="card p-3 text-center">
        <p className="text-2xl font-bold text-gray-800">{stats.total.individuals}</p>
        <p className="text-xs text-gray-500">Individuen gesamt</p>
      </div>
      <div className="card p-3 text-center col-span-2 sm:col-span-1">
        <p className="text-2xl font-bold text-gray-800">{stats.byType.length}</p>
        <p className="text-xs text-gray-500">Verschiedene Arten</p>
      </div>
      {stats.byType.map(t => (
        <div key={t.type} className="card p-3 flex items-center gap-2">
          <span
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: getPredatorColor(t.type) }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700 truncate">{getPredatorLabel(t.type)}</p>
            <p className="text-xs text-gray-400">{t.sightings}× gesehen · {t.individuals} Ind.</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Hauptkomponente ──
export default function DokumentationSection() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [view, setView] = useState('list'); // list | form | map (admin) | stats
  const [sightings, setSightings] = useState([]);
  const [allSightings, setAllSightings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');

  // Eigene Sichtungen laden
  const fetchSightings = useCallback(async () => {
    try {
      const data = await api.get('/api/predators');
      setSightings(data.sightings);
    } catch (err) {
      console.error('Fetch sightings error:', err);
    }
  }, []);

  // Admin: Alle Sichtungen laden
  const fetchAllSightings = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const params = filterType ? `?type=${filterType}` : '';
      const data = await api.get(`/api/predators/all${params}`);
      setAllSightings(data.sightings);
    } catch (err) {
      console.error('Fetch all sightings error:', err);
    }
  }, [isAdmin, filterType]);

  // Statistiken laden
  const fetchStats = useCallback(async () => {
    try {
      const data = await api.get('/api/predators/stats');
      setStats(data);
    } catch (err) {
      console.error('Fetch stats error:', err);
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchSightings(), fetchStats(), fetchAllSightings()]);
      setLoading(false);
    }
    init();
  }, [fetchSightings, fetchStats, fetchAllSightings]);

  // Neue Sichtung speichern
  const handleCreate = async (formData) => {
    await api.upload('/api/predators', formData);
    await Promise.all([fetchSightings(), fetchStats(), fetchAllSightings()]);
    setView('list');
  };

  // Sichtung löschen
  const handleDelete = async (id) => {
    if (!confirm('Sichtung wirklich löschen?')) return;
    await api.delete(`/api/predators/${id}`);
    await Promise.all([fetchSightings(), fetchStats(), fetchAllSightings()]);
  };

  // Admin-Filter anwenden
  useEffect(() => {
    if (isAdmin && view === 'map') {
      fetchAllSightings();
    }
  }, [filterType, isAdmin, view, fetchAllSightings]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header mit Aktionen */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Prädatoren-Sichtungen</h2>
          <p className="text-xs text-gray-500">
            {isAdmin ? 'Alle Sichtungen aller Fischer' : 'Dein Sichtungslog'}
          </p>
        </div>
        {view !== 'form' && (
          <button
            onClick={() => setView('form')}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Neue Sichtung
          </button>
        )}
      </div>

      {/* View-Tabs (Admin hat Karte + Statistik) */}
      {view !== 'form' && (
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView('list')}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              view === 'list' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {isAdmin ? 'Alle Einträge' : 'Meine Sichtungen'}
          </button>
          {isAdmin && (
            <button
              onClick={() => setView('map')}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                view === 'map' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Karte
            </button>
          )}
          <button
            onClick={() => setView('stats')}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              view === 'stats' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Statistik
          </button>
        </div>
      )}

      {/* Formular */}
      {view === 'form' && (
        <SightingForm
          onSubmit={handleCreate}
          onCancel={() => setView('list')}
        />
      )}

      {/* Liste */}
      {view === 'list' && (
        <div className="space-y-2">
          {/* Admin-Filter */}
          {isAdmin && (
            <div className="flex gap-2 items-center">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="input-field text-sm py-1.5"
              >
                <option value="">Alle Arten</option>
                {PREDATOR_TYPES.map(p => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sichtungsliste */}
          {(isAdmin ? allSightings : sightings)
            .filter(s => !filterType || s.predatorType === filterType)
            .map(s => (
              <SightingCard
                key={s.id}
                sighting={s}
                onDelete={handleDelete}
                isAdmin={isAdmin}
              />
            ))}

          {(isAdmin ? allSightings : sightings).length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">Noch keine Sichtungen erfasst.</p>
              <button
                onClick={() => setView('form')}
                className="mt-3 text-emerald-600 text-sm font-medium hover:underline"
              >
                Erste Sichtung melden
              </button>
            </div>
          )}
        </div>
      )}

      {/* Admin Karte */}
      {view === 'map' && isAdmin && (
        <div>
          {/* Art-Filter */}
          <div className="mb-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input-field text-sm py-1.5"
            >
              <option value="">Alle Arten</option>
              {PREDATOR_TYPES.map(p => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>
          <AdminMapView sightings={allSightings} />
        </div>
      )}

      {/* Statistik */}
      {view === 'stats' && <StatsOverview stats={stats} />}
    </div>
  );
}
