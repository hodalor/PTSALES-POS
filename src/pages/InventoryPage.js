import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useMemo, useState } from 'react';
import { setStock } from '../store/productsSlice';
import { addAudit } from '../store/auditSlice';
import BranchSelect from '../components/BranchSelect';
import * as stockApi from '../api/stock';
import { formatCurrency } from '../utils/currency';
import { useToast } from '../components/ToastProvider';
import { enqueueHttp, isOfflineBackupEnabled } from '../offline/offlineBackup';
import OfflineQueueIndicator from '../components/OfflineQueueIndicator';

function InventoryPage() {
  const products = useSelector(s => s.products.products);
  const branches = useSelector(s => s.branches.branches);
  const currentBranchId = useSelector(s => s.settings.currentBranchId);
  const settings = useSelector(s => s.settings);
  const auth = useSelector(s => s.auth);
  const offlineBackupAllowed = isOfflineBackupEnabled(settings);
  const allowManualStockEdit = false;
  const [branchId, setBranchId] = useState(currentBranchId);
  const [viewInventoryType, setViewInventoryType] = useState('retail');
  const [modalId, setModalId] = useState(null);
  const [openVariantsFor, setOpenVariantsFor] = useState(null);
  const dispatch = useDispatch();
  const toast = useToast();

  const branch = useMemo(() => branches.find(b => b.id === branchId) || branches[0], [branches, branchId]);
  const rows = useMemo(() => products, [products]);
  useEffect(() => { setBranchId(currentBranchId); }, [currentBranchId]);
  const selected = useMemo(() => rows.find(p => p.id === modalId) || null, [rows, modalId]);

  function setStockWithAudit(p, variantId, bId, quantity) {
    if (!allowManualStockEdit) {
      toast.show('Manual stock editing is disabled', { type: 'warning' });
      return;
    }
    const oldQty = variantId
      ? ((p.variants?.find(v => v.id === variantId)?.stockByBranch || {})[bId] || 0)
      : (p.stockByBranch?.[bId] || 0);
    const delta = Number(quantity) - Number(oldQty);
    if (!navigator.onLine && !offlineBackupAllowed) {
      toast.show('Offline: cannot save stock changes', { type: 'error' });
      return;
    }
    dispatch(setStock({ productId: p.id, variantId: variantId || undefined, branchId: bId, quantity: Number(quantity) }));
    dispatch(addAudit({
      actor: auth.user?.name || 'unknown',
      actionType: 'stock_set_manual',
      details: { product: p.name, variant: (p.variants || []).find(v => v.id === variantId)?.label || '', quantity: Number(quantity), delta, branchId: bId },
      branchId: bId,
      offline: !navigator.onLine
    }));
    const payload = {
      productId: p.id,
      branchId: bId,
      quantity: Number(quantity),
      actor: auth.user?.name || 'unknown',
      variantId: variantId || undefined
    };
    if (!navigator.onLine) {
      enqueueHttp({ collection: 'audits', label: 'Stock set', path: '/api/stock/set', method: 'POST', body: payload })
        .catch(() => {
          dispatch(setStock({ productId: p.id, variantId: variantId || undefined, branchId: bId, quantity: Number(oldQty) }));
          toast.show('Failed to save offline', { type: 'error' });
        });
      return;
    }
    stockApi.setStock(payload)
      .catch((e) => {
        dispatch(setStock({ productId: p.id, variantId: variantId || undefined, branchId: bId, quantity: Number(oldQty) }));
        toast.show(String(e?.message || 'Failed to save stock'), { type: 'error' });
      });
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Inventory</h1>
        <OfflineQueueIndicator collection="audits" label="Stock queued" />
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 12, color: '#64748b' }}>Branch</label>
          <BranchSelect value={branchId} onChange={setBranchId} style={{ minWidth: 220 }} />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button className={viewInventoryType === 'retail' ? 'btn btn-primary' : 'btn'} onClick={() => setViewInventoryType('retail')}>Retail</button>
            <button className={viewInventoryType === 'wholesale' ? 'btn btn-primary' : 'btn'} onClick={() => setViewInventoryType('wholesale')}>Wholesale</button>
          </div>
        </div>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th align="left">Product</th>
              <th align="left">Price</th>
              <th align="left">Barcode</th>
              <th align="left">Stock ({viewInventoryType === 'wholesale' ? 'Wholesale' : 'Retail'} – {branch?.code || branch?.name})</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(p => {
              const low = p.lowStock ?? 0;
              const cur = (viewInventoryType === 'wholesale' ? (p.wholesaleStockByBranch || {})[branchId] : (p.stockByBranch || {})[branchId]) || 0;
              const basePrice = viewInventoryType === 'wholesale'
                ? (p.wholesalePrice != null ? p.wholesalePrice : p.price)
                : (p.retailPrice != null ? p.retailPrice : p.price);
              const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
              return (
                <>
                  <tr key={p.id} onClick={() => setModalId(p.id)} style={{ cursor: 'pointer' }}>
                    <td>{p.name}</td>
                    <td>{formatCurrency(basePrice || 0, settings)}</td>
                    <td><code style={{ fontSize: 12 }}>{p.barcode || '—'}</code></td>
                    <td onClick={e => e.stopPropagation()}>
                      {hasVariants ? (
                        <button className="btn" onClick={() => setOpenVariantsFor(o => o === p.id ? null : p.id)}>Variants</button>
                      ) : (
                        <input
                          className="input"
                          type="number"
                          min="0"
                          value={cur}
                          onChange={e => setStockWithAudit(p, null, branchId, Number(e.target.value))}
                          style={{
                            width: 100,
                            borderColor: low > 0 && cur <= low ? '#ef4444' : undefined,
                            color: low > 0 && cur <= low ? '#b91c1c' : undefined
                          }}
                          disabled
                        />
                      )}
                    </td>
                  </tr>
                  {(openVariantsFor === p.id && hasVariants) && (
                    <tr key={`${p.id}-variants`} style={{ background: '#fbfdff' }}>
                      <td colSpan="4">
                        <div style={{ display: 'grid', gap: 6 }}>
                          {p.variants.map(v => (
                            <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, alignItems: 'center' }}>
                              <div><strong>{v.label}</strong> <span style={{ color: '#64748b' }}>{v.sku || ''}</span></div>
                          <input
                                className="input"
                                type="number"
                                min="0"
                                value={(viewInventoryType === 'wholesale' ? (v.wholesaleStockByBranch || {})[branchId] : (v.stockByBranch || {})[branchId]) || 0}
                                onChange={e => setStockWithAudit(p, v.id, branchId, Number(e.target.value))}
                                style={{ width: 120 }}
                                disabled
                              />
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
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
                <div><strong>Retail Price:</strong> {formatCurrency(Number(selected.retailPrice != null ? selected.retailPrice : selected.price || 0), settings)}</div>
                <div><strong>Wholesale Price:</strong> {formatCurrency(Number(selected.wholesalePrice != null ? selected.wholesalePrice : selected.price || 0), settings)}</div>
                <div><strong>Barcode:</strong> <code style={{ fontSize: 12 }}>{selected.barcode || '—'}</code></div>
                <div><strong>Low Stock:</strong> {selected.lowStock ?? 0}</div>
                <div><strong>Total Retail Across Branches:</strong> {Object.values(selected.stockByBranch || {}).reduce((a, b) => a + (b || 0), 0)}</div>
                <div><strong>Total Wholesale Across Branches:</strong> {Object.values(selected.wholesaleStockByBranch || {}).reduce((a, b) => a + (b || 0), 0)}</div>
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
                          onChange={e => setStockWithAudit(selected, null, b.id, Number(e.target.value))}
                          style={{ width: 80 }}
                          disabled
                        />
                          <input
                            className="input"
                            type="number"
                            min="0"
                            value={selected.wholesaleStockByBranch?.[b.id] || 0}
                            onChange={e => setStockWithAudit(selected, null, b.id, Number(e.target.value))}
                            style={{ width: 80, marginLeft: 4 }}
                            disabled
                          />
                      </div>
                    ))}
                  </div>
                </div>
                {(Array.isArray(selected.variants) && selected.variants.length > 0) && (
                  <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                    <strong>Variants (current branch)</strong>
                    <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                      {selected.variants.map(v => (
                        <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
                          <div><strong>{v.label}</strong> <span style={{ color: '#64748b' }}>{v.sku || ''}</span></div>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            value={v.stockByBranch?.[branchId] || 0}
                            onChange={e => setStockWithAudit(selected, v.id, branchId, Number(e.target.value))}
                            style={{ width: 100 }}
                            disabled
                          />
                          <input
                            className="input"
                            type="number"
                            min="0"
                            value={v.wholesaleStockByBranch?.[branchId] || 0}
                            onChange={e => setStockWithAudit(selected, v.id, branchId, Number(e.target.value))}
                            style={{ width: 100 }}
                            disabled
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryPage;
