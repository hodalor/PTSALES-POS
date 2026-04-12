import { fetchJson } from './client';

export function listProductUnits(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    query.set(key, String(value));
  });
  const qs = query.toString() ? `?${query.toString()}` : '';
  return fetchJson(`/api/product-units${qs}`, { timeoutMs: 60000 });
}

export function bulkCreateProductUnits(body) {
  return fetchJson('/api/product-units/bulk-create', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 0
  });
}

export function reserveProductUnit(body) {
  return fetchJson('/api/product-units/reserve', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 30000
  });
}

export function releaseProductUnits(body) {
  return fetchJson('/api/product-units/release', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 30000
  });
}

export function lookupProductUnit(code) {
  return fetchJson(`/api/product-units/lookup/${encodeURIComponent(code)}`, { timeoutMs: 30000 });
}
