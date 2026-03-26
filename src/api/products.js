import { fetchJson } from './client';

export function list() {
  return fetchJson('/api/products');
}
export function create(payload) {
  return fetchJson('/api/products', { method: 'POST', body: JSON.stringify(payload) });
}
export function update(id, payload) {
  return fetchJson(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(payload), timeoutMs: 60000 });
}
export function remove(id) {
  return fetchJson(`/api/products/${id}`, { method: 'DELETE' });
}
