import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRepayment, getCustomerCreditSummary, listCreditCustomers, listCreditSales, listRepayments } from '../api/credits';
import { useToast } from '../components/ToastProvider';
import { formatCurrency } from '../utils/currency';
import { promptDialog } from '../utils/dialogs';
import { useSelector } from 'react-redux';

function CreditControlPage({ initialSection = 'clients', clientFilter = 'all', title = 'Credit Control', description = 'EasyBuy balances, overdue tracking, customer rank, and repayment initiation.' }) {
  const settings = useSelector(s => s.settings);
  const saleRows = useSelector(s => s.sales.sales || []);
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState('');
  const [section, setSection] = useState(initialSection);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [customerRows, saleRows, repaymentRows] = await Promise.all([
        listCreditCustomers(),
        listCreditSales(),
        listRepayments()
      ]);
      setCustomers(Array.isArray(customerRows) ? customerRows : []);
      setSales(Array.isArray(saleRows) ? saleRows : []);
      setRepayments(Array.isArray(repaymentRows) ? repaymentRows : []);
    } catch (e) {
      toast.show(String(e?.message || 'Failed to load credit data'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!selectedCustomerId) {
      setSummary(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const data = await getCustomerCreditSummary(selectedCustomerId);
        if (alive) setSummary(data);
      } catch (e) {
        if (alive) toast.show(String(e?.message || 'Failed to load customer summary'), { type: 'error' });
      }
    })();
    return () => { alive = false; };
  }, [selectedCustomerId, toast]);

  const customerMap = useMemo(() => {
    const map = new Map();
    customers.forEach(row => map.set(String(row._id || row.id), row));
    return map;
  }, [customers]);
  const goodClients = useMemo(() => customers.filter(row => Number(row.latePayments || 0) === 0 && Number(row.outstandingBalance || 0) <= 0), [customers]);
  const riskyClients = useMemo(() => customers.filter(row => Number(row.latePayments || 0) > 0 || Number(row.overdueDays || 0) > 0), [customers]);
  const visibleCustomers = useMemo(() => {
    if (clientFilter === 'good') return goodClients;
    if (clientFilter === 'risky') return riskyClients;
    return customers;
  }, [clientFilter, customers, goodClients, riskyClients]);
  const fallbackCreditSales = useMemo(() => {
    return saleRows
      .filter(row => Array.isArray(row.payment_methods) && row.payment_methods.some(p => String(p.type || '').toLowerCase() === 'easybuy'))
      .map(row => ({
        _id: row.creditSaleId || row.id || row._id,
        saleId: row.id || row._id,
        customer_id: row.customerId || '',
        posType: row.posType || 'retail',
        items: row.items || [],
        total_amount: Number(row.total || 0),
        amount_paid: Number(row.creditAmountPaidNow || row.creditSale?.amount_paid || 0),
        balance: Number(row.creditBalance || row.creditSale?.balance || Math.max(0, Number(row.total || 0) - Number(row.creditAmountPaidNow || 0))),
        accumulated_penalty: Number(row.creditSale?.accumulated_penalty || 0),
        due_date: row.creditDueDate || row.creditSale?.due_date || row.creditSale?.dueDate || null,
        overdue_days: Number(row.creditSale?.overdue_days || 0),
        status: row.creditSale?.status || 'active'
      }));
  }, [saleRows]);
  const mergedSales = useMemo(() => {
    const byId = new Map();
    [...fallbackCreditSales, ...sales].forEach(row => {
      const key = String(row.saleId || row._id || '');
      if (!key) return;
      byId.set(key, row);
    });
    return Array.from(byId.values());
  }, [fallbackCreditSales, sales]);
  const shownActiveSales = useMemo(() => mergedSales.filter(row => row.status !== 'completed'), [mergedSales]);
  const overdueSales = useMemo(() => mergedSales.filter(row => row.status === 'overdue'), [mergedSales]);
  const dueTodaySales = useMemo(() => mergedSales.filter(row => {
    if (!row?.due_date || row.status === 'completed') return false;
    const due = new Date(row.due_date);
    const now = new Date();
    return due.toDateString() === now.toDateString();
  }), [mergedSales]);

  async function startRepayment(row) {
    const amount = await promptDialog('Repayment amount');
    if (!amount || Number(amount) <= 0) {
      toast.show('Enter a valid repayment amount', { type: 'error' });
      return;
    }
    const remark = await promptDialog('Repayment remark');
    setWorkingId(row._id || '');
    try {
      await createRepayment({ creditSaleId: row._id, amount: Number(amount), remark: String(remark || '') });
      toast.show('Repayment submitted for approval', { type: 'success' });
      await loadAll();
      if (selectedCustomerId) {
        const next = await getCustomerCreditSummary(selectedCustomerId);
        setSummary(next);
      }
    } catch (e) {
      toast.show(String(e?.message || 'Failed to create repayment'), { type: 'error' });
    } finally {
      setWorkingId('');
    }
  }

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <h1 style={{ margin: 0 }}>{title}</h1>
          <div style={{ color: '#64748b', fontSize: 13 }}>{description}</div>
        </div>
        <button className="btn" onClick={loadAll} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>

      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div>
          <div style={{ color: '#64748b', fontSize: 12 }}>Active Credit Sales</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{shownActiveSales.length}</div>
        </div>
        <div>
          <div style={{ color: '#64748b', fontSize: 12 }}>Overdue Accounts</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: overdueSales.length > 0 ? '#b91c1c' : undefined }}>{overdueSales.length}</div>
        </div>
        <div>
          <div style={{ color: '#64748b', fontSize: 12 }}>Pending Repayments</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{repayments.filter(row => row.status !== 'approved' && row.status !== 'rejected').length}</div>
        </div>
        <div>
          <div style={{ color: '#64748b', fontSize: 12 }}>Due Today</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: dueTodaySales.length > 0 ? '#b45309' : undefined }}>{dueTodaySales.length}</div>
        </div>
        <div>
          <div style={{ color: '#64748b', fontSize: 12 }}>Good Clients</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#15803d' }}>{goodClients.length}</div>
        </div>
        <div>
          <div style={{ color: '#64748b', fontSize: 12 }}>Flagged Clients</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#b91c1c' }}>{riskyClients.length}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className={section === 'clients' ? 'btn btn-primary' : 'btn'} onClick={() => setSection('clients')}>Client Ranking</button>
        <button className={section === 'sales' ? 'btn btn-primary' : 'btn'} onClick={() => setSection('sales')}>Active Sales</button>
        <button className={section === 'repayments' ? 'btn btn-primary' : 'btn'} onClick={() => setSection('repayments')}>Repayments</button>
      </div>

      {section === 'clients' && <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Customer Credit Ranking</h2>
          <select className="select" value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} style={{ minWidth: 260 }}>
            <option value="">Select customer</option>
            {customers.map(row => (
              <option key={row._id || row.id} value={row._id || row.id}>{row.name} {(row.customerCode || '') && `(${row.customerCode})`}</option>
            ))}
          </select>
        </div>
        <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th align="left">Customer</th>
              <th align="left">Behaviour</th>
              <th align="left">Rank</th>
              <th align="left">Score</th>
              <th align="left">Outstanding</th>
              <th align="left">Overdue Days</th>
            </tr>
          </thead>
          <tbody>
            {visibleCustomers.map(row => (
              <tr key={row._id || row.id}>
                <td>{row.name}</td>
                <td>
                  <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 999, background: Number(row.latePayments || 0) > 0 || Number(row.overdueDays || 0) > 0 ? '#fee2e2' : '#dcfce7', color: Number(row.latePayments || 0) > 0 || Number(row.overdueDays || 0) > 0 ? '#b91c1c' : '#166534', fontWeight: 700, fontSize: 12 }}>
                    {Number(row.latePayments || 0) > 0 || Number(row.overdueDays || 0) > 0 ? 'Bad / Risky' : 'Good Client'}
                  </span>
                </td>
                <td>{row.creditRank || 'Bronze'}</td>
                <td>{Number(row.creditScore || 0)}</td>
                <td>{formatCurrency(Number(row.outstandingBalance || 0), settings)}</td>
                <td>{Number(row.overdueDays || 0)}</td>
              </tr>
            ))}
            {!loading && visibleCustomers.length === 0 && <tr><td colSpan="6" style={{ padding: 12, color: '#64748b' }}>No customer credit data</td></tr>}
          </tbody>
        </table>
        </div>
      </div>}

      {section === 'clients' && summary && (
        <div className="card">
          <h2 className="section-title">Selected Customer Summary</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Credit Purchases</div><strong>{formatCurrency(Number(summary.summary?.totalCreditPurchases || 0), settings)}</strong></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Total Paid</div><strong>{formatCurrency(Number(summary.summary?.totalCreditPaid || 0), settings)}</strong></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Outstanding</div><strong>{formatCurrency(Number(summary.summary?.outstandingBalance || 0), settings)}</strong></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Rank</div><strong>{summary.summary?.creditRank || 'Bronze'}</strong></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Overdue Days</div><strong>{Number(summary.summary?.overdueDays || 0)}</strong></div>
            <div><div style={{ color: '#64748b', fontSize: 12 }}>Behaviour</div><strong style={{ color: Number(summary.summary?.latePayments || 0) > 0 || Number(summary.summary?.overdueDays || 0) > 0 ? '#b91c1c' : '#15803d' }}>{Number(summary.summary?.latePayments || 0) > 0 || Number(summary.summary?.overdueDays || 0) > 0 ? 'Bad / Risky' : 'Good Client'}</strong></div>
          </div>
        </div>
      )}

      {section === 'sales' && <div className="card">
        <h2 className="section-title">Active Credit Sales</h2>
        <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th align="left">Customer</th>
              <th align="left">Type</th>
              <th align="left">Items</th>
              <th align="left">Total</th>
              <th align="left">Paid</th>
              <th align="left">Balance</th>
              <th align="left">Penalty</th>
              <th align="left">Due Date</th>
              <th align="left">Status</th>
              <th align="left"></th>
            </tr>
          </thead>
          <tbody>
            {shownActiveSales.map(row => (
              <tr key={row._id}>
                <td>{customerMap.get(String(row.customer_id))?.name || row.customer_id}</td>
                <td>{String(row.posType || 'retail') === 'wholesale' ? 'Wholesale' : 'Retail'}</td>
                <td>{Array.isArray(row.items) ? row.items.map(item => `${item.name} × ${item.qty}`).join(', ') : '—'}</td>
                <td>{formatCurrency(Number(row.total_amount || 0), settings)}</td>
                <td>{formatCurrency(Number(row.amount_paid || 0), settings)}</td>
                <td>{formatCurrency(Number(row.balance || 0), settings)}</td>
                <td>{formatCurrency(Number(row.accumulated_penalty || 0), settings)}</td>
                <td>{row.due_date ? new Date(row.due_date).toLocaleDateString() : '—'} {row.status === 'overdue' ? `• ${row.overdue_days || 0} day(s)` : ''}</td>
                <td>
                  <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 999, background: row.status === 'overdue' ? '#fee2e2' : row.status === 'active' ? '#fef3c7' : '#dcfce7', color: row.status === 'overdue' ? '#b91c1c' : row.status === 'active' ? '#92400e' : '#166534', fontWeight: 700, fontSize: 12 }}>
                    {row.status}
                  </span>
                </td>
                <td><button className="btn btn-primary" onClick={() => startRepayment(row)} disabled={workingId === row._id}>{workingId === row._id ? 'Working…' : 'Repayment'}</button></td>
              </tr>
            ))}
            {!loading && shownActiveSales.length === 0 && <tr><td colSpan="10" style={{ padding: 12, color: '#64748b' }}>No active credit sales</td></tr>}
          </tbody>
        </table>
        </div>
      </div>}

      {section === 'repayments' && <div className="card">
        <h2 className="section-title">Repayment History</h2>
        <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th align="left">Customer</th>
              <th align="left">Amount</th>
              <th align="left">Status</th>
              <th align="left">Remark</th>
              <th align="left">Created</th>
            </tr>
          </thead>
          <tbody>
            {repayments.map(row => (
              <tr key={row._id}>
                <td>{customerMap.get(String(row.customerId))?.name || row.customerId}</td>
                <td>{formatCurrency(Number(row.amount || 0), settings)}</td>
                <td>{row.status}</td>
                <td>{row.remark || '—'}</td>
                <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</td>
              </tr>
            ))}
            {!loading && repayments.length === 0 && <tr><td colSpan="5" style={{ padding: 12, color: '#64748b' }}>No repayments recorded yet</td></tr>}
          </tbody>
        </table>
        </div>
      </div>}
    </div>
  );
}

export default CreditControlPage;
