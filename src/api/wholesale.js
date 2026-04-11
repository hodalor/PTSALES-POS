import { fetchJson } from './client';
import * as purchasesApi from './purchases';
import * as transfersApi from './transfers';
import * as adjustmentsApi from './adjustments';
import * as refundsApi from './refunds';

function toLegacyStatus(status = '') {
  const raw = String(status || '').toLowerCase();
  if (raw === 'pending_director' || raw === 'pending_manager') return 'pending';
  return raw;
}

function normalizeLegacyOperation(row, operationType) {
  if (!row) return row;
  const status = String(row.status || '').toLowerCase();
  return {
    ...row,
    operationType,
    status: status === 'pending_approval' ? 'pending_director' : status,
    approvalMode: 'legacy'
  };
}

function normalizeModernOperation(row, operationType) {
  if (!row) return row;
  return {
    ...row,
    operationType,
    approvalMode: 'workflow'
  };
}

export function listOperations(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', String(params.status));
  if (params.operationType) query.set('operationType', String(params.operationType));
  if (params.operationArea) query.set('operationArea', String(params.operationArea));
  const qs = query.toString() ? `?${query.toString()}` : '';
  return fetchJson(`/api/wholesale/operations${qs}`).then(rows => {
    return (Array.isArray(rows) ? rows : []).map(row => normalizeModernOperation(row, params.operationType));
  }).catch(async (error) => {
    const msg = String(error?.message || '');
    if (!/404|not found/i.test(msg)) throw error;
    const status = toLegacyStatus(params.status);
    if (params.operationType === 'purchase') {
      const rows = await purchasesApi.listRequests({ status, limit: 200 });
      return (Array.isArray(rows) ? rows : []).map(row => normalizeLegacyOperation(row, 'purchase'));
    }
    if (params.operationType === 'transfer') {
      const rows = await transfersApi.listRequests({ status, limit: 200 });
      return (Array.isArray(rows) ? rows : []).map(row => normalizeLegacyOperation(row, 'transfer'));
    }
    if (params.operationType === 'adjustment') {
      const rows = await adjustmentsApi.listRequests({ status, limit: 200 });
      return (Array.isArray(rows) ? rows : []).map(row => normalizeLegacyOperation(row, 'adjustment'));
    }
    if (params.operationType === 'refund') {
      if (String(params.operationArea || 'wholesale') === 'warehouse') return [];
      const rows = await refundsApi.listRequests();
      return (Array.isArray(rows) ? rows : [])
        .filter(row => !status || status === 'approved' || status === 'rejected' ? String(row.status || '').toLowerCase() === status : String(row.status || '').toLowerCase() === 'pending_approval')
        .map(row => normalizeLegacyOperation(row, 'refund'));
    }
    return [];
  });
}

export function createOperation(body) {
  return fetchJson('/api/wholesale/operations', {
    method: 'POST',
    body: JSON.stringify(body)
  }).catch(async (error) => {
    const msg = String(error?.message || '');
    if (!/404|not found/i.test(msg)) throw error;
    if (String(body?.operationArea || 'wholesale') === 'warehouse') throw error;
    const operationType = String(body?.operationType || '').toLowerCase();
    if (operationType === 'purchase') {
      const payload = {
        clientId: body.clientId,
        productId: body.productId,
        variantId: body.variantId || null,
        branchId: body.branchId,
        baseUnits: Number(body.qty || 0),
        supplier: body.supplier || '',
        cost: Number(body.cost || 0),
        costPerUnit: Number(body.cost || 0),
        remark: body.reason ? `${body.reason}${body.remark ? ` | ${body.remark}` : ''}` : (body.remark || '')
      };
      const row = await purchasesApi.createRequest(payload);
      return { operation: normalizeLegacyOperation(row, 'purchase') };
    }
    if (operationType === 'transfer') {
      const payload = {
        clientId: body.clientId,
        productId: body.productId,
        variantId: body.variantId || null,
        from: body.fromBranchId,
        to: body.toBranchId,
        qty: Number(body.qty || 0),
        remark: body.reason ? `${body.reason}${body.remark ? ` | ${body.remark}` : ''}` : (body.remark || '')
      };
      const row = await transfersApi.createRequest(payload);
      return { operation: normalizeLegacyOperation(row, 'transfer') };
    }
    if (operationType === 'adjustment') {
      const delta = String(body.adjustmentType || 'increase') === 'decrease'
        ? -Math.abs(Number(body.qty || 0))
        : Math.abs(Number(body.qty || 0));
      const payload = {
        clientId: body.clientId,
        productId: body.productId,
        variantId: body.variantId || null,
        branchId: body.branchId,
        delta,
        remark: body.reason ? `${body.reason}${body.remark ? ` | ${body.remark}` : ''}` : (body.remark || '')
      };
      const row = await adjustmentsApi.createRequest(payload);
      return { operation: normalizeLegacyOperation(row, 'adjustment') };
    }
    if (operationType === 'refund') {
      const payload = {
        clientId: body.clientId,
        productId: body.productId,
        variantId: body.variantId || null,
        branchId: body.branchId,
        requestedAmount: Number(body.requestedAmount || 0),
        initiatorName: '',
        initiatorRole: '',
        type: 'wholesale',
        remark: body.reason ? `${body.reason}${body.remark ? ` | ${body.remark}` : ''}` : (body.remark || ''),
        supplier: body.supplier || '',
        qty: Number(body.qty || 0)
      };
      const row = await refundsApi.createRequest(payload);
      return { operation: normalizeLegacyOperation(row, 'refund') };
    }
    throw error;
  });
}

export function approveOperation(row, body = {}) {
  const mode = String(row?.approvalMode || '');
  if (mode === 'workflow' && row?.approvalId) {
    return fetchJson(`/api/approvals/${encodeURIComponent(row.approvalId)}/approve`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }
  const payloadBase = {
    id: row?._id || row?.clientId,
    approverName: body.approverName || '',
    approverRole: body.approverRole || '',
    remark: body.remark || ''
  };
  if (row?.operationType === 'purchase') return purchasesApi.approve(payloadBase);
  if (row?.operationType === 'transfer') return transfersApi.approve(payloadBase);
  if (row?.operationType === 'adjustment') return adjustmentsApi.approve({ id: payloadBase.id, remark: payloadBase.remark });
  if (row?.operationType === 'refund') {
    return refundsApi.approve({
      id: payloadBase.id,
      approverName: payloadBase.approverName,
      approverRole: payloadBase.approverRole,
      approvalRemark: payloadBase.remark,
      restockMode: 'none'
    });
  }
  throw new Error('Unsupported operation');
}

export function rejectOperation(row, body = {}) {
  const mode = String(row?.approvalMode || '');
  if (mode === 'workflow' && row?.approvalId) {
    return fetchJson(`/api/approvals/${encodeURIComponent(row.approvalId)}/reject`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }
  const payloadBase = {
    id: row?._id || row?.clientId,
    approverName: body.approverName || '',
    approverRole: body.approverRole || '',
    remark: body.remark || ''
  };
  if (row?.operationType === 'purchase') return purchasesApi.reject(payloadBase);
  if (row?.operationType === 'transfer') return transfersApi.reject(payloadBase);
  if (row?.operationType === 'adjustment') return adjustmentsApi.reject({ id: payloadBase.id, remark: payloadBase.remark });
  if (row?.operationType === 'refund') {
    return refundsApi.reject({
      id: payloadBase.id,
      approverName: payloadBase.approverName,
      approverRole: payloadBase.approverRole,
      remark: payloadBase.remark
    });
  }
  throw new Error('Unsupported operation');
}
