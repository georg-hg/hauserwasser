import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useCatches } from '../../hooks/useCatches';
import { FISH_SPECIES, TECHNIQUES } from '../../utils/fishSpecies';
import { isInClosedSeason } from '../../utils/seasonCheck';
import MapComponent from '../map/MapComponent';

export default function CatchForm() {
  const navigate = useNavigate();
  const { position } = useGeolocation();
  const { addCatch } = useCatches();
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    catchDate: new Date().toISOString().split('T')[0],
    catchTime: new Date().toTimeString().slice(0, 5),
    fishSpecies: '',
    lengthCm: '',
    weightKg: '',
    technique: '',
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

    if (!currentPos) {
      setError('Bitte Standort auf der Karte waehlen oder GPS aktivieren.');
      return;
    }
    if (!form.fishSpecies) {
      setError('Bitte Fischart auswaehlen.');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('catchDate', form.catchDate);
      formData.append('catchTime', form.catchTime);
      formData.append('latitude', currentPos.lat);
      formData.append('longitude', currentPos.lng);
      formData.append('fishSpecies', form.fishSpecies);
      if (form.lengthCm) formData.append('lengthCm', form.lengthCm);
      if (form.weightKg) formData.append('weightKg', form.weightKg);
      if (form.technique) formData.append('technique', form.technique);
      formData.append('kept', form.kept);
      if (form.notes) formData.append('notes', form.notes);

      const file = fileRef.current?.files?.[0];
      if (file) formData.append('photo', file);

      await addCatch(formData);
      navigate('/fangbuch');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 md:py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Neuer Fang</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">{error}</div>
        )}

        {/* Karte */}
        <div className="card p-0 overflow-hidden">
          <div className="p-3 pb-1">
            <p className="text-sm font-medium text-gray-700">Fangort</p>
            <p className="text-xs text-gray-400">Tippe auf die Karte oder nutze GPS</p>
          </div>
          <MapComponent
            onLocationSelect={setSelectedPos}
            selectedPosition={selectedPos}
            currentPosition={position}
            height="h-[250px] md:h-[350px]"
          />
        </div>

        {/* Datum & Zeit */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
            <input type="date" value={form.catchDate} onChange={update('catchDate')} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Uhrzeit</label>
            <input type="time" value={form.catchTime} onChange={update('catchTime')} className="input-field" />
          </div>
        </div>

        {/* Fischart */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fischart *</label>
          <select value={form.fishSpecies} onChange={update('fishSpecies')} className="input-field" required>
            <option value="">Bitte waehlen...</option>
            {FISH_SPECIES.map((s) => (
              <option key={s.key} value={s.key}>{s.german} ({s.latin})</option>
            ))}
          </select>
          {seasonWarning?.closed && (
            <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2">
              <p className="text-sm text-red-700 font-medium">{seasonWarning.message}</p>
            </div>
          )}
          {seasonWarning && !seasonWarning.closed && seasonWarning.minSize && (
            <p className="mt-1 text-xs text-gray-500">Mindestmass: {seasonWarning.minSize} cm</p>
          )}
        </div>

        {/* Masse */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Laenge (cm)</label>
            <input type="number" step="0.1" min="0" value={form.lengthCm} onChange={update('lengthCm')} className="input-field" placeholder="z.B. 32.5" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gewicht in kg (optional)</label>
            <input type="number" step="0.01" min="0" value={form.weightKg} onChange={update('weightKg')} className="input-field" placeholder="z.B. 0.45" />
          </div>
        </div>

        {/* Technik */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Methode</label>
          <select value={form.technique} onChange={update('technique')} className="input-field">
            <option value="">Keine Angabe</option>
            {TECHNIQUES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Foto */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Foto</label>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-colors"
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

        {/* Entnommen */}
        <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 cursor-pointer">
          <input type="checkbox" checked={form.kept} onChange={update('kept')} className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          <div>
            <span className="text-sm font-medium text-gray-700">Fisch entnommen</span>
            <p className="text-xs text-gray-400">Zaehlt zur Tages-/Saisonquote</p>
          </div>
        </label>

        {/* Notizen */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
          <textarea value={form.notes} onChange={update('notes')} rows={2} className="input-field" placeholder="Wildfang oder Eingesetzt?" />
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">
            Abbrechen
          </button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? 'Wird gespeichert...' : 'Fang speichern'}
          </button>
        </div>
      </form>
    </div>
  );
}
