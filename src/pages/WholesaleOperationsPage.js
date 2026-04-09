import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useToast } from '../components/ToastProvider';
import { formatCurrency } from '../utils/currency';
import * as wholesaleApi from '../api/wholesale';
import { enqueueHttp, isOfflineBackupEnabled } from '../offline/offlineBackup';
import OfflineQueueIndicator from '../components/OfflineQueueIndicator';
import Modal from '../components/Modal';

const OPERATION_OPTIONS = [
  { key: 'purchase', label: 'Wholesale Purchase' },
  { key: 'transfer', label: 'Wholesale Transfer' },
  { key: 'adjustment', label: 'Wholesale Adjustment' },
  { key: 'refund', label: 'Wholesale Refund' }
];

function WholesaleOperationsPage({ operationType }) {
  const toast = useToast();
  const products = useSelector(s => s.products.products);
  const branches = useSelector(s => s.branches.branches);
  const settings = useSelector(s => s.settings);
  const auth = useSelector(s => s.auth);
  const currentBranchId = useSelector(s => s.settings.currentBranchId);
  const offlineBackupAllowed = isOfflineBackupEnabled(settings);
  const roleLower = String(auth.role || '').toLowerCase();
  const assigned = auth.user?.assignedBranches || 'all';

  const branchOptions = useMemo(() => {
    if (roleLower === 'superadmin' || roleLower === 'admin' || assigned === 'all') return branches;
    const ids = new Set(Array.isArray(assigned) ? assigned : [assigned]);
    return branches.filter(b => ids.has(b.id));
  }, [assigned, branches, roleLower]);

  const branchNameById = useMemo(() => {
    const map = new Map();
    branches.forEach(branch => map.set(branch.id, branch.name || branch.code || branch.id));
    return map;
  }, [branches]);

  const [statusFilter, setStatusFilter] = useState('pending_director');
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [decisionRemark, setDecisionRemark] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const [productId, setProductId] = useState(products[0]?.id || '');
  const [variantId, setVariantId] = useState('');
  const [branchId, setBranchId] = useState(currentBranchId || branchOptions[0]?.id || '');
  const [fromBranchId, setFromBranchId] = useState(currentBranchId || branchOptions[0]?.id || '');
  const [toBranchId, setToBranchId] = useState(branchOptions.find(branch => branch.id !== currentBranchId)?.id || branchOptions[0]?.id || '');
  const [fromInventoryType, setFromInventoryType] = useState('wholesale');
  const [toInventoryType, setToInventoryType] = useState('wholesale');
  const [qty, setQty] = useState(1);
  const [cost, setCost] = useState('');
  const [requestedAmount, setRequestedAmount] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('increase');
  const [supplier, setSupplier] = useState('');
  const [reason, setReason] = useState('');
  const [remark, setRemark] = useState('');

  const selectedProduct = useMemo(() => products.find(product => String(product.id) === String(productId)) || null, [productId, products]);
  const selectedVariant = useMemo(() => {
    if (!selectedProduct || !variantId) return null;
    return (selectedProduct.variants || []).find(v => String(v.id) === String(variantId)) || null;
  }, [selectedProduct, variantId]);
  const grants = Array.isArray(auth.grants) ? auth.grants : [];
  const canDirectorApprove = roleLower === 'superadmin' || roleLower === 'admin' || roleLower === 'director' || grants.includes('approve_wholesale_director') || grants.includes('approve_credit_director');
  const canManagerApprove = roleLower === 'superadmin' || roleLower === 'admin' || roleLower === 'manager' || grants.includes('approve_wholesale_manager') || grants.includes('approve_credit_manager');
  const defaultBranchIdRef = useRef(currentBranchId || branchOptions[0]?.id || '');
  const defaultTransferToBranchIdRef = useRef(branchOptions.find(branch => branch.id !== (currentBranchId || branchOptions[0]?.id))?.id || branchOptions[0]?.id || '');

  useEffect(() => {
    if (!productId && products[0]?.id) setProductId(products[0].id);
  }, [productId, products]);

  useEffect(() => {
    defaultBranchIdRef.current = currentBranchId || branchOptions[0]?.id || '';
    defaultTransferToBranchIdRef.current = branchOptions.find(branch => branch.id !== (currentBranchId || branchOptions[0]?.id))?.id || branchOptions[0]?.id || '';
  }, [branchOptions, currentBranchId]);

  useEffect(() => {
    if (!branchId && currentBranchId) setBranchId(currentBranchId);
    if (!fromBranchId && currentBranchId) setFromBranchId(currentBranchId);
    if (!toBranchId && branchOptions[0]?.id) {
      setToBranchId(branchOptions.find(branch => branch.id !== (currentBranchId || branchOptions[0]?.id))?.id || branchOptions[0]?.id || '');
    }
  }, [branchId, branchOptions, currentBranchId, fromBranchId, toBranchId]);

  useEffect(() => {
    setVariantId('');
    setCost('');
    setRequestedAmount('');
    setAdjustmentType('increase');
    setSupplier('');
    setReason('');
    setRemark('');
    setFromInventoryType(operationType === 'transfer' ? 'wholesale' : 'wholesale');
    if (operationType === 'transfer') {
      setFromBranchId(defaultBranchIdRef.current);
      setToBranchId(defaultTransferToBranchIdRef.current);
      setToInventoryType('wholesale');
    } else {
      setBranchId(defaultBranchIdRef.current);
    }
  }, [operationType]);

  const loadOperations = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await wholesaleApi.listOperations({ operationType, status: statusFilter });
      setOperations(Array.isArray(rows) ? rows : []);
    } catch (e) {
      const msg = String(e?.message || '');
      if (!/404|not found/i.test(msg)) {
        toast.show(msg || 'Failed to load wholesale operations', { type: 'error' });
      }
      setOperations([]);
    } finally {
      setLoading(false);
    }
  }, [operationType, statusFilter, toast]);

  useEffect(() => {
    loadOperations();
  }, [loadOperations]);

  function resetForm() {
    setVariantId('');
    setQty(1);
    setCost('');
    setRequestedAmount('');
    setAdjustmentType('increase');
    setSupplier('');
    setReason('');
    setRemark('');
  }

  function openReview(row) {
    setSelectedRow(row);
    setDecisionRemark('');
  }

  async function reviewAction(type) {
    if (!selectedRow || reviewing) return;
    const remark = String(decisionRemark || '').trim();
    if (!remark) {
      toast.show(type === 'approve' ? 'Approval remark is required' : 'Rejection remark is required', { type: 'error' });
      return;
    }
    setReviewing(true);
    try {
      const payload = {
        remark,
        reason: remark,
        approverName: auth.user?.name || auth.user?.username || 'unknown',
        approverRole: auth.role || ''
      };
      if (type === 'approve') await wholesaleApi.approveOperation(selectedRow, payload);
      else await wholesaleApi.rejectOperation(selectedRow, payload);
      toast.show(type === 'approve' ? 'Request updated' : 'Request rejected', { type: 'success' });
      setSelectedRow(null);
      setDecisionRemark('');
      await loadOperations();
    } catch (e) {
      toast.show(String(e?.message || `Failed to ${type} request`), { type: 'error' });
    } finally {
      setReviewing(false);
    }
  }

  async function submit() {
    if (saving) return;
    if (!productId) {
      toast.show('Select a product', { type: 'error' });
      return;
    }
    if (!Number.isFinite(Number(qty)) || Number(qty) <= 0) {
      toast.show('Quantity must be greater than zero', { type: 'error' });
      return;
    }
    if (!reason.trim()) {
      toast.show('Reason is required', { type: 'error' });
      return;
    }
    if (operationType === 'transfer') {
      if (!fromBranchId || !toBranchId) {
        toast.show('Select both source and destination branches', { type: 'error' });
        return;
      }
      if (fromBranchId === toBranchId) {
        toast.show('Source and destination branches must be different', { type: 'error' });
        return;
      }
    } else if (!branchId) {
      toast.show('Select a branch', { type: 'error' });
      return;
    }

    const clientId = `wholesale-${operationType}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const payload = {
      clientId,
      operationType,
      productId,
      variantId: variantId || undefined,
      qty: Number(qty),
      cost: Number(cost || 0),
      requestedAmount: Number(requestedAmount || 0),
      adjustmentType,
      supplier: supplier.trim(),
      reason: reason.trim(),
      remark: remark.trim(),
      branchId: operationType === 'transfer' ? undefined : branchId,
      fromBranchId: operationType === 'transfer' ? fromBranchId : undefined,
      toBranchId: operationType === 'transfer' ? toBranchId : undefined,
      fromInventoryType: operationType === 'transfer' ? fromInventoryType : 'wholesale',
      toInventoryType: operationType === 'transfer' ? toInventoryType : 'wholesale'
    };

    const optimistic = {
      ...payload,
      _id: clientId,
      initiatedByName: auth.user?.name || 'unknown',
      initiatedByRole: auth.role || '',
      status: 'pending_director',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setSaving(true);
    if (!navigator.onLine) {
      if (!offlineBackupAllowed) {
        toast.show('Offline: connect internet and try again.', { type: 'error' });
        setSaving(false);
        return;
      }
      try {
        await enqueueHttp({ collection: 'wholesaleoperations', label: `Wholesale ${operationType}`, path: '/api/wholesale/operations', method: 'POST', body: payload });
        setOperations(prev => [optimistic, ...prev]);
        resetForm();
        setIsCreateOpen(false);
        toast.show('Saved offline. Will sync when online.', { type: 'success' });
      } catch (e) {
        toast.show(String(e?.message || 'Failed to save offline'), { type: 'error' });
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      const response = await wholesaleApi.createOperation(payload);
      setOperations(prev => [response?.operation || optimistic, ...prev]);
      resetForm();
      setIsCreateOpen(false);
      toast.show('Wholesale request submitted for director approval', { type: 'success' });
    } catch (e) {
      toast.show(String(e?.message || 'Failed to submit wholesale request'), { type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <h1 style={{ margin: 0 }}>Wholesale Operations</h1>
          <div style={{ color: '#64748b', fontSize: 13 }}>Initiate wholesale purchases, transfers, adjustments, and refund restocks through the 2-step approval workflow.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <OfflineQueueIndicator collection="wholesaleoperations" label="Wholesale queued" />
          <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
            New Request
          </button>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <h2 className="section-title" style={{ margin: 0 }}>{OPERATION_OPTIONS.find(item => item.key === operationType)?.label}</h2>
        <div style={{ color: '#64748b', fontSize: 13 }}>
          Open the request modal to initiate a new {OPERATION_OPTIONS.find(item => item.key === operationType)?.label?.toLowerCase()} and then track director and manager approvals below.
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Request Tracking</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className={statusFilter === 'pending_director' ? 'btn btn-primary' : 'btn'} onClick={() => setStatusFilter('pending_director')}>Pending Director</button>
            <button className={statusFilter === 'pending_manager' ? 'btn btn-primary' : 'btn'} onClick={() => setStatusFilter('pending_manager')}>Pending Manager</button>
            <button className={statusFilter === 'approved' ? 'btn btn-primary' : 'btn'} onClick={() => setStatusFilter('approved')}>Approved</button>
            <button className={statusFilter === 'rejected' ? 'btn btn-primary' : 'btn'} onClick={() => setStatusFilter('rejected')}>Rejected</button>
            <button className="btn" onClick={loadOperations} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th align="left">Product</th>
                <th align="left">Route</th>
                <th align="left">Qty</th>
                <th align="left">Value</th>
                <th align="left">Status</th>
                <th align="left">Initiator</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan="6" style={{ padding: 12, color: '#64748b' }}>Loading…</td></tr>}
              {!loading && operations.map(row => {
                const product = products.find(item => String(item.id) === String(row.productId));
                const variantLabel = row.variantId ? ((product?.variants || []).find(variant => String(variant.id) === String(row.variantId))?.label || row.variantId) : '';
                const route = row.operationType === 'transfer'
                  ? `${branchNameById.get(row.fromBranchId || row.from) || row.fromBranchId || row.from || '—'} ${String(row.fromInventoryType || 'retail')} → ${branchNameById.get(row.toBranchId || row.to) || row.toBranchId || row.to || '—'} ${String(row.toInventoryType || 'retail')}`
                  : `${branchNameById.get(row.branchId) || row.branchId || '—'} • ${row.toInventoryType || row.fromInventoryType || 'wholesale'}`;
                const value = row.operationType === 'refund' ? Number(row.requestedAmount || 0) : Number(row.cost || 0);
                return (
                  <tr key={row._id || row.clientId} onClick={() => openReview(row)} style={{ cursor: 'pointer' }}>
                    <td>{product?.name || row.productId}{variantLabel ? ` • ${variantLabel}` : ''}</td>
                    <td>{route}</td>
                    <td>{Number(row.qty || 0)}</td>
                    <td>{value > 0 ? formatCurrency(value, settings) : '—'}</td>
                    <td>{row.status}</td>
                    <td>{row.initiatedByName || '—'} {row.initiatedByRole ? `(${row.initiatedByRole})` : ''}</td>
                  </tr>
                );
              })}
              {!loading && operations.length === 0 && <tr><td colSpan="6" style={{ padding: 12, color: '#64748b' }}>No wholesale requests yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateOpen && (
        <Modal
          title={OPERATION_OPTIONS.find(item => item.key === operationType)?.label || 'Wholesale Request'}
          onClose={() => setIsCreateOpen(false)}
          footer={(
            <>
              <button className="btn" onClick={() => setIsCreateOpen(false)} disabled={saving}>Close</button>
              <button className="btn btn-primary" onClick={submit} disabled={saving}>
                {saving ? 'Saving…' : 'Submit For Approval'}
              </button>
            </>
          )}
        >
          {selectedProduct && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
              <div>
                Retail: <strong>{formatCurrency(Number((selectedVariant || selectedProduct).retailPrice || selectedProduct.retailPrice || selectedProduct.price || 0), settings)}</strong>
              </div>
              <div>
                Wholesale: <strong>{formatCurrency(Number((selectedVariant || selectedProduct).wholesalePrice || selectedProduct.wholesalePrice || selectedProduct.price || 0), settings)}</strong>
              </div>
              <div>
                Agent: <strong>{formatCurrency(Number((selectedVariant || selectedProduct).agentPrice || selectedProduct.agentPrice || selectedProduct.price || 0), settings)}</strong>
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <label>
              <div style={{ marginBottom: 6, color: '#94a3b8' }}>Product</div>
              <select className="select" value={productId} onChange={e => setProductId(e.target.value)} style={{ width: '100%' }}>
                {products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </label>

            {(selectedProduct?.variants || []).length > 0 ? (
              <label>
                <div style={{ marginBottom: 6, color: '#94a3b8' }}>Variant</div>
                <select className="select" value={variantId} onChange={e => setVariantId(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Base</option>
                  {(selectedProduct?.variants || []).map(variant => <option key={variant.id} value={variant.id}>{variant.label}</option>)}
                </select>
              </label>
            ) : <div />}

            {operationType === 'transfer' ? (
              <>
                <label>
                  <div style={{ marginBottom: 6, color: '#94a3b8' }}>From Branch</div>
                  <select className="select" value={fromBranchId} onChange={e => setFromBranchId(e.target.value)} style={{ width: '100%' }}>
                    {branchOptions.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                </label>
                <label>
                  <div style={{ marginBottom: 6, color: '#94a3b8' }}>Source Inventory</div>
                  <select className="select" value={fromInventoryType} onChange={e => setFromInventoryType(e.target.value)} style={{ width: '100%' }}>
                    <option value="retail">Retail Inventory</option>
                    <option value="wholesale">Wholesale Inventory</option>
                  </select>
                </label>
                <label>
                  <div style={{ marginBottom: 6, color: '#94a3b8' }}>To Branch</div>
                  <select className="select" value={toBranchId} onChange={e => setToBranchId(e.target.value)} style={{ width: '100%' }}>
                    {branchOptions.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                </label>
                <label>
                  <div style={{ marginBottom: 6, color: '#94a3b8' }}>Destination Inventory</div>
                  <select className="select" value={toInventoryType} onChange={e => setToInventoryType(e.target.value)} style={{ width: '100%' }}>
                    <option value="wholesale">Wholesale Inventory</option>
                    <option value="retail">Retail Inventory</option>
                  </select>
                </label>
              </>
            ) : (
              <label>
                <div style={{ marginBottom: 6, color: '#94a3b8' }}>Branch</div>
                <select className="select" value={branchId} onChange={e => setBranchId(e.target.value)} style={{ width: '100%' }}>
                  {branchOptions.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </label>
            )}

            <label>
              <div style={{ marginBottom: 6, color: '#94a3b8' }}>Quantity</div>
              <input className="input" type="number" min="1" value={qty} onChange={e => setQty(Number(e.target.value))} />
            </label>

            {operationType === 'adjustment' ? (
              <label>
                <div style={{ marginBottom: 6, color: '#94a3b8' }}>Adjustment Type</div>
                <select className="select" value={adjustmentType} onChange={e => setAdjustmentType(e.target.value)} style={{ width: '100%' }}>
                  <option value="increase">Increase</option>
                  <option value="decrease">Decrease</option>
                </select>
              </label>
            ) : (
              <label>
                <div style={{ marginBottom: 6, color: '#94a3b8' }}>{operationType === 'refund' ? 'Refund Amount' : 'Cost'}</div>
                <input className="input" type="number" min="0" step="0.01" value={operationType === 'refund' ? requestedAmount : cost} onChange={e => operationType === 'refund' ? setRequestedAmount(e.target.value) : setCost(e.target.value)} />
              </label>
            )}

            {(operationType === 'purchase' || operationType === 'refund') && (
              <label>
                <div style={{ marginBottom: 6, color: '#94a3b8' }}>Supplier</div>
                <input className="input" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier or source" />
              </label>
            )}

            <label style={{ gridColumn: '1 / -1' }}>
              <div style={{ marginBottom: 6, color: '#94a3b8' }}>Reason</div>
              <input className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Why this wholesale operation is needed" />
            </label>

            <label style={{ gridColumn: '1 / -1' }}>
              <div style={{ marginBottom: 6, color: '#94a3b8' }}>Remark</div>
              <input className="input" value={remark} onChange={e => setRemark(e.target.value)} placeholder="Additional details for approvers" />
            </label>
          </div>
        </Modal>
      )}

      {selectedRow && (
        <Modal
          title="Request Review"
          onClose={() => { if (!reviewing) { setSelectedRow(null); setDecisionRemark(''); } }}
          footer={(
            <>
              <button className="btn" onClick={() => { setSelectedRow(null); setDecisionRemark(''); }} disabled={reviewing}>Close</button>
              {((selectedRow.status === 'pending_director' && canDirectorApprove) || (selectedRow.status === 'pending_manager' && canManagerApprove)) && (
                <>
                  <button className="btn" onClick={() => reviewAction('reject')} disabled={reviewing}>{reviewing ? 'Working…' : 'Reject'}</button>
                  <button className="btn btn-primary" onClick={() => reviewAction('approve')} disabled={reviewing}>{reviewing ? 'Working…' : 'Approve'}</button>
                </>
              )}
            </>
          )}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div><div style={{ color: '#94a3b8', fontSize: 12 }}>Status</div><strong>{selectedRow.status}</strong></div>
              <div><div style={{ color: '#94a3b8', fontSize: 12 }}>Initiator</div><strong>{selectedRow.initiatedByName || selectedRow.initiatorName || '—'}</strong></div>
              <div><div style={{ color: '#94a3b8', fontSize: 12 }}>Quantity</div><strong>{Number(selectedRow.qty || selectedRow.baseUnits || 0)}</strong></div>
              <div><div style={{ color: '#94a3b8', fontSize: 12 }}>Value</div><strong>{formatCurrency(Number(selectedRow.cost || selectedRow.requestedAmount || 0), settings)}</strong></div>
              <div><div style={{ color: '#94a3b8', fontSize: 12 }}>Source</div><strong>{branchNameById.get(selectedRow.fromBranchId || selectedRow.from || selectedRow.branchId) || selectedRow.fromBranchId || selectedRow.from || selectedRow.branchId || '—'}</strong></div>
              <div><div style={{ color: '#94a3b8', fontSize: 12 }}>Destination</div><strong>{branchNameById.get(selectedRow.toBranchId || selectedRow.to) || selectedRow.toBranchId || selectedRow.to || '—'}</strong></div>
              <div><div style={{ color: '#94a3b8', fontSize: 12 }}>From Inventory</div><strong>{selectedRow.fromInventoryType || 'retail'}</strong></div>
              <div><div style={{ color: '#94a3b8', fontSize: 12 }}>To Inventory</div><strong>{selectedRow.toInventoryType || selectedRow.fromInventoryType || 'wholesale'}</strong></div>
            </div>
            <div><div style={{ color: '#94a3b8', fontSize: 12 }}>Remark</div><strong>{selectedRow.remark || selectedRow.approvalRemark || selectedRow.rejectionRemark || '—'}</strong></div>
            <label>
              <div style={{ marginBottom: 6, color: '#94a3b8' }}>Approval / Rejection Remark</div>
              <textarea className="input" value={decisionRemark} onChange={e => setDecisionRemark(e.target.value)} rows={4} style={{ width: '100%', resize: 'vertical' }} />
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default WholesaleOperationsPage;
