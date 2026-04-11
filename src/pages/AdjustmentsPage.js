import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useMemo, useState } from 'react';
import { adjustStock } from '../store/productsSlice';
import { useToast } from '../components/ToastProvider';
import BranchSelect from '../components/BranchSelect';
import { exportCsv, exportTablePdf } from '../utils/exporters';
import * as adjustmentsApi from '../api/adjustments';
import { enqueueHttp, isOfflineBackupEnabled } from '../offline/offlineBackup';
import OfflineQueueIndicator from '../components/OfflineQueueIndicator';
import Modal from '../components/Modal';
import { promptDialog } from '../utils/dialogs';

function AdjustmentsPage() {
  const products = useSelector(s => s.products.products);
  const branches = useSelector(s => s.branches.branches);
  const audit = useSelector(s => s.audit.entries);
  const currentBranchId = useSelector(s => s.settings.currentBranchId);
  const settings = useSelector(s => s.settings);
  const auth = useSelector(s => s.auth);
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [variantId, setVariantId] = useState('');
  const [branchId, setBranchId] = useState(currentBranchId);
  const [delta, setDelta] = useState(0);
  const [remark, setRemark] = useState('');
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [tab, setTab] = useState('initiate');
  const [openModal, setOpenModal] = useState(false);
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [detail, setDetail] = useState(null);
  const dispatch = useDispatch();
  const toast = useToast();
  const offlineBackupAllowed = isOfflineBackupEnabled(settings);
  useEffect(() => { setBranchId(currentBranchId); }, [currentBranchId]);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [fActor, setFActor] = useState('');
  const [fBranch, setFBranch] = useState(currentBranchId);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const roleLower = String(auth.role || '').toLowerCase();
  const grants = Array.isArray(auth.grants) ? auth.grants : [];
  function has(g) {
    if (!g) return false;
    if (roleLower === 'superadmin') return true;
    return grants.includes(g);
  }
  const canAdjust = (['admin','manager','inventory staff'].includes(roleLower)) || has('add_adjustments');
  const canApprove = (['admin','manager','superadmin'].includes(roleLower)) || has('approve_adjustments');

  const byId = useMemo(() => {
    const map = new Map();
    branches.forEach(b => map.set(b.id, b.name || b.code || b.id));
    return map;
  }, [branches]);
  useEffect(() => { setFBranch(currentBranchId); }, [currentBranchId]);
  useEffect(() => { if (roleLower !== 'superadmin' && roleLower !== 'admin') setFBranch(branchId); }, [roleLower, branchId]);
  const baseRows = useMemo(() => audit.filter(e => e.actionType === 'stock_adjust' || e.actionType === 'stock_damage_remove'), [audit]);
  const actors = useMemo(() => Array.from(new Set(baseRows.map(e => e.actor).filter(Boolean))).sort(), [baseRows]);
  const rows = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : 0;
    const toTs = dateTo ? new Date(dateTo).getTime() : Number.MAX_SAFE_INTEGER;
    return baseRows.filter(e => {
      const ts = new Date(e.ts).getTime();
      if (ts < fromTs || ts > toTs) return false;
      if (fActor && e.actor !== fActor) return false;
      if (fBranch && (e.branchId || (e.details || {}).branchId) !== fBranch) return false;
      return true;
    }).map(e => {
      const d = e.details || {};
      const delta = e.actionType === 'stock_adjust' ? (Number(d.delta) || 0) : -Math.abs(Number(d.qty) || 0);
      return {
        id: e.id,
        ts: e.ts,
        actor: e.actor,
        product: d.product || '',
        variant: d.variant || '',
        branchId: e.branchId || d.branchId || '',
        delta,
        type: e.actionType === 'stock_adjust' ? 'Adjust' : 'Damage/Expired',
        remark: e.remark || ''
      };
    }).slice().reverse();
  }, [baseRows, dateFrom, dateTo, fActor, fBranch]);

  function onExportCsv() {
    const headers = [
      { key: 'ts', label: 'Timestamp', value: r => new Date(r.ts).toLocaleString() },
      { key: 'actor', label: 'Actor' },
      { key: 'product', label: 'Product' },
      { key: 'variant', label: 'Variant' },
      { key: 'branch', label: 'Branch', value: r => byId.get(r.branchId) || r.branchId || '' },
      { key: 'delta', label: 'Delta' },
      { key: 'type', label: 'Type' },
      { key: 'remark', label: 'Remark' }
    ];
    exportCsv('adjustments.csv', headers, rows);
  }
  function onExportPdf() {
    const headers = [
      { key: 'ts', label: 'Timestamp', value: r => new Date(r.ts).toLocaleString() },
      { key: 'actor', label: 'Actor' },
      { key: 'product', label: 'Product' },
      { key: 'variant', label: 'Variant' },
      { key: 'branch', label: 'Branch', value: r => byId.get(r.branchId) || r.branchId || '' },
      { key: 'delta', label: 'Delta' },
      { key: 'type', label: 'Type' },
      { key: 'remark', label: 'Remark' }
    ];
    exportTablePdf('Adjustments', headers, rows);
  }

  async function adjust() {
    if (savingAdjust) return;
    if (!canAdjust) {
      toast.show('Not authorized to adjust stock', { type: 'error' });
      return;
    }
    const selectedProduct = products.find(p => p.id === productId);
    const current = (() => {
      if (!selectedProduct) return 0;
      if (variantId) {
        const v = (selectedProduct.variants || []).find(vv => vv.id === variantId);
        return Number((v?.stockByBranch || {})[branchId] || 0);
      }
      return Number((selectedProduct.stockByBranch || {})[branchId] || 0);
    })();
    const nextItems = items.length > 0 ? items : null;
    const clientId = `adjust-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const payload = {
      productId: nextItems ? nextItems[0]?.productId : productId,
      branchId,
      delta: nextItems ? nextItems.reduce((sum, item) => sum + Number(item.delta || 0), 0) : Number(delta),
      actor: auth.user?.name || 'unknown',
      variantId: nextItems ? (nextItems[0]?.variantId || undefined) : (variantId || undefined),
      remark,
      initiatorName: auth.user?.name || 'unknown',
      initiatorRole: auth.role || '',
      clientId,
      items: nextItems || undefined
    };
    if (!nextItems && (!productId || !branchId || delta === 0)) {
      toast.show('Select product/branch and enter non-zero delta', { type: 'error' });
      return;
    }
    if (!nextItems && Number(delta) < 0) {
      const toRemove = Math.abs(Number(delta));
      if (toRemove > current) {
        toast.show(`Cannot remove more than available stock (${current})`, { type: 'error' });
        return;
      }
    }
    if (!remark || !remark.trim()) {
      toast.show('Remark is required for adjustments', { type: 'error' });
      return;
    }
    setSavingAdjust(true);
    if (!navigator.onLine) {
      if (!offlineBackupAllowed) {
        toast.show('Offline: cannot submit request', { type: 'error' });
        setSavingAdjust(false);
        return;
      }
      try {
        await enqueueHttp({ collection: 'adjustmentrequests', label: 'Adjustment request', path: '/api/adjustments/requests', method: 'POST', body: payload });
      } catch (e) {
        toast.show(String(e?.message || 'Failed to save offline'), { type: 'error' });
        setSavingAdjust(false);
        return;
      }
    } else {
      try {
        await adjustmentsApi.createRequest(payload);
      } catch (e) {
        toast.show(String(e?.message || 'Failed to submit request'), { type: 'error' });
        setSavingAdjust(false);
        return;
      }
    }
    setDelta(0);
    setVariantId('');
    setRemark('');
    setItems([]);
    toast.show(navigator.onLine ? 'Adjustment request submitted for approval' : 'Saved offline. Will sync when online.', { type: 'success' });
    setSavingAdjust(false);
  }

  function addCurrentItem() {
    if (!productId || !branchId || delta === 0) {
      toast.show('Select product/branch and enter non-zero delta', { type: 'error' });
      return;
    }
    setItems(prev => [...prev, {
      lineId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      productId,
      variantId: variantId || '',
      delta: Number(delta),
      remark: remark.trim(),
      status: 'accepted'
    }]);
    setDelta(0);
    setVariantId('');
    setRemark('');
  }

  function removeItem(lineId) {
    setItems(prev => prev.filter(item => item.lineId !== lineId));
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Adjustments</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {tab === 'initiate' && (
            <button className="btn btn-primary" onClick={() => setOpenModal(true)}>
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2"/></svg>
              Add Adjustment
            </button>
          )}
          <OfflineQueueIndicator collection="adjustmentrequests" label="Adjustments queued" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button className={tab === 'initiate' ? 'btn btn-primary' : 'btn'} onClick={() => setTab('initiate')}>Initiate</button>
        <button className={tab === 'approvals' ? 'btn btn-primary' : 'btn'} onClick={() => setTab('approvals')} disabled={!canApprove}>Approvals</button>
      </div>
      {openModal && (
        <Modal title="Add Adjustment" onClose={() => setOpenModal(false)} footer={
          <>
            <button className="btn" onClick={() => setOpenModal(false)}>Cancel</button>
            <button className="btn" onClick={addCurrentItem}>Add To List</button>
            <button className="btn btn-primary" onClick={async () => { await adjust(); setOpenModal(false); }} disabled={!canAdjust || savingAdjust}>
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2"/></svg>
              {savingAdjust ? 'Saving…' : 'Submit For Approval'}
            </button>
          </>
        }>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              <div style={{ marginBottom: 6, color: '#64748b' }}>Product</div>
              <select className="select" value={productId} onChange={e => { setProductId(e.target.value); setVariantId(''); }}>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            {(products.find(p => p.id === productId)?.variants || []).length > 0 && (
              <label>
                <div style={{ marginBottom: 6, color: '#64748b' }}>Variant</div>
                <select className="select" value={variantId} onChange={e => setVariantId(e.target.value)} style={{ minWidth: 180 }}>
                  <option value="">Base</option>
                  {(products.find(p => p.id === productId)?.variants || []).map(v => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <div style={{ marginBottom: 6, color: '#64748b' }}>Branch</div>
              <BranchSelect value={branchId} onChange={setBranchId} />
            </label>
            <label>
              <div style={{ marginBottom: 6, color: '#64748b' }}>Delta (+/-)</div>
              <input className="input" type="number" value={delta} onChange={e => setDelta(Number(e.target.value))} placeholder="Delta (+/-)" />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              <div style={{ marginBottom: 6, color: '#64748b' }}>Remark (required)</div>
              <input className="input" value={remark} onChange={e => setRemark(e.target.value)} placeholder="Reason or note" />
            </label>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 6, color: '#64748b' }}>Items In This Request</div>
            <table className="table">
              <thead>
                <tr>
                  <th align="left">Product</th>
                  <th align="left">Delta</th>
                  <th align="left"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const product = products.find(p => p.id === item.productId);
                  return (
                    <tr key={item.lineId}>
                      <td>{product?.name || item.productId}</td>
                      <td>{item.delta}</td>
                      <td><button className="btn" onClick={() => removeItem(item.lineId)}>Remove</button></td>
                    </tr>
                  );
                })}
                {items.length === 0 && <tr><td colSpan="3" style={{ padding: 12, color: '#64748b' }}>No items added yet. You can still submit a single item.</td></tr>}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
      {tab === 'approvals' && (
        <ApprovalsSection
          canApprove={canApprove}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          loading={loading}
          setLoading={setLoading}
          products={products}
          byId={byId}
          setDetail={setDetail}
          busyId={busyId}
          setBusyId={setBusyId}
          toast={toast}
          auth={auth}
          dispatch={dispatch}
        />
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
            <BranchSelect value={fBranch} onChange={setFBranch} />
          </label>
          <div style={{ alignSelf: 'end', display: 'flex', gap: 6 }}>
            <button className="btn" onClick={onExportCsv}>Export CSV</button>
            <button className="btn" onClick={onExportPdf}>Export PDF</button>
          </div>
        </div>
        <h2 className="section-title">Recent Adjustments</h2>
        <table className="table">
          <thead>
            <tr>
              <th align="left">Timestamp</th>
              <th align="left">Actor</th>
              <th align="left">Product</th>
              <th align="left">Variant</th>
              <th align="left">Branch</th>
              <th align="left">Delta</th>
              <th align="left">Type</th>
              <th align="left">Remark</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice((page-1)*pageSize, (page-1)*pageSize + pageSize).map(r => (
              <tr key={r.id}>
                <td>{new Date(r.ts).toLocaleString()}</td>
                <td>{r.actor}</td>
                <td>{r.product || '—'}</td>
                <td>{r.variant || '—'}</td>
                <td>{byId.get(r.branchId) || r.branchId || '—'}</td>
                <td>{r.delta}</td>
                <td>{r.type}</td>
                <td>{r.remark || '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan="8" style={{ padding: 12, color: '#64748b' }}>No adjustment records yet</td></tr>
            )}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
            <span>Page {page} of {Math.max(1, Math.ceil(rows.length / pageSize))}</span>
            <button className="btn" onClick={() => setPage(p => Math.min(Math.max(1, Math.ceil(rows.length / pageSize)), p + 1))} disabled={page >= Math.max(1, Math.ceil(rows.length / pageSize))}>Next</button>
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
      {detail && (
        <Modal title="Adjustment Request" onClose={() => setDetail(null)}>
          <RequestDetail detail={detail} products={products} byId={byId} />
        </Modal>
      )}
    </div>
  );
}

function ApprovalsSection({ canApprove, statusFilter, setStatusFilter, loading, setLoading, products, byId, setDetail, busyId, setBusyId, toast, auth, dispatch }) {
  const [requests, setRequests] = useState([]);
  const [reloadAt, setReloadAt] = useState(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        let rows = await adjustmentsApi.listRequests({ status: statusFilter, limit: 200 });
        if ((!Array.isArray(rows) || rows.length === 0) && (statusFilter === 'pending' || statusFilter === 'approved' || statusFilter === 'rejected')) {
          const all = await adjustmentsApi.listRequests({ limit: 200 });
          const wanted = statusFilter === 'pending' ? ['pending', 'pending_approval'] : [statusFilter];
          rows = Array.isArray(all) ? all.filter(r => wanted.includes(String(r.status || ''))) : [];
        }
        if (alive) setRequests(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (alive) {
          setRequests([]);
          try { toast.show(String(e?.message || 'Failed to load requests'), { type: 'error' }); } catch {}
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [statusFilter, setLoading, reloadAt]);
  async function approve(r) {
    if (!canApprove) { toast.show('Not authorized to approve adjustments', { type: 'error' }); return; }
    const id = r._id || r.clientId;
    try {
      const remark = await promptDialog('Enter remark for approval (required)');
      if (!remark || !String(remark).trim()) { toast.show('Remark is required', { type: 'error' }); return; }
      setBusyId(id);
      if (!navigator.onLine) {
        await enqueueHttp({ collection: 'adjustmentrequests', label: 'Adjustment approve', path: '/api/adjustments/approve', method: 'POST', body: { id, approverName: auth.user?.name || 'unknown', approverRole: auth.role || '', remark } });
      } else {
        await adjustmentsApi.approve({ id, approverName: auth.user?.name || 'unknown', approverRole: auth.role || '', remark });
      }
      dispatch(adjustStock({ productId: r.productId, variantId: r.variantId || undefined, branchId: r.branchId, delta: Number(r.delta || 0) }));
      toast.show('Adjustment approved and stock updated', { type: 'success' });
      setRequests(prev => prev.map(x => String(x._id || x.clientId) === String(id) ? { ...x, status: 'approved', approverName: auth.user?.name || 'unknown', approverRole: auth.role || '', approvalRemark: remark, approved_at: new Date().toISOString() } : x));
    } catch (e) {
      toast.show(String(e?.message || 'Failed to approve'), { type: 'error' });
    } finally { setBusyId(null); }
  }
  async function reject(r) {
    if (!canApprove) { toast.show('Not authorized to reject adjustments', { type: 'error' }); return; }
    const id = r._id || r.clientId;
    try {
      const remark = await promptDialog('Enter reason for rejection (required)');
      if (!remark || !String(remark).trim()) { toast.show('Remark is required', { type: 'error' }); return; }
      setBusyId(id);
      if (!navigator.onLine) {
        await enqueueHttp({ collection: 'adjustmentrequests', label: 'Adjustment reject', path: '/api/adjustments/reject', method: 'POST', body: { id, approverName: auth.user?.name || 'unknown', approverRole: auth.role || '', remark } });
      } else {
        await adjustmentsApi.reject({ id, approverName: auth.user?.name || 'unknown', approverRole: auth.role || '', remark });
      }
      toast.show('Adjustment rejected', { type: 'success' });
      setRequests(prev => prev.map(x => String(x._id || x.clientId) === String(id) ? { ...x, status: 'rejected', approverName: auth.user?.name || 'unknown', approverRole: auth.role || '', rejectionRemark: remark, rejected_at: new Date().toISOString() } : x));
    } catch (e) {
      toast.show(String(e?.message || 'Failed to reject'), { type: 'error' });
    } finally { setBusyId(null); }
  }
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="section-title" style={{ marginBottom: 8 }}>Approvals</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={statusFilter === 'pending' ? 'btn btn-primary' : 'btn'} onClick={() => setStatusFilter('pending')}>Pending</button>
          <button className={statusFilter === 'approved' ? 'btn btn-primary' : 'btn'} onClick={() => setStatusFilter('approved')}>Approved</button>
          <button className={statusFilter === 'rejected' ? 'btn btn-primary' : 'btn'} onClick={() => setStatusFilter('rejected')}>Rejected</button>
          <button className="btn" onClick={() => setReloadAt(Date.now())} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th align="left">Product</th>
            <th align="left">Branch</th>
            <th align="left">Delta</th>
            <th align="left"></th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan="4" style={{ padding: 12, color: '#64748b' }}>Loading…</td></tr>}
          {!loading && requests.map(r => {
            const p = products.find(x => x.id === r.productId);
            return (
              <tr key={r._id || r.clientId} style={{ borderTop: '1px solid #e2e8f0', cursor: 'pointer' }} onClick={() => setDetail(r)}>
                <td>{p?.name || r.productId}{r.variantId ? ` • ${(p?.variants || []).find(v => v.id === r.variantId)?.label || r.variantId}` : ''}</td>
                <td>{byId.get(r.branchId) || r.branchId}</td>
                <td>{r.delta}</td>
                <td>
                  {r.status === 'pending_approval' ? (
                    <>
                      <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); approve(r); }} disabled={!canApprove || busyId === (r._id || r.clientId)}>{busyId === (r._id || r.clientId) ? 'Working…' : 'Approve'}</button>
                      <button className="btn" onClick={(e) => { e.stopPropagation(); reject(r); }} style={{ marginLeft: 6 }} disabled={!canApprove || busyId === (r._id || r.clientId)}>{busyId === (r._id || r.clientId) ? 'Working…' : 'Reject'}</button>
                    </>
                  ) : (
                    <span style={{ color: r.status === 'approved' ? '#10b981' : '#ef4444', fontWeight: 600 }}>{r.status}</span>
                  )}
                </td>
              </tr>
            );
          })}
          {!loading && requests.length === 0 && <tr><td colSpan="4" style={{ padding: 12, color: '#64748b' }}>No items</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function RequestDetail({ detail, products, byId }) {
  const p = products.find(x => x.id === detail.productId);
  const vLabel = detail.variantId ? ((p?.variants || []).find(v => v.id === detail.variantId)?.label || detail.variantId) : '';
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div><div style={{ color: '#64748b' }}>Status</div><div>{detail.status}</div></div>
        <div><div style={{ color: '#64748b' }}>Product</div><div>{p?.name || detail.productId}{vLabel ? ` • ${vLabel}` : ''}</div></div>
        <div><div style={{ color: '#64748b' }}>Branch</div><div>{byId.get(detail.branchId) || detail.branchId}</div></div>
        <div><div style={{ color: '#64748b' }}>Delta</div><div>{detail.delta}</div></div>
        <div><div style={{ color: '#64748b' }}>Initiator</div><div>{detail.initiatorName} {detail.initiatorRole ? `(${detail.initiatorRole})` : ''}</div></div>
        <div><div style={{ color: '#64748b' }}>Initiation Remark</div><div>{detail.remark || '—'}</div></div>
        <div><div style={{ color: '#64748b' }}>Approver</div><div>{detail.approverName ? `${detail.approverName}${detail.approverRole ? ` (${detail.approverRole})` : ''}` : '—'}</div></div>
        {detail.status === 'approved' && <div><div style={{ color: '#64748b' }}>Approval Remark</div><div>{detail.approvalRemark || '—'}</div></div>}
        {detail.status === 'rejected' && <div><div style={{ color: '#64748b' }}>Rejection Remark</div><div>{detail.rejectionRemark || '—'}</div></div>}
        <div><div style={{ color: '#64748b' }}>Created</div><div>{detail.createdAt ? new Date(detail.createdAt).toLocaleString() : '—'}</div></div>
        <div><div style={{ color: '#64748b' }}>Updated</div><div>{detail.updatedAt ? new Date(detail.updatedAt).toLocaleString() : '—'}</div></div>
      </div>
      {Array.isArray(detail.items) && detail.items.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 6, color: '#64748b' }}>Request Items</div>
          <table className="table">
            <thead>
              <tr>
                <th align="left">Product</th>
                <th align="left">Delta</th>
                <th align="left">Status</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((item, index) => {
                const product = products.find(row => row.id === item.productId);
                return (
                  <tr key={item.lineId || index}>
                    <td>{product?.name || item.productId}</td>
                    <td>{item.delta}</td>
                    <td>{item.status || 'accepted'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default AdjustmentsPage;
