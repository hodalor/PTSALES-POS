import { useDispatch, useSelector } from 'react-redux';
import { useMemo, useState, useEffect } from 'react';
import { adjustStock } from '../store/productsSlice';
import { useToast } from '../components/ToastProvider';
import BranchSelect from '../components/BranchSelect';
import { addAudit } from '../store/auditSlice';
import { formatCurrency } from '../utils/currency';
import { useSelector as useReduxSelector } from 'react-redux';
import { exportCsv, exportTablePdf } from '../utils/exporters';
import * as stockApi from '../api/stock';
import { enqueueHttp, isOfflineBackupEnabled } from '../offline/offlineBackup';
import OfflineQueueIndicator from '../components/OfflineQueueIndicator';

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
      toast.show('Not authorized to receive stock', { type: 'error' });
      return;
    }
    if (!navigator.onLine) {
      if (!offlineBackupAllowed) {
        toast.show('Offline: cannot sync purchase to server', { type: 'error' });
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
      variantId: variantId || undefined
    };
    if (!navigator.onLine) {
      try {
        await enqueueHttp({ collection: 'audits', label: 'Stock receive', path: '/api/stock/receive', method: 'POST', body: payload });
      } catch (e) {
        toast.show(String(e?.message || 'Failed to save offline'), { type: 'error' });
        setSaving(false);
        return;
      }
    } else {
      try {
        await stockApi.receive(payload);
      } catch (e) {
        toast.show(String(e?.message || 'Failed to sync to server'), { type: 'error' });
        setSaving(false);
        return;
      }
    }
    dispatch(adjustStock({ productId, variantId: variantId || undefined, branchId, delta: baseUnits }));
    dispatch(addAudit({
      actor: auth.user?.name || 'unknown',
      actionType: 'stock_receive',
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
    toast.show(navigator.onLine ? 'Stock received' : 'Saved offline. Will backup when online.', { type: 'success' });
    setSaving(false);
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Purchases (Receive Stock)</h1>
        <OfflineQueueIndicator collection="audits" label="Stock queued" />
      </div>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
        <label>
          <div style={{ marginBottom: 6, color: '#64748b' }}>Product</div>
          <select className="select" value={productId} onChange={e => { setProductId(e.target.value); setPackName(''); setVariantId(''); }} style={{ display: 'block', width: '100%' }}>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
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
          <div style={{ marginBottom: 6, color: '#64748b' }}>Branch</div>
          <BranchSelect value={branchId} onChange={setBranchId} />
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
        <label style={{ gridColumn: '1 / span 4' }}>
          <div style={{ marginBottom: 6, color: '#64748b' }}>Remark</div>
          <input className="input" placeholder="Optional note" value={note} onChange={e => setNote(e.target.value)} />
        </label>
        <div>
          <button className="btn btn-primary" onClick={receive} style={{ marginTop: 6 }} disabled={!canReceive || saving}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v12M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2"/><path d="M5 19h14" stroke="currentColor" strokeWidth="2"/></svg>
            {saving ? 'Saving…' : 'Receive'}
          </button>
        </div>
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
