import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useState } from 'react';

function Sidebar() {
  const appName = useSelector(s => s.settings.appName);
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/logo512.png" alt="logo" />
        <div className="sidebar-title">{appName}</div>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" fill="currentColor"/></svg>
          Dashboard
        </NavLink>
        <NavLink to="/pos" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M7 4h10a2 2 0 012 2v4H5V6a2 2 0 012-2zm-2 8h14l-1 7a2 2 0 01-2 1H8a2 2 0 01-2-1l-1-7z" fill="currentColor"/></svg>
          POS
        </NavLink>
        <NavLink to="/sales" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M3 13l4-4 4 4 6-6 4 4" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M5 19h14" stroke="currentColor" strokeWidth="2"/></svg>
          Sales
        </NavLink>
        <NavLink to="/products" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 7l8-4 8 4-8 4-8-4z" fill="currentColor"/><path d="M4 17l8 4 8-4" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M4 12l8 4 8-4" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
          Products
        </NavLink>
        <NavLink to="/inventory" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M3 7h18v13H3V7z" stroke="currentColor" strokeWidth="2"/><path d="M8 7V4h8v3" stroke="currentColor" strokeWidth="2"/></svg>
          Inventory
        </NavLink>
        <NavLink to="/labels" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16v10H4z" stroke="currentColor" strokeWidth="2"/><path d="M8 7V4h8v3" stroke="currentColor" strokeWidth="2"/><path d="M7 13h10" stroke="currentColor" strokeWidth="2"/></svg>
          Labels
        </NavLink>
        <NavLink to="/purchases" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M6 6h13l-1 10a2 2 0 01-2 2H8a2 2 0 01-2-2L5 4H3" stroke="currentColor" strokeWidth="2"/></svg>
          Purchases
        </NavLink>
        <NavLink to="/transfers" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M7 7h10M7 17h10M7 7l-3 3m3-3l-3-3M17 17l3 3m-3-3l3-3" stroke="currentColor" strokeWidth="2"/></svg>
          Transfers
        </NavLink>
        <NavLink to="/adjustments" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2"/></svg>
          Adjustments
        </NavLink>
        <NavLink to="/suppliers" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 12a5 5 0 100-10 5 5 0 000 10z" stroke="currentColor" strokeWidth="2"/><path d="M3 22a9 9 0 0118 0" stroke="currentColor" strokeWidth="2"/></svg>
          Suppliers
        </NavLink>
        <NavLink to="/customers" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M16 11a4 4 0 10-8 0 4 4 0 008 0z" stroke="currentColor" strokeWidth="2"/><path d="M6 21a6 6 0 0112 0" stroke="currentColor" strokeWidth="2"/></svg>
          Customers
        </NavLink>
        <NavLink to="/refunds" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1018 0" stroke="currentColor" strokeWidth="2"/><path d="M3 12l4 4M3 12l4-4" stroke="currentColor" strokeWidth="2"/></svg>
          Refunds
        </NavLink>
        <NavLink to="/reports" className="sidebar-link">
          <svg viewBox="0 0 24 24" fill="none"><path d="M5 3h14v18H5z" stroke="currentColor" strokeWidth="2"/><path d="M9 17V9M13 17v-7M17 17v-4" stroke="currentColor" strokeWidth="2"/></svg>
          Reports
        </NavLink>
        <AdminGroup />
      </nav>
    </aside>
  );
}

function AdminGroup() {
  const [open, setOpen] = useState(false);
  const role = useSelector(s => s.auth.role);
  const allowed = ['Admin', 'SuperAdmin'].includes(role);
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
          <NavLink to="/users" className="sidebar-link">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 6a4 4 0 110 8 4 4 0 010-8z" stroke="currentColor" strokeWidth="2"/><path d="M4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="2"/></svg>
            Users
          </NavLink>
          <NavLink to="/audit" className="sidebar-link">
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 3h14v18H5z" stroke="currentColor" strokeWidth="2"/><path d="M9 17V9M13 17v-7M17 17v-4" stroke="currentColor" strokeWidth="2"/></svg>
            Audit Log
          </NavLink>
          <NavLink to="/cashdrawer" className="sidebar-link">
            <svg viewBox="0 0 24 24" fill="none"><path d="M3 7h18v10H3V7z" stroke="currentColor" strokeWidth="2"/><path d="M7 11h2M15 11h2" stroke="currentColor" strokeWidth="2"/></svg>
            Cash Drawer
          </NavLink>
          <NavLink to="/config" className="sidebar-link">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" stroke="currentColor" strokeWidth="2"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06A1.65 1.65 0 0015 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0l-.06-.06A1.65 1.65 0 008.6 19.4a1.65 1.65 0 00-1.82-.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 8.6c.37 0 .73-.13 1.02-.36l.06-.06a2 2 0 012.83 0l.06.06c.29.23.65.36 1.02.36.37 0 .73-.13 1.02-.36l.06-.06a2 2 0 012.83 2.83l-.06.06c-.23.29-.36.65-.36 1.02 0 .37.13.73.36 1.02l.06.06z" stroke="currentColor" strokeWidth="2"/></svg>
            Config
          </NavLink>
        </div>
      )}
    </div>
  );
}

export default Sidebar;
