import { useDispatch, useSelector } from 'react-redux';
import { addItem, removeItem, setQuantity, clearCart, setDiscount } from '../store/cartSlice';
import { enqueue } from '../offline/queue';
import { adjustStock } from '../store/productsSlice';
import { recordSale } from '../store/salesSlice';
import { buildBrandedReceiptHtml, printReceiptHtml } from '../utils/print';
import { escposReceipt, escposOpenDrawer, downloadText } from '../utils/escpos';
import { useToast } from '../components/ToastProvider';
import { formatCurrency } from '../utils/currency';
import { useMemo, useState } from 'react';
import { addAudit } from '../store/auditSlice';

function PosPage() {
  const cart = useSelector(state => state.cart);
  const products = useSelector(s => s.products.products);
  const branches = useSelector(s => s.branches.branches);
  const branchId = useSelector(s => s.settings.currentBranchId);
  const settings = useSelector(s => s.settings);
  const auth = useSelector(s => s.auth);
  const [query, setQuery] = useState('');
  const [payments, setPayments] = useState([{ type: 'cash', amount: '' }]);
  const [view, setView] = useState('grid');
  const [taxOverridePct, setTaxOverridePct] = useState('');
  const [taxOverrideRemark, setTaxOverrideRemark] = useState('');
  const toast = useToast();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q)
    );
  }, [products, query]);
  const dispatch = useDispatch();

  const subtotal = cart.items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);
  const discount = cart.discount || 0;
  const canOverrideTax = ['Admin','Manager'].includes(auth.role) || String(auth.role || '').toLowerCase() === 'superadmin';
  const taxRate = canOverrideTax && taxOverridePct !== '' ? Math.max(0, Math.min(1, Number(taxOverridePct) / 100)) : Number(settings.taxRate ?? 0);
  const tax = Math.max(0, (subtotal - discount) * taxRate);
  const total = Math.max(0, subtotal - discount + tax);
  const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const due = Math.max(0, total - paid);
  const change = Math.max(0, paid - total);

  function addToCart(p) {
    const available = p.stockByBranch?.[branchId] || 0;
    const inCart = cart.items.find(i => i.sku === p.sku)?.quantity || 0;
    if (available - inCart <= 0) {
      toast.show('Out of stock for current branch', { type: 'error' });
      return;
    }
    dispatch(addItem({ name: p.name, sku: p.sku, price: p.price }));
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
    if (due > 0) {
      toast.show('Payment incomplete', { type: 'error' });
      return;
    }
    if (canOverrideTax && taxOverridePct !== '' && String(Math.round((taxRate || 0)*100)) !== String(Math.round((settings.taxRate || 0)*100))) {
      if (!taxOverrideRemark.trim()) {
        toast.show('Enter a remark for tax override', { type: 'error' });
        return;
      }
    }
    const branchName = branches.find(b => b.id === branchId)?.name || branchId;
    const sale = {
      id: String(Date.now()),
      branchId,
      branchName,
      sellerName: auth.user?.name || 'unknown',
      sellerRole: auth.role || '',
      items: cart.items.map(i => ({ name: i.name, sku: i.sku, qty: i.quantity, price: i.price })),
      subtotal,
      discount,
      tax,
      total,
      payment_methods: payments.map(p => ({ type: p.type, amount: Number(p.amount) || 0 })),
      status: 'completed',
      created_at: new Date().toISOString()
    };
    cart.items.forEach(i => {
      const p = products.find(p2 => p2.sku === i.sku);
      if (p) dispatch(adjustStock({ productId: p.id, branchId, delta: -i.quantity }));
    });
    dispatch(recordSale(sale));
    if (canOverrideTax && taxOverridePct !== '' && String(Math.round((taxRate || 0)*100)) !== String(Math.round((settings.taxRate || 0)*100))) {
      dispatch(addAudit({
        actor: auth.user?.name || 'unknown',
        actionType: 'pos_tax_override',
        details: { from: Math.round((settings.taxRate || 0) * 100), to: Math.round(taxRate * 100) },
        remark: taxOverrideRemark,
        branchId
      }));
    }
    dispatch(addAudit({
      actor: auth.user?.name || 'unknown',
      actionType: 'sale_complete',
      details: { total: sale.total, items: sale.items.length },
      branchId
    }));
    const receiptHtml = buildBrandedReceiptHtml({ settings, sale });
    if (!navigator.onLine) {
      await enqueue('sale', sale);
      dispatch(clearCart());
      toast.show('Offline: sale queued for sync.', { type: 'success' });
      return;
    }
    await enqueue('sale', sale);
    dispatch(clearCart());
    if (escpos) {
      const text = escposReceipt({
        header: { title: settings.appName, store: settings.receiptHeader, branch: branchName },
        items: sale.items,
        totals: { subtotal, discount, tax, total },
        footer: { note: settings.receiptFooter },
        settings
      });
      downloadText('receipt-escpos.txt', (settings.drawerOpenOnCash && payments.some(p => p.type === 'cash')) ? (escposOpenDrawer() + '\n' + text) : text);
    } else {
      printReceiptHtml(receiptHtml);
    }
    toast.show('Sale recorded', { type: 'success' });
  }

  function onSearchKeyDown(e) {
    if (e.key === 'Enter') {
      const q = query.trim();
      if (!q) return;
      const exact = products.find(p =>
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
        <h2>Products</h2>
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
        <ul className="cart-list">
          {cart.items.map(item => (
            <li key={item.id} className="cart-item">
              <div className="cart-title">
                <div>{item.name}</div>
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
            <label style={{ color: '#64748b' }}>Discount</label>
            <input className="input" type="number" min="0" value={discount} onChange={e => dispatch(setDiscount(Number(e.target.value)))} style={{ width: 120 }} />
          </div>
          <div style={{ marginTop: 8 }}>
            <div>Subtotal: {formatCurrency(subtotal, settings)}</div>
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
          <button className="btn btn-primary" onClick={() => completeSale(false)} disabled={cart.items.length === 0 || due > 0}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M6 9V3h12v6" stroke="currentColor" strokeWidth="2"/><path d="M6 17h12v4H6z" stroke="currentColor" strokeWidth="2"/><path d="M4 9h16a2 2 0 012 2v2H2v-2a2 2 0 012-2z" stroke="currentColor" strokeWidth="2"/></svg>
            Complete & Print
          </button>
          <button className="btn" onClick={() => completeSale(true)} style={{ marginLeft: 8 }} disabled={cart.items.length === 0 || due > 0}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M6 9V3h12v6" stroke="currentColor" strokeWidth="2"/><path d="M6 17h12v4H6z" stroke="currentColor" strokeWidth="2"/><path d="M4 9h16a2 2 0 012 2v2H2v-2a2 2 0 012-2z" stroke="currentColor" strokeWidth="2"/></svg>
            Complete (ESC/POS)
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
