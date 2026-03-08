import { createContext, useState, useEffect } from 'react';
import { api } from '../api/client';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('hw_token');
    if (token) {
      api.get('/api/auth/me')
        .then((data) => setUser(data))
        .catch(() => localStorage.removeItem('hw_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('hw_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (userData) => {
    const data = await api.post('/api/auth/register', userData);
    localStorage.setItem('hw_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('hw_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
