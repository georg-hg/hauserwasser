import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { TECHNIQUES } from '../../utils/fishSpecies';

export default function FishingDayForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fishingDate: new Date().toISOString().split('T')[0],
    technique: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const day = await api.post('/api/fishing-days', {
        fishingDate: form.fishingDate,
        technique: form.technique || null,
        notes: form.notes || null,
      });
      navigate(`/fischtag/${day.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 md:py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Neuer Fischtag</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">{error}</div>
        )}

        {/* Datum */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Datum *</label>
          <input
            type="date"
            value={form.fishingDate}
            onChange={update('fishingDate')}
            className="input-field"
            required
          />
        </div>

        {/* Methode */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Methode</label>
          <select value={form.technique} onChange={update('technique')} className="input-field">
            <option value="">Keine Angabe</option>
            {TECHNIQUES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Notizen */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notizen zum Fischtag</label>
          <textarea
            value={form.notes}
            onChange={update('notes')}
            rows={2}
            className="input-field"
            placeholder="z.B. Wasserstand, Wetter, Bedingungen..."
          />
        </div>

        {/* Info-Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-700">
            Nach dem Anlegen kannst du Fänge hinzufügen oder den Tag ohne Fang abschließen.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">
            Abbrechen
          </button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? 'Wird angelegt...' : 'Fischtag starten'}
          </button>
        </div>
      </form>
    </div>
  );
}
