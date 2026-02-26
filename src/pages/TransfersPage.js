import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useMemo, useState } from 'react';
import { adjustStock } from '../store/productsSlice';
import { useToast } from '../components/ToastProvider';
import BranchSelect from '../components/BranchSelect';
import { addAudit } from '../store/auditSlice';
import { promptDialog } from '../utils/dialogs';
import { exportCsv, exportTablePdf } from '../utils/exporters';
import * as stockApi from '../api/stock';
import { enqueueHttp, isOfflineBackupEnabled } from '../offline/offlineBackup';
import OfflineQueueIndicator from '../components/OfflineQueueIndicator';

function TransfersPage() {
  const products = useSelector(s => s.products.products);
  const branches = useSelector(s => s.branches.branches);
  const currentBranchId = useSelector(s => s.settings.currentBranchId);
  const settings = useSelector(s => s.settings);
  const auth = useSelector(s => s.auth);
  const audit = useSelector(s => s.audit.entries);
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [variantId, setVariantId] = useState('');
  const [fromId, setFromId] = useState(currentBranchId || branches[0]?.id || '');
  const [toId, setToId] = useState(branches.find(b => b.id !== currentBranchId)?.id || branches[1]?.id || branches[0]?.id || '');
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [fActor, setFActor] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const dispatch = useDispatch();
  const toast = useToast();
  const offlineBackupAllowed = isOfflineBackupEnabled(settings);
  useEffect(() => {
    setFromId(currentBranchId);
  }, [currentBranchId]);

  const roleLower = String(auth.role || '').toLowerCase();
  const grants = Array.isArray(auth.grants) ? auth.grants : [];
  function has(g) {
    if (!g) return false;
    if (roleLower === 'superadmin') return true;
    return grants.includes(g);
  }
  const canTransfer = (['admin','manager','inventory staff'].includes(roleLower)) || has('add_transfers');
  const assigned = auth.user?.assignedBranches || 'all';
  const branchOptions = useMemo(() => {
    if (roleLower === 'superadmin' || roleLower === 'admin' || assigned === 'all') return branches;
    const ids = new Set(Array.isArray(assigned) ? assigned : [assigned]);
    return branches.filter(b => ids.has(b.id));
  }, [roleLower, assigned, branches]);

  const byId = useMemo(() => {
    const map = new Map();
    branches.forEach(b => map.set(b.id, b.name));
    return map;
  }, [branches]);
  const baseTransfers = useMemo(() => audit.filter(e => e.actionType === 'stock_transfer'), [audit]);
  const actors = useMemo(() => Array.from(new Set(baseTransfers.map(e => e.actor).filter(Boolean))).sort(), [baseTransfers]);
  const transfers = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : 0;
    const toTs = dateTo ? new Date(dateTo).getTime() : Number.MAX_SAFE_INTEGER;
    return baseTransfers.filter(e => {
      const ts = new Date(e.ts).getTime();
      if (ts < fromTs || ts > toTs) return false;
      if (fActor && e.actor !== fActor) return false;
      const d = e.details || {};
      if (fFrom && d.from !== fFrom) return false;
      if (fTo && d.to !== fTo) return false;
      return true;
    }).slice().reverse();
  }, [baseTransfers, fActor, fFrom, fTo, dateFrom, dateTo]);

  function onExportCsv() {
    const headers = [
      { key: 'ts', label: 'Timestamp', value: e => new Date(e.ts).toLocaleString() },
      { key: 'actor', label: 'Actor' },
      { key: 'product', label: 'Product', value: e => (e.details || {}).product || '' },
      { key: 'from', label: 'From', value: e => byId.get((e.details || {}).from) || (e.details || {}).from || '' },
      { key: 'to', label: 'To', value: e => byId.get((e.details || {}).to) || (e.details || {}).to || '' },
      { key: 'qty', label: 'Qty', value: e => (e.details || {}).qty ?? '' },
      { key: 'remark', label: 'Remark', value: e => e.remark || '' }
    ];
    exportCsv('transfers.csv', headers, transfers);
  }
  function onExportPdf() {
    const headers = [
      { key: 'ts', label: 'Timestamp', value: e => new Date(e.ts).toLocaleString() },
      { key: 'actor', label: 'Actor' },
      { key: 'product', label: 'Product', value: e => (e.details || {}).product || '' },
      { key: 'route', label: 'From → To', value: e => {
        const d = e.details || {}; return `${byId.get(d.from) || d.from || '—'} → ${byId.get(d.to) || d.to || '—'}`;
      }},
      { key: 'qty', label: 'Qty', value: e => (e.details || {}).qty ?? '' },
      { key: 'remark', label: 'Remark', value: e => e.remark || '' }
    ];
    exportTablePdf('Transfers', headers, transfers);
  }

  async function transfer() {
    if (saving) return;
    if (!canTransfer) {
      toast.show('Not authorized to transfer stock', { type: 'error' });
      return;
    }
    if (!navigator.onLine) {
      if (!offlineBackupAllowed) {
        toast.show('Offline: cannot sync transfer to server', { type: 'error' });
        return;
      }
    }
    if (!productId || !fromId || !toId || fromId === toId || qty <= 0) {
      toast.show('Check product, branches and quantity', { type: 'error' });
      return;
    }
    const remark = await promptDialog('Enter reason/remark for this transfer');
    if (!remark || !remark.trim()) {
      toast.show('Remark is required for transfers', { type: 'error' });
      return;
    }
    const prod = products.find(p => p.id === productId);
    setSaving(true);
    const payload = {
      productId,
      from: fromId,
      to: toId,
      qty: Number(qty),
      actor: auth.user?.name || 'unknown',
      remark,
      variantId: variantId || undefined
    };
    if (!navigator.onLine) {
      try {
        await enqueueHttp({ collection: 'audits', label: 'Stock transfer', path: '/api/stock/transfer', method: 'POST', body: payload });
      } catch (e) {
        toast.show(String(e?.message || 'Failed to save offline'), { type: 'error' });
        setSaving(false);
        return;
      }
    } else {
      try {
        await stockApi.transfer(payload);
      } catch (e) {
        toast.show(String(e?.message || 'Failed to sync transfer to server'), { type: 'error' });
        setSaving(false);
        return;
      }
    }
    dispatch(adjustStock({ productId, variantId: variantId || undefined, branchId: fromId, delta: -Number(qty) }));
    dispatch(adjustStock({ productId, variantId: variantId || undefined, branchId: toId, delta: Number(qty) }));
    dispatch(addAudit({
      actor: auth.user?.name || 'unknown',
      actionType: 'stock_transfer',
      details: { product: prod?.name || productId, variant: (prod?.variants || []).find(v => v.id === variantId)?.label || '', from: fromId, to: toId, qty: Number(qty) },
      remark,
      branchId: fromId,
      offline: !navigator.onLine
    }));
    setQty(1);
    setVariantId('');
    toast.show(navigator.onLine ? 'Transfer recorded' : 'Saved offline. Will backup when online.', { type: 'success' });
    setSaving(false);
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Transfers</h1>
        <OfflineQueueIndicator collection="audits" label="Stock queued" />
      </div>
      <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select className="select" value={productId} onChange={e => { setProductId(e.target.value); setVariantId(''); }}>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {(products.find(p => p.id === productId)?.variants || []).length > 0 && (
          <select className="select" value={variantId} onChange={e => setVariantId(e.target.value)} style={{ minWidth: 180 }}>
            <option value="">Base</option>
            {(products.find(p => p.id === productId)?.variants || []).map(v => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        )}
        <BranchSelect value={fromId} onChange={setFromId} />
        <BranchSelect value={toId} onChange={setToId} />
        <input className="input" type="number" min="1" value={qty} onChange={e => setQty(Number(e.target.value))} style={{ width: 120 }} />
        <button className="btn btn-primary" onClick={transfer} disabled={!canTransfer || saving}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M7 7h10M7 17h10M7 7l-3 3m3-3l-3-3M17 17l3 3m-3-3l3-3" stroke="currentColor" strokeWidth="2"/></svg>
          {saving ? 'Saving…' : 'Transfer'}
        </button>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 8 }}>
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
            From Branch
            <select className="select" value={fFrom} onChange={e => setFFrom(e.target.value)}>
              <option value="">All</option>
              {branchOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label>
            To Branch
            <select className="select" value={fTo} onChange={e => setFTo(e.target.value)}>
              <option value="">All</option>
              {branchOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <div style={{ alignSelf: 'end', display: 'flex', gap: 6 }}>
            <button className="btn" onClick={onExportCsv}>Export CSV</button>
            <button className="btn" onClick={onExportPdf}>Export PDF</button>
          </div>
        </div>
        <h2 className="section-title">Recent Transfers</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Timestamp</th>
              <th align="left">Actor</th>
              <th align="left">Product</th>
              <th align="left">From → To</th>
              <th align="left">Qty</th>
              <th align="left">Remark</th>
            </tr>
          </thead>
          <tbody>
            {transfers.slice((page-1)*pageSize, (page-1)*pageSize + pageSize).map(e => {
              const d = e.details || {};
              const fromName = byId.get(d.from) || d.from || '—';
              const toName = byId.get(d.to) || d.to || '—';
              return (
                <tr key={e.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td>{new Date(e.ts).toLocaleString()}</td>
                  <td>{e.actor}</td>
                  <td>{d.product || '—'}</td>
                  <td>{fromName} → {toName}</td>
                  <td>{d.qty ?? '—'}</td>
                  <td>{e.remark || '—'}</td>
                </tr>
              );
            })}
            {transfers.length === 0 && (
              <tr><td colSpan="6" style={{ padding: 12, color: '#64748b' }}>No transfers yet</td></tr>
            )}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
            <span>Page {page} of {Math.max(1, Math.ceil(transfers.length / pageSize))}</span>
            <button className="btn" onClick={() => setPage(p => Math.min(Math.max(1, Math.ceil(transfers.length / pageSize)), p + 1))} disabled={page >= Math.max(1, Math.ceil(transfers.length / pageSize))}>Next</button>
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

export default TransfersPage;
