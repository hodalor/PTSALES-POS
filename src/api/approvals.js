import { fetchJson } from './client';

const approvalsCache = new Map();
const APPROVALS_TTL_MS = 5000;

function approvalsKey(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', String(params.status));
  if (params.actionType) query.set('actionType', String(params.actionType));
  if (params.referenceModel) query.set('referenceModel', String(params.referenceModel));
  return query.toString() ? `?${query.toString()}` : '';
}

function invalidateApprovalsCache() {
  approvalsCache.clear();
}

export function listApprovals(params = {}) {
  const qs = approvalsKey(params);
  const now = Date.now();
  const cached = approvalsCache.get(qs);
  if (cached && cached.data && cached.expiresAt > now) return Promise.resolve(cached.data);
  if (cached?.promise) return cached.promise;
  const promise = fetchJson(`/api/approvals${qs}`, { timeoutMs: 60000 }).then(data => {
    approvalsCache.set(qs, { data, expiresAt: Date.now() + APPROVALS_TTL_MS });
    return data;
  }).finally(() => {
    const latest = approvalsCache.get(qs);
    if (latest?.promise) approvalsCache.set(qs, { data: latest.data, expiresAt: latest.expiresAt || 0 });
  });
  approvalsCache.set(qs, { ...cached, promise, expiresAt: now + APPROVALS_TTL_MS });
  return promise;
}

export function approveApproval(id, body = {}) {
  return fetchJson(`/api/approvals/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 0
  }).finally(() => invalidateApprovalsCache());
}

export function rejectApproval(id, body = {}) {
  return fetchJson(`/api/approvals/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 0
  }).finally(() => invalidateApprovalsCache());
}
