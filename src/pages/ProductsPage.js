import { useDispatch, useSelector } from 'react-redux';
import { addProduct, updateProduct, removeProduct, setStock, addCategory } from '../store/productsSlice';
import { useState } from 'react';
import { formatCurrency } from '../utils/currency';
import { addAudit } from '../store/auditSlice';

function ProductsPage() {
  const dispatch = useDispatch();
  const products = useSelector(s => s.products.products);
  const categories = useSelector(s => s.products.categories);
  const branches = useSelector(s => s.branches.branches);
  const settings = useSelector(s => s.settings);
  const currentBranchId = useSelector(s => s.settings.currentBranchId);
  const currentBranch = branches.find(b => b.id === currentBranchId);
  const currentBranchLabel = (currentBranch?.code) || (currentBranch?.name) || currentBranchId;
  const auth = useSelector(s => s.auth);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState(categories[0] || '');
  const [newCategory, setNewCategory] = useState('');
  const [initialStock, setInitialStock] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [imagePreview, setImagePreview] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCategory, setEditCategory] = useState(categories[0] || '');
  const [editLowStock, setEditLowStock] = useState(0);
  const [editImagePreview, setEditImagePreview] = useState('');

  function copy(text) {
    try {
      navigator.clipboard.writeText(text);
    } catch {}
  }

  function onFileChange(e, setter) {
    const f = e.target.files?.[0];
    if (!f) { setter(''); return; }
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result || ''));
    reader.readAsDataURL(f);
  }

  function add() {
    if (!name.trim() || !sku.trim() || !price) return;
    const action = dispatch(addProduct({ name: name.trim(), sku: sku.trim(), price: Number(price), category, lowStock: Number(lowStock) || 0, image: imagePreview || null }));
    const newId = action?.payload?.id;
    if (newId && (Number(initialStock) || 0) > 0) {
      dispatch(setStock({ productId: newId, branchId: currentBranchId, quantity: Number(initialStock) || 0 }));
    }
    dispatch(addAudit({
      actor: auth.user?.name || 'unknown',
      actionType: 'product_add',
      details: { name: name.trim(), sku: sku.trim(), price: Number(price) },
      branchId: currentBranchId
    }));
    setName(''); setSku(''); setPrice(''); setInitialStock(0); setLowStock(0); setImagePreview('');
  }

  function addCat() {
    if (!newCategory.trim()) return;
    dispatch(addCategory(newCategory.trim()));
    setCategory(newCategory.trim());
    setNewCategory('');
  }

  function startEdit(p) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditSku(p.sku);
    setEditPrice(String(p.price || 0));
    setEditCategory(p.category || '');
    setEditLowStock(p.lowStock || 0);
    setEditImagePreview(p.image || '');
  }

  function saveEdit() {
    const original = products.find(p => p.id === editingId);
    let remark = '';
    if (original && Number(original.price) !== Number(editPrice)) {
      remark = window.prompt('Enter remark for price change') || '';
      if (!remark.trim()) {
        alert('Remark is required when changing price');
        return;
      }
    }
    dispatch(updateProduct({ id: editingId, name: editName.trim(), sku: editSku.trim(), price: Number(editPrice), category: editCategory, lowStock: Number(editLowStock) || 0, image: editImagePreview || null }));
    const changed = {};
    if (original) {
      if (original.name !== editName.trim()) changed.name = { from: original.name, to: editName.trim() };
      if (original.sku !== editSku.trim()) changed.sku = { from: original.sku, to: editSku.trim() };
      if (Number(original.price) !== Number(editPrice)) changed.price = { from: Number(original.price), to: Number(editPrice) };
      if ((original.category || '') !== editCategory) changed.category = { from: original.category || '', to: editCategory };
      if ((original.lowStock || 0) !== Number(editLowStock)) changed.lowStock = { from: original.lowStock || 0, to: Number(editLowStock) };
    }
    dispatch(addAudit({
      actor: auth.user?.name || 'unknown',
      actionType: 'product_update',
      details: { id: editingId, changed },
      remark,
      branchId: currentBranchId
    }));
    setEditingId(null);
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Products</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        <div className="card">
          <h2 className="section-title">Add Product</h2>
          <input className="input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8 }} />
          <input className="input" placeholder="SKU" value={sku} onChange={e => setSku(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8 }} />
          <input className="input" placeholder="Price" type="number" value={price} onChange={e => setPrice(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8 }} />
          <select className="select" value={category} onChange={e => setCategory(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8 }}>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <label>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Initial Stock ({currentBranchLabel})</div>
              <input className="input" type="number" min="0" value={initialStock} onChange={e => setInitialStock(Number(e.target.value))} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Low Stock Alert</div>
              <input className="input" type="number" min="0" value={lowStock} onChange={e => setLowStock(Number(e.target.value))} />
            </label>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Product Image</div>
            <input type="file" accept="image/*" onChange={e => onFileChange(e, setImagePreview)} />
            {imagePreview && <div style={{ marginTop: 8 }}><img src={imagePreview} alt="preview" className="thumb" /></div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8 }}>
            <input className="input" placeholder="New category" value={newCategory} onChange={e => setNewCategory(e.target.value)} />
            <button className="btn" onClick={addCat}>
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2"/></svg>
              Add Category
            </button>
          </div>
          <button className="btn btn-primary" onClick={add}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2"/></svg>
            Add Product
          </button>
        </div>
        <div className="card">
          <h2 className="section-title">Catalog</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Image</th>
                <th align="left">Name</th>
                <th align="left">SKU</th>
                <th align="left">Barcode</th>
                <th align="left">Price</th>
                <th align="left">Category</th>
                <th align="left">Low</th>
                <th align="left">Stock ({currentBranchLabel})</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td>
                    {editingId === p.id ? (
                      <div>
                        {editImagePreview && <img src={editImagePreview} alt="preview" className="thumb" />}
                        <div style={{ marginTop: 6 }}>
                          <input type="file" accept="image/*" onChange={e => onFileChange(e, setEditImagePreview)} />
                        </div>
                      </div>
                    ) : (
                      p.image ? <img src={p.image} alt={p.name} className="thumb" /> : <span style={{ color: '#94a3b8' }}>—</span>
                    )}
                  </td>
                  <td>
                    {editingId === p.id ? (
                      <input className="input" value={editName} onChange={e => setEditName(e.target.value)} />
                    ) : p.name}
                  </td>
                  <td>
                    {editingId === p.id ? (
                      <input className="input" value={editSku} onChange={e => setEditSku(e.target.value)} />
                    ) : p.sku}
                  </td>
                  <td>
                    {p.barcode ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <code style={{ fontSize: 12, color: '#0f172a' }}>{p.barcode}</code>
                        <button className="btn" onClick={() => copy(p.barcode)} title="Copy barcode">
                          <svg viewBox="0 0 24 24" fill="none"><path d="M9 9h11v11H9z" stroke="currentColor" strokeWidth="2"/><path d="M5 5h11v11" stroke="currentColor" strokeWidth="2"/></svg>
                          Copy
                        </button>
                      </div>
                    ) : '-'}
                  </td>
                  <td>
                    {editingId === p.id ? (
                      <input className="input" type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} style={{ width: 100 }} />
                    ) : formatCurrency(p.price, settings)}
                  </td>
                  <td>
                    {editingId === p.id ? (
                      <select className="select" value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                        {categories.map(c => <option key={c}>{c}</option>)}
                      </select>
                    ) : (p.category || '-')}
                  </td>
                  <td>
                    {editingId === p.id ? (
                      <input className="input" type="number" min="0" value={editLowStock} onChange={e => setEditLowStock(Number(e.target.value))} style={{ width: 80 }} />
                    ) : (p.lowStock ?? 0)}
                  </td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={p.stockByBranch?.[currentBranchId] || 0}
                      onChange={e => dispatch(setStock({ productId: p.id, branchId: currentBranchId, quantity: Number(e.target.value) }))}
                      style={{ width: 100 }}
                    />
                  </td>
                  <td>
                    {editingId === p.id ? (
                      <>
                        <button className="btn btn-primary" onClick={saveEdit}>
                          <svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2"/></svg>
                          Save
                        </button>
                        <button className="btn" onClick={() => setEditingId(null)} style={{ marginLeft: 6 }}>
                          <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2"/></svg>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn" onClick={() => startEdit(p)}>
                          <svg viewBox="0 0 24 24" fill="none"><path d="M4 21h4l11-11-4-4L4 17v4z" stroke="currentColor" strokeWidth="2"/></svg>
                          Edit
                        </button>
                        <button className="btn" onClick={() => dispatch(removeProduct(p.id))} style={{ marginLeft: 6 }}>
                          <svg viewBox="0 0 24 24" fill="none"><path d="M6 7h12M10 11v6M14 11v6M9 7l1-2h4l1 2M7 7l1 12h8l1-12" stroke="currentColor" strokeWidth="2"/></svg>
                          Remove
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ProductsPage;
