import { fetchJson } from './client';

export function list(limit = 500) {
  return fetchJson(`/api/audits?limit=${encodeURIComponent(limit)}`);
}

export function remove(id) {
  return fetchJson(`/api/audits/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}
