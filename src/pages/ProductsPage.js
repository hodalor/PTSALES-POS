import { useDispatch, useSelector } from 'react-redux';
import { addProduct, updateProduct, removeProduct, setStock, addCategory } from '../store/productsSlice';
import { useMemo, useState } from 'react';
import { formatCurrency } from '../utils/currency';
import { addAudit } from '../store/auditSlice';
import { useToast } from '../components/ToastProvider';
import { promptDialog } from '../utils/dialogs';
import { productSpec } from '../utils/productSpec';
import * as productsApi from '../api/products';
import * as stockApi from '../api/stock';
import Modal from '../components/Modal';

function ProductsPage() {
  const dispatch = useDispatch();
  const products = useSelector(s => s.products.products);
  const categories = useSelector(s => s.products.categories);
  const branches = useSelector(s => s.branches.branches);
  const settings = useSelector(s => s.settings);
  const currentBranchId = useSelector(s => s.settings.currentBranchId);
  const sales = useSelector(s => s.sales.sales);
  const currentBranch = branches.find(b => b.id === currentBranchId);
  const currentBranchLabel = (currentBranch?.code) || (currentBranch?.name) || currentBranchId;
  const auth = useSelector(s => s.auth);
  const roleLower = String(auth.role || '').toLowerCase();
  const grants = Array.isArray(auth.grants) ? auth.grants : [];
  function has(g) {
    if (!g) return false;
    if (roleLower === 'superadmin') return true;
    return grants.includes(g);
  }
  const canAddProducts = (['admin','manager'].includes(roleLower)) || has('add_products');
  const canEditProducts = (['admin','manager'].includes(roleLower)) || has('edit_products');
  const canEditStock = (['admin','manager','inventory staff'].includes(roleLower)) || has('edit_inventory');

  const [modalMode, setModalMode] = useState('none'); // none, add, edit
  const [editingId, setEditingId] = useState(null);
  const [tab, setTab] = useState('catalog'); // catalog, reorder, expiry, profitability
  const [leadDays, setLeadDays] = useState(7);

  // Unified form state
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState(categories[0] || '');
  const [newCategory, setNewCategory] = useState('');
  const [initialStock, setInitialStock] = useState(0);
  const [editStockQty, setEditStockQty] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [imagePreview, setImagePreview] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [unitKind, setUnitKind] = useState('none');
  const [unitValue, setUnitValue] = useState('');
  const [unitSymbol, setUnitSymbol] = useState('');
  const [sizeLabel, setSizeLabel] = useState('');
  const [shoeSize, setShoeSize] = useState('');
  const [attrs, setAttrs] = useState([{ key: '', value: '' }]);
  const [packs, setPacks] = useState([{ name: '', quantity: '' }]);
  const [variants, setVariants] = useState([{ label: '', sku: '', price: '' }]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [unitsOpen, setUnitsOpen] = useState(false);
  const [attrsOpen, setAttrsOpen] = useState(false);
  const [packsOpen, setPacksOpen] = useState(false);
  const [variantsOpen, setVariantsOpen] = useState(false);
  
  const [openStockFor, setOpenStockFor] = useState(null);
  const toast = useToast();

  function resetForm() {
    setName(''); setSku(''); setPrice(''); 
    setCategory(categories[0] || ''); setNewCategory('');
    setInitialStock(0); setEditStockQty(0); setLowStock(0); setImagePreview('');
    setCostPrice(''); setExpiryDate('');
    setUnitKind('none'); setUnitValue(''); setUnitSymbol('');
    setSizeLabel(''); setShoeSize('');
    setAttrs([{ key: '', value: '' }]);
    setPacks([{ name: '', quantity: '' }]);
    setVariants([{ label: '', sku: '', price: '' }]);
    setAdvancedOpen(false);
    setPricingOpen(false);
    setUnitsOpen(false);
    setAttrsOpen(false);
    setPacksOpen(false);
    setVariantsOpen(false);
  }

  function populateForm(p) {
    const sb = p.stockByBranch || {};
    setEditStockQty(Number(sb?.[currentBranchId] || 0));
    setName(p.name);
    setSku(p.sku);
    setPrice(String(p.price || 0));
    setCostPrice(p.costPrice != null ? String(p.costPrice) : '');
    setExpiryDate(p.expiryDate ? String(p.expiryDate).slice(0, 10) : '');
    setCategory(p.category || '');
    setLowStock(p.lowStock || 0);
    setImagePreview(p.image || '');
    setUnitKind(p.unitKind || 'none');
    setUnitValue(p.unitValue != null ? String(p.unitValue) : '');
    setUnitSymbol(p.unitSymbol || '');
    setSizeLabel(p.sizeLabel || '');
    setShoeSize(p.shoeSize || '');
    const hasPricing = (p.costPrice != null && String(p.costPrice) !== '' && Number(p.costPrice) > 0) || !!p.expiryDate;
    const hasUnits = (p.unitKind && p.unitKind !== 'none') || p.unitValue != null || !!p.unitSymbol || !!p.sizeLabel || !!p.shoeSize;
    const hasAttrs = Array.isArray(p.attributes) && p.attributes.length > 0;
    const hasPacks = Array.isArray(p.packs) && p.packs.length > 0;
    const hasVars = Array.isArray(p.variants) && p.variants.length > 0;
    setAdvancedOpen(hasPricing || hasUnits || hasAttrs || hasPacks || hasVars);
    setPricingOpen(hasPricing);
    setUnitsOpen(hasUnits);
    setAttrsOpen(hasAttrs);
    setPacksOpen(hasPacks);
    setVariantsOpen(hasVars);
    setAttrs(hasAttrs ? p.attributes.map(a => ({ key: a.key, value: a.value })) : [{ key: '', value: '' }]);
    setPacks(hasPacks ? p.packs.map(pk => ({ name: pk.name, quantity: String(pk.quantity) })) : [{ name: '', quantity: '' }]);
    setVariants(hasVars ? p.variants.map(v => ({ id: v.id, label: v.label, sku: v.sku || '', price: v.price != null ? String(v.price) : '' })) : [{ label: '', sku: '', price: '' }]);
  }

  function openAdd() {
    resetForm();
    setEditingId(null);
    setModalMode('add');
  }

  function startEdit(p) {
    if (!canEditProducts) { toast.show('Not authorized to edit products', { type: 'error' }); return; }
    setEditingId(p.id || p._id || p.sku);
    populateForm(p);
    setModalMode('edit');
  }

  function closeModal() {
    setModalMode('none');
    setEditingId(null);
  }

  function copy(text) {
    try {
      navigator.clipboard.writeText(text);
    } catch {}
  }

  function onFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) { setImagePreview(''); return; }
    const reader = new FileReader();
    reader.onload = () => setImagePreview(String(reader.result || ''));
    reader.readAsDataURL(f);
  }

  async function save() {
    if (modalMode === 'add') {
        if (!canAddProducts) { toast.show('Not authorized to add products', { type: 'error' }); return; }
        if (!name.trim() || !sku.trim() || !price) return;
        
        const cleanAttrs = (attrs || []).filter(a => a.key && a.value).map(a => ({ key: a.key.trim(), value: a.value.trim() }));
        const payload = {
            name: name.trim(),
            sku: sku.trim(),
            price: Number(price),
            costPrice: Number(costPrice) || 0,
            expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null,
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
        };

        const action = dispatch(addProduct(payload));
        const serverPayload = { id: action?.payload?.id, ...payload };
        productsApi.create(serverPayload).catch(() => {});
        const newId = action?.payload?.id;
        
        if (newId && (Number(initialStock) || 0) > 0) {
            const qty = Number(initialStock) || 0;
            dispatch(setStock({ productId: newId, branchId: currentBranchId, quantity: qty }));
            dispatch(addAudit({
                actor: auth.user?.name || 'unknown',
                actionType: 'stock_set_initial',
                details: { product: name.trim(), quantity: qty, branchId: currentBranchId },
                branchId: currentBranchId
            }));
            stockApi.setStock({
                productId: newId,
                branchId: currentBranchId,
                quantity: qty,
                actor: auth.user?.name || 'unknown'
            }).catch(() => {});
        }
        
        dispatch(addAudit({
            actor: auth.user?.name || 'unknown',
            actionType: 'product_add',
            details: { name: name.trim(), sku: sku.trim(), price: Number(price) },
            branchId: currentBranchId
        }));
        
        closeModal();
        toast.show('Product added', { type: 'success' });

    } else if (modalMode === 'edit') {
        if (!canEditProducts) { toast.show('Not authorized to edit products', { type: 'error' }); return; }
        if (!editingId) return;

        const original = products.find(p => (p.id || p._id || p.sku) === editingId);
        let remark = '';
        if (original && Number(original.price) !== Number(price)) {
            remark = await promptDialog('Enter remark for price change');
            if (!remark || !remark.trim()) { toast.show('Remark is required when changing price', { type: 'error' }); return; }
        }

        const cleanAttrs = (attrs || []).filter(a => a.key && a.value).map(a => ({ key: a.key.trim(), value: a.value.trim() }));
        const nextIdByIdx = new Map();
        const variantsLocal = (variants || []).filter(v => v.label).map((v, idx) => {
            const id = v.id || nextIdByIdx.get(idx) || crypto.randomUUID();
            nextIdByIdx.set(idx, id);
            const prev = original?.variants?.find(x => x.id === id);
            return { id, label: v.label.trim(), sku: v.sku?.trim() || '', price: v.price !== '' ? Number(v.price) : undefined, stockByBranch: prev?.stockByBranch || {} };
        });
        const variantsServer = variantsLocal.map(({ stockByBranch, ...rest }) => rest);
        const updatedBaseLocal = {
            name: name.trim(),
            sku: sku.trim(),
            price: Number(price),
            costPrice: Number(costPrice) || 0,
            expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null,
            category,
            lowStock: Number(lowStock) || 0,
            image: imagePreview || null,
            unitKind,
            unitValue: (unitKind === 'volume' || unitKind === 'mass' || unitKind === 'length') ? (Number(unitValue) || null) : null,
            unitSymbol: (unitKind === 'volume' || unitKind === 'mass' || unitKind === 'length') ? unitSymbol : '',
            sizeLabel: unitKind === 'size' ? sizeLabel.trim() : '',
            shoeSize: unitKind === 'shoe' ? shoeSize.trim() : '',
            attributes: cleanAttrs,
            packs: (packs || []).filter(p => p.name && Number(p.quantity) > 0).map(p => ({ name: p.name.trim(), quantity: Number(p.quantity) })),
            variants: variantsLocal
        };
        const updatedBaseServer = {
            ...updatedBaseLocal,
            variants: variantsServer
        };

        const localId = original?.id || original?._id || editingId;
        const updated = { id: localId, ...updatedBaseLocal };
        dispatch(updateProduct(updated));
        
        const serverId = original?._id || original?.id || null;
        if (serverId) {
            productsApi.update(serverId, { id: original?.id, ...updatedBaseServer }).catch(() => {});
        }
        if (canEditStock && original) {
            const pid = original.id || original._id || editingId;
            const prev = Number(original.stockByBranch?.[currentBranchId] || 0);
            const next = Number(editStockQty) || 0;
            if (prev !== next) {
                dispatch(setStock({ productId: pid, branchId: currentBranchId, quantity: next }));
                stockApi.setStock({
                    productId: original._id || original.id || pid,
                    branchId: currentBranchId,
                    quantity: next,
                    actor: auth.user?.name || 'unknown'
                }).catch(() => {
                    dispatch(setStock({ productId: pid, branchId: currentBranchId, quantity: prev }));
                    toast.show('Failed to save stock. Check your permission or connection.', { type: 'error' });
                });
            }
        }

        const changed = {};
        if (original) {
            if (original.name !== name.trim()) changed.name = { from: original.name, to: name.trim() };
            if (original.sku !== sku.trim()) changed.sku = { from: original.sku, to: sku.trim() };
            if (Number(original.price) !== Number(price)) changed.price = { from: Number(original.price), to: Number(price) };
            if ((original.category || '') !== category) changed.category = { from: original.category || '', to: category };
            if ((original.lowStock || 0) !== Number(lowStock)) changed.lowStock = { from: original.lowStock || 0, to: Number(lowStock) };
            if (Number(original.costPrice || 0) !== (Number(costPrice) || 0)) changed.costPrice = { from: Number(original.costPrice || 0), to: Number(costPrice) || 0 };
            const oldExp = original.expiryDate ? String(original.expiryDate).slice(0, 10) : '';
            if (oldExp !== (expiryDate || '')) changed.expiryDate = { from: oldExp, to: expiryDate || '' };
            if ((original.unitKind || 'none') !== unitKind) changed.unitKind = { from: original.unitKind || 'none', to: unitKind };
        }
        
        dispatch(addAudit({
            actor: auth.user?.name || 'unknown',
            actionType: 'product_update',
            details: { id: editingId, changed },
            remark,
            branchId: currentBranchId
        }));
        
        closeModal();
        toast.show('Product updated', { type: 'success' });
    }
  }

  function addCat() {
    if (!newCategory.trim()) return;
    dispatch(addCategory(newCategory.trim()));
    setCategory(newCategory.trim());
    setNewCategory('');
  }

  const unitSymbolOptions = useMemo(() => {
    if (unitKind === 'volume') return ['mL', 'L'];
    if (unitKind === 'mass') return ['g', 'kg'];
    if (unitKind === 'length') return ['mm', 'cm', 'm', 'in'];
    return [];
  }, [unitKind]);

  const reorder = useMemo(() => {
    const fromTs = Date.now() - 14 * 24 * 3600 * 1000;
    const unitsByProduct = new Map();
    for (const s of sales) {
      const ts = new Date(s.created_at).getTime();
      if (ts < fromTs) continue;
      if (String(s.branchId || '') !== String(currentBranchId || '')) continue;
      for (const it of s.items || []) {
        const pid = String(it.productId || '');
        const qty = Number(it.qty) || 0;
        if (!pid || qty <= 0) continue;
        unitsByProduct.set(pid, (unitsByProduct.get(pid) || 0) + qty);
      }
    }
    const out = [];
    for (const p of products) {
      const cur = Number(p.stockByBranch?.[currentBranchId] || 0);
      const avgDaily = (unitsByProduct.get(String(p.id)) || 0) / 14;
      const target = Math.ceil(avgDaily * Math.max(0, Number(leadDays) || 0) + (Number(p.lowStock) || 0));
      const suggest = Math.max(0, target - cur);
      const low = Number(p.lowStock) || 0;
      const daysCover = avgDaily > 0 ? Math.round((cur / avgDaily) * 10) / 10 : null;
      if (suggest > 0 || (low > 0 && cur <= low)) {
        out.push({ id: p.id, name: p.name, sku: p.sku, current: cur, lowStock: low, avgDaily: Math.round(avgDaily * 100) / 100, daysCover, suggest });
      }
    }
    return out.sort((a, b) => b.suggest - a.suggest).slice(0, 50);
  }, [products, sales, currentBranchId, leadDays]);

  const expirySoon = useMemo(() => {
    const now = Date.now();
    const soonMs = 30 * 24 * 3600 * 1000;
    return products
      .filter(p => p.expiryDate)
      .map(p => ({ id: p.id, name: p.name, sku: p.sku, expiry: String(p.expiryDate).slice(0, 10), ts: new Date(p.expiryDate).getTime() }))
      .filter(x => x.ts >= now && x.ts <= now + soonMs)
      .sort((a, b) => a.ts - b.ts)
      .slice(0, 50);
  }, [products]);

  const productProfit = useMemo(() => {
    const fromTs = Date.now() - 30 * 24 * 3600 * 1000;
    const map = new Map();
    for (const s of sales) {
      const ts = new Date(s.created_at).getTime();
      if (ts < fromTs) continue;
      if (String(s.branchId || '') !== String(currentBranchId || '')) continue;
      for (const it of s.items || []) {
        const pid = it.productId || '';
        const key = `${pid}:${it.variantId || ''}`;
        if (!map.has(key)) map.set(key, { key, name: it.name || it.sku || '—', units: 0, revenue: 0, cost: 0, profit: 0 });
        const row = map.get(key);
        const qty = Number(it.qty) || 0;
        const price = Number(it.price) || 0;
        const prod = products.find(p => String(p.id) === String(pid));
        const cp = Number(prod?.costPrice || 0);
        row.units += qty;
        row.revenue += qty * price;
        row.cost += qty * (Number.isFinite(cp) ? cp : 0);
        row.profit = row.revenue - row.cost;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.profit - a.profit).slice(0, 20);
  }, [sales, products, currentBranchId]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1>Products</h1>
        {canAddProducts && (
          <button className="btn btn-primary" onClick={openAdd}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2"/></svg>
            Add Product
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className={tab === 'catalog' ? 'btn btn-primary' : 'btn'} onClick={() => setTab('catalog')}>Catalog</button>
        <button className={tab === 'reorder' ? 'btn btn-primary' : 'btn'} onClick={() => setTab('reorder')}>Auto Reorder</button>
        <button className={tab === 'expiry' ? 'btn btn-primary' : 'btn'} onClick={() => setTab('expiry')}>Expiry Alerts</button>
        <button className={tab === 'profitability' ? 'btn btn-primary' : 'btn'} onClick={() => setTab('profitability')}>Profitability</button>
      </div>

      {tab === 'reorder' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="section-title">Auto Reorder Suggestions</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#64748b' }}>Lead days</span>
              <input className="input" type="number" min="0" max="60" value={leadDays} onChange={e => setLeadDays(Number(e.target.value))} style={{ width: 90 }} />
            </div>
          </div>
          <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>Based on last 14 days sales + low stock ({currentBranchLabel})</div>
          <table className="table">
            <thead>
              <tr>
                <th align="left">Product</th>
                <th align="left">SKU</th>
                <th align="left">Current</th>
                <th align="left">Low</th>
                <th align="left">Avg/day</th>
                <th align="left">Days cover</th>
                <th align="left">Suggest</th>
              </tr>
            </thead>
            <tbody>
              {reorder.map(r => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.sku}</td>
                  <td>{r.current}</td>
                  <td>{r.lowStock}</td>
                  <td>{r.avgDaily}</td>
                  <td>{r.daysCover == null ? '—' : r.daysCover}</td>
                  <td style={{ fontWeight: 700 }}>{r.suggest}</td>
                </tr>
              ))}
              {reorder.length === 0 && <tr><td colSpan="7" style={{ padding: 12, color: '#64748b' }}>No reorder suggestions</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'expiry' && (
        <div className="card">
          <h2 className="section-title">Expiry Alerts (30 days)</h2>
          <table className="table">
            <thead>
              <tr>
                <th align="left">Product</th>
                <th align="left">SKU</th>
                <th align="left">Expiry</th>
              </tr>
            </thead>
            <tbody>
              {expirySoon.map(x => (
                <tr key={x.id}>
                  <td>{x.name}</td>
                  <td>{x.sku}</td>
                  <td>{x.expiry}</td>
                </tr>
              ))}
              {expirySoon.length === 0 && <tr><td colSpan="3" style={{ padding: 12, color: '#64748b' }}>No expiring products</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'profitability' && (
        <div className="card">
          <h2 className="section-title">Product-level Profitability (Top 20)</h2>
          <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>Last 30 days ({currentBranchLabel}). Profit requires cost price.</div>
          <table className="table">
            <thead>
              <tr>
                <th align="left">Product</th>
                <th align="left">Units</th>
                <th align="left">Revenue</th>
                <th align="left">Profit</th>
              </tr>
            </thead>
            <tbody>
              {productProfit.map(x => (
                <tr key={x.key}>
                  <td>{x.name}</td>
                  <td>{x.units}</td>
                  <td>{formatCurrency(x.revenue, settings)}</td>
                  <td>{formatCurrency(x.profit, settings)}</td>
                </tr>
              ))}
              {productProfit.length === 0 && <tr><td colSpan="4" style={{ padding: 12, color: '#64748b' }}>No sales in range</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'catalog' && (
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
              <tr key={p.id || p._id || p.sku} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td>
                  {p.image ? <img src={p.image} alt={p.name} className="thumb" /> : <span style={{ color: '#94a3b8' }}>—</span>}
                </td>
                <td>{p.name}</td>
                <td>{p.sku}</td>
                <td><span style={{ color: '#64748b' }}>{productSpec(p) || '—'}</span></td>
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
                <td>{formatCurrency(p.price, settings)}</td>
                <td>{p.category || '-'}</td>
                <td>{p.lowStock ?? 0}</td>
                <td>
                  {Array.isArray(p.variants) && p.variants.length > 0 ? (
                    <button className="btn" onClick={() => {
                      const key = p.id || p._id || p.sku;
                      setOpenStockFor(o => o === key ? null : key);
                    }}>Variants</button>
                  ) : (
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={p.stockByBranch?.[currentBranchId] || 0}
                    onChange={e => {
                      if (!canEditStock) {
                        toast.show('Not authorized to edit stock', { type: 'error' });
                        return;
                      }
                      const q = Number(e.target.value);
                      const pid = p.id || p._id || p.sku;
                      const prev = p.stockByBranch?.[currentBranchId] || 0;
                      dispatch(setStock({ productId: pid, branchId: currentBranchId, quantity: q }));
                      stockApi.setStock({
                        productId: p.id || p._id || p.sku,
                        branchId: currentBranchId,
                        quantity: q,
                        actor: auth.user?.name || 'unknown'
                      }).catch(() => {
                        dispatch(setStock({ productId: pid, branchId: currentBranchId, quantity: prev }));
                        toast.show('Failed to save stock. Check your permission or connection.', { type: 'error' });
                      });
                    }}
                    style={{ width: 100 }}
                    disabled={!canEditStock}
                  />
                  )}
                </td>
                <td>
                  {canEditProducts && (
                  <button className="btn" onClick={() => startEdit(p)}>
                    <svg viewBox="0 0 24 24" fill="none"><path d="M4 21h4l11-11-4-4L4 17v4z" stroke="currentColor" strokeWidth="2"/></svg>
                    Edit
                  </button>
                  )}
                  {(roleLower === 'admin' || roleLower === 'superadmin') && (
                  <button
                    className="btn"
                    onClick={() => {
                      const localKey = p.id || p._id || p.sku;
                      const serverKey = p._id || p.id;
                      dispatch(removeProduct(localKey));
                      if (serverKey) productsApi.remove(serverKey).catch(() => {});
                    }}
                    style={{ marginLeft: 6 }}
                  >
                    <svg viewBox="0 0 24 24" fill="none"><path d="M6 7h12M10 11v6M14 11v6M9 7l1-2h4l1 2M7 7l1 12h8l1-12" stroke="currentColor" strokeWidth="2"/></svg>
                    Remove
                  </button>
                  )}
                </td>
              </tr>
            ))}
            {products.map(p => (
              (openStockFor === (p.id || p._id || p.sku) && Array.isArray(p.variants) && p.variants.length > 0) ? (
                <tr key={`${p.id || p._id || p.sku}-variants`} style={{ background: '#fbfdff' }}>
                  <td colSpan="10">
                    <div style={{ display: 'grid', gap: 6, padding: 8 }}>
                      {p.variants.map(v => (
                        <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, alignItems: 'center' }}>
                          <div><strong>{v.label}</strong> <span style={{ color: '#64748b' }}>{v.sku || ''}</span></div>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            value={v.stockByBranch?.[currentBranchId] || 0}
                            onChange={e => {
                              if (!canEditStock) {
                                toast.show('Not authorized to edit stock', { type: 'error' });
                                return;
                              }
                              const q = Number(e.target.value);
                              const pid = p.id || p._id || p.sku;
                              const prev = v.stockByBranch?.[currentBranchId] || 0;
                              dispatch(setStock({ productId: p.id || p._id || p.sku, variantId: v.id, branchId: currentBranchId, quantity: q }));
                              stockApi.setStock({
                                productId: p.id || p._id || p.sku,
                                variantId: v.id,
                                branchId: currentBranchId,
                                quantity: q,
                                actor: auth.user?.name || 'unknown'
                              }).catch(() => {
                                dispatch(setStock({ productId: pid, variantId: v.id, branchId: currentBranchId, quantity: prev }));
                                toast.show('Failed to save variant stock. Check your permission or connection.', { type: 'error' });
                              });
                            }}
                            style={{ width: 120 }}
                            disabled={!canEditStock}
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
      )}

      {modalMode !== 'none' && (
        <Modal
          title={modalMode === 'add' ? 'Add Product' : 'Edit Product'}
          onClose={closeModal}
          footer={
            <>
              <button className="btn" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>
                {modalMode === 'add' ? 'Add Product' : 'Save Changes'}
              </button>
            </>
          }
        >
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {modalMode === 'add' ? (
                <div>
                  <label className="label">Initial Stock ({currentBranchLabel})</label>
                  <input className="input" type="number" min="0" value={initialStock} onChange={e => setInitialStock(Number(e.target.value))} style={{ display: 'block', width: '100%' }} />
                </div>
              ) : (
                <div>
                  <label className="label">Stock ({currentBranchLabel})</label>
                  <input className="input" type="number" min="0" value={editStockQty} onChange={e => setEditStockQty(Number(e.target.value))} style={{ display: 'block', width: '100%' }} disabled={!canEditStock} />
                </div>
              )}
              <div>
                <label className="label">Low Stock Alert</label>
                <input className="input" type="number" min="0" value={lowStock} onChange={e => setLowStock(Number(e.target.value))} style={{ display: 'block', width: '100%' }} />
              </div>
            </div>
            <div>
                <label className="label">Name</label>
                <input className="input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} style={{ display: 'block', width: '100%' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                    <label className="label">SKU</label>
                    <input className="input" placeholder="SKU" value={sku} onChange={e => setSku(e.target.value)} style={{ display: 'block', width: '100%' }} />
                </div>
                <div>
                    <label className="label">Price</label>
                    <input className="input" placeholder="Price" type="number" value={price} onChange={e => setPrice(e.target.value)} style={{ display: 'block', width: '100%' }} />
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                    <label className="label">Category</label>
                    <select className="select" value={category} onChange={e => setCategory(e.target.value)} style={{ display: 'block', width: '100%' }}>
                        {categories.map(c => <option key={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                     {/* Category add input */}
                     <label className="label">New Category</label>
                     <div style={{ display: 'flex', gap: 8 }}>
                        <input className="input" placeholder="New category" value={newCategory} onChange={e => setNewCategory(e.target.value)} style={{ flex: 1 }} />
                        <button className="btn" onClick={addCat}>Add</button>
                     </div>
                </div>
            </div>

            <div>
              <button className="btn" onClick={() => setAdvancedOpen(v => !v)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>More Fields</span>
                <span style={{ display: 'inline-flex', width: 18, height: 18 }}>
                  {advancedOpen ? (
                    <svg viewBox="0 0 24 24" fill="none"><path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </span>
              </button>
            </div>

            {advancedOpen && (
              <>
                <div style={{ border: '1px solid #111827', borderRadius: 12, padding: 12, background: '#000' }}>
                  <button className="btn" onClick={() => setPricingOpen(v => !v)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Pricing & Expiry</span>
                    <span style={{ display: 'inline-flex', width: 18, height: 18 }}>
                      {pricingOpen ? (
                        <svg viewBox="0 0 24 24" fill="none"><path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      )}
                    </span>
                  </button>
                  {pricingOpen && (
                    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <label>
                        <div className="label" style={{ color: '#cbd5e1' }}>Cost Price (per unit)</div>
                        <input className="input" type="number" min="0" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} />
                      </label>
                      <label>
                        <div className="label" style={{ color: '#cbd5e1' }}>Expiry Date</div>
                        <input className="input" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
                      </label>
                    </div>
                  )}
                </div>

                <div style={{ border: '1px solid #111827', borderRadius: 12, padding: 12, background: '#000' }}>
                  <button className="btn" onClick={() => setUnitsOpen(v => !v)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Units & Size</span>
                    <span style={{ display: 'inline-flex', width: 18, height: 18 }}>
                      {unitsOpen ? (
                        <svg viewBox="0 0 24 24" fill="none"><path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      )}
                    </span>
                  </button>
                  {unitsOpen && (
                    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <label>
                        <div className="label" style={{ color: '#cbd5e1' }}>Type</div>
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
                            <div className="label" style={{ color: '#cbd5e1' }}>Value</div>
                            <input className="input" type="number" value={unitValue} onChange={e => setUnitValue(e.target.value)} />
                          </label>
                          <label>
                            <div className="label" style={{ color: '#cbd5e1' }}>Unit</div>
                            <select className="select" value={unitSymbol} onChange={e => setUnitSymbol(e.target.value)}>
                              <option value="">Select</option>
                              {unitSymbolOptions.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </label>
                        </>
                      )}
                      {unitKind === 'size' && (
                        <label style={{ gridColumn: '1 / span 2' }}>
                          <div className="label" style={{ color: '#cbd5e1' }}>Size</div>
                          <input className="input" value={sizeLabel} onChange={e => setSizeLabel(e.target.value)} placeholder="XS, S, M, L, XL, etc." />
                        </label>
                      )}
                      {unitKind === 'shoe' && (
                        <label style={{ gridColumn: '1 / span 2' }}>
                          <div className="label" style={{ color: '#cbd5e1' }}>Shoe Size</div>
                          <input className="input" value={shoeSize} onChange={e => setShoeSize(e.target.value)} placeholder="e.g. 42 EU or 9 US" />
                        </label>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ border: '1px solid #111827', borderRadius: 12, padding: 12, background: '#000' }}>
                  <button className="btn" onClick={() => setAttrsOpen(v => !v)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Attributes</span>
                    <span style={{ display: 'inline-flex', width: 18, height: 18 }}>
                      {attrsOpen ? (
                        <svg viewBox="0 0 24 24" fill="none"><path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      )}
                    </span>
                  </button>
                  {attrsOpen && (
                    <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                      {attrs.map((row, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
                          <input className="input" placeholder="Key" value={row.key} onChange={e => {
                            const v = e.target.value;
                            setAttrs(prev => prev.map((r, i) => i === idx ? { ...r, key: v } : r));
                          }} />
                          <input className="input" placeholder="Value" value={row.value} onChange={e => {
                            const v = e.target.value;
                            setAttrs(prev => prev.map((r, i) => i === idx ? { ...r, value: v } : r));
                          }} />
                          <button className="btn" onClick={() => setAttrs(prev => prev.filter((_, i) => i !== idx))}>Remove</button>
                        </div>
                      ))}
                      <button className="btn" onClick={() => setAttrs(prev => [...prev, { key: '', value: '' }])}>Add Attribute</button>
                    </div>
                  )}
                </div>

                <div style={{ border: '1px solid #111827', borderRadius: 12, padding: 12, background: '#000' }}>
                  <button className="btn" onClick={() => setPacksOpen(v => !v)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Packs</span>
                    <span style={{ display: 'inline-flex', width: 18, height: 18 }}>
                      {packsOpen ? (
                        <svg viewBox="0 0 24 24" fill="none"><path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      )}
                    </span>
                  </button>
                  {packsOpen && (
                    <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                      {packs.map((row, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 140px auto', gap: 8 }}>
                          <input className="input" placeholder="Name" value={row.name} onChange={e => {
                            const v = e.target.value;
                            setPacks(prev => prev.map((r, i) => i === idx ? { ...r, name: v } : r));
                          }} />
                          <input className="input" type="number" min="1" placeholder="Qty" value={row.quantity} onChange={e => {
                            const v = e.target.value;
                            setPacks(prev => prev.map((r, i) => i === idx ? { ...r, quantity: v } : r));
                          }} />
                          <button className="btn" onClick={() => setPacks(prev => prev.filter((_, i) => i !== idx))}>Remove</button>
                        </div>
                      ))}
                      <button className="btn" onClick={() => setPacks(prev => [...prev, { name: '', quantity: '' }])}>Add Pack</button>
                    </div>
                  )}
                </div>

                <div style={{ border: '1px solid #111827', borderRadius: 12, padding: 12, background: '#000' }}>
                  <button className="btn" onClick={() => setVariantsOpen(v => !v)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Variants</span>
                    <span style={{ display: 'inline-flex', width: 18, height: 18 }}>
                      {variantsOpen ? (
                        <svg viewBox="0 0 24 24" fill="none"><path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      )}
                    </span>
                  </button>
                  {variantsOpen && (
                    <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                      {variants.map((row, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px auto', gap: 8 }}>
                          <input className="input" placeholder="Label" value={row.label} onChange={e => {
                            const v = e.target.value;
                            setVariants(prev => prev.map((r, i) => i === idx ? { ...r, label: v } : r));
                          }} />
                          <input className="input" placeholder="SKU" value={row.sku} onChange={e => {
                            const v = e.target.value;
                            setVariants(prev => prev.map((r, i) => i === idx ? { ...r, sku: v } : r));
                          }} />
                          <input className="input" type="number" placeholder="Price" value={row.price} onChange={e => {
                            const v = e.target.value;
                            setVariants(prev => prev.map((r, i) => i === idx ? { ...r, price: v } : r));
                          }} />
                          <button className="btn" onClick={() => setVariants(prev => prev.filter((_, i) => i !== idx))}>Remove</button>
                        </div>
                      ))}
                      <button className="btn" onClick={() => setVariants(prev => [...prev, { label: '', sku: '', price: '' }])}>Add Variant</button>
                    </div>
                  )}
                </div>
              </>
            )}

            <div>
                <label className="label">Product Image</label>
                <input type="file" accept="image/*" onChange={onFileChange} />
                {imagePreview && <div style={{ marginTop: 8 }}><img src={imagePreview} alt="preview" className="thumb" /></div>}
            </div>

          </div>
        </Modal>
      )}
    </div>
  );
}

export default ProductsPage;
