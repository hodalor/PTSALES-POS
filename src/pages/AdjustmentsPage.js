import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useMemo, useState } from 'react';
import { adjustStock } from '../store/productsSlice';
import { useToast } from '../components/ToastProvider';
import BranchSelect from '../components/BranchSelect';
import { addAudit } from '../store/auditSlice';
import { exportCsv, exportTablePdf } from '../utils/exporters';
import * as stockApi from '../api/stock';
import { enqueueHttp, isOfflineBackupEnabled } from '../offline/offlineBackup';
import OfflineQueueIndicator from '../components/OfflineQueueIndicator';

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
    if (!navigator.onLine) {
      if (!offlineBackupAllowed) {
        toast.show('Offline: cannot sync adjustment to server', { type: 'error' });
        return;
      }
    }
    if (!productId || !branchId || delta === 0) {
      toast.show('Select product/branch and enter non-zero delta', { type: 'error' });
      return;
    }
    if (Number(delta) < 0) {
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
    const prod = selectedProduct;
    setSavingAdjust(true);
    const payload = {
      productId,
      branchId,
      delta: Number(delta),
      actor: auth.user?.name || 'unknown',
      variantId: variantId || undefined,
      remark
    };
    if (!navigator.onLine) {
      try {
        await enqueueHttp({ collection: 'audits', label: 'Stock adjust', path: '/api/stock/adjust', method: 'POST', body: payload });
      } catch (e) {
        toast.show(String(e?.message || 'Failed to save offline'), { type: 'error' });
        setSavingAdjust(false);
        return;
      }
    } else {
      try {
        await stockApi.adjust(payload);
      } catch (e) {
        toast.show(String(e?.message || 'Failed to sync adjustment to server'), { type: 'error' });
        setSavingAdjust(false);
        return;
      }
    }
    dispatch(adjustStock({ productId, variantId: variantId || undefined, branchId, delta: Number(delta) }));
    dispatch(addAudit({
      actor: auth.user?.name || 'unknown',
      actionType: 'stock_adjust',
      details: { product: prod?.name || productId, variant: (prod?.variants || []).find(v => v.id === variantId)?.label || '', delta: Number(delta), branchId },
      remark,
      branchId,
      offline: !navigator.onLine
    }));
    setDelta(0);
    setVariantId('');
    setRemark('');
    toast.show(navigator.onLine ? 'Adjustment applied' : 'Saved offline. Will backup when online.', { type: 'success' });
    setSavingAdjust(false);
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Adjustments</h1>
        <OfflineQueueIndicator collection="audits" label="Stock queued" />
      </div>
      <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
        <BranchSelect value={branchId} onChange={setBranchId} />
        <input
          className="input"
          type="number"
          value={delta}
          onChange={e => setDelta(Number(e.target.value))}
          placeholder="Delta (+/-)"
          style={{ width: 140 }}
        />
        <input
          className="input"
          placeholder="Remark (required)"
          value={remark}
          onChange={e => setRemark(e.target.value)}
          style={{ minWidth: 240 }}
        />
        <button className="btn btn-primary" onClick={adjust} disabled={!canAdjust || savingAdjust}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2"/></svg>
          {savingAdjust ? 'Saving…' : 'Apply'}
        </button>
      </div>
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
    </div>
  );
}

export default AdjustmentsPage;
