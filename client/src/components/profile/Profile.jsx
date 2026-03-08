import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';

export default function Profile() {
  const { user } = useAuth();
  const [licenses, setLicenses] = useState([]);
  const [loadingLicenses, setLoadingLicenses] = useState(true);

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
