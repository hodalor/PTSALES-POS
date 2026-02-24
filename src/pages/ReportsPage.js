import { useSelector } from 'react-redux';

function ReportsPage() {
  const sales = useSelector(s => s.sales.sales);
  const branches = useSelector(s => s.branches.branches);
  function branchLabel(sale) {
    return sale.branchName || (branches.find(b => b.id === sale.branchId)?.name || sale.branchId || '-');
  }

  function exportCsv() {
    const cols = ['id','created_at','branch','seller','items','subtotal','discount','tax','total'];
    const lines = [cols.join(',')].concat(
      sales.map(sale => [
        sale.id,
        sale.created_at,
        branchLabel(sale),
        sale.sellerName || '',
        JSON.stringify(sale.items).replaceAll(',', ';'),
        sale.subtotal,
        sale.discount,
        sale.tax,
        sale.total
      ].join(','))
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Reports</h1>
      <button className="btn btn-primary" onClick={exportCsv}>
        <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v12M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2"/><path d="M5 19h14" stroke="currentColor" strokeWidth="2"/></svg>
        Export Sales CSV
      </button>
      <table className="table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th align="left">Date</th>
            <th align="left">Branch</th>
            <th align="left">Seller</th>
            <th align="left">Items</th>
            <th align="left">Total</th>
          </tr>
        </thead>
        <tbody>
          {sales.map(sale => (
            <tr key={sale.id}>
              <td>{new Date(sale.created_at).toLocaleString()}</td>
              <td>{branchLabel(sale)}</td>
              <td>{sale.sellerName || '-'}</td>
              <td>{sale.items.map(i => `${i.name}x${i.qty}`).join(', ')}</td>
              <td>${sale.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ReportsPage;
