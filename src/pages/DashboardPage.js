import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { formatCurrency } from '../utils/currency';
import { Chart, BarElement, LineElement, PointElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend, Filler } from 'chart.js';

Chart.register(BarElement, LineElement, PointElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend, Filler);

function DashboardPage() {
  const sales = useSelector(s => s.sales.sales);
  const products = useSelector(s => s.products.products);
  const settings = useSelector(s => s.settings);
  const auth = useSelector(s => s.auth);

  const metrics = useMemo(() => {
    const roleLower = String(auth.role || '').toLowerCase();
    const sourceSales = (roleLower === 'superadmin' || roleLower === 'admin') ? sales : sales.filter(s => s.branchId === settings.currentBranchId);
    const today = new Date().toDateString();
    let todayTotal = 0;
    let itemsSold = 0;
    const perDay = {};
    const perDayPayments = {}; // { 'YYYY-MM-DD': { cash: x, card: y, ... } }
    const categoryTotals = {};
    const productUnits = {}; // sku -> qty
    const cashierTotals = {};
    for (const sale of sourceSales) {
      const day = new Date(sale.created_at).toISOString().slice(0, 10);
      perDay[day] = (perDay[day] || 0) + sale.total;
      perDayPayments[day] = perDayPayments[day] || {};
      (sale.payment_methods || []).forEach(pm => {
        const t = pm.type || 'other';
        perDayPayments[day][t] = (perDayPayments[day][t] || 0) + (pm.amount || 0);
      });
      if (new Date(sale.created_at).toDateString() === today) todayTotal += sale.total;
      const seller = sale.sellerName || 'Unknown';
      cashierTotals[seller] = (cashierTotals[seller] || 0) + (sale.total || 0);
      for (const it of sale.items) {
        itemsSold += it.qty;
        const prod = products.find(p => p.sku === it.sku);
        const cat = prod?.category || 'Uncategorized';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + it.qty;
        productUnits[it.sku] = (productUnits[it.sku] || 0) + it.qty;
      }
    }
    const last7 = [...new Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });
    const last30 = [...new Array(30)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return d.toISOString().slice(0, 10);
    });
    const lineData = {
      labels: last30,
      datasets: [{
        label: 'Revenue',
        data: last30.map(d => +(perDay[d] || 0).toFixed(2)),
        fill: true,
        tension: 0.35,
        backgroundColor: 'rgba(22,163,74,0.15)',
        borderColor: '#16a34a',
        pointRadius: 0
      }]
    };
    const paymentTypes = ['cash','card','mobile','wallet','other'];
    const paymentBar = {
      labels: last7,
      datasets: paymentTypes.map((t, idx) => ({
        label: t.charAt(0).toUpperCase() + t.slice(1),
        data: last7.map(d => +(perDayPayments[d]?.[t] || 0).toFixed(2)),
        backgroundColor: ['#16a34a','#0ea5e9','#8b5cf6','#f59e0b','#64748b'][idx]
      }))
    };
    const doughLabels = Object.keys(categoryTotals);
    const doughData = {
      labels: doughLabels,
      datasets: [{
        data: doughLabels.map(k => categoryTotals[k]),
        backgroundColor: ['#0ea5e9','#16a34a','#f59e0b','#ef4444','#8b5cf6','#14b8a6']
      }]
    };
    const top5 = Object.entries(productUnits)
      .sort((a,b) => b[1]-a[1])
      .slice(0,5)
      .map(([sku, qty]) => {
        const p = products.find(pp => pp.sku === sku);
        return { name: p?.name || sku, qty };
      });
    const topBar = {
      labels: top5.map(x => x.name),
      datasets: [{
        label: 'Units',
        data: top5.map(x => x.qty),
        backgroundColor: '#0ea5e9'
      }]
    };
    const stackedOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { stacked: true }, y: { stacked: true } }
    };
    const lineOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      interaction: { intersect: false, mode: 'index' },
      scales: { y: { beginAtZero: true } }
    };
    const barOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, indexAxis: 'y' };
    const cashierTop = Object.entries(cashierTotals).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const cashierBar = {
      labels: cashierTop.map(x => x[0]),
      datasets: [{ label: 'Revenue', data: cashierTop.map(x => +(x[1]||0).toFixed(2)), backgroundColor: '#16a34a' }]
    };
    return { todayTotal, itemsSold, lineData, paymentBar, doughData, topBar, stackedOptions, lineOptions, barOptions, cashierBar };
  }, [sales, products, settings.currentBranchId, auth.role]);

  return (
    <div style={{ padding: 16 }}>
      <h1>Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#fff', padding: 16, borderRadius: 12 }}>
          <div style={{ color: '#64748b' }}>Today Sales</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{formatCurrency(metrics.todayTotal, settings)}</div>
        </div>
        <div style={{ background: '#fff', padding: 16, borderRadius: 12 }}>
          <div style={{ color: '#64748b' }}>Items Sold</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{metrics.itemsSold}</div>
        </div>
        <div style={{ background: '#fff', padding: 16, borderRadius: 12 }}>
          <div style={{ color: '#64748b' }}>Transactions</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{(String(auth.role||'').toLowerCase()==='superadmin'||String(auth.role||'').toLowerCase()==='admin') ? sales.length : sales.filter(s=>s.branchId===settings.currentBranchId).length}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={{ background: '#fff', padding: 16, borderRadius: 12 }}>
          <h2 style={{ marginTop: 0 }}>Revenue (Last 30 days)</h2>
          <div style={{ height: 260 }}>
            <Line data={metrics.lineData} options={metrics.lineOptions} />
          </div>
        </div>
        <div style={{ background: '#fff', padding: 16, borderRadius: 12 }}>
          <h2 style={{ marginTop: 0 }}>Units by Category</h2>
          <Doughnut data={metrics.doughData} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div style={{ background: '#fff', padding: 16, borderRadius: 12 }}>
          <h2 style={{ marginTop: 0 }}>Top Products (Units)</h2>
          <div style={{ height: 220 }}>
            <Bar data={metrics.topBar} options={metrics.barOptions} />
          </div>
        </div>
        <div style={{ background: '#fff', padding: 16, borderRadius: 12 }}>
          <h2 style={{ marginTop: 0 }}>Payments by Day (7d)</h2>
          <div style={{ height: 220 }}>
            <Bar data={metrics.paymentBar} options={metrics.stackedOptions} />
          </div>
        </div>
      </div>
      <div style={{ background: '#fff', padding: 16, borderRadius: 12, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Cashier Performance (30d revenue)</h2>
        <div style={{ height: 240 }}>
          <Bar data={metrics.cashierBar} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
