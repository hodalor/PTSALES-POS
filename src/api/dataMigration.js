import { fetchJson } from './client';

export function exportAllData() {
  return fetchJson('/api/data-migration/export', { timeoutMs: 0 });
}

export function importAllData({ mode = 'merge', collections = {} } = {}) {
  return fetchJson('/api/data-migration/import', {
    method: 'POST',
    body: JSON.stringify({ mode, collections }),
    timeoutMs: 0
  });
}
