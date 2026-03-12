import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';

const API_URL = import.meta.env.VITE_API_URL ? `https://${import.meta.env.VITE_API_URL}` : '';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [licenses, setLicenses] = useState([]);
  const [loadingLicenses, setLoadingLicenses] = useState(true);

  // Fischerkarte Wallet
  const [cardUrl, setCardUrl] = useState(null);
  const [cardUploading, setCardUploading] = useState(false);
  const [cardFullscreen, setCardFullscreen] = useState(false);
  const cardInputRef = useRef(null);

  // Passwort-Form
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMessage, setPwMessage] = useState(null);
  const [pwError, setPwError] = useState(null);
  const [saving, setSaving] = useState(false);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    api.get('/api/auth/license')
      .then(data => setLicenses(data.licenses))
      .catch(console.error)
      .finally(() => setLoadingLicenses(false));
  }, []);

  // Fischerkarte aus User-Daten laden
  useEffect(() => {
    if (user?.fisherCardUrl) setCardUrl(user.fisherCardUrl);
  }, [user]);

  const handleCardUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCardUploading(true);
    try {
      const formData = new FormData();
      formData.append('card', file);
      const data = await api.upload('/api/auth/fisher-card', formData);
      setCardUrl(data.fisherCardUrl);
      if (refreshUser) refreshUser();
    } catch (err) {
      alert('Upload fehlgeschlagen: ' + err.message);
    } finally {
      setCardUploading(false);
      if (cardInputRef.current) cardInputRef.current.value = '';
    }
  };

  const handleCardDelete = async () => {
    if (!confirm('Fischerkarte wirklich entfernen?')) return;
    try {
      await api.delete('/api/auth/fisher-card');
      setCardUrl(null);
      if (refreshUser) refreshUser();
    } catch (err) {
      alert('Löschen fehlgeschlagen: ' + err.message);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwMessage(null);
    setPwError(null);

    if (newPw !== confirmPw) {
      setPwError('Passwörter stimmen nicht überein.');
      return;
    }
    if (newPw.length < 8) {
      setPwError('Neues Passwort muss mindestens 8 Zeichen haben.');
      return;
    }

    setSaving(true);
    try {
      const data = await api.put('/api/auth/password', {
        currentPassword: currentPw,
        newPassword: newPw,
      });
      setPwMessage(data.message);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      setPwError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const activeLicense = licenses.find(l => l.seasonYear === currentYear && l.active);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Mein Profil</h1>

      {/* Persönliche Daten */}
      <section className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Persönliche Daten</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Name</span>
            <p className="font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
          </div>
          <div>
            <span className="text-gray-500">E-Mail</span>
            <p className="font-medium text-gray-900">{user?.email}</p>
          </div>
          {user?.fisherCardNr && (
            <div>
              <span className="text-gray-500">Fischerkarten-Nr.</span>
              <p className="font-medium text-gray-900">{user.fisherCardNr}</p>
            </div>
          )}
          <div>
            <span className="text-gray-500">Rolle</span>
            <p className="font-medium text-gray-900 capitalize">{user?.role}</p>
          </div>
        </div>
      </section>

      {/* Fischereiberechtigung / Lizenz-Status */}
      <section className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Fischereiberechtigung</h2>

        {loadingLicenses ? (
          <div className="flex items-center gap-2 text-gray-400">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500" />
            Lade Lizenz-Status...
          </div>
        ) : activeLicense ? (
          <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-green-800">
                Hauserwasser {activeLicense.seasonYear} — Freigeschaltet
              </p>
              <p className="text-sm text-green-700 mt-1">
                Jahreslizenz aktiv seit {new Date(activeLicense.activatedAt).toLocaleDateString('de-AT')}.
                Revier: Krems samt Fischlmayrbach (ON 30/5 BH Linz-Land).
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-6 h-6 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-amber-800">
                Hauserwasser {currentYear} — Nicht freigeschaltet
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Deine Jahreslizenz für {currentYear} wurde noch nicht vom Revierverwalter freigeschaltet.
                Bitte wende dich an den Administrator.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Fischerkarte Wallet */}
      <section className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
          </svg>
          Meine Fischerkarte
        </h2>

        {cardUrl ? (
          <div className="space-y-3">
            {/* Vorschau */}
            <div
              className="relative rounded-lg overflow-hidden border border-gray-200 cursor-pointer group"
              onClick={() => setCardFullscreen(true)}
            >
              <img
                src={`${API_URL}${cardUrl}`}
                alt="Fischerkarte"
                className="w-full h-auto max-h-48 object-contain bg-gray-50"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                  Vollbild anzeigen
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setCardFullscreen(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
                Vorzeigen
              </button>
              <button
                onClick={() => cardInputRef.current?.click()}
                disabled={cardUploading}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Ersetzen
              </button>
              <button
                onClick={handleCardDelete}
                className="px-4 py-2.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
              >
                Löschen
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => cardInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-colors"
          >
            <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            <p className="text-sm font-medium text-gray-700">
              {cardUploading ? 'Wird hochgeladen...' : 'Fischerkarte fotografieren oder hochladen'}
            </p>
            <p className="text-xs text-gray-500 mt-1">JPG, PNG oder HEIC</p>
          </div>
        )}

        <input
          ref={cardInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleCardUpload}
          className="hidden"
        />
      </section>

      {/* Fullscreen Fischerkarte */}
      {cardFullscreen && cardUrl && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" onClick={() => setCardFullscreen(false)}>
          <div className="flex items-center justify-between px-4 py-3 bg-black/80">
            <h3 className="text-white font-medium text-sm">Fischerkarte</h3>
            <button
              onClick={() => setCardFullscreen(false)}
              className="text-white/80 hover:text-white text-2xl font-bold leading-none"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={`${API_URL}${cardUrl}`}
              alt="Fischerkarte"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Schnellzugriff */}
      <section className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Schnellzugriff</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/regeln"
            className="flex items-center gap-3 p-3 rounded-lg bg-primary-50 border border-primary-200 hover:bg-primary-100 transition-colors"
          >
            <svg className="w-6 h-6 text-primary-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-primary-900">Fischereiordnung</p>
              <p className="text-xs text-primary-600">Regeln & Vorschriften</p>
            </div>
          </Link>
          <Link
            to="/schonzeiten"
            className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
          >
            <svg className="w-6 h-6 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-900">Schonzeiten</p>
              <p className="text-xs text-amber-600">Aktuelle Schonzeiten</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Passwort ändern */}
      <section className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Passwort ändern</h2>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Aktuelles Passwort</label>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Neues Passwort</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Neues Passwort bestätigen</label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            />
          </div>

          {pwError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{pwError}</p>
          )}
          {pwMessage && (
            <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">{pwMessage}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700
                       disabled:opacity-50 transition-colors text-sm font-medium"
          >
            {saving ? 'Speichern...' : 'Passwort ändern'}
          </button>
        </form>
      </section>
    </div>
  );
}
