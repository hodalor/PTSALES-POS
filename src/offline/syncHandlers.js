import { fetchJson } from '../api/client';
import { createSale } from '../api/sales';
import { ensureOnlineJwt, reauthIf401 } from './reAuth';

export async function syncQueuedItem(item) {
  if (!item) return;
  if (item.type === 'http') {
    const p = item.payload || {};
    const method = String(p.method || 'POST').toUpperCase();
    const path = String(p.path || '');
    const body = p.body;
    if (!path) throw new Error('Missing path');
    const opts = { method, timeoutMs: 60000 };
    if (method !== 'GET') opts.body = JSON.stringify(body ?? {});
    await ensureOnlineJwt();
    try {
      await fetchJson(path, opts);
    } catch (e) {
      const retried = await reauthIf401(e);
      if (retried) {
        await fetchJson(path, opts);
        return;
      }
      throw e;
    }
    return;
  }
  if (item.type === 'sale') {
    await createSale(item.payload);
  }
}
