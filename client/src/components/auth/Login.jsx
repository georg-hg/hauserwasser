import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary-700 to-primary-900">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Hauserwasser</h1>
          <p className="text-primary-200 mt-1">Digitales Fangbuch</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="text-lg font-bold text-gray-800">Anmelden</h2>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
            <input
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field" placeholder="name@email.at"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
            <input
              type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field" placeholder="Mindestens 8 Zeichen"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Wird angemeldet...' : 'Anmelden'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Noch kein Konto?{' '}
            <Link to="/register" className="text-primary-600 hover:underline font-medium">
              Registrieren
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
