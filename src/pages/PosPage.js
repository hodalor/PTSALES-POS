import { useDispatch, useSelector } from 'react-redux';
import { addItem, removeItem, setQuantity, clearCart, setDiscount } from '../store/cartSlice';
import { adjustStock } from '../store/productsSlice';
import { recordSale } from '../store/salesSlice';
import { updateCustomer } from '../store/customersSlice';
import { buildBrandedReceiptHtml, printReceiptHtml } from '../utils/print';
import { escposReceipt, escposOpenDrawer, downloadText } from '../utils/escpos';
import { useToast } from '../components/ToastProvider';
import { formatCurrency } from '../utils/currency';
import { useMemo, useState } from 'react';
import { addAudit } from '../store/auditSlice';
import { productSpec } from '../utils/productSpec';
import { createSale } from '../api/sales';
import { enqueueHttp, isOfflineBackupEnabled } from '../offline/offlineBackup';
import OfflineQueueIndicator from '../components/OfflineQueueIndicator';

function PosPage() {
  const cart = useSelector(state => state.cart);
  const products = useSelector(s => s.products.products);
  const customers = useSelector(s => s.customers.customers);
  const branches = useSelector(s => s.branches.branches);
  const branchId = useSelector(s => s.settings.currentBranchId);
  const settings = useSelector(s => s.settings);
  const auth = useSelector(s => s.auth);
  const [query, setQuery] = useState('');
  const [payments, setPayments] = useState([{ type: 'cash', amount: '' }]);
  const [view, setView] = useState('grid');
  const [taxOverridePct, setTaxOverridePct] = useState('');
  const [taxOverrideRemark, setTaxOverrideRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [redeemPoints, setRedeemPoints] = useState('');
  const toast = useToast();
  const sellables = useMemo(() => {
    const out = [];
    products.forEach(p => {
      if (Array.isArray(p.variants) && p.variants.length > 0) {
        p.variants.forEach(v => {
          out.push({
            id: `${p.id}:${v.id}`,
            productId: p.id,
            variantId: v.id,
            name: `${p.name} (${v.label})`,
            sku: v.sku || `${p.sku}-${v.label}`,
            price: (v.price != null ? v.price : p.price),
            image: p.image,
            stockByBranch: v.stockByBranch || {},
            lowStock: p.lowStock,
            attributes: p.attributes,
            unitKind: p.unitKind, unitValue: p.unitValue, unitSymbol: p.unitSymbol, sizeLabel: p.sizeLabel, shoeSize: p.shoeSize
          });
        });
      } else {
        out.push(p);
      }
    });
    return out;
  }, [products]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sellables;
    return sellables.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q) ||
      productSpec(p).toLowerCase().includes(q)
    );
  }, [sellables, query]);
  const dispatch = useDispatch();

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find(c => String(c.id) === String(selectedCustomerId)) || null;
  }, [customers, selectedCustomerId]);

  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return [];
    return customers
      .filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        String(c.customerCode || '').toLowerCase().includes(q) ||
        String(c.idCardNumber || '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [customers, customerQuery]);

  const subtotal = cart.items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);
  const manualDiscount = cart.discount || 0;
  const canOverrideTax = ['Admin','Manager'].includes(auth.role) || String(auth.role || '').toLowerCase() === 'superadmin';
  const taxRate = canOverrideTax && taxOverridePct !== '' ? Math.max(0, Math.min(1, Number(taxOverridePct) / 100)) : Number(settings.taxRate ?? 0);
  const maxRedeemPct = Math.max(0, Math.min(100, Number(settings.loyaltyMaxRedeemPercent ?? 50)));
  const redeemValue = Number(settings.loyaltyRedeemValue || 0);
  const availablePoints = Math.max(0, Math.floor(Number(selectedCustomer?.loyaltyPoints || 0)));
  const reqRedeem = Math.max(0, Math.floor(Number(redeemPoints || 0)));
  const redeemable = Math.min(reqRedeem, availablePoints);
  let loyaltyDiscount = (settings.loyaltyEnabled && selectedCustomer && redeemValue > 0) ? (redeemable * redeemValue) : 0;
  const cap = (subtotal > 0 ? (subtotal * (maxRedeemPct / 100)) : 0);
  if (loyaltyDiscount > cap) loyaltyDiscount = cap;
  const discount = Math.max(0, Number(manualDiscount || 0) + Number(loyaltyDiscount || 0));
  const tax = Math.max(0, (subtotal - discount) * taxRate);
  const total = Math.max(0, subtotal - discount + tax);
  const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const due = Math.max(0, total - paid);
  const change = Math.max(0, paid - total);
  const offlineBackupAllowed = isOfflineBackupEnabled(settings);

  function addToCart(p) {
    const available = p.stockByBranch?.[branchId] || 0;
    const inCart = cart.items.find(i => i.sku === p.sku)?.quantity || 0;
    if (available - inCart <= 0) {
      toast.show('Out of stock for current branch', { type: 'error' });
      return;
    }
    const spec = productSpec(p);
    dispatch(addItem({ name: p.name, sku: p.sku, price: p.price, spec, productId: p.productId || p.id, variantId: p.variantId || null }));
  }

  function addPaymentRow() {
    setPayments(p => [...p, { type: 'cash', amount: '' }]);
  }
  function updatePayment(i, field, value) {
    setPayments(p => p.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  }
  function removePaymentRow(i) {
    setPayments(p => p.filter((_, idx) => idx !== i));
  }

  async function completeSale(escpos = false) {
    if (saving) return;
    if (due > 0) {
      toast.show('Payment incomplete', { type: 'error' });
      return;
    }
    if (!navigator.onLine) {
      if (!offlineBackupAllowed) {
        toast.show('Offline: connect internet and try again.', { type: 'error' });
        return;
      }
    }
    if (canOverrideTax && taxOverridePct !== '' && String(Math.round((taxRate || 0)*100)) !== String(Math.round((settings.taxRate || 0)*100))) {
      if (!taxOverrideRemark.trim()) {
        toast.show('Enter a remark for tax override', { type: 'error' });
        return;
      }
    }
    const branchName = branches.find(b => b.id === branchId)?.name || branchId;
    const sale = {
      branchId,
      branchName,
      sellerName: auth.user?.name || 'unknown',
      sellerRole: auth.role || '',
      customerId: selectedCustomer ? selectedCustomer.id : '',
      customerCode: selectedCustomer ? (selectedCustomer.customerCode || '') : '',
      customerName: selectedCustomer ? (selectedCustomer.name || '') : '',
      customerPhone: selectedCustomer ? (selectedCustomer.phone || '') : '',
      loyaltyPointsRedeemed: (settings.loyaltyEnabled && selectedCustomer) ? redeemable : 0,
      items: cart.items.map(i => ({
        name: i.name,
        sku: i.sku,
        spec: i.spec,
        qty: i.quantity,
        price: i.price,
        productId: i.productId,
        variantId: i.variantId || null
      })),
      subtotal,
      discount,
      tax,
      total,
      payment_methods: payments.map(p => ({ type: p.type, amount: Number(p.amount) || 0 })),
      status: 'completed',
      created_at: new Date().toISOString()
    };
    setSaving(true);
    let saleForUi = null;
    if (!navigator.onLine) {
      const offlineId = `offline-sale-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      sale.clientId = offlineId;
      const ref = `OFF-${String(Date.now()).padStart(6, '0').slice(-6)}`;
      try {
        await enqueueHttp({ collection: 'sales', label: 'Sale', path: '/api/sales', method: 'POST', body: sale });
      } catch (e) {
        toast.show(String(e?.message || 'Failed to save offline'), { type: 'error' });
        setSaving(false);
        return;
      }
      saleForUi = { ...sale, id: offlineId, invoiceSerial: ref, receiptNumber: ref, branchName, offline: true };
    } else {
      let saved = null;
      try {
        sale.clientId = crypto.randomUUID();
        saved = await createSale(sale);
      } catch (e) {
        toast.show(String(e?.message || 'Failed to record sale on server'), { type: 'error' });
        setSaving(false);
        return;
      }
      saleForUi = { ...sale, ...saved, branchName };
    }
    const receiptHtml = buildBrandedReceiptHtml({ settings, sale: saleForUi });
    const skuToRef = new Map();
    sellables.forEach(p => skuToRef.set(p.sku, { productId: p.productId || p.id, variantId: p.variantId || null }));
    cart.items.forEach(i => {
      const ref = skuToRef.get(i.sku);
      if (ref) {
        dispatch(adjustStock({ productId: ref.productId, variantId: ref.variantId, branchId, delta: -i.quantity }));
      }
    });
    dispatch(recordSale(saleForUi));
    if (navigator.onLine && selectedCustomer && saleForUi.customerPointsAfter != null) {
      dispatch(updateCustomer({ id: selectedCustomer.id, loyaltyPoints: Number(saleForUi.customerPointsAfter || 0) }));
    }
    dispatch(addAudit({
      actor: auth.user?.name || 'unknown',
      actionType: 'stock_sale_deduct',
      details: { items: sale.items.map(it => ({ sku: it.sku, qty: it.qty })), branchId },
      branchId,
      offline: !navigator.onLine
    }));
    if (canOverrideTax && taxOverridePct !== '' && String(Math.round((taxRate || 0)*100)) !== String(Math.round((settings.taxRate || 0)*100))) {
      dispatch(addAudit({
        actor: auth.user?.name || 'unknown',
        actionType: 'pos_tax_override',
        details: { from: Math.round((settings.taxRate || 0) * 100), to: Math.round(taxRate * 100) },
        remark: taxOverrideRemark,
        branchId,
        offline: !navigator.onLine
      }));
    }
    dispatch(addAudit({
      actor: auth.user?.name || 'unknown',
      actionType: 'sale_complete',
      details: { total: sale.total, items: sale.items.length },
      branchId,
      offline: !navigator.onLine
    }));
    dispatch(clearCart());
    setSelectedCustomerId('');
    setCustomerQuery('');
    setRedeemPoints('');
    if (escpos) {
      const text = escposReceipt({
        header: { title: settings.appName, store: settings.receiptHeader, branch: branchName, phone: settings.businessPhone || '', cashier: saleForUi.sellerName, customer: saleForUi.customerName ? `${saleForUi.customerName}${saleForUi.customerCode ? ` (${saleForUi.customerCode})` : ''}` : '', receiptId: saleForUi.id || saleForUi._id, receiptNumber: saleForUi.receiptNumber, invoiceSerial: saleForUi.invoiceSerial },
        items: saleForUi.items,
        totals: { subtotal, discount, tax, total },
        footer: { note: settings.receiptFooter },
        settings
      });
      downloadText('receipt-escpos.txt', (settings.drawerOpenOnCash && payments.some(p => p.type === 'cash')) ? (escposOpenDrawer() + '\n' + text) : text);
    } else {
      printReceiptHtml(receiptHtml);
    }
    toast.show(navigator.onLine ? 'Sale recorded' : 'Saved offline. Will backup when online.', { type: 'success' });
    setSaving(false);
  }

  function onSearchKeyDown(e) {
    if (e.key === 'Enter') {
      const q = query.trim();
      if (!q) return;
      const exact = sellables.find(p =>
        (p.barcode && p.barcode === q) ||
        p.sku.toLowerCase() === q.toLowerCase()
      );
      if (exact) {
        addToCart(exact);
        setQuery('');
      }
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, padding: 16 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2>Products</h2>
          <OfflineQueueIndicator collection="sales" label="Sales queued" />
        </div>
        <div className="toolbar">
          <input className="input" placeholder="Search name, SKU or scan barcode" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onSearchKeyDown} style={{ width: '100%' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={`btn-toggle ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" stroke="currentColor" strokeWidth="2"/></svg>
            </button>
            <button className={`btn-toggle ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2"/></svg>
            </button>
          </div>
        </div>
        {view === 'grid' ? (
          <div className="product-grid">
            {filtered.map(p => (
              <button key={p.id} onClick={() => addToCart(p)} className="product-card">
                {p.image && <img src={p.image} alt={p.name} className="product-img" />}
                <div className="product-name">{p.name}</div>
                {productSpec(p) && <div className="product-sku" style={{ color: '#64748b' }}>{productSpec(p)}</div>}
                <div className="product-sku">{p.sku}</div>
                <div className="product-price">{formatCurrency(p.price, settings)}</div>
                <div className="product-stock" style={{ color: (p.lowStock ?? 0) > 0 && (p.stockByBranch?.[branchId] || 0) <= (p.lowStock ?? 0) ? '#ef4444' : undefined }}>
                  Stock: {p.stockByBranch?.[branchId] || 0}{(p.lowStock ?? 0) > 0 && (p.stockByBranch?.[branchId] || 0) <= (p.lowStock ?? 0) ? ' • Low' : ''}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="product-list">
            {filtered.map(p => (
              <button key={p.id} onClick={() => addToCart(p)} className="product-list-item">
                {p.image && <img src={p.image} alt={p.name} className="thumb" />}
                <div className="meta">
                  <div>
                    <div className="title">{p.name}</div>
                    {productSpec(p) && <div className="sku" style={{ color: '#64748b' }}>{productSpec(p)}</div>}
                    <div className="sku">{p.sku}</div>
                  </div>
                  <div className="stock" style={{ color: (p.lowStock ?? 0) > 0 && (p.stockByBranch?.[branchId] || 0) <= (p.lowStock ?? 0) ? '#ef4444' : undefined }}>
                    Stock: {p.stockByBranch?.[branchId] || 0}{(p.lowStock ?? 0) > 0 && (p.stockByBranch?.[branchId] || 0) <= (p.lowStock ?? 0) ? ' • Low' : ''}
                  </div>
                </div>
                <div style={{ fontWeight: 700 }}>{formatCurrency(p.price, settings)}</div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <h2>Cart</h2>
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Customer (optional)</div>
          {selectedCustomer ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{selectedCustomer.name}</div>
                <div style={{ color: '#64748b', fontSize: 12 }}>
                  {selectedCustomer.customerCode || '—'} {selectedCustomer.phone ? `• ${selectedCustomer.phone}` : ''}
                </div>
              </div>
              <button className="btn" onClick={() => { setSelectedCustomerId(''); setCustomerQuery(''); }}>
                Clear
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                placeholder="Search by phone, customer ID, name, ID card"
                value={customerQuery}
                onChange={e => setCustomerQuery(e.target.value)}
              />
              {customerMatches.length > 0 && (
                <div style={{ position: 'absolute', top: 44, left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', zIndex: 20 }}>
                  {customerMatches.map(c => (
                    <button
                      key={c.id}
                      className="btn"
                      onClick={() => { setSelectedCustomerId(c.id); setCustomerQuery(''); }}
                      style={{ width: '100%', justifyContent: 'space-between', borderRadius: 0 }}
                    >
                      <span style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 700 }}>{c.name}</div>
                        <div style={{ color: '#64748b', fontSize: 12 }}>{c.customerCode || '—'} {c.phone ? `• ${c.phone}` : ''}</div>
                      </span>
                      <span>Select</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <ul className="cart-list">
          {cart.items.map(item => (
            <li key={item.id} className="cart-item">
              <div className="cart-title">
                <div>{item.name}</div>
                {item.spec && <small style={{ color: '#64748b' }}>{item.spec}</small>}
                <small>{item.sku}</small>
              </div>
              <input
                className="input"
                type="number"
                min="1"
                value={item.quantity}
                onChange={e => dispatch(setQuantity({ id: item.id, quantity: Number(e.target.value) }))}
                style={{ width: 70 }}
              />
              <span style={{ fontWeight: 700 }}>{formatCurrency(item.price, settings)}</span>
              <button className="btn" onClick={() => dispatch(removeItem(item.id))}>
                <svg viewBox="0 0 24 24" fill="none"><path d="M6 7h12M10 11v6M14 11v6M9 7l1-2h4l1 2M7 7l1 12h8l1-12" stroke="currentColor" strokeWidth="2"/></svg>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="totals-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ color: '#64748b' }}>Manual discount</label>
            <input className="input" type="number" min="0" value={manualDiscount} onChange={e => dispatch(setDiscount(Number(e.target.value)))} style={{ width: 140 }} />
          </div>
          {settings.loyaltyEnabled && selectedCustomer && (
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ color: '#64748b' }}>Redeem points</label>
                <input className="input" type="number" min="0" step="1" value={redeemPoints} onChange={e => setRedeemPoints(e.target.value)} style={{ width: 140 }} />
                <span style={{ color: '#64748b' }}>Available: {availablePoints}</span>
              </div>
              <div style={{ color: '#64748b' }}>Loyalty discount: {formatCurrency(loyaltyDiscount, settings)}</div>
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <div>Subtotal: {formatCurrency(subtotal, settings)}</div>
            <div>Discount: {formatCurrency(discount, settings)}</div>
            <div>Tax ({Math.round((taxRate || 0) * 100)}%): {formatCurrency(tax, settings)}</div>
            <div><strong>Total: {formatCurrency(total, settings)}</strong></div>
          </div>
          <div style={{ marginTop: 8 }}>
            <h3 style={{ margin: '8px 0' }}>Payments</h3>
            {payments.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <select className="select" value={p.type} onChange={e => updatePayment(i, 'type', e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="mobile">Mobile</option>
                  <option value="wallet">Wallet</option>
                </select>
                <input className="input" type="number" placeholder="amount" value={p.amount} onChange={e => updatePayment(i, 'amount', e.target.value)} style={{ width: 140 }} />
                {payments.length > 1 && <button className="btn" onClick={() => removePaymentRow(i)}>
                  <svg viewBox="0 0 24 24" fill="none"><path d="M6 7h12M10 11v6M14 11v6M9 7l1-2h4l1 2M7 7l1 12h8l1-12" stroke="currentColor" strokeWidth="2"/></svg>
                  Remove
                </button>}
              </div>
            ))}
            <button className="btn" onClick={addPaymentRow}>
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2"/></svg>
              Add Payment
            </button>
            <div style={{ marginTop: 6, color: '#64748b' }}>Paid: {formatCurrency(paid, settings)} | Due: {formatCurrency(due, settings)} | Change: {formatCurrency(change, settings)}</div>
          </div>
          {canOverrideTax && (
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ color: '#64748b' }}>Tax override (%)</label>
                <input className="input" type="number" min="0" max="100" step="0.01" value={taxOverridePct} onChange={e => setTaxOverridePct(e.target.value)} style={{ width: 140 }} />
              </div>
              {taxOverridePct !== '' && (
                <input className="input" placeholder="Remark for override (required)" value={taxOverrideRemark} onChange={e => setTaxOverrideRemark(e.target.value)} />
              )}
            </div>
          )}
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={() => completeSale(false)} disabled={cart.items.length === 0}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M6 9V3h12v6" stroke="currentColor" strokeWidth="2"/><path d="M6 17h12v4H6z" stroke="currentColor" strokeWidth="2"/><path d="M4 9h16a2 2 0 012 2v2H2v-2a2 2 0 012-2z" stroke="currentColor" strokeWidth="2"/></svg>
            {saving ? 'Processing…' : 'Complete & Print'}
          </button>
          <button className="btn" onClick={() => completeSale(true)} style={{ marginLeft: 8 }} disabled={cart.items.length === 0 || saving}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M6 9V3h12v6" stroke="currentColor" strokeWidth="2"/><path d="M6 17h12v4H6z" stroke="currentColor" strokeWidth="2"/><path d="M4 9h16a2 2 0 012 2v2H2v-2a2 2 0 012-2z" stroke="currentColor" strokeWidth="2"/></svg>
            {saving ? 'Processing…' : 'Complete (ESC/POS)'}
          </button>
          <button className="btn" onClick={() => dispatch(clearCart())} style={{ marginLeft: 8 }} disabled={cart.items.length === 0}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M6 7l1 12h10l1-12M9 7l1-2h4l1 2" stroke="currentColor" strokeWidth="2"/></svg>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

export default PosPage;
