import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import BranchSelect from '../components/BranchSelect';
import * as productUnitsApi from '../api/productUnits';
import { useToast } from '../components/ToastProvider';

function SerializedInventoryPage() {
  const toast = useToast();
  const products = useSelector(s => s.products.products || []);
  const branches = useSelector(s => s.branches.branches || []);
  const [productId, setProductId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState('');
  const [inventoryType, setInventoryType] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const productNameById = useMemo(() => new Map(products.map(product => [String(product.id), product.name])), [products]);
  const branchNameById = useMemo(() => new Map(branches.map(branch => [String(branch.id), branch.name])), [branches]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let alive = true;
    const cached = productUnitsApi.getCachedProductUnits({
      productId,
      branchId,
      status,
      inventoryType,
      query: debouncedQuery,
      page,
      pageSize
    });
    if (alive && Array.isArray(cached?.rows) && cached.rows.length > 0) {
      setRows(cached.rows);
      setTotal(Number(cached.total || 0));
    }
    async function run() {
      setLoading(true);
      try {
        const result = await productUnitsApi.listProductUnits({
          productId,
          branchId,
          status,
          inventoryType,
          query: debouncedQuery,
          page,
          pageSize
        });
        if (!alive) return;
        setRows(Array.isArray(result?.rows) ? result.rows : []);
        setTotal(Number(result?.total || 0));
      } catch (e) {
        if (!alive) return;
        toast.show(String(e?.message || 'Failed to load serialized inventory'), { type: 'error' });
        setRows([]);
        setTotal(0);
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => { alive = false; };
  }, [branchId, debouncedQuery, inventoryType, page, pageSize, productId, status, toast]);

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div className="card">
        <h1 style={{ margin: 0 }}>Serialized Inventory</h1>
        <div style={{ color: '#64748b', marginTop: 6 }}>Search unit-level stock by branch, status, inventory type, IMEI, or serial number.</div>
      </div>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr', gap: 10 }}>
        <label>
          <div style={{ marginBottom: 6, color: '#64748b' }}>Search</div>
          <input className="input" value={query} onChange={e => { setPage(1); setQuery(e.target.value); }} placeholder="IMEI or serial number" />
        </label>
        <label>
          <div style={{ marginBottom: 6, color: '#64748b' }}>Product</div>
          <select className="select" value={productId} onChange={e => { setPage(1); setProductId(e.target.value); }}>
            <option value="">All Products</option>
            {products.filter(product => String(product.trackType || 'quantity') === 'serialized').map(product => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
        </label>
        <label>
          <div style={{ marginBottom: 6, color: '#64748b' }}>Branch</div>
          <BranchSelect value={branchId} onChange={value => { setPage(1); setBranchId(value); }} includeAll />
        </label>
        <label>
          <div style={{ marginBottom: 6, color: '#64748b' }}>Inventory Type</div>
          <select className="select" value={inventoryType} onChange={e => { setPage(1); setInventoryType(e.target.value); }}>
            <option value="">All</option>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
            <option value="warehouse">Warehouse</option>
          </select>
        </label>
        <label>
          <div style={{ marginBottom: 6, color: '#64748b' }}>Status</div>
          <select className="select" value={status} onChange={e => { setPage(1); setStatus(e.target.value); }}>
            <option value="">All</option>
            <option value="in_stock">In Stock</option>
            <option value="reserved">Reserved</option>
            <option value="sold">Sold</option>
            <option value="returned">Returned</option>
            <option value="adjusted_out">Adjusted Out</option>
          </select>
        </label>
      </div>
      <div className="card">
        <div style={{ color: '#64748b', marginBottom: 8 }}>Total Units: {total}</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th align="left">Product</th>
                <th align="left">IMEI</th>
                <th align="left">Serial</th>
                <th align="left">Branch</th>
                <th align="left">Inventory</th>
                <th align="left">Status</th>
                <th align="left">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row._id}>
                  <td>{productNameById.get(String(row.productId)) || row.productId}</td>
                  <td>{row.imei || '—'}</td>
                  <td>{row.serialNumber || '—'}</td>
                  <td>{branchNameById.get(String(row.branchId)) || row.branchId}</td>
                  <td>{row.inventoryType}</td>
                  <td>{row.status}</td>
                  <td>{row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && <tr><td colSpan="7" style={{ padding: 12, color: '#64748b' }}>No serialized units found</td></tr>}
              {loading && <tr><td colSpan="7" style={{ padding: 12, color: '#64748b' }}>Loading…</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
            <span>Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
            <button className="btn" onClick={() => setPage(p => Math.min(Math.max(1, Math.ceil(total / pageSize)), p + 1))} disabled={page >= Math.max(1, Math.ceil(total / pageSize))}>Next</button>
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

export default SerializedInventoryPage;
