import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useState } from 'react';

function Sidebar() {
  const appName = useSelector(s => s.settings.appName);
  const role = useSelector(s => s.auth.role);
  const grants = useSelector(s => s.auth.grants);
  const rl = String(role || '').toLowerCase();
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
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/logo512.png" alt="logo" />
        <div className="sidebar-title">{appName}</div>
      </div>
      <nav className="sidebar-nav">
        {can(['Admin','Manager','SuperAdmin'],['view_dashboard','see_dashboard']) && (
        <NavLink to="/dashboard" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" fill="currentColor"/></svg>
          Dashboard
        </NavLink>
        )}
        
        {can(['Admin','Manager','Cashier','SuperAdmin'],['view_pos','see_pos']) && (
        <NavLink to="/pos" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M7 4h10a2 2 0 012 2v4H5V6a2 2 0 012-2zm-2 8h14l-1 7a2 2 0 01-2 1H8a2 2 0 01-2-1l-1-7z" fill="currentColor"/></svg>
          POS
        </NavLink>
        )}
        {can(['Admin','Manager','Cashier','SuperAdmin'],['view_sales','see_sales']) && (
        <NavLink to="/sales" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M3 13l4-4 4 4 6-6 4 4" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M5 19h14" stroke="currentColor" strokeWidth="2"/></svg>
          Sales
        </NavLink>
        )}
        {can(['Admin','Manager','Inventory Staff','SuperAdmin'],['view_products','see_products']) && (
        <NavLink to="/products" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 7l8-4 8 4-8 4-8-4z" fill="currentColor"/><path d="M4 17l8 4 8-4" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M4 12l8 4 8-4" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
          Products
        </NavLink>
        )}
        {can(['Admin','Manager','Inventory Staff','SuperAdmin'],['view_inventory','see_inventory']) && (
        <NavLink to="/inventory" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M3 7h18v13H3V7z" stroke="currentColor" strokeWidth="2"/><path d="M8 7V4h8v3" stroke="currentColor" strokeWidth="2"/></svg>
          Inventory
        </NavLink>
        )}
        {can(['Admin','Manager','Inventory Staff','SuperAdmin'],['view_labels','see_labels']) && (
        <NavLink to="/labels" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16v10H4z" stroke="currentColor" strokeWidth="2"/><path d="M8 7V4h8v3" stroke="currentColor" strokeWidth="2"/><path d="M7 13h10" stroke="currentColor" strokeWidth="2"/></svg>
          Labels
        </NavLink>
        )}
        {can(['Admin','Manager','Inventory Staff','SuperAdmin'],['view_purchases','see_purchases']) && (
        <NavLink to="/purchases" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M6 6h13l-1 10a2 2 0 01-2 2H8a2 2 0 01-2-2L5 4H3" stroke="currentColor" strokeWidth="2"/></svg>
          Purchases
        </NavLink>
        )}
        {can(['Admin','Manager','SuperAdmin'],['view_expenses','see_expenses','add_expenses']) && (
        <NavLink to="/expenses" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M6 3h12v18H6z" stroke="currentColor" strokeWidth="2"/><path d="M9 7h6M9 11h6M9 15h4" stroke="currentColor" strokeWidth="2"/></svg>
          Expenses
        </NavLink>
        )}
        {can(['Admin','Manager','Inventory Staff','SuperAdmin'],['view_transfers','see_transfers']) && (
        <NavLink to="/transfers" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M7 7h10M7 17h10M7 7l-3 3m3-3l-3-3M17 17l3 3m-3-3l3-3" stroke="currentColor" strokeWidth="2"/></svg>
          Transfers
        </NavLink>
        )}
        {can(['Admin','Manager','Inventory Staff','SuperAdmin'],['view_adjustments','see_adjustments']) && (
        <NavLink to="/adjustments" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2"/></svg>
          Adjustments
        </NavLink>
        )}
        {can(['Admin','Manager','Inventory Staff','SuperAdmin'],['view_suppliers','see_suppliers']) && (
        <NavLink to="/suppliers" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 12a5 5 0 100-10 5 5 0 000 10z" stroke="currentColor" strokeWidth="2"/><path d="M3 22a9 9 0 0118 0" stroke="currentColor" strokeWidth="2"/></svg>
          Suppliers
        </NavLink>
        )}
        {can(['Admin','Manager','Cashier','SuperAdmin'],['view_customers','see_customers']) && (
        <NavLink to="/customers" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M16 11a4 4 0 10-8 0 4 4 0 008 0z" stroke="currentColor" strokeWidth="2"/><path d="M6 21a6 6 0 0112 0" stroke="currentColor" strokeWidth="2"/></svg>
          Customers
        </NavLink>
        )}
        {can(['Admin','Manager','Cashier','SuperAdmin'],['view_refunds','see_refunds']) && (
        <NavLink to="/refunds" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1018 0" stroke="currentColor" strokeWidth="2"/><path d="M3 12l4 4M3 12l4-4" stroke="currentColor" strokeWidth="2"/></svg>
          Refunds
        </NavLink>
        )}
        {can(['Admin','Manager','SuperAdmin'],['approve_refunds']) && (
        <NavLink to="/refund-approvals" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M5 3h14v18H5z" stroke="currentColor" strokeWidth="2"/><path d="M9 17V9M13 17v-7M17 17v-4" stroke="currentColor" strokeWidth="2"/></svg>
          Refund Approvals
        </NavLink>
        )}
        {can(['Admin','Manager','Auditor','SuperAdmin'],['view_reports','see_reports']) && (
        <NavLink to="/reports" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M5 3h14v18H5z" stroke="currentColor" strokeWidth="2"/><path d="M9 17V9M13 17v-7M17 17v-4" stroke="currentColor" strokeWidth="2"/></svg>
          Reports
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
  if (!allowed) return null;
  return (
    <div>
      <button className="sidebar-group-toggle" onClick={() => setOpen(o => !o)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 12a5 5 0 100-10 5 5 0 000 10z" stroke="currentColor" strokeWidth="2"/><path d="M3 22a9 9 0 0118 0" stroke="currentColor" strokeWidth="2"/></svg>
          Admin
        </span>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2"/>
        </svg>
      </button>
      {open && (
        <div className="sidebar-subgroup">
          {((Array.isArray(grants) && (grants.includes('view_users') || grants.includes('see_users'))) || ['Admin','SuperAdmin'].includes(role)) && (
          <NavLink to="/users" className="sidebar-link">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 6a4 4 0 110 8 4 4 0 010-8z" stroke="currentColor" strokeWidth="2"/><path d="M4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="2"/></svg>
            Users
          </NavLink>
          )}
          <NavLink to="/manual" className="sidebar-link">
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 4h14v16H5z" stroke="currentColor" strokeWidth="2"/><path d="M7 8h10M7 12h10M7 16h6" stroke="currentColor" strokeWidth="2"/></svg>
            Manual
          </NavLink>
          {((Array.isArray(grants) && (grants.includes('view_audit') || grants.includes('see_audit'))) || ['Admin','SuperAdmin'].includes(role)) && (
          <NavLink to="/audit" className="sidebar-link">
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 3h14v18H5z" stroke="currentColor" strokeWidth="2"/><path d="M9 17V9M13 17v-7M17 17v-4" stroke="currentColor" strokeWidth="2"/></svg>
            Audit Log
          </NavLink>
          )}
          {role === 'SuperAdmin' && (
          <NavLink to="/server-logs" className="sidebar-link">
            <svg viewBox="0 0 24 24" fill="none"><path d="M4 6h16v12H4z" stroke="currentColor" strokeWidth="2"/><path d="M7 9h10M7 13h6" stroke="currentColor" strokeWidth="2"/></svg>
            Server Logs
          </NavLink>
          )}
          {((Array.isArray(grants) && (grants.includes('view_stock_records') || grants.includes('see_stock_records'))) || ['Admin','SuperAdmin'].includes(role)) && (
          <NavLink to="/stock-records" className="sidebar-link">
            <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16v10H4z" stroke="currentColor" strokeWidth="2"/><path d="M7 10h10M7 14h6" stroke="currentColor" strokeWidth="2"/></svg>
            Stock Records
          </NavLink>
          )}
          {((Array.isArray(grants) && (grants.includes('view_cashdrawer') || grants.includes('see_cashdrawer'))) || ['Admin','SuperAdmin'].includes(role)) && (
          <NavLink to="/cashdrawer" className="sidebar-link">
            <svg viewBox="0 0 24 24" fill="none"><path d="M3 7h18v10H3V7z" stroke="currentColor" strokeWidth="2"/><path d="M7 11h2M15 11h2" stroke="currentColor" strokeWidth="2"/></svg>
            Cash Drawer
          </NavLink>
          )}
          {((Array.isArray(grants) && (grants.includes('view_config') || grants.includes('see_config'))) || ['Admin','SuperAdmin'].includes(role)) && (
          <NavLink to="/config" className="sidebar-link">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" stroke="currentColor" strokeWidth="2"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06A1.65 1.65 0 0015 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0l-.06-.06A1.65 1.65 0 008.6 19.4a1.65 1.65 0 00-1.82-.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 8.6c.37 0 .73-.13 1.02-.36l.06-.06a2 2 0 012.83 0l.06.06c.29.23.65.36 1.02.36.37 0 .73-.13 1.02-.36l.06-.06a2 2 0 012.83 2.83l-.06.06c-.23.29-.36.65-.36 1.02 0 .37.13.73.36 1.02l.06.06z" stroke="currentColor" strokeWidth="2"/></svg>
            Config
          </NavLink>
          )}
        </div>
      )}
    </div>
  );
}

export default Sidebar;
