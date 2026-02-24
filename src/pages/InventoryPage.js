import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useMemo, useState } from 'react';
import { setStock } from '../store/productsSlice';
import BranchSelect from '../components/BranchSelect';

function InventoryPage() {
  const products = useSelector(s => s.products.products);
  const branches = useSelector(s => s.branches.branches);
  const currentBranchId = useSelector(s => s.settings.currentBranchId);
  const [branchId, setBranchId] = useState(currentBranchId);
  const [modalId, setModalId] = useState(null);
  const dispatch = useDispatch();

  const branch = useMemo(() => branches.find(b => b.id === branchId) || branches[0], [branches, branchId]);
  const rows = useMemo(() => products, [products]);
  useEffect(() => { setBranchId(currentBranchId); }, [currentBranchId]);
  const selected = useMemo(() => rows.find(p => p.id === modalId) || null, [rows, modalId]);

  return (
    <div style={{ padding: 16 }}>
      <h1>Inventory</h1>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 12, color: '#64748b' }}>Branch</label>
          <BranchSelect value={branchId} onChange={setBranchId} style={{ minWidth: 220 }} />
        </div>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th align="left">Product</th>
              <th align="left">Price</th>
              <th align="left">Barcode</th>
              <th align="left">Stock ({branch?.code || branch?.name})</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(p => {
              const low = p.lowStock ?? 0;
              const cur = p.stockByBranch?.[branchId] || 0;
              return (
                <tr key={p.id} onClick={() => setModalId(p.id)} style={{ cursor: 'pointer' }}>
                  <td>{p.name}</td>
                  <td>${(p.price || 0).toFixed(2)}</td>
                  <td><code style={{ fontSize: 12 }}>{p.barcode || '—'}</code></td>
                  <td onClick={e => e.stopPropagation()}>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={cur}
                      onChange={e => dispatch(setStock({ productId: p.id, branchId, quantity: Number(e.target.value) }))}
                      style={{
                        width: 100,
                        borderColor: low > 0 && cur <= low ? '#ef4444' : undefined,
                        color: low > 0 && cur <= low ? '#b91c1c' : undefined
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selected && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.6)', display: 'grid', placeItems: 'center', zIndex: 1000 }} onClick={() => setModalId(null)}>
          <div className="card" style={{ width: 720, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>{selected.name}</h2>
              <button className="btn" onClick={() => setModalId(null)}>
                <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2"/></svg>
                Close
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, marginTop: 12 }}>
              <div>{selected.image ? <img src={selected.image} alt={selected.name} className="thumb" /> : <div style={{ color: '#94a3b8' }}>No image</div>}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                <div><strong>SKU:</strong> {selected.sku}</div>
                <div><strong>Category:</strong> {selected.category || '—'}</div>
                <div><strong>Price:</strong> ${Number(selected.price || 0).toFixed(2)}</div>
                <div><strong>Barcode:</strong> <code style={{ fontSize: 12 }}>{selected.barcode || '—'}</code></div>
                <div><strong>Low Stock:</strong> {selected.lowStock ?? 0}</div>
                <div><strong>Total Across Branches:</strong> {Object.values(selected.stockByBranch || {}).reduce((a, b) => a + (b || 0), 0)}</div>
                <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                  <strong>Branch Breakdown</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 6, marginTop: 6 }}>
                    {branches.map(b => (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <small style={{ width: 90 }}>{b.code || b.name}</small>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          value={selected.stockByBranch?.[b.id] || 0}
                          onChange={e => dispatch(setStock({ productId: selected.id, branchId: b.id, quantity: Number(e.target.value) }))}
                          style={{ width: 80 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryPage;

