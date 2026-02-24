import { useDispatch, useSelector } from 'react-redux';
import { useState } from 'react';
import { adjustStock } from '../store/productsSlice';
import { useToast } from '../components/ToastProvider';
import BranchSelect from '../components/BranchSelect';
import { addAudit } from '../store/auditSlice';

function PurchasesPage() {
  const products = useSelector(s => s.products.products);
  const currentBranchId = useSelector(s => s.settings.currentBranchId);
  const auth = useSelector(s => s.auth);
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [branchId, setBranchId] = useState(currentBranchId);
  const [qty, setQty] = useState(1);
  const dispatch = useDispatch();
  const toast = useToast();

  function receive() {
    if (!productId || !branchId || qty <= 0) {
      toast.show('Select product/branch and quantity', { type: 'error' });
      return;
    }
    dispatch(adjustStock({ productId, branchId, delta: Number(qty) }));
    const prod = products.find(p => p.id === productId);
    dispatch(addAudit({
      actor: auth.user?.name || 'unknown',
      actionType: 'stock_receive',
      details: { product: prod?.name || productId, qty: Number(qty), branchId },
      branchId
    }));
    setQty(1);
    toast.show('Stock received', { type: 'success' });
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Purchases (Receive Stock)</h1>
      <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select className="select" value={productId} onChange={e => setProductId(e.target.value)}>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <BranchSelect value={branchId} onChange={setBranchId} />
        <input className="input" type="number" min="1" value={qty} onChange={e => setQty(Number(e.target.value))} style={{ width: 120 }} />
        <button className="btn btn-primary" onClick={receive}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v12M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2"/><path d="M5 19h14" stroke="currentColor" strokeWidth="2"/></svg>
          Receive
        </button>
      </div>
    </div>
  );
}

export default PurchasesPage;
