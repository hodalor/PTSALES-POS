import { useDispatch, useSelector } from 'react-redux';
import { addProduct, updateProduct, removeProduct, setStock, addCategory } from '../store/productsSlice';
import { useMemo, useState } from 'react';
import { formatCurrency } from '../utils/currency';
import { addAudit } from '../store/auditSlice';
import { useToast } from '../components/ToastProvider';
import { promptDialog } from '../utils/dialogs';
import { productSpec } from '../utils/productSpec';

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
  // Units & attributes (add)
  const [unitKind, setUnitKind] = useState('none'); // none|volume|mass|length|size|shoe
  const [unitValue, setUnitValue] = useState('');
  const [unitSymbol, setUnitSymbol] = useState('');
  const [sizeLabel, setSizeLabel] = useState('');
  const [shoeSize, setShoeSize] = useState('');
  const [attrs, setAttrs] = useState([{ key: '', value: '' }]);
  const [packs, setPacks] = useState([{ name: '', quantity: '' }]);
  const [variants, setVariants] = useState([{ label: '', sku: '', price: '' }]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCategory, setEditCategory] = useState(categories[0] || '');
  const [editLowStock, setEditLowStock] = useState(0);
  const [editImagePreview, setEditImagePreview] = useState('');
  // Units & attributes (edit)
  const [editUnitKind, setEditUnitKind] = useState('none');
  const [editUnitValue, setEditUnitValue] = useState('');
  const [editUnitSymbol, setEditUnitSymbol] = useState('');
  const [editSizeLabel, setEditSizeLabel] = useState('');
  const [editShoeSize, setEditShoeSize] = useState('');
  const [editAttrs, setEditAttrs] = useState([{ key: '', value: '' }]);
  const [editPacks, setEditPacks] = useState([{ name: '', quantity: '' }]);
  const [editVariants, setEditVariants] = useState([{ label: '', sku: '', price: '' }]);
  const [openStockFor, setOpenStockFor] = useState(null);
  const toast = useToast();

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
    const cleanAttrs = (attrs || []).filter(a => a.key && a.value).map(a => ({ key: a.key.trim(), value: a.value.trim() }));
    const action = dispatch(addProduct({
      name: name.trim(),
      sku: sku.trim(),
      price: Number(price),
      category,
      lowStock: Number(lowStock) || 0,
      image: imagePreview || null,
      unitKind,
      unitValue: unitKind === 'volume' || unitKind === 'mass' || unitKind === 'length' ? Number(unitValue) || null : null,
      unitSymbol: unitKind === 'volume' || unitKind === 'mass' || unitKind === 'length' ? unitSymbol : '',
      sizeLabel: unitKind === 'size' ? sizeLabel.trim() : '',
      shoeSize: unitKind === 'shoe' ? shoeSize.trim() : '',
      attributes: cleanAttrs,
      packs: (packs || []).filter(p => p.name && Number(p.quantity) > 0).map(p => ({ name: p.name.trim(), quantity: Number(p.quantity) })),
      variants: (variants || []).filter(v => v.label).map(v => ({ id: crypto.randomUUID(), label: v.label.trim(), sku: v.sku?.trim() || '', price: v.price !== '' ? Number(v.price) : undefined, stockByBranch: {} }))
    }));
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
    resetUnitState();
  }

  function resetUnitState() {
    setUnitKind('none');
    setUnitValue('');
    setUnitSymbol('');
    setSizeLabel('');
    setShoeSize('');
    setAttrs([{ key: '', value: '' }]);
    setPacks([{ name: '', quantity: '' }]);
    setVariants([{ label: '', sku: '', price: '' }]);
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
    setEditUnitKind(p.unitKind || 'none');
    setEditUnitValue(p.unitValue != null ? String(p.unitValue) : '');
    setEditUnitSymbol(p.unitSymbol || '');
    setEditSizeLabel(p.sizeLabel || '');
    setEditShoeSize(p.shoeSize || '');
    setEditAttrs(Array.isArray(p.attributes) && p.attributes.length > 0 ? p.attributes.map(a => ({ key: a.key, value: a.value })) : [{ key: '', value: '' }]);
    setEditPacks(Array.isArray(p.packs) && p.packs.length > 0 ? p.packs.map(pk => ({ name: pk.name, quantity: String(pk.quantity) })) : [{ name: '', quantity: '' }]);
    setEditVariants(Array.isArray(p.variants) && p.variants.length > 0 ? p.variants.map(v => ({ id: v.id, label: v.label, sku: v.sku || '', price: v.price != null ? String(v.price) : '' })) : [{ label: '', sku: '', price: '' }]);
  }

  async function saveEdit() {
    const original = products.find(p => p.id === editingId);
    let remark = '';
    if (original && Number(original.price) !== Number(editPrice)) {
      remark = await promptDialog('Enter remark for price change');
      if (!remark || !remark.trim()) { toast.show('Remark is required when changing price', { type: 'error' }); return; }
    }
    const cleanAttrs = (editAttrs || []).filter(a => a.key && a.value).map(a => ({ key: a.key.trim(), value: a.value.trim() }));
    dispatch(updateProduct({
      id: editingId,
      name: editName.trim(),
      sku: editSku.trim(),
      price: Number(editPrice),
      category: editCategory,
      lowStock: Number(editLowStock) || 0,
      image: editImagePreview || null,
      unitKind: editUnitKind,
      unitValue: (editUnitKind === 'volume' || editUnitKind === 'mass' || editUnitKind === 'length') ? (Number(editUnitValue) || null) : null,
      unitSymbol: (editUnitKind === 'volume' || editUnitKind === 'mass' || editUnitKind === 'length') ? editUnitSymbol : '',
      sizeLabel: editUnitKind === 'size' ? editSizeLabel.trim() : '',
      shoeSize: editUnitKind === 'shoe' ? editShoeSize.trim() : '',
      attributes: cleanAttrs,
      packs: (editPacks || []).filter(p => p.name && Number(p.quantity) > 0).map(p => ({ name: p.name.trim(), quantity: Number(p.quantity) })),
      variants: (editVariants || []).filter(v => v.label).map(v => ({ id: v.id || crypto.randomUUID(), label: v.label.trim(), sku: v.sku?.trim() || '', price: v.price !== '' ? Number(v.price) : undefined, stockByBranch: (original?.variants?.find(x => x.id === v.id)?.stockByBranch) || {} }))
    }));
    const changed = {};
    if (original) {
      if (original.name !== editName.trim()) changed.name = { from: original.name, to: editName.trim() };
      if (original.sku !== editSku.trim()) changed.sku = { from: original.sku, to: editSku.trim() };
      if (Number(original.price) !== Number(editPrice)) changed.price = { from: Number(original.price), to: Number(editPrice) };
      if ((original.category || '') !== editCategory) changed.category = { from: original.category || '', to: editCategory };
      if ((original.lowStock || 0) !== Number(editLowStock)) changed.lowStock = { from: original.lowStock || 0, to: Number(editLowStock) };
      if ((original.unitKind || 'none') !== editUnitKind) changed.unitKind = { from: original.unitKind || 'none', to: editUnitKind };
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

  const unitSymbolOptions = useMemo(() => {
    if (unitKind === 'volume') return ['mL', 'L'];
    if (unitKind === 'mass') return ['g', 'kg'];
    if (unitKind === 'length') return ['mm', 'cm', 'm', 'in'];
    return [];
  }, [unitKind]);

  const editUnitSymbolOptions = useMemo(() => {
    if (editUnitKind === 'volume') return ['mL', 'L'];
    if (editUnitKind === 'mass') return ['g', 'kg'];
    if (editUnitKind === 'length') return ['mm', 'cm', 'm', 'in'];
    return [];
  }, [editUnitKind]);

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
          <div className="card" style={{ padding: 8, marginBottom: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Units & Size</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label>
                <div className="label">Type</div>
                <select className="select" value={unitKind} onChange={e => setUnitKind(e.target.value)}>
                  <option value="none">None</option>
                  <option value="volume">Volume</option>
                  <option value="mass">Mass</option>
                  <option value="length">Length</option>
                  <option value="size">Clothing Size</option>
                  <option value="shoe">Shoe Size</option>
                </select>
              </label>
              {(unitKind === 'volume' || unitKind === 'mass' || unitKind === 'length') && (
                <>
                  <label>
                    <div className="label">Value</div>
                    <input className="input" type="number" value={unitValue} onChange={e => setUnitValue(e.target.value)} />
                  </label>
                  <label>
                    <div className="label">Unit</div>
                    <select className="select" value={unitSymbol} onChange={e => setUnitSymbol(e.target.value)}>
                      <option value="">Select</option>
                      {unitSymbolOptions.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </label>
                </>
              )}
              {unitKind === 'size' && (
                <label style={{ gridColumn: '1 / span 2' }}>
                  <div className="label">Size</div>
                  <input className="input" value={sizeLabel} onChange={e => setSizeLabel(e.target.value)} placeholder="XS, S, M, L, XL, etc." />
                </label>
              )}
              {unitKind === 'shoe' && (
                <label style={{ gridColumn: '1 / span 2' }}>
                  <div className="label">Shoe Size</div>
                  <input className="input" value={shoeSize} onChange={e => setShoeSize(e.target.value)} placeholder="e.g. 42 EU or 9 US" />
                </label>
              )}
            </div>
          </div>
          <div className="card" style={{ padding: 8, marginBottom: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Attributes</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {attrs.map((row, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6 }}>
                  <input className="input" placeholder="Key (e.g., Model, RAM)" value={row.key} onChange={e => {
                    const v = e.target.value;
                    setAttrs(prev => prev.map((r, i) => i === idx ? { ...r, key: v } : r));
                  }} />
                  <input className="input" placeholder="Value (e.g., T480, 8GB)" value={row.value} onChange={e => {
                    const v = e.target.value;
                    setAttrs(prev => prev.map((r, i) => i === idx ? { ...r, value: v } : r));
                  }} />
                  <button className="btn" onClick={() => setAttrs(prev => prev.filter((_, i) => i !== idx))}>Remove</button>
                </div>
              ))}
              <div>
                <button className="btn" onClick={() => setAttrs(prev => [...prev, { key: '', value: '' }])}>
                  <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2"/></svg>
                  Add Attribute
                </button>
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: 8, marginBottom: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Packs (Unit Conversions)</div>
            <div style={{ color: '#64748b', fontSize: 12, marginBottom: 6 }}>Define larger units that convert to base items, e.g., “Case (24)” → 24.</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {packs.map((row, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 140px auto', gap: 6 }}>
                  <input className="input" placeholder="Name (e.g., Case 24)" value={row.name} onChange={e => {
                    const v = e.target.value;
                    setPacks(prev => prev.map((r, i) => i === idx ? { ...r, name: v } : r));
                  }} />
                  <input className="input" type="number" min="1" placeholder="Quantity" value={row.quantity} onChange={e => {
                    const v = e.target.value;
                    setPacks(prev => prev.map((r, i) => i === idx ? { ...r, quantity: v } : r));
                  }} />
                  <button className="btn" onClick={() => setPacks(prev => prev.filter((_, i) => i !== idx))}>Remove</button>
                </div>
              ))}
              <div>
                <button className="btn" onClick={() => setPacks(prev => [...prev, { name: '', quantity: '' }])}>
                  <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2"/></svg>
                  Add Pack
                </button>
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: 8, marginBottom: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Variants (per-variant stock)</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {variants.map((row, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px auto', gap: 6 }}>
                  <input className="input" placeholder="Label (e.g., Large, 42 EU)" value={row.label} onChange={e => {
                    const v = e.target.value;
                    setVariants(prev => prev.map((r, i) => i === idx ? { ...r, label: v } : r));
                  }} />
                  <input className="input" placeholder="SKU (optional)" value={row.sku} onChange={e => {
                    const v = e.target.value;
                    setVariants(prev => prev.map((r, i) => i === idx ? { ...r, sku: v } : r));
                  }} />
                  <input className="input" type="number" placeholder="Price (opt.)" value={row.price} onChange={e => {
                    const v = e.target.value;
                    setVariants(prev => prev.map((r, i) => i === idx ? { ...r, price: v } : r));
                  }} />
                  <button className="btn" onClick={() => setVariants(prev => prev.filter((_, i) => i !== idx))}>Remove</button>
                </div>
              ))}
              <div>
                <button className="btn" onClick={() => setVariants(prev => [...prev, { label: '', sku: '', price: '' }])}>
                  <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2"/></svg>
                  Add Variant
                </button>
              </div>
            </div>
          </div>
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
                <th align="left">Spec</th>
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
                    {editingId === p.id ? (
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <select className="select" value={editUnitKind} onChange={e => setEditUnitKind(e.target.value)}>
                            <option value="none">None</option>
                            <option value="volume">Volume</option>
                            <option value="mass">Mass</option>
                            <option value="length">Length</option>
                            <option value="size">Clothing Size</option>
                            <option value="shoe">Shoe Size</option>
                          </select>
                          {(editUnitKind === 'volume' || editUnitKind === 'mass' || editUnitKind === 'length') && (
                            <>
                              <input className="input" placeholder="Value" value={editUnitValue} onChange={e => setEditUnitValue(e.target.value)} />
                              <select className="select" value={editUnitSymbol} onChange={e => setEditUnitSymbol(e.target.value)}>
                                <option value="">Unit</option>
                                {editUnitSymbolOptions.map(u => <option key={u}>{u}</option>)}
                              </select>
                            </>
                          )}
                          {editUnitKind === 'size' && (
                            <input className="input" placeholder="Size" value={editSizeLabel} onChange={e => setEditSizeLabel(e.target.value)} />
                          )}
                          {editUnitKind === 'shoe' && (
                            <input className="input" placeholder="Shoe Size" value={editShoeSize} onChange={e => setEditShoeSize(e.target.value)} />
                          )}
                        </div>
                        <div>
                          {(editAttrs || []).map((row, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6, marginBottom: 6 }}>
                              <input className="input" placeholder="Key" value={row.key} onChange={e => {
                                const v = e.target.value;
                                setEditAttrs(prev => prev.map((r, i) => i === idx ? { ...r, key: v } : r));
                              }} />
                              <input className="input" placeholder="Value" value={row.value} onChange={e => {
                                const v = e.target.value;
                                setEditAttrs(prev => prev.map((r, i) => i === idx ? { ...r, value: v } : r));
                              }} />
                              <button className="btn" onClick={() => setEditAttrs(prev => prev.filter((_, i) => i !== idx))}>Remove</button>
                            </div>
                          ))}
                          <button className="btn" onClick={() => setEditAttrs(prev => [...prev, { key: '', value: '' }])}>Add Attribute</button>
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>Packs</div>
                          {(editPacks || []).map((row, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 140px auto', gap: 6, marginBottom: 6 }}>
                              <input className="input" placeholder="Name" value={row.name} onChange={e => {
                                const v = e.target.value;
                                setEditPacks(prev => prev.map((r, i) => i === idx ? { ...r, name: v } : r));
                              }} />
                              <input className="input" type="number" min="1" placeholder="Qty" value={row.quantity} onChange={e => {
                                const v = e.target.value;
                                setEditPacks(prev => prev.map((r, i) => i === idx ? { ...r, quantity: v } : r));
                              }} />
                              <button className="btn" onClick={() => setEditPacks(prev => prev.filter((_, i) => i !== idx))}>Remove</button>
                            </div>
                          ))}
                          <button className="btn" onClick={() => setEditPacks(prev => [...prev, { name: '', quantity: '' }])}>Add Pack</button>
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: '#64748b' }}>{productSpec(p) || '—'}</span>
                    )}
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
                    {Array.isArray(p.variants) && p.variants.length > 0 ? (
                      <button className="btn" onClick={() => setOpenStockFor(o => o === p.id ? null : p.id)}>Variants</button>
                    ) : (
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={p.stockByBranch?.[currentBranchId] || 0}
                      onChange={e => dispatch(setStock({ productId: p.id, branchId: currentBranchId, quantity: Number(e.target.value) }))}
                      style={{ width: 100 }}
                    />
                    )}
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
              {products.map(p => (
                (openStockFor === p.id && Array.isArray(p.variants) && p.variants.length > 0) ? (
                  <tr key={`${p.id}-variants`} style={{ background: '#fbfdff' }}>
                    <td colSpan="9">
                      <div style={{ display: 'grid', gap: 6 }}>
                        {p.variants.map(v => (
                          <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, alignItems: 'center' }}>
                            <div><strong>{v.label}</strong> <span style={{ color: '#64748b' }}>{v.sku || ''}</span></div>
                            <input
                              className="input"
                              type="number"
                              min="0"
                              value={v.stockByBranch?.[currentBranchId] || 0}
                              onChange={e => dispatch(setStock({ productId: p.id, variantId: v.id, branchId: currentBranchId, quantity: Number(e.target.value) }))}
                              style={{ width: 120 }}
                            />
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ) : null
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ProductsPage;
