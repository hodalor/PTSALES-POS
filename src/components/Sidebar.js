import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useState } from 'react';
import { isFeatureEnabled } from '../utils/featureFlags';

function Sidebar({ collapsed }) {
  const appName = useSelector(s => s.settings.appName);
  const settings = useSelector(s => s.settings);
  const role = useSelector(s => s.auth.role);
  const grants = useSelector(s => s.auth.grants);
  const offlineTotal = useSelector(s => s.offlineQueue.total);
  const rl = String(role || '').toLowerCase();
  const expensePending = useSelector(s => (s.expenseRequests?.requests || []).filter(r => String(r.status || '') === 'pending_approval').length);
  const refundPending = useSelector(s => (s.refunds?.requests || []).filter(r => String(r.status || '') === 'pending_approval').length);
  const adjustmentPending = useSelector(s => (s.adjustmentRequests?.requests || []).filter(r => String(r.status || '') === 'pending_approval').length);
  const purchasePending = useSelector(s => (s.purchases?.requests || []).filter(r => String(r.status || '') === 'pending_approval').length);
  const transferPending = useSelector(s => (s.transfers?.requests || []).filter(r => String(r.status || '') === 'pending_approval').length);
  const can = (list, grant) => {
    if (!Array.isArray(list) || list.length === 0) return true;
    if (rl === 'superadmin') return true;
    const okRole = list.map(x => String(x).toLowerCase()).includes(rl);
    function has(g) {
      if (!g) return false;
      const gList = Array.isArray(grants) ? grants : [];
      if (gList.includes(g)) return true;
      if (g.startsWith('view_')) return gList.includes(`see_${g.slice(5)}`);
      if (g.startsWith('see_')) return gList.includes(`view_${g.slice(4)}`);
      return false;
    }
    const okGrant = Array.isArray(grant) ? grant.some(has) : has(grant);
    return okRole || okGrant;
  };
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <img src="/logo512.png" alt="logo" />
        <div className="sidebar-title">{appName}</div>
      </div>
      <nav className="sidebar-nav">
        {isFeatureEnabled(settings, 'modules.dashboard') && can(['Admin','Manager','SuperAdmin'],['view_dashboard','see_dashboard']) && (
        <NavLink to="/dashboard" className="sidebar-link" title="Dashboard">
          <svg viewBox="0 0 24 24" fill="none"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" fill="currentColor"/></svg>
          <span className="sidebar-text">Dashboard</span>
        </NavLink>
        )}
        
        {isFeatureEnabled(settings, 'modules.pos') && can(['Admin','Manager','Cashier','SuperAdmin'],['view_pos','see_pos']) && (
        <NavLink to="/pos" className="sidebar-link" title="POS">
          <svg viewBox="0 0 24 24" fill="none"><path d="M7 4h10a2 2 0 012 2v4H5V6a2 2 0 012-2zm-2 8h14l-1 7a2 2 0 01-2 1H8a2 2 0 01-2-1l-1-7z" fill="currentColor"/></svg>
          <span className="sidebar-text">POS</span>
        </NavLink>
        )}
        {isFeatureEnabled(settings, 'modules.sales') && can(['Admin','Manager','Cashier','SuperAdmin'],['view_sales','see_sales']) && (
        <NavLink to="/sales" className="sidebar-link" title="Sales">
          <svg viewBox="0 0 24 24" fill="none"><path d="M3 13l4-4 4 4 6-6 4 4" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M5 19h14" stroke="currentColor" strokeWidth="2"/></svg>
          <span className="sidebar-text">Sales</span>
        </NavLink>
        )}
        {isFeatureEnabled(settings, 'modules.invoices') && can(['Admin','Manager','Cashier','SuperAdmin'],['view_invoices','see_invoices']) && (
        <NavLink to="/invoices" className="sidebar-link" title="Invoices">
          <svg viewBox="0 0 24 24" fill="none"><path d="M6 3h12v18H6z" stroke="currentColor" strokeWidth="2"/><path d="M9 7h6M9 11h6M9 15h4" stroke="currentColor" strokeWidth="2"/></svg>
          <span className="sidebar-text">Invoices</span>
        </NavLink>
        )}
        {isFeatureEnabled(settings, 'modules.products') && can(['Admin','Manager','Inventory Staff','SuperAdmin'],['view_products','see_products']) && (
        <NavLink to="/products" className="sidebar-link" title="Products">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 7l8-4 8 4-8 4-8-4z" fill="currentColor"/><path d="M4 17l8 4 8-4" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M4 12l8 4 8-4" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
          <span className="sidebar-text">Products</span>
        </NavLink>
        )}
        {isFeatureEnabled(settings, 'modules.inventory') && can(['Admin','Manager','Inventory Staff','SuperAdmin'],['view_inventory','see_inventory']) && (
        <NavLink to="/inventory" className="sidebar-link" title="Inventory">
          <svg viewBox="0 0 24 24" fill="none"><path d="M3 7h18v13H3V7z" stroke="currentColor" strokeWidth="2"/><path d="M8 7V4h8v3" stroke="currentColor" strokeWidth="2"/></svg>
          <span className="sidebar-text">Inventory</span>
        </NavLink>
        )}
        {isFeatureEnabled(settings, 'modules.labels') && can(['Admin','Manager','Inventory Staff','SuperAdmin'],['view_labels','see_labels']) && (
        <NavLink to="/labels" className="sidebar-link" title="Labels">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16v10H4z" stroke="currentColor" strokeWidth="2"/><path d="M8 7V4h8v3" stroke="currentColor" strokeWidth="2"/><path d="M7 13h10" stroke="currentColor" strokeWidth="2"/></svg>
          <span className="sidebar-text">Labels</span>
        </NavLink>
        )}
        {isFeatureEnabled(settings, 'modules.purchases') && can(['Admin','Manager','Inventory Staff','SuperAdmin'],['view_purchases','see_purchases']) && (
        <NavLink to="/purchases" className="sidebar-link" title="Purchases" style={{ display: 'flex', alignItems: 'center' }}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M6 6h13l-1 10a2 2 0 01-2 2H8a2 2 0 01-2-2L5 4H3" stroke="currentColor" strokeWidth="2"/></svg>
          <span className="sidebar-text">Purchases</span>
          {purchasePending > 0 && can(['Admin','Manager','SuperAdmin'],['approve_purchases']) && (
            <span style={{ marginLeft: 'auto', minWidth: 22, height: 20, borderRadius: 999, padding: '0 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: 12 }}>
              {purchasePending}
            </span>
          )}
        </NavLink>
        )}
        {isFeatureEnabled(settings, 'modules.expenses') && can(['Admin','Manager','SuperAdmin'],['view_expenses','see_expenses','add_expenses']) && (
        <NavLink to="/expenses" className="sidebar-link" title="Expenses" style={{ display: 'flex', alignItems: 'center' }}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M6 3h12v18H6z" stroke="currentColor" strokeWidth="2"/><path d="M9 7h6M9 11h6M9 15h4" stroke="currentColor" strokeWidth="2"/></svg>
          <span className="sidebar-text">Expenses</span>
          {expensePending > 0 && isFeatureEnabled(settings, 'modules.expenseApprovals') && can(['Admin','Manager','SuperAdmin'],['approve_expenses']) && (
            <span style={{ marginLeft: 'auto', minWidth: 22, height: 20, borderRadius: 999, padding: '0 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: 12 }}>
              {expensePending}
            </span>
          )}
        </NavLink>
        )}
        {isFeatureEnabled(settings, 'modules.expenses') && isFeatureEnabled(settings, 'modules.expenseApprovals') && can(['Admin','Manager','SuperAdmin'],['approve_expenses']) && (
        <NavLink to="/expense-approvals" className="sidebar-link" title="Expense Approvals" style={{ display: 'flex', alignItems: 'center' }}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M5 3h14v18H5z" stroke="currentColor" strokeWidth="2"/><path d="M9 17V9M13 17v-7M17 17v-4" stroke="currentColor" strokeWidth="2"/></svg>
          <span className="sidebar-text">Expense Approvals</span>
          {expensePending > 0 && (
            <span style={{ marginLeft: 'auto', minWidth: 22, height: 20, borderRadius: 999, padding: '0 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: 12 }}>
              {expensePending}
            </span>
          )}
        </NavLink>
        )}
        {isFeatureEnabled(settings, 'modules.transfers') && can(['Admin','Manager','Inventory Staff','SuperAdmin'],['view_transfers','see_transfers']) && (
        <NavLink to="/transfers" className="sidebar-link" title="Transfers" style={{ display: 'flex', alignItems: 'center' }}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M7 7h10M7 17h10M7 7l-3 3m3-3l-3-3M17 17l3 3m-3-3l3-3" stroke="currentColor" strokeWidth="2"/></svg>
          <span className="sidebar-text">Transfers</span>
          {transferPending > 0 && can(['Admin','Manager','SuperAdmin'],['approve_transfers']) && (
            <span style={{ marginLeft: 'auto', minWidth: 22, height: 20, borderRadius: 999, padding: '0 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: 12 }}>
              {transferPending}
            </span>
          )}
        </NavLink>
        )}
        {isFeatureEnabled(settings, 'modules.adjustments') && can(['Admin','Manager','Inventory Staff','SuperAdmin'],['view_adjustments','see_adjustments']) && (
        <NavLink to="/adjustments" className="sidebar-link" title="Adjustments" style={{ display: 'flex', alignItems: 'center' }}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2"/></svg>
          <span className="sidebar-text">Adjustments</span>
          {adjustmentPending > 0 && can(['Admin','Manager','SuperAdmin'],['approve_adjustments']) && (
            <span style={{ marginLeft: 'auto', minWidth: 22, height: 20, borderRadius: 999, padding: '0 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: 12 }}>
              {adjustmentPending}
            </span>
          )}
        </NavLink>
        )}
        {isFeatureEnabled(settings, 'modules.suppliers') && can(['Admin','Manager','Inventory Staff','SuperAdmin'],['view_suppliers','see_suppliers']) && (
        <NavLink to="/suppliers" className="sidebar-link" title="Suppliers">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 12a5 5 0 100-10 5 5 0 000 10z" stroke="currentColor" strokeWidth="2"/><path d="M3 22a9 9 0 0118 0" stroke="currentColor" strokeWidth="2"/></svg>
          <span className="sidebar-text">Suppliers</span>
        </NavLink>
        )}
        {isFeatureEnabled(settings, 'modules.customers') && can(['Admin','Manager','Cashier','SuperAdmin'],['view_customers','see_customers']) && (
        <NavLink to="/customers" className="sidebar-link" title="Customers">
          <svg viewBox="0 0 24 24" fill="none"><path d="M16 11a4 4 0 10-8 0 4 4 0 008 0z" stroke="currentColor" strokeWidth="2"/><path d="M6 21a6 6 0 0112 0" stroke="currentColor" strokeWidth="2"/></svg>
          <span className="sidebar-text">Customers</span>
        </NavLink>
        )}
        {isFeatureEnabled(settings, 'modules.refunds') && can(['Admin','Manager','Cashier','SuperAdmin'],['view_refunds','see_refunds']) && (
        <NavLink to="/refunds" className="sidebar-link" title="Refunds">
          <svg viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1018 0" stroke="currentColor" strokeWidth="2"/><path d="M3 12l4 4M3 12l4-4" stroke="currentColor" strokeWidth="2"/></svg>
          <span className="sidebar-text">Refunds</span>
        </NavLink>
        )}
        {isFeatureEnabled(settings, 'modules.refundApprovals') && can(['Admin','Manager','SuperAdmin'],['approve_refunds']) && (
        <NavLink to="/refund-approvals" className="sidebar-link" title="Refund Approvals" style={{ display: 'flex', alignItems: 'center' }}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M5 3h14v18H5z" stroke="currentColor" strokeWidth="2"/><path d="M9 17V9M13 17v-7M17 17v-4" stroke="currentColor" strokeWidth="2"/></svg>
          <span className="sidebar-text">Refund Approvals</span>
          {refundPending > 0 && (
            <span style={{ marginLeft: 'auto', minWidth: 22, height: 20, borderRadius: 999, padding: '0 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: 12 }}>
              {refundPending}
            </span>
          )}
        </NavLink>
        )}
        {isFeatureEnabled(settings, 'modules.reports') && can(['Admin','Manager','Auditor','SuperAdmin'],['view_reports','see_reports']) && (
        <NavLink to="/reports" className="sidebar-link" title="Reports">
          <svg viewBox="0 0 24 24" fill="none"><path d="M5 3h14v18H5z" stroke="currentColor" strokeWidth="2"/><path d="M9 17V9M13 17v-7M17 17v-4" stroke="currentColor" strokeWidth="2"/></svg>
          <span className="sidebar-text">Reports</span>
        </NavLink>
        )}
        {isFeatureEnabled(settings, 'modules.backup') && can(['Admin','Manager','SuperAdmin'], null) && (
        <NavLink to="/backup" className="sidebar-link" title="Backup" style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16v10H4V7z" stroke="currentColor" strokeWidth="2"/><path d="M8 11h8" stroke="currentColor" strokeWidth="2"/></svg>
            <span className="sidebar-text">Backup</span>
          </span>
          {Number(offlineTotal || 0) > 0 && (
            <span style={{ marginLeft: 'auto', minWidth: 22, height: 20, borderRadius: 999, padding: '0 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: 12 }}>
              {Number(offlineTotal || 0)}
            </span>
          )}
        </NavLink>
        )}
        <AdminGroup />
      </nav>
    </aside>
  );
}

function AdminGroup() {
  const [open, setOpen] = useState(false);
  const role = useSelector(s => s.auth.role);
  const grants = useSelector(s => s.auth.grants);
  const settings = useSelector(s => s.settings);
  const allowed = (
    ['Admin', 'SuperAdmin'].includes(role) ||
    (Array.isArray(grants) && (
      grants.includes('view_users') || grants.includes('see_users') ||
      grants.includes('view_config') || grants.includes('see_config') ||
      grants.includes('view_audit') || grants.includes('see_audit') ||
      grants.includes('view_stock_records') || grants.includes('see_stock_records') ||
      grants.includes('view_cashdrawer') || grants.includes('see_cashdrawer')
    ))
  );
  const anyEnabled = (
    isFeatureEnabled(settings, 'admin.users') ||
    isFeatureEnabled(settings, 'admin.manual') ||
    isFeatureEnabled(settings, 'admin.docs') ||
    isFeatureEnabled(settings, 'admin.audit') ||
    isFeatureEnabled(settings, 'admin.serverLogs') ||
    isFeatureEnabled(settings, 'admin.stockRecords') ||
    isFeatureEnabled(settings, 'admin.cashDrawer') ||
    isFeatureEnabled(settings, 'admin.config') ||
    isFeatureEnabled(settings, 'admin.godhand')
  );
  if (!allowed || !anyEnabled) return null;
  return (
    <div>
      <button className="sidebar-group-toggle" onClick={() => setOpen(o => !o)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 12a5 5 0 100-10 5 5 0 000 10z" stroke="currentColor" strokeWidth="2"/><path d="M3 22a9 9 0 0118 0" stroke="currentColor" strokeWidth="2"/></svg>
          <span className="sidebar-text">Admin</span>
        </span>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2"/>
        </svg>
      </button>
      {open && (
        <div className="sidebar-subgroup">
          {isFeatureEnabled(settings, 'admin.users') && ((Array.isArray(grants) && (grants.includes('view_users') || grants.includes('see_users'))) || ['Admin','SuperAdmin'].includes(role)) && (
          <NavLink to="/users" className="sidebar-link" title="Users">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 6a4 4 0 110 8 4 4 0 010-8z" stroke="currentColor" strokeWidth="2"/><path d="M4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="2"/></svg>
            <span className="sidebar-text">Users</span>
          </NavLink>
          )}
          {isFeatureEnabled(settings, 'admin.manual') && (
          <NavLink to="/manual" className="sidebar-link" title="Manual">
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 4h14v16H5z" stroke="currentColor" strokeWidth="2"/><path d="M7 8h10M7 12h10M7 16h6" stroke="currentColor" strokeWidth="2"/></svg>
            <span className="sidebar-text">Manual</span>
          </NavLink>
          )}
          {isFeatureEnabled(settings, 'admin.docs') && role === 'SuperAdmin' && (
          <NavLink to="/docs" className="sidebar-link" title="Docs">
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 4h14v16H5z" stroke="currentColor" strokeWidth="2"/><path d="M7 8h10M7 12h10M7 16h6" stroke="currentColor" strokeWidth="2"/></svg>
            <span className="sidebar-text">Docs</span>
          </NavLink>
          )}
          {isFeatureEnabled(settings, 'admin.audit') && ((Array.isArray(grants) && (grants.includes('view_audit') || grants.includes('see_audit'))) || ['Admin','SuperAdmin'].includes(role)) && (
          <NavLink to="/audit" className="sidebar-link" title="Audit Log">
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 3h14v18H5z" stroke="currentColor" strokeWidth="2"/><path d="M9 17V9M13 17v-7M17 17v-4" stroke="currentColor" strokeWidth="2"/></svg>
            <span className="sidebar-text">Audit Log</span>
          </NavLink>
          )}
          {isFeatureEnabled(settings, 'admin.serverLogs') && role === 'SuperAdmin' && (
          <NavLink to="/server-logs" className="sidebar-link" title="Server Logs">
            <svg viewBox="0 0 24 24" fill="none"><path d="M4 6h16v12H4z" stroke="currentColor" strokeWidth="2"/><path d="M7 9h10M7 13h6" stroke="currentColor" strokeWidth="2"/></svg>
            <span className="sidebar-text">Server Logs</span>
          </NavLink>
          )}
          {isFeatureEnabled(settings, 'admin.stockRecords') && ((Array.isArray(grants) && (grants.includes('view_stock_records') || grants.includes('see_stock_records'))) || ['Admin','SuperAdmin'].includes(role)) && (
          <NavLink to="/stock-records" className="sidebar-link" title="Stock Records">
            <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16v10H4z" stroke="currentColor" strokeWidth="2"/><path d="M7 10h10M7 14h6" stroke="currentColor" strokeWidth="2"/></svg>
            <span className="sidebar-text">Stock Records</span>
          </NavLink>
          )}
          {isFeatureEnabled(settings, 'admin.cashDrawer') && ((Array.isArray(grants) && (grants.includes('view_cashdrawer') || grants.includes('see_cashdrawer'))) || ['Admin','SuperAdmin'].includes(role)) && (
          <NavLink to="/cashdrawer" className="sidebar-link" title="Cash Drawer">
            <svg viewBox="0 0 24 24" fill="none"><path d="M3 7h18v10H3V7z" stroke="currentColor" strokeWidth="2"/><path d="M7 11h2M15 11h2" stroke="currentColor" strokeWidth="2"/></svg>
            <span className="sidebar-text">Cash Drawer</span>
          </NavLink>
          )}
          {isFeatureEnabled(settings, 'admin.config') && ((Array.isArray(grants) && (grants.includes('view_config') || grants.includes('see_config'))) || ['Admin','SuperAdmin'].includes(role)) && (
          <NavLink to="/config" className="sidebar-link" title="Config">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" stroke="currentColor" strokeWidth="2"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06A1.65 1.65 0 0015 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0l-.06-.06A1.65 1.65 0 008.6 19.4a1.65 1.65 0 00-1.82-.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 8.6c.37 0 .73-.13 1.02-.36l.06-.06a2 2 0 012.83 0l.06.06c.29.23.65.36 1.02.36.37 0 .73-.13 1.02-.36l.06-.06a2 2 0 012.83 2.83l-.06.06c-.23.29-.36.65-.36 1.02 0 .37.13.73.36 1.02l.06.06z" stroke="currentColor" strokeWidth="2"/></svg>
            <span className="sidebar-text">Config</span>
          </NavLink>
          )}
          {isFeatureEnabled(settings, 'admin.godhand') && role === 'SuperAdmin' && (
          <NavLink to="/godhand" className="sidebar-link" title="GodHand">
            <svg viewBox="0 0 24 24" fill="none"><path d="M7 7a5 5 0 0110 0v4a4 4 0 01-4 4h-1v3H9v-5H8a3 3 0 01-3-3V7z" stroke="currentColor" strokeWidth="2"/></svg>
            <span className="sidebar-text">GodHand</span>
          </NavLink>
          )}
        </div>
      )}
    </div>
  );
}

export default Sidebar;
