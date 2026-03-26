import { fetchJson } from './client';

export async function createSale(sale) {
  return fetchJson('/api/sales', {
    method: 'POST',
    body: JSON.stringify(sale),
    timeoutMs: 60000
  });
}

export function list() {
  return fetchJson('/api/sales');
}
