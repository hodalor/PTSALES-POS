import { fetchJson } from './client';

export function listRequests() {
  return fetchJson('/api/purchases/requests', { timeoutMs: 60000 });
}

export function createRequest(payload) {
  return fetchJson('/api/purchases/requests', {
    method: 'POST',
    body: JSON.stringify(payload),
    timeoutMs: 60000
  });
}

export function approve(payload) {
  return fetchJson('/api/purchases/approve', {
    method: 'POST',
    body: JSON.stringify(payload),
    timeoutMs: 60000
  });
}

export function reject(payload) {
  return fetchJson('/api/purchases/reject', {
    method: 'POST',
    body: JSON.stringify(payload),
    timeoutMs: 60000
  });
}
