import { fetchJson } from './client';

const CACHE_KEY = 'ptsales:serialized-units-cache:v1';

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];
    return rows;
  } catch {
    return [];
  }
}

function writeCache(rows) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rows: rows.slice(-5000) }));
  } catch {}
}

function mergeRows(nextRows = []) {
  const map = new Map(readCache().map(row => [String(row._id), row]));
  (Array.isArray(nextRows) ? nextRows : []).forEach(row => {
    if (row?._id) map.set(String(row._id), { ...map.get(String(row._id)), ...row });
  });
  const merged = Array.from(map.values()).sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
  writeCache(merged);
  return merged;
}

function filterRows(params = {}) {
  const q = String(params.query || '').trim().toLowerCase();
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = Math.max(1, Number(params.pageSize || 30));
  const rows = readCache().filter(row => {
    if (params.productId && String(row.productId || '') !== String(params.productId)) return false;
    if (params.variantId && String(row.variantId || '') !== String(params.variantId)) return false;
    if (params.branchId && String(row.branchId || '') !== String(params.branchId)) return false;
    if (params.inventoryType && String(row.inventoryType || '') !== String(params.inventoryType)) return false;
    if (params.status && String(row.status || '') !== String(params.status)) return false;
    if (q) {
      const hay = `${row.imei || ''} ${row.serialNumber || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  return {
    rows: rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize),
    total: rows.length
  };
}

function reserveLocalUnit({ code = '', productId = '', variantId = '', branchId = '', inventoryType = '', reservationToken = '' }) {
  const rows = readCache();
  const match = rows.find(row => {
    if (branchId && String(row.branchId || '') !== String(branchId)) return false;
    if (inventoryType && String(row.inventoryType || '') !== String(inventoryType)) return false;
    if (productId && String(row.productId || '') !== String(productId)) return false;
    if (variantId && String(row.variantId || '') !== String(variantId)) return false;
    if (!['in_stock', 'reserved'].includes(String(row.status || ''))) return false;
    if (code) return String(row.imei || '') === String(code) || String(row.serialNumber || '') === String(code);
    return true;
  });
  if (!match) throw new Error('Serialized unit not available offline');
  if (String(match.status || '') === 'reserved' && match.reservationToken && String(match.reservationToken) !== String(reservationToken || '')) {
    throw new Error('Serialized unit already reserved offline');
  }
  const next = rows.map(row => String(row._id) === String(match._id) ? { ...row, status: 'reserved', reservationToken: String(reservationToken || ''), reservedAt: new Date().toISOString(), offlineCached: true } : row);
  writeCache(next);
  return next.find(row => String(row._id) === String(match._id));
}

function releaseLocalUnits({ unitIds = [], reservationToken = '' }) {
  if (!Array.isArray(unitIds) || unitIds.length === 0) return { count: 0 };
  let count = 0;
  const next = readCache().map(row => {
    if (!unitIds.map(String).includes(String(row._id))) return row;
    if (String(row.status || '') !== 'reserved') return row;
    if (reservationToken && row.reservationToken && String(row.reservationToken) !== String(reservationToken)) return row;
    count += 1;
    return { ...row, status: 'in_stock', reservationToken: '', reservedAt: null, offlineCached: true };
  });
  writeCache(next);
  return { count };
}

export function markSoldProductUnits(unitIds = []) {
  if (!Array.isArray(unitIds) || unitIds.length === 0) return;
  const next = readCache().map(row => unitIds.map(String).includes(String(row._id)) ? { ...row, status: 'sold', reservationToken: '', reservedAt: null, soldAt: new Date().toISOString(), offlineCached: true } : row);
  writeCache(next);
}

export function listProductUnits(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    query.set(key, String(value));
  });
  const qs = query.toString() ? `?${query.toString()}` : '';
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return Promise.resolve(filterRows(params));
  }
  return fetchJson(`/api/product-units${qs}`, { timeoutMs: 60000 }).then(result => {
    mergeRows(result?.rows || []);
    return result;
  });
}

export function bulkCreateProductUnits(body) {
  return fetchJson('/api/product-units/bulk-create', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 0
  });
}

export function reserveProductUnit(body) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return Promise.resolve(reserveLocalUnit(body || {}));
  }
  return fetchJson('/api/product-units/reserve', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 30000
  }).then(row => {
    mergeRows([row]);
    return row;
  });
}

export function scanProductUnit(body) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return Promise.resolve(reserveLocalUnit({ ...(body || {}), code: body?.imei || body?.code || '' }));
  }
  return fetchJson('/api/product-units/scan-imei', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 15000
  }).then(row => {
    mergeRows([row]);
    return row;
  });
}

export function releaseProductUnits(body) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return Promise.resolve(releaseLocalUnits(body || {}));
  }
  return fetchJson('/api/product-units/release', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 30000
  }).then(result => {
    releaseLocalUnits(body || {});
    return result;
  });
}

export function lookupProductUnit(code) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached = readCache().find(row => String(row.imei || '') === String(code) || String(row.serialNumber || '') === String(code));
    if (!cached) return Promise.reject(new Error('Serialized unit not found offline'));
    return Promise.resolve(cached);
  }
  return fetchJson(`/api/product-units/lookup/${encodeURIComponent(code)}`, { timeoutMs: 30000 }).then(row => {
    mergeRows([row]);
    return row;
  });
}
