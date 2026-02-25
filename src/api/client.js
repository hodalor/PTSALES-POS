const LS_KEY = 'apiBaseUrl';

export function getApiBase() {
  const fromLs = localStorage.getItem(LS_KEY);
  if (fromLs) return fromLs.replace(/\/+$/,'');
  return 'http://localhost:4000';
}

export function setApiBase(url) {
  if (url) localStorage.setItem(LS_KEY, url.replace(/\/+$/,''));
}

export async function fetchJson(path, opts = {}) {
  const base = getApiBase();
  let url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const method = (opts.method || 'GET').toUpperCase();
  if (method === 'GET') {
    url += (url.includes('?') ? '&' : '?') + `_=${Date.now()}`;
  }
  let roleHeader = {};
  try {
    const raw = localStorage.getItem('ptSales:state');
    if (raw) {
      const st = JSON.parse(raw);
      const role = st?.auth?.role;
      const user = st?.auth?.user?.name;
      if (role) roleHeader['X-Role'] = role;
      if (user) roleHeader['X-User'] = user;
    }
  } catch {}
  let authHeader = {};
  try {
    const token = localStorage.getItem('ptSales:authToken');
    if (token) authHeader['Authorization'] = `Bearer ${token}`;
  } catch {}
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', ...roleHeader, ...authHeader, ...(opts.headers || {}) },
    cache: 'no-store',
    ...opts
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let parsedError = '';
    try {
      const obj = JSON.parse(text);
      if (obj && typeof obj === 'object' && obj.error) parsedError = String(obj.error);
    } catch {}
    throw new Error(parsedError || text || `HTTP ${res.status}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}
