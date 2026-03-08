import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

export function useCatches(options = {}) {
  const [catches, setCatches] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCatches = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/api/catches?limit=100');
      setCatches(data.catches);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.get('/api/catches/stats');
      setStats(data);
    } catch (err) {
      console.error('Stats error:', err);
    }
  }, []);

  const addCatch = async (formData) => {
    const data = await api.upload('/api/catches', formData);
    setCatches((prev) => [data, ...prev]);
    await fetchStats(); // Quoten aktualisieren
    return data;
  };

  const deleteCatch = async (id) => {
    await api.delete(`/api/catches/${id}`);
    setCatches((prev) => prev.filter((c) => c.id !== id));
    await fetchStats();
  };

  useEffect(() => {
    fetchCatches();
    fetchStats();
  }, [fetchCatches, fetchStats]);

  return {
    catches, stats, loading, error,
    addCatch, deleteCatch, refresh: fetchCatches,
  };
}
