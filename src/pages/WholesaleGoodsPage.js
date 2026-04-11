import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { formatCurrency } from '../utils/currency';

function WholesaleGoodsPage() {
  const products = useSelector(s => s.products.products || []);
  const branches = useSelector(s => s.branches.branches || []);
  const settings = useSelector(s => s.settings);
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState('card');

  const wholesaleBranches = useMemo(
    () => branches.filter(branch => String(branch.branchType || 'retail').toLowerCase() === 'wholesale'),
    [branches]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .map(product => {
        const wholesaleStock = Object.values(product.wholesaleStockByBranch || {}).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
        return { ...product, wholesaleStock };
      })
      .filter(product => !q || [product.name, product.sku, product.barcode].some(value => String(value || '').toLowerCase().includes(q)))
      .sort((a, b) => b.wholesaleStock - a.wholesaleStock || String(a.name || '').localeCompare(String(b.name || '')));
  }, [products, query]);

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <h1 style={{ margin: 0 }}>Wholesale Goods</h1>
          <div style={{ color: '#64748b', fontSize: 13 }}>Browse products available in wholesale shops and switch between list and card views.</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={viewMode === 'card' ? 'btn btn-primary' : 'btn'} onClick={() => setViewMode('card')}>Card</button>
          <button className={viewMode === 'list' ? 'btn btn-primary' : 'btn'} onClick={() => setViewMode('list')}>List</button>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <input className="input" placeholder="Search wholesale goods by name, SKU, or barcode" value={query} onChange={e => setQuery(e.target.value)} />
        <div style={{ color: '#64748b', fontSize: 13 }}>Wholesale shops: {wholesaleBranches.map(branch => branch.name).join(', ') || 'None configured'}</div>
      </div>

      {viewMode === 'card' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {rows.map(product => (
            <div key={product.id} className="card" style={{ display: 'grid', gap: 8 }}>
              {product.image ? (
                <img src={product.image} alt={product.name} style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 10, border: '1px solid #e2e8f0' }} />
              ) : (
                <div style={{ height: 160, borderRadius: 10, border: '1px dashed #cbd5e1', display: 'grid', placeItems: 'center', color: '#94a3b8' }}>
                  No image
                </div>
              )}
              <div style={{ fontWeight: 700, fontSize: 18 }}>{product.name}</div>
              <div style={{ color: '#64748b' }}>{product.sku || 'No SKU'}</div>
              <div><strong>Wholesale Stock:</strong> {product.wholesaleStock}</div>
              <div><strong>Wholesale Price:</strong> {formatCurrency(Number(product.wholesalePrice != null ? product.wholesalePrice : product.price || 0), settings)}</div>
              <div><strong>Agent Price:</strong> {formatCurrency(Number(product.agentPrice != null ? product.agentPrice : (product.wholesalePrice != null ? product.wholesalePrice : (product.price || 0))), settings)}</div>
              <div><strong>Retail Price:</strong> {formatCurrency(Number(product.retailPrice != null ? product.retailPrice : product.price || 0), settings)}</div>
              <div style={{ color: product.wholesaleStock <= Number(product.lowStock || 0) ? '#b91c1c' : '#15803d', fontWeight: 700 }}>
                {product.wholesaleStock <= Number(product.lowStock || 0) ? 'Low stock' : 'Available'}
              </div>
            </div>
          ))}
          {rows.length === 0 && <div className="card" style={{ color: '#64748b' }}>No wholesale goods found</div>}
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th align="left">Image</th>
                <th align="left">Product</th>
                <th align="left">SKU</th>
                <th align="left">Wholesale Stock</th>
                <th align="left">Retail Price</th>
                <th align="left">Wholesale Price</th>
                <th align="left">Agent Price</th>
                <th align="left">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(product => (
                <tr key={product.id}>
                  <td>{product.image ? <img src={product.image} alt={product.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }} /> : <span style={{ color: '#94a3b8' }}>—</span>}</td>
                  <td>{product.name}</td>
                  <td>{product.sku || '—'}</td>
                  <td>{product.wholesaleStock}</td>
                  <td>{formatCurrency(Number(product.retailPrice != null ? product.retailPrice : product.price || 0), settings)}</td>
                  <td>{formatCurrency(Number(product.wholesalePrice != null ? product.wholesalePrice : product.price || 0), settings)}</td>
                  <td>{formatCurrency(Number(product.agentPrice != null ? product.agentPrice : (product.wholesalePrice != null ? product.wholesalePrice : (product.price || 0))), settings)}</td>
                  <td>{product.wholesaleStock <= Number(product.lowStock || 0) ? 'Low stock' : 'Available'}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="8" style={{ padding: 12, color: '#64748b' }}>No wholesale goods found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default WholesaleGoodsPage;
