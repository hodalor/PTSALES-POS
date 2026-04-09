import { fetchJson } from './client';

export function listCreditSales(params = {}) {
  const query = new URLSearchParams();
  if (params.customerId) query.set('customerId', String(params.customerId));
  if (params.status) query.set('status', String(params.status));
  const qs = query.toString() ? `?${query.toString()}` : '';
  return fetchJson(`/api/credits/sales${qs}`, { timeoutMs: 60000 });
}

export function listCreditCustomers() {
  return fetchJson('/api/credits/customers', { timeoutMs: 60000 });
}

export function getCustomerCreditSummary(id) {
  return fetchJson(`/api/credits/customers/${encodeURIComponent(id)}/summary`, { timeoutMs: 60000 });
}

export function listRepayments(params = {}) {
  const query = new URLSearchParams();
  if (params.customerId) query.set('customerId', String(params.customerId));
  if (params.status) query.set('status', String(params.status));
  const qs = query.toString() ? `?${query.toString()}` : '';
  return fetchJson(`/api/credits/repayments${qs}`, { timeoutMs: 60000 });
}

export function createRepayment(body) {
  return fetchJson('/api/credits/repayments', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 0
  });
}
