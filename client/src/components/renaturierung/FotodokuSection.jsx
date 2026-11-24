import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../api/client';

const API_URL = import.meta.env.VITE_API_URL ? `https://${import.meta.env.VITE_API_URL}` : '';

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('de-AT', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Fotodokumentation zum Trübungsmonitoring.
 * Alle sehen die Fotos (auch öffentlich unter /monitoring), nur Admins laden hoch, ändern und löschen.
 */
export default function FotodokuSection({ isAdmin }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [files, setFiles] = useState([]);
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState('');
  const [preferExif, setPreferExif] = useState(true);
  const [location, setLocation] = useState('Hauserwasser (Krems)');
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState(null); // { done, total }
  const [edit, setEdit] = useState(null); // { id, date, time, location, note }
  const [open, setOpen] = useState(null);
  const fileInput = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/api/monitoring-photos');
      setPhotos(data.photos || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!files.length || progress) return;
    setError(''); setMessage('');
    let saved = 0, skipped = 0;
    const failed = [];
    setProgress({ done: 0, total: files.length });
    // Einzeln hochladen: kleine Anfragen, sichtbarer Fortschritt
    for (let i = 0; i < files.length; i++) {
      const fd = new FormData();
      fd.append('photos', files[i]);
      fd.append('date', date);
      if (time) fd.append('time', time);
      if (preferExif) fd.append('preferExif', '1');
      if (location.trim()) fd.append('location', location.trim());
      if (note.trim()) fd.append('note', note.trim());
      try {
        const r = await api.upload('/api/monitoring-photos', fd);
        saved += r.saved || 0;
        skipped += r.skipped || 0;
        (r.failed || []).forEach((f) => failed.push(`${f.name}: ${f.error}`));
      } catch (err) {
        failed.push(`${files[i].name}: ${err.message}`);
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setProgress(null);
    setFiles([]); setNote('');
    if (fileInput.current) fileInput.current.value = '';
    const parts = [];
    if (saved) parts.push(`${saved} Foto${saved === 1 ? '' : 's'} gespeichert`);
    if (skipped) parts.push(`${skipped} bereits vorhanden`);
    setMessage(parts.join(', '));
    if (failed.length) setError(failed.join(' · '));
    load();
  }

  async function handleDelete(p) {
    if (!window.confirm(`Foto vom ${formatDay(p.date)}${p.time ? `, ${p.time} Uhr` : ''} endgültig löschen?`)) return;
    try {
      await api.delete(`/api/monitoring-photos/${p.id}`);
      setPhotos((list) => list.filter((x) => x.id !== p.id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    try {
      const r = await api.put(`/api/monitoring-photos/${edit.id}`, {
        date: edit.date, time: edit.time || null, location: edit.location, note: edit.note,
      });
      setPhotos((list) => list.map((x) => (x.id === edit.id ? r.photo : x)));
      setEdit(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const days = [];
  photos.forEach((p) => {
    const last = days[days.length - 1];
    if (last && last.date === p.date) last.items.push(p);
    else days.push({ date: p.date, items: [p] });
  });

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none';

  return (
    <div className="space-y-6">
      {isAdmin && (
        <form onSubmit={handleUpload} className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Fotos hochladen</h3>
            <p className="text-xs text-gray-500">
              Die Fotos erscheinen sofort öffentlich in der Fotodokumentation unter{' '}
              <a href="/monitoring" target="_blank" rel="noreferrer" className="text-emerald-700 underline">/monitoring</a>.
              Standortdaten (GPS) im Foto werden nicht veröffentlicht.
            </p>
          </div>
          <div className="p-4 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2 block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Fotos (mehrere möglich, je höchstens 25 MB)</span>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-emerald-700 hover:file:bg-emerald-100"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Datum</span>
              <input type="date" required value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Uhrzeit (optional)</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
            </label>
            <label className="sm:col-span-2 flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={preferExif} onChange={(e) => setPreferExif(e.target.checked)} className="mt-0.5 rounded border-gray-300 text-emerald-600" />
              <span>Aufnahmezeit aus dem Foto übernehmen, wenn sie darin gespeichert ist. Datum und Uhrzeit oben gelten dann nur als Ersatz.</span>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Ort (optional)</span>
              <input type="text" maxLength={160} value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Notiz (optional)</span>
              <input type="text" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. stark getrübt, Schaum" className={inputCls} />
            </label>
            <div className="sm:col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={!files.length || !!progress}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {progress ? `Lädt hoch … ${progress.done}/${progress.total}` : files.length > 1 ? `${files.length} Fotos hochladen` : 'Foto hochladen'}
              </button>
              {message && <span className="text-sm text-emerald-700">{message}</span>}
            </div>
          </div>
        </form>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
        </div>
      ) : days.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-sm text-gray-500">Noch keine Fotos vorhanden.</div>
      ) : (
        days.map((day) => (
          <section key={day.date} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-gray-700">{formatDay(day.date)}</h3>
              <span className="text-xs text-gray-500">{day.items.length} Foto{day.items.length === 1 ? '' : 's'}</span>
            </div>
            <div className="p-4 grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {day.items.map((p) => (
                <figure key={p.id} className="min-w-0">
                  <button type="button" onClick={() => setOpen(p)} className="block w-full aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <img src={`${API_URL}${p.thumb}`} alt={p.note || `Foto vom ${formatDay(p.date)}`} loading="lazy" className="w-full h-full object-cover" />
                  </button>
                  <figcaption className="mt-2 text-xs text-gray-600">
                    <span className="font-medium text-gray-800">{p.time ? `${p.time} Uhr` : 'ohne Uhrzeit'}</span>
                    {p.location ? ` · ${p.location}` : ''}
                    {p.note && <span className="block text-gray-500 break-words">{p.note}</span>}
                    {isAdmin && (
                      <span className="mt-1 flex gap-3">
                        <button type="button" onClick={() => setEdit({ id: p.id, date: p.date, time: p.time || '', location: p.location || '', note: p.note || '' })} className="text-emerald-700 hover:underline">Bearbeiten</button>
                        <button type="button" onClick={() => handleDelete(p)} className="text-red-600 hover:underline">Löschen</button>
                      </span>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <figure className="max-w-full max-h-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img src={`${API_URL}${open.image}`} alt={open.note || ''} className="max-w-full max-h-[82vh] rounded-lg" />
            <figcaption className="mt-3 text-sm text-white text-center">
              {formatDay(open.date)}{open.time ? `, ${open.time} Uhr` : ''}{open.location ? ` · ${open.location}` : ''}
              {open.note && <span className="block text-gray-300">{open.note}</span>}
            </figcaption>
            <button type="button" onClick={() => setOpen(null)} className="mt-3 px-4 py-1.5 rounded-lg bg-white/15 text-white text-sm hover:bg-white/25">Schließen</button>
          </figure>
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSaveEdit} className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-base font-semibold text-gray-800">Foto bearbeiten</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-medium text-gray-600 mb-1">Datum</span>
                <input type="date" required value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-gray-600 mb-1">Uhrzeit</span>
                <input type="time" value={edit.time} onChange={(e) => setEdit({ ...edit, time: e.target.value })} className={inputCls} />
              </label>
            </div>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Ort</span>
              <input type="text" maxLength={160} value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Notiz</span>
              <textarea rows={3} maxLength={1000} value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} className={inputCls} />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEdit(null)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Abbrechen</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">Speichern</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
