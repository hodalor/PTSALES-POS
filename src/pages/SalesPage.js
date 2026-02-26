import { useSelector } from 'react-redux';
import { useMemo, useState } from 'react';
import { buildBrandedReceiptHtml, printReceiptHtml } from '../utils/print';
import { escposReceipt, downloadText } from '../utils/escpos';
import { formatCurrency } from '../utils/currency';
import { exportCsv, exportTablePdf } from '../utils/exporters';
import OfflineQueueIndicator from '../components/OfflineQueueIndicator';

function SalesPage() {
  const sales = useSelector(s => s.sales.sales);
  const settings = useSelector(s => s.settings);
  const branches = useSelector(s => s.branches.branches);
  const currentBranchId = useSelector(s => s.settings.currentBranchId);
  const auth = useSelector(s => s.auth);
  const roleLower = String(auth.role || '').toLowerCase();
  const canSeeAll = roleLower === 'admin' || roleLower === 'superadmin';
  const [showAll, setShowAll] = useState(false);
  const [tab, setTab] = useState('sales'); // sales, leaderboard, branches
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  function branchLabel(sale) {
    return sale.branchName || (branches.find(b => b.id === sale.branchId)?.name || sale.branchId || '-');
  }
  const filteredSales = (canSeeAll && showAll) ? sales : sales.filter(sale => sale.branchId === currentBranchId);

  const leaderboard = useMemo(() => {
    const map = new Map();
    for (const s of filteredSales) {
      const name = s.sellerName || 'Unknown';
      if (!map.has(name)) map.set(name, { seller: name, revenue: 0, profit: 0, sales: 0 });
      const row = map.get(name);
      row.revenue += Number(s.total) || 0;
      row.profit += Number(s.profitTotal) || 0;
      row.sales += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales]);

  const byId = useMemo(() => {
    const map = new Map();
    branches.forEach(b => map.set(b.id, b.name || b.code || b.id));
    return map;
  }, [branches]);

  const branchComparison = useMemo(() => {
    const map = new Map();
    for (const s of filteredSales) {
      const key = String(s.branchId || '');
      if (!map.has(key)) map.set(key, { branchId: key, name: byId.get(key) || key, revenue: 0, profit: 0, sales: 0 });
      const row = map.get(key);
      row.revenue += Number(s.total) || 0;
      row.profit += Number(s.profitTotal) || 0;
      row.sales += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, byId]);
  function reprint(sale, escpos = false) {
    if (escpos) {
      const text = escposReceipt({
        header: { title: settings.appName, store: settings.receiptHeader, branch: branchLabel(sale), phone: settings.businessPhone || '', cashier: sale.sellerName, customer: sale.customerName ? `${sale.customerName}${sale.customerCode ? ` (${sale.customerCode})` : ''}` : '', receiptId: sale.id, receiptNumber: sale.receiptNumber, invoiceSerial: sale.invoiceSerial },
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
  function onExportCsv() {
    const headers = [
      { key: 'date', label: 'Date', value: s => new Date(s.created_at).toLocaleString() },
      { key: 'branch', label: 'Branch', value: s => branchLabel(s) },
      { key: 'seller', label: 'Seller', value: s => s.sellerName || '' },
      { key: 'invoice', label: 'Invoice', value: s => s.invoiceSerial || '' },
      { key: 'items', label: 'Items', value: s => s.items.map(i => `${i.name}x${i.qty}`).join('; ') },
      { key: 'total', label: 'Total', value: s => s.total }
    ];
    exportCsv('sales.csv', headers, filteredSales);
  }
  function onExportPdf() {
    const headers = [
      { key: 'date', label: 'Date', value: s => new Date(s.created_at).toLocaleString() },
      { key: 'branch', label: 'Branch', value: s => branchLabel(s) },
      { key: 'seller', label: 'Seller', value: s => s.sellerName || '' },
      { key: 'invoice', label: 'Invoice', value: s => s.invoiceSerial || '' },
      { key: 'items', label: 'Items', value: s => s.items.map(i => `${i.name}x${i.qty}`).join('; ') },
      { key: 'total', label: 'Total', value: s => formatCurrency(s.total, settings) }
    ];
    exportTablePdf('Sales', headers, filteredSales);
  }
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Sales</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <OfflineQueueIndicator collection="sales" label="Sales queued" />
          {canSeeAll && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
              <span>All branches</span>
            </label>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <button className={tab === 'sales' ? 'btn btn-primary' : 'btn'} onClick={() => setTab('sales')}>Sales</button>
        <button className={tab === 'leaderboard' ? 'btn btn-primary' : 'btn'} onClick={() => setTab('leaderboard')}>Sales Rep Leaderboard</button>
        <button className={tab === 'branches' ? 'btn btn-primary' : 'btn'} onClick={() => setTab('branches')}>Branch Comparison</button>
      </div>
      {tab === 'sales' && (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, margin: '8px 0' }}>
        <button className="btn" onClick={onExportCsv}>Export CSV</button>
        <button className="btn" onClick={onExportPdf}>Export PDF</button>
      </div>
      )}
      {tab === 'leaderboard' && (
        <div className="card" style={{ marginTop: 12 }}>
          <h2 className="section-title">Sales Rep Leaderboard</h2>
          <table className="table">
            <thead>
              <tr>
                <th align="left">Seller</th>
                <th align="left">Sales</th>
                <th align="left">Revenue</th>
                <th align="left">Profit</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map(x => (
                <tr key={x.seller}>
                  <td>{x.seller}</td>
                  <td>{x.sales}</td>
                  <td>{formatCurrency(x.revenue, settings)}</td>
                  <td>{formatCurrency(x.profit, settings)}</td>
                </tr>
              ))}
              {leaderboard.length === 0 && <tr><td colSpan="4" style={{ padding: 12, color: '#64748b' }}>No sales found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'branches' && (
        <div className="card" style={{ marginTop: 12 }}>
          <h2 className="section-title">Branch Comparison</h2>
          <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>
            {canSeeAll && showAll ? 'Showing all branches' : 'Enable “All branches” to compare branches'}
          </div>
          <table className="table">
            <thead>
              <tr>
                <th align="left">Branch</th>
                <th align="left">Sales</th>
                <th align="left">Revenue</th>
                <th align="left">Profit</th>
              </tr>
            </thead>
            <tbody>
              {branchComparison.map(b => (
                <tr key={b.branchId}>
                  <td>{b.name}</td>
                  <td>{b.sales}</td>
                  <td>{formatCurrency(b.revenue, settings)}</td>
                  <td>{formatCurrency(b.profit, settings)}</td>
                </tr>
              ))}
              {branchComparison.length === 0 && <tr><td colSpan="4" style={{ padding: 12, color: '#64748b' }}>No sales found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'sales' && (
      <>
      <table className="table">
        <thead>
          <tr>
            <th align="left">Date</th>
            <th align="left">Branch</th>
            <th align="left">Seller</th>
            <th align="left">Invoice</th>
            <th align="left">Items</th>
            <th align="left">Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filteredSales.slice((page-1)*pageSize, (page-1)*pageSize + pageSize).map(sale => (
            <tr key={sale.id}>
              <td>{new Date(sale.created_at).toLocaleString()}</td>
              <td>{branchLabel(sale)}</td>
              <td>{sale.sellerName || '-'}</td>
              <td>{sale.invoiceSerial || '—'}</td>
              <td>{sale.items.map(i => `${i.name}${i.spec ? ' ['+i.spec+']' : ''}x${i.qty}`).join(', ')}</td>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
          <span>Page {page} of {Math.max(1, Math.ceil(filteredSales.length / pageSize))}</span>
          <button className="btn" onClick={() => setPage(p => Math.min(Math.max(1, Math.ceil(filteredSales.length / pageSize)), p + 1))} disabled={page >= Math.max(1, Math.ceil(filteredSales.length / pageSize))}>Next</button>
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
      </>
      )}
    </div>
  );
}

export default SalesPage;
