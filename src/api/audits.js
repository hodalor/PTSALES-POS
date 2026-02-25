import { fetchJson } from './client';

export async function list(limit = 500) {
  return fetchJson(`/api/audits?limit=${encodeURIComponent(limit)}`, { method: 'GET' });
}

