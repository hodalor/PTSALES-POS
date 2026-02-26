import { fetchJson } from '../api/client';
import { createSale } from '../api/sales';

export async function syncQueuedItem(item) {
  if (!item) return;
  if (item.type === 'http') {
    const p = item.payload || {};
    const method = String(p.method || 'POST').toUpperCase();
    const path = String(p.path || '');
    const body = p.body;
    if (!path) throw new Error('Missing path');
    const opts = { method };
    if (method !== 'GET') opts.body = JSON.stringify(body ?? {});
    await fetchJson(path, opts);
    return;
  }
  if (item.type === 'sale') {
    await createSale(item.payload);
  }
}

