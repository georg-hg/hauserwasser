import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { FISH_SPECIES } from '../../utils/fishSpecies';

export default function ImageUpload() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);
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
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const useResultForCatch = () => {
    const params = new URLSearchParams();
    if (result?.species && result.species !== 'unknown') {
      params.set('species', result.species);
    }
    if (result?.photoUrl) {
      params.set('photo', result.photoUrl);
    }
    if (result?.estimatedLength?.lengthCm) {
      params.set('length', result.estimatedLength.lengthCm);
    }
    navigate(`/fang/neu?${params.toString()}`);
  };

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

  return (
    <div className="max-w-lg mx-auto px-4 py-4 md:py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Fisch erkennen</h1>

      <div className="card space-y-4">
        {/* Upload */}
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-colors"
        >
          {preview ? (
            <img src={preview} alt="Vorschau" className="max-h-64 mx-auto rounded-lg object-contain" />
          ) : (
            <div className="space-y-2">
              <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm text-gray-500">Foto aufnehmen oder hochladen</p>
              <p className="text-xs text-gray-400">
                Tipp: Halte den Fisch so, dass deine Hand sichtbar ist
              </p>
            </div>
          )}
        </div>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />

        {/* Analyse-Button */}
        {preview && !result && (
          <button onClick={handleAnalyze} disabled={analyzing} className="btn-primary w-full flex items-center justify-center gap-2">
            {analyzing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                Analysiere Art & Länge...
              </>
            ) : (
              'Fisch analysieren'
            )}
          </button>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">{error}</div>
        )}

        {/* Ergebnis */}
        {result && result.species !== 'unknown' && (
          <div className="space-y-3">
            {/* Art */}
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <h3 className="font-bold text-green-800 text-lg">{result.speciesGerman}</h3>
              <p className="text-sm text-green-600 mt-0.5">
                {result.speciesLatin} &middot; Konfidenz: {Math.round(result.confidence * 100)}%
              </p>
            </div>

            {/* Geschätzte Länge */}
            {result.estimatedLength && result.estimatedLength.lengthCm && (
              <div className={`rounded-lg p-4 border ${confidenceColors[result.estimatedLength.confidence] || confidenceColors.niedrig}`}>
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-2">
                    <svg className="w-5 h-5 flex-shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h1m2 0h1m2 0h1m2 0h1m2 0h1m2 0h1m2 0h1M3 12v2m4-2v3m4-3v2m4-2v3m4-3v2" />
                    </svg>
                    <span className="text-2xl font-bold">~{result.estimatedLength.lengthCm} cm</span>
                  </div>
                  <span className="text-xs opacity-70">
                    {confidenceLabels[result.estimatedLength.confidence] || 'Schätzung'}
                  </span>
                </div>
                {result.estimatedLength.hint && (
                  <p className="text-xs mt-1 opacity-70">{result.estimatedLength.hint}</p>
                )}
              </div>
            )}

            {/* Länge nicht schätzbar */}
            {result.estimatedLength && !result.estimatedLength.lengthCm && result.estimatedLength.hint && (
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-500">
                  <span className="font-medium">Längenschätzung:</span> {result.estimatedLength.hint}
                </p>
              </div>
            )}

            {result.closedSeasonWarning && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700 font-medium">{result.closedSeasonWarning}</p>
              </div>
            )}

            {/* Mindestmaß-Warnung mit Längenvergleich */}
            {result.minSizeWarning && (
              <div className={`border rounded-lg p-3 ${
                result.estimatedLength?.lengthCm && result.minSizeCm && result.estimatedLength.lengthCm < result.minSizeCm
                  ? 'bg-red-50 border-red-200'
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <p className={`text-sm font-medium ${
                  result.estimatedLength?.lengthCm && result.minSizeCm && result.estimatedLength.lengthCm < result.minSizeCm
                    ? 'text-red-700'
                    : 'text-yellow-700'
                }`}>
                  {result.minSizeWarning}
                  {result.estimatedLength?.lengthCm && result.minSizeCm && result.estimatedLength.lengthCm < result.minSizeCm && (
                    <span className="block mt-1 text-red-600">
                      Geschätzte Länge (~{result.estimatedLength.lengthCm} cm) unter Mindestmaß! Bitte nachmessen und ggf. zurücksetzen.
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Alternative Ergebnisse */}
            {result.allResults?.length > 1 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Weitere Möglichkeiten:</p>
                <div className="space-y-1">
                  {result.allResults.slice(1, 4).map((r, i) => (
                    <div key={i} className="flex justify-between text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded">
                      <span>{r.local?.german || r.commonName || r.name}</span>
                      <span>{Math.round(r.score * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setResult(null); setPreview(null); }} className="btn-secondary flex-1">
                Nochmal
              </button>
              <button onClick={useResultForCatch} className="btn-primary flex-1">
                Als Fang eintragen
              </button>
            </div>
          </div>
        )}

        {/* Unbekannt */}
        {result && result.species === 'unknown' && (
          <div className="space-y-3">
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <p className="text-sm text-yellow-700 font-medium">Fischart konnte nicht erkannt werden.</p>
              <p className="text-xs text-yellow-600 mt-1">{result.note}</p>
            </div>

            {/* Auch bei unbekannter Art: Länge anzeigen falls verfügbar */}
            {result.estimatedLength && result.estimatedLength.lengthCm && (
              <div className={`rounded-lg p-4 border ${confidenceColors[result.estimatedLength.confidence] || confidenceColors.niedrig}`}>
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">~{result.estimatedLength.lengthCm} cm</span>
                  </div>
                  <span className="text-xs opacity-70">
                    {confidenceLabels[result.estimatedLength.confidence] || 'Schätzung'}
                  </span>
                </div>
                {result.estimatedLength.hint && (
                  <p className="text-xs mt-1 opacity-70">{result.estimatedLength.hint}</p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setResult(null); setPreview(null); }} className="btn-secondary flex-1 text-sm">
                Neues Foto
              </button>
              <button onClick={() => navigate('/fang/neu')} className="btn-primary flex-1 text-sm">
                Manuell eintragen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
