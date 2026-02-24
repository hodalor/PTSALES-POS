import { useDispatch, useSelector } from 'react-redux';
import { useMemo, useState, useEffect } from 'react';
import { adjustStock } from '../store/productsSlice';
import { useToast } from '../components/ToastProvider';
import BranchSelect from '../components/BranchSelect';
import { addAudit } from '../store/auditSlice';
import { formatCurrency } from '../utils/currency';

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
  const [supplier, setSupplier] = useState('');
  const [cost, setCost] = useState('');
  const [note, setNote] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [fActor, setFActor] = useState('');
  const [fBranch, setFBranch] = useState('');
  const dispatch = useDispatch();
  const toast = useToast();
  useEffect(() => { setBranchId(currentBranchId); }, [currentBranchId]);

  const byId = useMemo(() => {
    const map = new Map();
    branches.forEach(b => map.set(b.id, b.name));
    return map;
  }, [branches]);
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

  function exportCsv() {
    const headers = ['Timestamp','Actor','Product','Branch','Qty','Supplier','Cost','Remark'];
    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.map(escape).join(',')];
    purchases.forEach(e => {
      const d = e.details || {};
      lines.push([
        e.ts,
        e.actor,
        d.product || '',
        byId.get(e.branchId) || e.branchId || '',
        d.qty ?? '',
        d.supplier || '',
        Number.isFinite(Number(d.cost)) ? Number(d.cost) : '',
        e.remark || ''
      ].map(escape).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'purchases.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function receive() {
    if (!productId || !branchId || qty <= 0) {
      toast.show('Select product/branch and quantity', { type: 'error' });
      return;
    }
    const price = Number(cost) || 0;
    dispatch(adjustStock({ productId, branchId, delta: Number(qty) }));
    const prod = products.find(p => p.id === productId);
    dispatch(addAudit({
      actor: auth.user?.name || 'unknown',
      actionType: 'stock_receive',
      details: { product: prod?.name || productId, qty: Number(qty), branchId, supplier: supplier.trim() || '', cost: price },
      remark: note.trim() || '',
      branchId
    }));
    setQty(1);
    setSupplier('');
    setCost('');
    setNote('');
    toast.show('Stock received', { type: 'success' });
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Purchases (Receive Stock)</h1>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
        <label>
          <div style={{ marginBottom: 6, color: '#64748b' }}>Product</div>
          <select className="select" value={productId} onChange={e => setProductId(e.target.value)} style={{ display: 'block', width: '100%' }}>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
          <input className="input" placeholder="e.g., FreshCo" value={supplier} onChange={e => setSupplier(e.target.value)} />
        </label>
        <label>
          <div style={{ marginBottom: 6, color: '#64748b' }}>Cost Price</div>
          <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={cost} onChange={e => setCost(e.target.value)} />
        </label>
        <label style={{ gridColumn: '1 / span 4' }}>
          <div style={{ marginBottom: 6, color: '#64748b' }}>Remark</div>
          <input className="input" placeholder="Optional note" value={note} onChange={e => setNote(e.target.value)} />
        </label>
        <div>
          <button className="btn btn-primary" onClick={receive} style={{ marginTop: 6 }}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v12M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2"/><path d="M5 19h14" stroke="currentColor" strokeWidth="2"/></svg>
            Receive
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
              <option value="">All</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <div style={{ alignSelf: 'end' }}>
            <button className="btn" onClick={exportCsv}>Export CSV</button>
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
              <th align="left">Supplier</th>
              <th align="left">Cost</th>
              <th align="left">Remark</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map(e => {
              const d = e.details || {};
              const branchName = byId.get(e.branchId) || e.branchId || '—';
              return (
                <tr key={e.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td>{new Date(e.ts).toLocaleString()}</td>
                  <td>{e.actor}</td>
                  <td>{d.product || '—'}</td>
                  <td>{branchName}</td>
                  <td>{d.qty ?? '—'}</td>
                  <td>{d.supplier || '—'}</td>
                  <td>{Number.isFinite(Number(d.cost)) ? formatCurrency(Number(d.cost), settings) : '—'}</td>
                  <td>{e.remark || '—'}</td>
                </tr>
              );
            })}
            {purchases.length === 0 && (
              <tr><td colSpan="8" style={{ padding: 12, color: '#64748b' }}>No purchase records yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PurchasesPage;
