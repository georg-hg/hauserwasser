import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useGeolocation } from '../../hooks/useGeolocation';
import { FISH_SPECIES, TECHNIQUES, getSpeciesGerman } from '../../utils/fishSpecies';
import { isInClosedSeason } from '../../utils/seasonCheck';
import MapComponent from '../map/MapComponent';

const API_URL = import.meta.env.VITE_API_URL ? `https://${import.meta.env.VITE_API_URL}` : '';

function AddCatchForm({ fishingDayId, onCatchAdded }) {
  const { position } = useGeolocation();
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    catchTime: new Date().toTimeString().slice(0, 5),
    fishSpecies: '',
    lengthCm: '',
    weightKg: '',
    kept: false,
    notes: '',
  });
  const [selectedPos, setSelectedPos] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const currentPos = selectedPos || position;
  const seasonWarning = form.fishSpecies ? isInClosedSeason(form.fishSpecies) : null;

  const update = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [key]: val });
  };

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
    if (!form.fishSpecies) {
      setError('Bitte Fischart auswählen.');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('catchTime', form.catchTime);
      formData.append('fishSpecies', form.fishSpecies);
      if (currentPos) {
        formData.append('latitude', currentPos.lat);
        formData.append('longitude', currentPos.lng);
      }
      if (form.lengthCm) formData.append('lengthCm', form.lengthCm);
      if (form.weightKg) formData.append('weightKg', form.weightKg);
      formData.append('kept', form.kept);
      if (form.notes) formData.append('notes', form.notes);

      const file = fileRef.current?.files?.[0];
      if (file) formData.append('photo', file);

      await api.upload(`/api/fishing-days/${fishingDayId}/catches`, formData);

      // Reset form
      setForm({ catchTime: new Date().toTimeString().slice(0, 5), fishSpecies: '', lengthCm: '', weightKg: '', kept: false, notes: '' });
      setPreview(null);
      setSelectedPos(null);
      if (fileRef.current) fileRef.current.value = '';
      onCatchAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">{error}</div>
      )}

      {/* Karte */}
      <div className="rounded-lg overflow-hidden border border-gray-200">
        <MapComponent
          onLocationSelect={setSelectedPos}
          selectedPosition={selectedPos}
          currentPosition={position}
          height="h-[180px]"
        />
      </div>

      {/* Uhrzeit + Fischart */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Uhrzeit</label>
          <input type="time" value={form.catchTime} onChange={update('catchTime')} className="input-field text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Fischart *</label>
          <select value={form.fishSpecies} onChange={update('fishSpecies')} className="input-field text-sm" required>
            <option value="">Bitte wählen...</option>
            {FISH_SPECIES.map((s) => (
              <option key={s.key} value={s.key}>{s.german}</option>
            ))}
          </select>
        </div>
      </div>

      {seasonWarning?.closed && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2">
          <p className="text-xs text-red-700 font-medium">{seasonWarning.message}</p>
        </div>
      )}

      {/* Länge + Gewicht */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Länge (cm)</label>
          <input type="number" step="0.1" min="0" value={form.lengthCm} onChange={update('lengthCm')} className="input-field text-sm" placeholder="z.B. 32.5" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Gewicht in kg (optional)</label>
          <input type="number" step="0.01" min="0" value={form.weightKg} onChange={update('weightKg')} className="input-field text-sm" placeholder="z.B. 0.45" />
        </div>
      </div>

      {/* Foto */}
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-primary-400 transition-colors"
      >
        {preview ? (
          <img src={preview} alt="Vorschau" className="max-h-28 mx-auto rounded-lg object-contain" />
        ) : (
          <p className="text-xs text-gray-500">Foto aufnehmen oder hochladen</p>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />

      {/* Entnommen */}
      <label className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 cursor-pointer">
        <input type="checkbox" checked={form.kept} onChange={update('kept')} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
        <span className="text-sm text-gray-700">Fisch entnommen</span>
      </label>

      {/* Notizen */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Notizen zum Fang</label>
        <textarea value={form.notes} onChange={update('notes')} rows={2} className="input-field text-sm" placeholder="Wildfang oder Eingesetzt?" />
      </div>

      <button type="submit" disabled={saving} className="btn-primary w-full text-sm">
        {saving ? 'Wird gespeichert...' : 'Fang hinzufügen'}
      </button>
    </form>
  );
}

// ── Edit-Formular für einen bestehenden Fang ─────────────────
function EditCatchForm({ catchData, onSaved, onCancel }) {
  const [form, setForm] = useState({
    catchDate: catchData.catch_date?.slice(0, 10) || '',
    catchTime: catchData.catch_time?.slice(0, 5) || '',
    fishSpecies: catchData.fish_species || '',
    lengthCm: catchData.length_cm ?? '',
    weightKg: catchData.weight_kg ?? '',
    kept: catchData.kept || false,
    notes: catchData.notes || '',
    technique: catchData.technique || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [key]: val });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.fishSpecies) {
      setError('Bitte Fischart auswählen.');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/api/catches/${catchData.id}`, {
        catchDate: form.catchDate || null,
        catchTime: form.catchTime || null,
        fishSpecies: form.fishSpecies,
        lengthCm: form.lengthCm !== '' ? parseFloat(form.lengthCm) : null,
        weightKg: form.weightKg !== '' ? parseFloat(form.weightKg) : null,
        technique: form.technique || null,
        kept: form.kept,
        notes: form.notes,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-blue-50/50 border border-blue-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-700">Fang bearbeiten</h3>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-2 rounded-lg border border-red-200">{error}</div>
      )}

      {/* Datum + Uhrzeit */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Datum</label>
          <input type="date" value={form.catchDate} onChange={update('catchDate')} className="input-field text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Uhrzeit</label>
          <input type="time" value={form.catchTime} onChange={update('catchTime')} className="input-field text-sm" />
        </div>
      </div>

      {/* Fischart */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Fischart *</label>
        <select value={form.fishSpecies} onChange={update('fishSpecies')} className="input-field text-sm" required>
          <option value="">Bitte wählen...</option>
          {FISH_SPECIES.map((s) => (
            <option key={s.key} value={s.key}>{s.german}</option>
          ))}
        </select>
      </div>

      {/* Länge + Gewicht */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Länge (cm)</label>
          <input type="number" step="0.1" min="0" value={form.lengthCm} onChange={update('lengthCm')} className="input-field text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Gewicht (kg)</label>
          <input type="number" step="0.01" min="0" value={form.weightKg} onChange={update('weightKg')} className="input-field text-sm" />
        </div>
      </div>

      {/* Technik */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Technik</label>
        <select value={form.technique} onChange={update('technique')} className="input-field text-sm">
          <option value="">Keine Angabe</option>
          {TECHNIQUES.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Entnommen */}
      <label className="flex items-center gap-3 p-2 rounded-lg bg-white cursor-pointer">
        <input type="checkbox" checked={form.kept} onChange={update('kept')} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
        <span className="text-sm text-gray-700">Fisch entnommen</span>
      </label>

      {/* Notizen */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Notizen</label>
        <textarea value={form.notes} onChange={update('notes')} rows={2} className="input-field text-sm" />
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm">
          {saving ? 'Speichern...' : 'Speichern'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
          Abbrechen
        </button>
      </div>
    </form>
  );
}

// ── Edit-Formular für den Fischtag ───────────────────────────
function EditDayForm({ day, onSaved, onCancel }) {
  const [technique, setTechnique] = useState(day.technique || '');
  const [notes, setNotes] = useState(day.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/api/fishing-days/${day.id}`, { technique, notes });
      onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-amber-50/50 border border-amber-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-700">Fischtag bearbeiten</h3>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Technik</label>
        <select value={technique} onChange={(e) => setTechnique(e.target.value)} className="input-field text-sm">
          <option value="">Keine Angabe</option>
          {TECHNIQUES.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Notizen</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input-field text-sm" placeholder="z.B. Wetter, Bedingungen..." />
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm">
          {saving ? 'Speichern...' : 'Speichern'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
          Abbrechen
        </button>
      </div>
    </form>
  );
}

// ── Hauptkomponente ──────────────────────────────────────────
export default function FishingDayDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [day, setDay] = useState(null);
  const [catches, setCatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddCatch, setShowAddCatch] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [editingCatchId, setEditingCatchId] = useState(null);
  const [editingDay, setEditingDay] = useState(false);

  const fetchDay = async () => {
    try {
      const data = await api.get(`/api/fishing-days/${id}`);
      setDay(data.fishingDay);
      setCatches(data.catches);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDay(); }, [id]);

  const handleComplete = async () => {
    const msg = catches.length === 0
      ? 'Fischtag ohne Fang abschließen?'
      : `Fischtag mit ${catches.length} Fang/Fängen abschließen?`;
    if (!confirm(msg)) return;

    setCompleting(true);
    try {
      await api.put(`/api/fishing-days/${id}/complete`, {});
      await fetchDay();
    } catch (err) {
      alert(err.message);
    } finally {
      setCompleting(false);
    }
  };

  const handleDelete = async () => {
    const msg = catches.length > 0
      ? `Fischtag mit ${catches.length} Fang/Fängen wirklich löschen?`
      : 'Fischtag wirklich löschen?';
    if (!confirm(msg)) return;
    try {
      await api.delete(`/api/fishing-days/${id}`);
      navigate('/fangbuch');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteCatch = async (catchId, name) => {
    if (!confirm(`Fang "${name}" löschen?`)) return;
    try {
      await api.delete(`/api/catches/${catchId}`);
      await fetchDay();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!day) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 text-center">
        <p className="text-gray-500">Fischtag nicht gefunden.</p>
        <button onClick={() => navigate('/fangbuch')} className="btn-primary mt-4 text-sm">Zum Fangbuch</button>
      </div>
    );
  }

  const dateStr = new Date(day.fishing_date).toLocaleDateString('de-AT', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const technique = TECHNIQUES.find(t => t.key === day.technique)?.label;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 md:py-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Fischtag</h1>
          <p className="text-sm text-gray-500">{dateStr}</p>
        </div>
        <div className="flex items-center gap-2">
          {day.completed ? (
            <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
              Abgeschlossen
            </span>
          ) : (
            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
              Offen
            </span>
          )}
        </div>
      </div>

      {/* Info / Edit */}
      {editingDay ? (
        <EditDayForm
          day={day}
          onSaved={() => { setEditingDay(false); fetchDay(); }}
          onCancel={() => setEditingDay(false)}
        />
      ) : (
        <div className="card">
          <div className="flex items-start justify-between">
            <div className="grid grid-cols-2 gap-3 text-sm flex-1">
              <div>
                <span className="text-gray-500">Methode</span>
                <p className="font-medium text-gray-900">{technique || 'Keine Angabe'}</p>
              </div>
              <div>
                <span className="text-gray-500">Fänge</span>
                <p className="font-medium text-gray-900">
                  {catches.length === 0 ? 'Keine' : `${catches.length} Fang/Fänge`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setEditingDay(true)}
              className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors"
              title="Fischtag bearbeiten"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </button>
          </div>
          {day.notes && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">Notizen</span>
              <p className="text-sm text-gray-700 mt-0.5">{day.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Fang-Liste */}
      {catches.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Fänge ({catches.length})</h2>
          <div className="space-y-2">
            {catches.map((c) => (
              editingCatchId === c.id ? (
                <EditCatchForm
                  key={c.id}
                  catchData={c}
                  onSaved={() => { setEditingCatchId(null); fetchDay(); }}
                  onCancel={() => setEditingCatchId(null)}
                />
              ) : (
                <div key={c.id} className="card flex items-center gap-3">
                  {c.photo_url ? (
                    <img src={`${API_URL}${c.photo_url}`} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800">
                      {c.german_name || getSpeciesGerman(c.fish_species)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {c.catch_time && `${c.catch_time.slice(0, 5)} Uhr`}
                      {c.length_cm && ` · ${c.length_cm} cm`}
                      {c.weight_kg && ` · ${c.weight_kg} kg`}
                    </p>
                    <p className="text-xs text-gray-400">
                      {c.kept ? 'entnommen' : 'zurückgesetzt'}
                      {c.notes && ` · ${c.notes}`}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {/* Bearbeiten-Button */}
                    <button
                      onClick={() => setEditingCatchId(c.id)}
                      className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors"
                      title="Fang bearbeiten"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    {/* Löschen-Button */}
                    {!day.completed && (
                      <button
                        onClick={() => handleDeleteCatch(c.id, c.german_name || c.fish_species)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                        title="Fang löschen"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )
            ))}
          </div>
        </section>
      )}

      {/* Aktionen (nur wenn noch offen) */}
      {!day.completed && (
        <div className="space-y-3">
          {/* Fang hinzufügen Toggle */}
          {!showAddCatch ? (
            <button
              onClick={() => setShowAddCatch(true)}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Fang hinzufügen
            </button>
          ) : (
            <section className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">Neuer Fang</h2>
                <button onClick={() => setShowAddCatch(false)} className="text-xs text-gray-400 hover:text-gray-600">
                  Abbrechen
                </button>
              </div>
              <AddCatchForm
                fishingDayId={id}
                onCatchAdded={() => { fetchDay(); setShowAddCatch(false); }}
              />
            </section>
          )}

          {/* Abschließen / Löschen */}
          <div className="flex gap-3">
            <button
              onClick={handleComplete}
              disabled={completing}
              className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              {completing ? 'Wird abgeschlossen...' : catches.length === 0 ? 'Ohne Fang abschließen' : 'Fischtag abschließen'}
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
            >
              Löschen
            </button>
          </div>
        </div>
      )}

      {/* Zurück */}
      <button
        onClick={() => navigate('/fangbuch')}
        className="w-full text-center text-sm text-gray-500 hover:text-gray-700 py-2"
      >
        ← Zurück zum Fangbuch
      </button>
    </div>
  );
}
