import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '',
    birthDate: '', fisherCardNr: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-primary-700 to-primary-900">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Hauserwasser</h1>
          <p className="text-primary-200 mt-1">Konto erstellen</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vorname *</label>
              <input type="text" required value={form.firstName} onChange={update('firstName')} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nachname *</label>
              <input type="text" required value={form.lastName} onChange={update('lastName')} className="input-field" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail *</label>
            <input type="email" required value={form.email} onChange={update('email')} className="input-field" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort *</label>
            <input type="password" required minLength={8} value={form.password} onChange={update('password')} className="input-field" placeholder="Mind. 8 Zeichen" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Geburtsdatum</label>
              <input type="date" value={form.birthDate} onChange={update('birthDate')} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fischerkarte Nr.</label>
              <input type="text" value={form.fisherCardNr} onChange={update('fisherCardNr')} className="input-field" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Wird registriert...' : 'Registrieren'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Schon ein Konto?{' '}
            <Link to="/login" className="text-primary-600 hover:underline font-medium">
              Anmelden
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
