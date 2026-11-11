// api.js — cliente HTTP hacia la API de FlowMoney.
// La cookie de sesión (httpOnly) la gestiona el navegador; aquí solo enviamos JSON.

const BASE = '/api';

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });

  // Sin sesión: llevamos al login (salvo que ya estemos ahí o sea /auth/me).
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (!location.pathname.endsWith('login.html')) location.href = 'login.html';
    throw new Error('No autenticado');
  }

  let data = null;
  try { data = await res.json(); } catch (e) { /* respuesta vacía */ }
  if (!res.ok) throw new Error((data && data.error) || `Error ${res.status}`);
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  put: (p, body) => request(p, { method: 'PUT', body }),
  del: (p) => request(p, { method: 'DELETE' }),

  // auth
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
};
