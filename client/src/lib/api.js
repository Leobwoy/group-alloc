export const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('rep_token');
}

export function setToken(token) {
  localStorage.setItem('rep_token', token);
}

export function clearToken() {
  localStorage.removeItem('rep_token');
}

export function isAuthenticated() {
  return !!getToken();
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

// Rep endpoints
export const repAPI = {
  register: (body) => request('/rep/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/rep/login', { method: 'POST', body: JSON.stringify(body) }),
  getClasses: () => request('/rep/classes'),
  createClass: (body) => request('/rep/classes', { method: 'POST', body: JSON.stringify(body) }),
  getClassGroups: (id) => request(`/rep/classes/${id}/groups`),
  exportCSV: (id) => `${API_BASE}/rep/classes/${id}/export`,
};

// Submit endpoints
export const submitAPI = {
  validateCode: (code) => request(`/submit/${code}`),
  submit: (code, body) => request(`/submit/${code}`, { method: 'POST', body: JSON.stringify(body) }),
};
