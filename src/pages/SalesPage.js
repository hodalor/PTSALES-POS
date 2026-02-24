import { useSelector } from 'react-redux';
import { useState } from 'react';
import { buildBrandedReceiptHtml, printReceiptHtml } from '../utils/print';
import { escposReceipt, downloadText } from '../utils/escpos';
import { formatCurrency } from '../utils/currency';

function SalesPage() {
  const sales = useSelector(s => s.sales.sales);
  const settings = useSelector(s => s.settings);
  const branches = useSelector(s => s.branches.branches);
  const currentBranchId = useSelector(s => s.settings.currentBranchId);
  const auth = useSelector(s => s.auth);
  const roleLower = String(auth.role || '').toLowerCase();
  const canSeeAll = roleLower === 'admin' || roleLower === 'superadmin';
  const [showAll, setShowAll] = useState(false);
  function branchLabel(sale) {
    return sale.branchName || (branches.find(b => b.id === sale.branchId)?.name || sale.branchId || '-');
  }
  const filteredSales = (canSeeAll && showAll) ? sales : sales.filter(sale => sale.branchId === currentBranchId);
  function reprint(sale, escpos = false) {
    if (escpos) {
      const text = escposReceipt({
        header: { title: settings.appName, store: settings.receiptHeader, branch: branchLabel(sale) },
        items: sale.items,
        totals: { subtotal: sale.subtotal, discount: sale.discount, tax: sale.tax, total: sale.total },
        footer: { note: settings.receiptFooter },
        settings
      });
      downloadText(`receipt-${sale.id}.txt`, text);
      return;
    }
    const html = buildBrandedReceiptHtml({ settings, sale: { ...sale, branchName: branchLabel(sale) } });
    printReceiptHtml(html);
  }
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Sales</h1>
        {canSeeAll && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
            <span>All branches</span>
          </label>
        )}
      </div>
      <table className="table">
        <thead>
          <tr>
            <th align="left">Date</th>
            <th align="left">Branch</th>
            <th align="left">Seller</th>
            <th align="left">Items</th>
            <th align="left">Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filteredSales.map(sale => (
            <tr key={sale.id}>
              <td>{new Date(sale.created_at).toLocaleString()}</td>
              <td>{branchLabel(sale)}</td>
              <td>{sale.sellerName || '-'}</td>
              <td>{sale.items.map(i => `${i.name}x${i.qty}`).join(', ')}</td>
              <td>{formatCurrency(sale.total, settings)}</td>
              <td>
                <button className="btn btn-primary" onClick={() => reprint(sale, false)}>
                  <svg viewBox="0 0 24 24" fill="none"><path d="M6 9V3h12v6" stroke="currentColor" strokeWidth="2"/><path d="M6 17h12v4H6z" stroke="currentColor" strokeWidth="2"/><path d="M4 9h16a2 2 0 012 2v2H2v-2a2 2 0 012-2z" stroke="currentColor" strokeWidth="2"/></svg>
                  Reprint
                </button>
                <button className="btn" onClick={() => reprint(sale, true)} style={{ marginLeft: 6 }}>
                  <svg viewBox="0 0 24 24" fill="none"><path d="M6 9V3h12v6" stroke="currentColor" strokeWidth="2"/><path d="M6 17h12v4H6z" stroke="currentColor" strokeWidth="2"/><path d="M4 9h16a2 2 0 012 2v2H2v-2a2 2 0 012-2z" stroke="currentColor" strokeWidth="2"/></svg>
                  ESC/POS
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default SalesPage;
