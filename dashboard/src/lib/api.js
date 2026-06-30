let rawBase = process.env.NEXT_PUBLIC_API_URL || 'https://linkedin-crm-y0bz.onrender.com/api';
rawBase = rawBase.trim().replace(/\/+$/, '');
const BASE = rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`;

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('warmdm_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

function handleAuthError(res) {
  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('warmdm_token');
    if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
      window.location.href = '/login';
    }
  }
}

export async function fetcher(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: getHeaders(),
  });
  handleAuthError(res);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  handleAuthError(res);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function patch(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  handleAuthError(res);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function del(path) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  handleAuthError(res);
  try { return res.json(); } catch { return null; }
}
