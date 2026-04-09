import { fetchJson } from './client';

export function listApprovals(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', String(params.status));
  if (params.actionType) query.set('actionType', String(params.actionType));
  if (params.referenceModel) query.set('referenceModel', String(params.referenceModel));
  const qs = query.toString() ? `?${query.toString()}` : '';
  return fetchJson(`/api/approvals${qs}`, { timeoutMs: 60000 });
}

export function approveApproval(id, body = {}) {
  return fetchJson(`/api/approvals/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 0
  });
}

export function rejectApproval(id, body = {}) {
  return fetchJson(`/api/approvals/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 0
  });
}
