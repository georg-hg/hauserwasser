const API_URL = import.meta.env.VITE_API_URL
  ? `https://${import.meta.env.VITE_API_URL}`
  : '';

/**
 * Fetch-Wrapper mit JWT-Auth
 */
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('hw_token');

  const config = {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {} // Browser setzt Content-Type mit Boundary
        : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  };

  if (options.body && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
  }

  const res = await fetch(`${API_URL}${endpoint}`, config);

  if (res.status === 401) {
    localStorage.removeItem('hw_token');
    window.location.href = '/login';
    throw new Error('Sitzung abgelaufen.');
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Ein Fehler ist aufgetreten.');
  }

  return data;
}

export const api = {
  get: (url) => request(url),
  post: (url, body) => request(url, { method: 'POST', body }),
  put: (url, body) => request(url, { method: 'PUT', body }),
  delete: (url) => request(url, { method: 'DELETE' }),

  // Für File-Uploads (FormData)
  upload: (url, formData) =>
    request(url, { method: 'POST', body: formData }),
};
