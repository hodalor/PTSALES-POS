import { fetchJson } from './client';

export function list() {
  return fetchJson('/api/customers');
}
export function create(payload) {
  return fetchJson('/api/customers', { method: 'POST', body: JSON.stringify(payload) });
}
export function update(id, payload) {
  return fetchJson(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}
export function remove(id) {
  return fetchJson(`/api/customers/${id}`, { method: 'DELETE' });
}
