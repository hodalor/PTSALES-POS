import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useMemo, useState } from 'react';
import { adjustStock } from '../store/productsSlice';
import { useToast } from '../components/ToastProvider';
import BranchSelect from '../components/BranchSelect';
import { addAudit } from '../store/auditSlice';

function TransfersPage() {
  const products = useSelector(s => s.products.products);
  const branches = useSelector(s => s.branches.branches);
  const currentBranchId = useSelector(s => s.settings.currentBranchId);
  const auth = useSelector(s => s.auth);
  const audit = useSelector(s => s.audit.entries);
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [fromId, setFromId] = useState(currentBranchId || branches[0]?.id || '');
  const [toId, setToId] = useState(branches.find(b => b.id !== currentBranchId)?.id || branches[1]?.id || branches[0]?.id || '');
  const [qty, setQty] = useState(1);
  const [fActor, setFActor] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const dispatch = useDispatch();
  const toast = useToast();
  useEffect(() => {
    setFromId(currentBranchId);
  }, [currentBranchId]);

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

  function exportCsv() {
    const headers = ['Timestamp','Actor','Product','From','To','Qty','Remark'];
    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.map(escape).join(',')];
    transfers.forEach(e => {
      const d = e.details || {};
      lines.push([e.ts, e.actor, d.product || '', byId.get(d.from) || d.from || '', byId.get(d.to) || d.to || '', d.qty ?? '', e.remark || ''].map(escape).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transfers.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function transfer() {
    if (!productId || !fromId || !toId || fromId === toId || qty <= 0) {
      toast.show('Check product, branches and quantity', { type: 'error' });
      return;
    }
    const remark = window.prompt('Enter reason/remark for this transfer');
    if (!remark || !remark.trim()) {
      toast.show('Remark is required for transfers', { type: 'error' });
      return;
    }
    dispatch(adjustStock({ productId, branchId: fromId, delta: -Number(qty) }));
    dispatch(adjustStock({ productId, branchId: toId, delta: Number(qty) }));
    const prod = products.find(p => p.id === productId);
    dispatch(addAudit({
      actor: auth.user?.name || 'unknown',
      actionType: 'stock_transfer',
      details: { product: prod?.name || productId, from: fromId, to: toId, qty: Number(qty) },
      remark,
      branchId: fromId
    }));
    setQty(1);
    toast.show('Transfer recorded', { type: 'success' });
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Transfers</h1>
      <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select className="select" value={productId} onChange={e => setProductId(e.target.value)}>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <BranchSelect value={fromId} onChange={setFromId} />
        <BranchSelect value={toId} onChange={setToId} enforceRole={false} />
        <input className="input" type="number" min="1" value={qty} onChange={e => setQty(Number(e.target.value))} style={{ width: 120 }} />
        <button className="btn btn-primary" onClick={transfer}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M7 7h10M7 17h10M7 7l-3 3m3-3l-3-3M17 17l3 3m-3-3l3-3" stroke="currentColor" strokeWidth="2"/></svg>
          Transfer
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
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label>
            To Branch
            <select className="select" value={fTo} onChange={e => setFTo(e.target.value)}>
              <option value="">All</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <div style={{ alignSelf: 'end' }}>
            <button className="btn" onClick={exportCsv}>Export CSV</button>
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
            {transfers.map(e => {
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
      </div>
    </div>
  );
}

export default TransfersPage;
