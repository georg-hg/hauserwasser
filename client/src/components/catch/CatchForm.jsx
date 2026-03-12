import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useCatches } from '../../hooks/useCatches';
import { FISH_SPECIES, TECHNIQUES } from '../../utils/fishSpecies';
import { isInClosedSeason } from '../../utils/seasonCheck';
import { api } from '../../api/client';
import MapComponent from '../map/MapComponent';

const confidenceColors = {
  hoch: 'text-green-700 bg-green-50 border-green-200',
  mittel: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  niedrig: 'text-gray-500 bg-gray-50 border-gray-200',
};

const confidenceLabels = {
  hoch: 'hohe Sicherheit',
  mittel: 'mittlere Sicherheit',
  niedrig: 'grobe Schätzung',
};

export default function CatchForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { position } = useGeolocation();
  const { addCatch } = useCatches();
  const fileRef = useRef(null);

  // Pre-fill aus Fish-ID Redirect (Legacy-Support)
  const prefillSpecies = searchParams.get('species') || '';
  const prefillLength = searchParams.get('length') || '';
  const prefillOrigin = searchParams.get('origin') || '';

  const [form, setForm] = useState({
    catchDate: new Date().toISOString().split('T')[0],
    catchTime: new Date().toTimeString().slice(0, 5),
    fishSpecies: prefillSpecies,
    lengthCm: prefillLength,
    weightKg: '',
    technique: '',
    kept: false,
    notes: '',
  });
  const [selectedPos, setSelectedPos] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fish-ID Analyse State
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisApplied, setAnalysisApplied] = useState(!!prefillSpecies);

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
      // Reset vorherige Analyse
      setAnalysisResult(null);
      setAnalysisApplied(false);
    }
  };

  const handleDeletePhoto = () => {
    setPreview(null);
    setAnalysisResult(null);
    setAnalysisApplied(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleReanalyze = () => {
    setAnalysisResult(null);
    setAnalysisApplied(false);
  };

  const handleAnalyze = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('photo', file);
      const data = await api.upload('/api/fish-id/analyze', formData);
      setAnalysisResult(data);

      // Automatisch Formularfelder ausfüllen wenn Art erkannt
      if (data.species && data.species !== 'unknown') {
        setForm(prev => ({
          ...prev,
          fishSpecies: data.species,
          ...(data.estimatedLength?.lengthCm ? { lengthCm: String(data.estimatedLength.lengthCm) } : {}),
        }));
        setAnalysisApplied(true);
      } else if (data.estimatedLength?.lengthCm) {
        setForm(prev => ({
          ...prev,
          lengthCm: String(data.estimatedLength.lengthCm),
        }));
      }
    } catch (err) {
      setError('Analyse fehlgeschlagen: ' + err.message);
    } finally {
      setAnalyzing(false);
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

        {/* Foto & Fisch-Analyse */}
        <div className="card space-y-3">
          <label className="block text-sm font-medium text-gray-700">Foto aufnehmen</label>
          {preview ? (
            <div className="relative">
              <img src={preview} alt="Vorschau" className="max-h-48 mx-auto rounded-lg object-contain" />
              {/* Foto loeschen Button */}
              <button
                type="button"
                onClick={handleDeletePhoto}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg transition-colors"
                title="Foto entfernen"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-colors"
            >
              <div className="space-y-1">
                <svg className="w-10 h-10 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm text-gray-500">Foto aufnehmen oder hochladen</p>
                <p className="text-xs text-gray-400">Art, Laenge & Herkunft werden automatisch erkannt</p>
              </div>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />

          {/* Analyse-Button */}
          {preview && !analysisApplied && !analyzing && (
            <button
              type="button"
              onClick={handleAnalyze}
              className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              Fisch analysieren (Art, Laenge, Herkunft)
            </button>
          )}

          {/* Analysiert-Hinweis */}
          {analyzing && (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-gray-500">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500" />
              Analysiere Art, Laenge & Herkunft...
            </div>
          )}

          {/* Analyse-Ergebnis */}
          {analysisResult && analysisResult.species !== 'unknown' && (
            <div className="space-y-2">
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-green-800">{analysisResult.speciesGerman}</span>
                    <span className="text-xs text-green-600 ml-2">
                      {Math.round(analysisResult.confidence * 100)}%
                    </span>
                  </div>
                  <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">erkannt</span>
                </div>
              </div>

              {/* Herkunft */}
              {analysisResult.origin && analysisResult.origin.type !== 'unklar' && (
                <div className={`rounded-lg p-3 border ${
                  analysisResult.origin.type === 'wildfisch'
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-orange-50 border-orange-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{analysisResult.origin.type === 'wildfisch' ? '🐟' : '🏭'}</span>
                      <span className={`font-bold text-sm ${
                        analysisResult.origin.type === 'wildfisch' ? 'text-emerald-800' : 'text-orange-800'
                      }`}>
                        {analysisResult.origin.type === 'wildfisch' ? 'Wildfisch' : 'Besatzfisch'}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      analysisResult.origin.confidence === 'hoch'
                        ? 'bg-green-100 text-green-700'
                        : analysisResult.origin.confidence === 'mittel'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}>
                      {confidenceLabels[analysisResult.origin.confidence] || 'Schaetzung'}
                    </span>
                  </div>
                  {analysisResult.origin.hint && (
                    <p className={`text-xs mt-1 ${
                      analysisResult.origin.type === 'wildfisch' ? 'text-emerald-600' : 'text-orange-600'
                    }`}>
                      {analysisResult.origin.hint}
                    </p>
                  )}
                </div>
              )}

              {/* Laenge */}
              {analysisResult.estimatedLength?.lengthCm && (
                <div className={`rounded-lg p-3 border ${confidenceColors[analysisResult.estimatedLength.confidence] || confidenceColors.niedrig}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold">~{analysisResult.estimatedLength.lengthCm} cm</span>
                    <span className="text-xs opacity-70">
                      {confidenceLabels[analysisResult.estimatedLength.confidence] || 'Schaetzung'}
                    </span>
                  </div>
                  {analysisResult.estimatedLength.hint && (
                    <p className="text-xs mt-1 opacity-70">{analysisResult.estimatedLength.hint}</p>
                  )}
                </div>
              )}

              {/* Schonzeit/Mindestmass-Warnung aus Analyse */}
              {analysisResult.closedSeasonWarning && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700 font-medium">{analysisResult.closedSeasonWarning}</p>
                </div>
              )}

              {analysisResult.minSizeWarning && (
                <div className={`border rounded-lg p-3 ${
                  analysisResult.estimatedLength?.lengthCm && analysisResult.minSizeCm && analysisResult.estimatedLength.lengthCm < analysisResult.minSizeCm
                    ? 'bg-red-50 border-red-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <p className={`text-sm font-medium ${
                    analysisResult.estimatedLength?.lengthCm && analysisResult.minSizeCm && analysisResult.estimatedLength.lengthCm < analysisResult.minSizeCm
                      ? 'text-red-700'
                      : 'text-yellow-700'
                  }`}>
                    {analysisResult.minSizeWarning}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Art nicht erkannt */}
          {analysisResult && analysisResult.species === 'unknown' && (
            <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
              <p className="text-sm text-yellow-700 font-medium">Art nicht erkannt</p>
              <p className="text-xs text-yellow-600 mt-0.5">{analysisResult.note} Bitte unten manuell auswaehlen.</p>
            </div>
          )}

          {/* Aktionen nach Analyse: Erneut analysieren / Neues Foto */}
          {analysisResult && !analyzing && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleReanalyze}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                Erneut analysieren
              </button>
              <button
                type="button"
                onClick={() => { handleDeletePhoto(); setTimeout(() => fileRef.current?.click(), 100); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
                Neues Foto
              </button>
            </div>
          )}
        </div>

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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fischart *
            {analysisApplied && <span className="text-green-600 text-xs ml-2">(automatisch erkannt)</span>}
          </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Laenge (cm)
              {analysisResult?.estimatedLength?.lengthCm && analysisApplied && (
                <span className="text-green-600 text-xs ml-1">(geschaetzt)</span>
              )}
            </label>
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
