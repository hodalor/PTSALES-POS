import { fetchJson } from './client';

export function list({ branchId, from, to } = {}) {
  const params = new URLSearchParams();
  if (branchId) params.set('branchId', branchId);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return fetchJson(`/api/expenses${qs ? `?${qs}` : ''}`);
}

export function create(payload) {
  return fetchJson('/api/expenses', { method: 'POST', body: JSON.stringify(payload) });
}

export function update(id, payload) {
  return fetchJson(`/api/expenses/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function remove(id) {
  return fetchJson(`/api/expenses/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

