import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import { adjustStock } from '../store/productsSlice';
import { useToast } from '../components/ToastProvider';
import BranchSelect from '../components/BranchSelect';
import { addAudit } from '../store/auditSlice';

function AdjustmentsPage() {
  const products = useSelector(s => s.products.products);
  const currentBranchId = useSelector(s => s.settings.currentBranchId);
  const auth = useSelector(s => s.auth);
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [branchId, setBranchId] = useState(currentBranchId);
  const [delta, setDelta] = useState(0);
  const dispatch = useDispatch();
  const toast = useToast();
  useEffect(() => { setBranchId(currentBranchId); }, [currentBranchId]);

  function adjust() {
    if (!productId || !branchId || delta === 0) {
      toast.show('Select product/branch and enter non-zero delta', { type: 'error' });
      return;
    }
    const remark = window.prompt('Enter reason/remark for this adjustment');
    if (!remark || !remark.trim()) {
      toast.show('Remark is required for adjustments', { type: 'error' });
      return;
    }
    dispatch(adjustStock({ productId, branchId, delta: Number(delta) }));
    const prod = products.find(p => p.id === productId);
    dispatch(addAudit({
      actor: auth.user?.name || 'unknown',
      actionType: 'stock_adjust',
      details: { product: prod?.name || productId, delta: Number(delta), branchId },
      remark,
      branchId
    }));
    setDelta(0);
    toast.show('Adjustment applied', { type: 'success' });
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Adjustments</h1>
      <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select className="select" value={productId} onChange={e => setProductId(e.target.value)}>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <BranchSelect value={branchId} onChange={setBranchId} />
        <input className="input" type="number" value={delta} onChange={e => setDelta(Number(e.target.value))} style={{ width: 120 }} />
        <button className="btn btn-primary" onClick={adjust}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2"/></svg>
          Apply
        </button>
      </div>
    </div>
  );
}

export default AdjustmentsPage;
