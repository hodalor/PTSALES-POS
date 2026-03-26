import { useDispatch, useSelector } from 'react-redux';
import { useMemo, useState, useEffect } from 'react';
import { adjustStock } from '../store/productsSlice';
import { useToast } from '../components/ToastProvider';
import BranchSelect from '../components/BranchSelect';
import { addAudit } from '../store/auditSlice';
import { formatCurrency } from '../utils/currency';
import { useSelector as useReduxSelector } from 'react-redux';
import { exportCsv, exportTablePdf } from '../utils/exporters';
import * as purchasesApi from '../api/purchases';
import { enqueueHttp, isOfflineBackupEnabled } from '../offline/offlineBackup';
import OfflineQueueIndicator from '../components/OfflineQueueIndicator';
import { approvePurchase, createPurchaseRequest, rejectPurchase } from '../store/purchasesSlice';
import Modal from '../components/Modal';

function PurchasesPage() {
  const products = useSelector(s => s.products.products);
  const branches = useSelector(s => s.branches.branches);
  const currentBranchId = useSelector(s => s.settings.currentBranchId);
  const settings = useSelector(s => s.settings);
  const auth = useSelector(s => s.auth);
  const audit = useSelector(s => s.audit.entries);
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [branchId, setBranchId] = useState(currentBranchId);
  const [qty, setQty] = useState(1);
  const [packName, setPackName] = useState('');
  const [variantId, setVariantId] = useState('');
  const [supplier, setSupplier] = useState('');
  const [cost, setCost] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [note, setNote] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [fActor, setFActor] = useState('');
  const [fBranch, setFBranch] = useState(currentBranchId);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('initiate'); // initiate | approvals
  const [openModal, setOpenModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending'); // pending | approved | rejected
  const [detail, setDetail] = useState(null);
  const dispatch = useDispatch();
  const toast = useToast();
  const offlineBackupAllowed = isOfflineBackupEnabled(settings);
  useEffect(() => { setBranchId(currentBranchId); }, [currentBranchId]);
  useEffect(() => { setFBranch(currentBranchId); }, [currentBranchId]);

  const byId = useMemo(() => {
    const map = new Map();
    branches.forEach(b => map.set(b.id, b.name));
    return map;
  }, [branches]);
  const roleLower = String(auth.role || '').toLowerCase();
  const grants = Array.isArray(auth.grants) ? auth.grants : [];
  function has(g) {
    if (!g) return false;
    if (roleLower === 'superadmin') return true;
    return grants.includes(g);
  }
  const canReceive = (['admin','manager','inventory staff'].includes(roleLower)) || has('add_purchases');
  const canApprove = (['admin','manager','superadmin'].includes(roleLower)) || has('approve_purchases');
  const assigned = auth.user?.assignedBranches || 'all';
  const branchOptions = useMemo(() => {
    if (roleLower === 'superadmin' || roleLower === 'admin' || assigned === 'all') return branches;
    const ids = new Set(Array.isArray(assigned) ? assigned : [assigned]);
    return branches.filter(b => ids.has(b.id));
  }, [roleLower, assigned, branches]);
  const basePurchases = useMemo(() => audit.filter(e => e.actionType === 'stock_receive'), [audit]);
  const actors = useMemo(() => Array.from(new Set(basePurchases.map(e => e.actor).filter(Boolean))).sort(), [basePurchases]);
  const purchases = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : 0;
    const toTs = dateTo ? new Date(dateTo).getTime() : Number.MAX_SAFE_INTEGER;
    return basePurchases.filter(e => {
      const ts = new Date(e.ts).getTime();
      if (ts < fromTs || ts > toTs) return false;
      if (fActor && e.actor !== fActor) return false;
      if (fBranch && e.branchId !== fBranch) return false;
      return true;
    }).slice().reverse();
  }, [basePurchases, dateFrom, dateTo, fActor, fBranch]);

  function onExportCsv() {
    const headers = [
      { key: 'ts', label: 'Timestamp', value: e => new Date(e.ts).toLocaleString() },
      { key: 'actor', label: 'Actor' },
      { key: 'product', label: 'Product', value: e => (e.details || {}).product || '' },
      { key: 'branch', label: 'Branch', value: e => byId.get(e.branchId) || e.branchId || '' },
      { key: 'qty', label: 'Qty', value: e => (e.details || {}).qty ?? '' },
      { key: 'pack', label: 'Pack', value: e => (e.details || {}).pack || 'Base Unit' },
      { key: 'baseUnits', label: 'Base Units', value: e => (e.details || {}).baseUnits ?? '' },
      { key: 'supplier', label: 'Supplier', value: e => (e.details || {}).supplier || '' },
      { key: 'cost', label: 'Cost', value: e => (e.details || {}).cost ?? '' },
      { key: 'remark', label: 'Remark', value: e => e.remark || '' }
    ];
    exportCsv('purchases.csv', headers, purchases);
  }
  function onExportPdf() {
    const headers = [
      { key: 'ts', label: 'Timestamp', value: e => new Date(e.ts).toLocaleString() },
      { key: 'actor', label: 'Actor' },
      { key: 'product', label: 'Product', value: e => (e.details || {}).product || '' },
      { key: 'branch', label: 'Branch', value: e => byId.get(e.branchId) || e.branchId || '' },
      { key: 'qty', label: 'Qty', value: e => (e.details || {}).qty ?? '' },
      { key: 'pack', label: 'Pack', value: e => (e.details || {}).pack || 'Base Unit' },
      { key: 'baseUnits', label: 'Base Units', value: e => (e.details || {}).baseUnits ?? '' },
      { key: 'supplier', label: 'Supplier', value: e => (e.details || {}).supplier || '' },
      { key: 'cost', label: 'Cost', value: e => (e.details || {}).cost ?? '' },
      { key: 'remark', label: 'Remark', value: e => e.remark || '' }
    ];
    exportTablePdf('Purchases', headers, purchases);
  }

  async function receive() {
    if (saving) return;
    if (!canReceive) {
      toast.show('Not authorized to initiate purchases', { type: 'error' });
      return;
    }
    if (!navigator.onLine) {
      if (!offlineBackupAllowed) {
        toast.show('Offline: cannot submit purchase request', { type: 'error' });
        return;
      }
    }
    if (!productId || !branchId || qty <= 0) {
      toast.show('Select product/branch and quantity', { type: 'error' });
      return;
    }
    const price = Number(cost) || 0;
    const prod = products.find(p => p.id === productId);
    const pack = (prod?.packs || []).find(pk => pk.name === packName);
    const factor = pack ? Number(pack.quantity) || 1 : 1;
    const baseUnits = Number(qty) * factor;
    const cpu = factor > 0 ? (price / factor) : price;
    setSaving(true);
    const clientId = `purchase-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const payload = {
      productId,
      branchId,
      baseUnits,
      actor: auth.user?.name || 'unknown',
      supplier: supplier.trim() || '',
      cost: price,
      costPerUnit: cpu,
      expiryDate: expiryDate || undefined,
      remark: note.trim() || '',
      variantId: variantId || undefined,
      pack: pack ? pack.name : '',
      initiatorName: auth.user?.name || 'unknown',
      initiatorRole: auth.role || '',
      clientId
    };
    if (!navigator.onLine) {
      try {
        await enqueueHttp({ collection: 'purchaserequests', label: 'Purchase request', path: '/api/purchases/requests', method: 'POST', body: payload });
      } catch (e) {
        toast.show(String(e?.message || 'Failed to save offline'), { type: 'error' });
        setSaving(false);
        return;
      }
    } else {
      try {
        await purchasesApi.createRequest(payload);
      } catch (e) {
        toast.show(String(e?.message || 'Failed to submit request'), { type: 'error' });
        setSaving(false);
        return;
      }
    }
    dispatch(createPurchaseRequest({
      productId,
      variantId: variantId || null,
      branchId,
      baseUnits,
      supplier: supplier.trim() || '',
      cost: price,
      costPerUnit: cpu,
      expiryDate: expiryDate || null,
      remark: note.trim() || '',
      initiatorName: auth.user?.name || 'unknown',
      initiatorRole: auth.role || '',
      pack: pack ? pack.name : '',
      status: 'pending_approval',
      clientId,
      created_at: new Date().toISOString()
    }));
    dispatch(addAudit({
      actor: auth.user?.name || 'unknown',
      actionType: 'purchase_initiated',
      details: { product: prod?.name || productId, variant: (prod?.variants || []).find(v => v.id === variantId)?.label || '', qty: Number(qty), pack: pack ? pack.name : 'Base Unit', factor, baseUnits, branchId, supplier: supplier.trim() || '', cost: price, costPerUnit: cpu, expiryDate: expiryDate || null },
      remark: note.trim() || '',
      branchId,
      offline: !navigator.onLine
    }));
    setQty(1);
    setPackName('');
    setVariantId('');
    setSupplier('');
    setCost('');
    setExpiryDate('');
    setNote('');
    toast.show(navigator.onLine ? 'Purchase request submitted for approval' : 'Saved offline. Will sync when online.', { type: 'success' });
    setSaving(false);
  }

  const requests = useSelector(s => s.purchases?.requests || []);
  const allowedBranches = useMemo(() => {
    if (roleLower === 'superadmin' || roleLower === 'admin' || assigned === 'all') return null; // null => all
    return new Set(Array.isArray(assigned) ? assigned : [assigned]);
  }, [roleLower, assigned]);
  const pendingRequests = useMemo(() => {
    return requests.filter(r => {
      const s = r.status === 'pending_approval' ? 'pending' : r.status;
      if (s !== statusFilter) return false;
      if (fBranch && r.branchId !== fBranch) return false;
      if (allowedBranches && !allowedBranches.has(r.branchId)) return false;
      return true;
    });
  }, [requests, statusFilter, fBranch, allowedBranches]);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (tab !== 'approvals') return;
      setLoading(true);
      try {
        const rows = await purchasesApi.listRequests();
        if (alive && Array.isArray(rows)) {
          const { setPurchaseRequests } = await import('../store/purchasesSlice');
          dispatch(setPurchaseRequests(rows));
        }
      } catch {}
      if (alive) setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [tab, fBranch, dispatch]);
  async function approve(r) {
    if (!canApprove) { toast.show('Not authorized to approve purchases', { type: 'error' }); return; }
    const id = r._id || r.clientId;
    try {
      const { promptDialog } = await import('../utils/dialogs');
      let remark = await promptDialog('Enter remark for approval (required)');
      if (!remark || !String(remark).trim()) { toast.show('Remark is required', { type: 'error' }); return; }
      if (!navigator.onLine) {
        await enqueueHttp({ collection: 'purchaserequests', label: 'Purchase approve', path: '/api/purchases/approve', method: 'POST', body: { id, approverName: auth.user?.name || 'unknown', approverRole: auth.role || '', remark } });
      } else {
        await purchasesApi.approve({ id, approverName: auth.user?.name || 'unknown', approverRole: auth.role || '', remark });
      }
      dispatch(approvePurchase({ id, approverName: auth.user?.name || 'unknown', approverRole: auth.role || '', remark }));
      dispatch(adjustStock({ productId: r.productId, variantId: r.variantId || undefined, branchId: r.branchId, delta: Number(r.baseUnits || 0) }));
      toast.show('Purchase approved and stock updated', { type: 'success' });
    } catch (e) {
      toast.show(String(e?.message || 'Failed to approve'), { type: 'error' });
    }
  }
  async function reject(r) {
    if (!canApprove) { toast.show('Not authorized to reject purchases', { type: 'error' }); return; }
    const id = r._id || r.clientId;
    try {
      const { promptDialog } = await import('../utils/dialogs');
      let remark = await promptDialog('Enter reason for rejection (required)');
      if (!remark || !String(remark).trim()) { toast.show('Remark is required', { type: 'error' }); return; }
      if (!navigator.onLine) {
        await enqueueHttp({ collection: 'purchaserequests', label: 'Purchase reject', path: '/api/purchases/reject', method: 'POST', body: { id, approverName: auth.user?.name || 'unknown', approverRole: auth.role || '', remark } });
      } else {
        await purchasesApi.reject({ id, approverName: auth.user?.name || 'unknown', approverRole: auth.role || '', remark });
      }
      dispatch(rejectPurchase({ id, approverName: auth.user?.name || 'unknown', approverRole: auth.role || '', remark }));
      toast.show('Purchase rejected', { type: 'success' });
    } catch (e) {
      toast.show(String(e?.message || 'Failed to reject'), { type: 'error' });
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Purchases</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {tab === 'initiate' && (
          <button className="btn btn-primary" onClick={() => { setOpenModal(true); }}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2"/></svg>
            Add Purchase
          </button>
          )}
          <OfflineQueueIndicator collection="purchaserequests" label="Purchases queued" />
          <OfflineQueueIndicator collection="audits" label="Stock queued" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button className={tab === 'initiate' ? 'btn btn-primary' : 'btn'} onClick={() => setTab('initiate')}>Initiate</button>
        <button className={tab === 'approvals' ? 'btn btn-primary' : 'btn'} onClick={() => setTab('approvals')} disabled={!canApprove}>Approvals</button>
      </div>
      {openModal && (
        <Modal title="Add Purchase" onClose={() => setOpenModal(false)} footer={
          <>
            <button className="btn" onClick={() => setOpenModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={async () => { await receive(); setOpenModal(false); }} disabled={!canReceive || saving}>
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v12M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2"/><path d="M5 19h14" stroke="currentColor" strokeWidth="2"/></svg>
              {saving ? 'Saving…' : 'Submit For Approval'}
            </button>
          </>
        }>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              <div style={{ marginBottom: 6, color: '#64748b' }}>Product</div>
              <select className="select" value={productId} onChange={e => { setProductId(e.target.value); setPackName(''); setVariantId(''); }} style={{ display: 'block', width: '100%' }}>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>
              <div style={{ marginBottom: 6, color: '#64748b' }}>Branch</div>
              <BranchSelect value={branchId} onChange={setBranchId} />
            </label>
            {(products.find(p => p.id === productId)?.variants || []).length > 0 && (
              <label>
                <div style={{ marginBottom: 6, color: '#64748b' }}>Variant</div>
                <select className="select" value={variantId} onChange={e => setVariantId(e.target.value)}>
                  <option value="">None (base)</option>
                  {(products.find(p => p.id === productId)?.variants || []).map(v => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <div style={{ marginBottom: 6, color: '#64748b' }}>Pack</div>
              <select className="select" value={packName} onChange={e => setPackName(e.target.value)}>
                <option value="">Base Unit</option>
                {(products.find(p => p.id === productId)?.packs || []).map(pk => (
                  <option key={pk.name} value={pk.name}>{pk.name} = {pk.quantity} units</option>
                ))}
              </select>
            </label>
            <label>
              <div style={{ marginBottom: 6, color: '#64748b' }}>Quantity</div>
              <input className="input" type="number" min="1" value={qty} onChange={e => setQty(Number(e.target.value))} />
            </label>
            <label>
              <div style={{ marginBottom: 6, color: '#64748b' }}>Supplier</div>
              <input className="input" placeholder="e.g., FreshCo" value={supplier} onChange={e => setSupplier(e.target.value)} list="suppliers-list" />
              <SuppliersDatalist />
            </label>
            <label>
              <div style={{ marginBottom: 6, color: '#64748b' }}>Cost Price</div>
              <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={cost} onChange={e => setCost(e.target.value)} />
            </label>
            <label>
              <div style={{ marginBottom: 6, color: '#64748b' }}>Expiry Date</div>
              <input className="input" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              <div style={{ marginBottom: 6, color: '#64748b' }}>Remark</div>
              <input className="input" placeholder="Optional note" value={note} onChange={e => setNote(e.target.value)} />
            </label>
          </div>
        </Modal>
      )}
      {tab === 'approvals' && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="section-title" style={{ marginBottom: 8 }}>Approvals</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={statusFilter === 'pending' ? 'btn btn-primary' : 'btn'} onClick={() => setStatusFilter('pending')}>Pending</button>
              <button className={statusFilter === 'approved' ? 'btn btn-primary' : 'btn'} onClick={() => setStatusFilter('approved')}>Approved</button>
              <button className={statusFilter === 'rejected' ? 'btn btn-primary' : 'btn'} onClick={() => setStatusFilter('rejected')}>Rejected</button>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th align="left">Product</th>
                <th align="left">Branch</th>
                <th align="left">Base Units</th>
                <th align="left">Supplier</th>
                <th align="left">Cost</th>
                <th align="left"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan="6" style={{ padding: 12, color: '#64748b' }}>Loading…</td></tr>}
              {!loading && pendingRequests.map(r => {
                const p = products.find(x => x.id === r.productId);
                const branchName = byId.get(r.branchId) || r.branchId;
                return (
                  <tr key={r._id || r.clientId} style={{ borderTop: '1px solid #e2e8f0', cursor: 'pointer' }} onClick={() => setDetail(r)}>
                    <td>{p?.name || r.productId}</td>
                    <td>{branchName}</td>
                    <td>{r.baseUnits}</td>
                    <td>{r.supplier || '—'}</td>
                    <td>{Number.isFinite(Number(r.cost)) ? formatCurrency(Number(r.cost), settings) : '—'}</td>
                    <td>
                      {r.status === 'pending_approval' ? (
                        <>
                          <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); approve(r); }} disabled={!canApprove}>Approve</button>
                          <button className="btn" onClick={(e) => { e.stopPropagation(); reject(r); }} style={{ marginLeft: 6 }} disabled={!canApprove}>Reject</button>
                        </>
                      ) : (
                        <span style={{ color: r.status === 'approved' ? '#10b981' : '#ef4444', fontWeight: 600 }}>{r.status}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && pendingRequests.length === 0 && <tr><td colSpan="6" style={{ padding: 12, color: '#64748b' }}>No items</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {detail && (
        <Modal title="Purchase Details" onClose={() => setDetail(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><div style={{ color: '#64748b' }}>Status</div><div>{detail.status}</div></div>
            <div><div style={{ color: '#64748b' }}>Branch</div><div>{byId.get(detail.branchId) || detail.branchId}</div></div>
            <div><div style={{ color: '#64748b' }}>Product</div><div>{products.find(p => p.id === detail.productId)?.name || detail.productId}</div></div>
            {detail.variantId ? <div><div style={{ color: '#64748b' }}>Variant</div><div>{(products.find(p => p.id === detail.productId)?.variants || []).find(v => v.id === detail.variantId)?.label || detail.variantId}</div></div> : null}
            <div><div style={{ color: '#64748b' }}>Base Units</div><div>{detail.baseUnits}</div></div>
            <div><div style={{ color: '#64748b' }}>Pack</div><div>{detail.pack || 'Base Unit'}</div></div>
            <div><div style={{ color: '#64748b' }}>Supplier</div><div>{detail.supplier || '—'}</div></div>
            <div><div style={{ color: '#64748b' }}>Cost</div><div>{Number.isFinite(Number(detail.cost)) ? formatCurrency(Number(detail.cost), settings) : '—'}</div></div>
            <div><div style={{ color: '#64748b' }}>Initiator</div><div>{detail.initiatorName} {detail.initiatorRole ? `(${detail.initiatorRole})` : ''}</div></div>
            <div><div style={{ color: '#64748b' }}>Initiation Remark</div><div>{detail.remark || '—'}</div></div>
            <div><div style={{ color: '#64748b' }}>Approver</div><div>{detail.approverName ? `${detail.approverName}${detail.approverRole ? ` (${detail.approverRole})` : ''}` : '—'}</div></div>
            {detail.status === 'approved' && <div><div style={{ color: '#64748b' }}>Approval Remark</div><div>{detail.approvalRemark || '—'}</div></div>}
            {detail.status === 'rejected' && <div><div style={{ color: '#64748b' }}>Rejection Remark</div><div>{detail.rejectionRemark || '—'}</div></div>}
            <div><div style={{ color: '#64748b' }}>Created</div><div>{detail.createdAt ? new Date(detail.createdAt).toLocaleString() : '—'}</div></div>
            <div><div style={{ color: '#64748b' }}>Updated</div><div>{detail.updatedAt ? new Date(detail.updatedAt).toLocaleString() : '—'}</div></div>
          </div>
        </Modal>
      )}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr) auto', gap: 8, marginBottom: 8 }}>
          <label>
            From
            <input className="input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </label>
          <label>
            To
            <input className="input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </label>
          <label>
            Actor
            <select className="select" value={fActor} onChange={e => setFActor(e.target.value)}>
              <option value="">All</option>
              {actors.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label>
            Branch
            <select className="select" value={fBranch} onChange={e => setFBranch(e.target.value)}>
              {(roleLower === 'superadmin' || roleLower === 'admin') && <option value="">All</option>}
              {branchOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <div style={{ alignSelf: 'end', display: 'flex', gap: 6 }}>
            <button className="btn" onClick={onExportCsv}>Export CSV</button>
            <button className="btn" onClick={onExportPdf}>Export PDF</button>
          </div>
        </div>
        <h2 className="section-title">Recent Purchases</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Timestamp</th>
              <th align="left">Actor</th>
              <th align="left">Product</th>
              <th align="left">Branch</th>
              <th align="left">Qty</th>
              <th align="left">Pack</th>
              <th align="left">Base Units</th>
              <th align="left">Supplier</th>
              <th align="left">Cost</th>
              <th align="left">Remark</th>
            </tr>
          </thead>
          <tbody>
            {purchases.slice((page-1)*pageSize, (page-1)*pageSize + pageSize).map(e => {
              const d = e.details || {};
              const branchName = byId.get(e.branchId) || e.branchId || '—';
              return (
                <tr key={e.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td>{new Date(e.ts).toLocaleString()}</td>
                  <td>{e.actor}</td>
                  <td>{d.product || '—'}</td>
                  <td>{branchName}</td>
                  <td>{d.qty ?? '—'}</td>
                  <td>{d.pack || 'Base Unit'}</td>
                  <td>{d.baseUnits ?? (Number(d.qty) || 0) * (Number(d.factor) || 1)}</td>
                  <td>{d.supplier || '—'}</td>
                  <td>{Number.isFinite(Number(d.cost)) ? formatCurrency(Number(d.cost), settings) : '—'}</td>
                  <td>{e.remark || '—'}</td>
                </tr>
              );
            })}
            {purchases.length === 0 && (
              <tr><td colSpan="10" style={{ padding: 12, color: '#64748b' }}>No purchase records yet</td></tr>
            )}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
            <span>Page {page} of {Math.max(1, Math.ceil(purchases.length / pageSize))}</span>
            <button className="btn" onClick={() => setPage(p => Math.min(Math.max(1, Math.ceil(purchases.length / pageSize)), p + 1))} disabled={page >= Math.max(1, Math.ceil(purchases.length / pageSize))}>Next</button>
          </div>
          <label>
            <span style={{ marginRight: 6 }}>Rows</span>
            <select className="select" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

function SuppliersDatalist() {
  const list = useReduxSelector(s => s.suppliers?.suppliers || []);
  return (
    <datalist id="suppliers-list">
      {list.map(s => <option key={s.id} value={s.name} />)}
    </datalist>
  );
}

export default PurchasesPage;
