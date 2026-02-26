import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import LoginPage from './pages/LoginPage';
import PosPage from './pages/PosPage';
import ProductsPage from './pages/ProductsPage';
import InventoryPage from './pages/InventoryPage';
import ReportsPage from './pages/ReportsPage';
import NotFoundPage from './pages/NotFoundPage';
import ProtectedRoute from './components/ProtectedRoute';
import useAutoSync from './offline/useAutoSync';
import { createSale } from './api/sales';
import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as productsApi from './api/products';
import * as suppliersApi from './api/suppliers';
import * as customersApi from './api/customers';
import * as branchesApi from './api/branches';
import { setProducts } from './store/productsSlice';
import { setSuppliers } from './store/suppliersSlice';
import { setCustomers } from './store/customersSlice';
import { setBranches } from './store/branchesSlice';
import * as refundsApi from './api/refunds';
import * as salesApi from './api/sales';
import { setRequests } from './store/refundsSlice';
import { setSales } from './store/salesSlice';
import CustomersPage from './pages/CustomersPage';
import RefundsPage from './pages/RefundsPage';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import ConfigSettingsPage from './pages/ConfigSettingsPage';
import UsersPage from './pages/UsersPage';
import PurchasesPage from './pages/PurchasesPage';
import TransfersPage from './pages/TransfersPage';
import AdjustmentsPage from './pages/AdjustmentsPage';
import SuppliersPage from './pages/SuppliersPage';
import SalesPage from './pages/SalesPage';
import CashDrawerPage from './pages/CashDrawerPage';
import RefundApprovalsPage from './pages/RefundApprovalsPage';
import ToastProvider from './components/ToastProvider';
import LabelsPage from './pages/LabelsPage';
import AuditLogPage from './pages/AuditLogPage';
import ReceiptPublicPage from './pages/ReceiptPublicPage';
import AdminManualPage from './pages/AdminManualPage';
import StockRecordsPage from './pages/StockRecordsPage';
import ServerLogsPage from './pages/ServerLogsPage';
import ExpensesPage from './pages/ExpensesPage';
import * as authApi from './api/auth';
import { loginSuccess, setGrants, setInitialized, logout } from './store/authSlice';
import * as settingsApi from './api/settings';
import { setAllSettings } from './store/settingsSlice';
import * as usersApi from './api/users';
import { setUsers } from './store/usersSlice';
import * as auditsApi from './api/audits';
import { setEntries as setAuditEntries } from './store/auditSlice';

function App() {
  const dispatch = useDispatch();
  const refreshSec = useSelector(s => s.settings.refreshIntervalSec || 60);
  const isAuthed = useSelector(s => s.auth.isAuthenticated);
  const settings = useSelector(s => s.settings);
  const userName = useSelector(s => s.auth.user?.name || '');
  const isAuthedNow = useSelector(s => s.auth.isAuthenticated);
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('ptSales:authToken');
        if (token) {
          const resp = await authApi.me();
          if (resp && resp.role) {
            dispatch(loginSuccess({ user: resp.user, role: resp.role, grants: resp.grants || [] }));
          }
        }
      } catch {
        try { localStorage.removeItem('ptSales:authToken'); } catch {}
      } finally {
        dispatch(setInitialized(true));
      }
    })();
  }, [dispatch]);
  useEffect(() => {
    (async () => {
      try {
        const remote = await settingsApi.get();
        if (remote && Object.keys(remote).length > 0) {
          dispatch(setAllSettings(remote));
        } else {
          // push defaults
          await settingsApi.save(settings);
        }
      } catch (e) {
        console.error('Settings init error:', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);
  useEffect(() => {
    (async () => {
      if (!isAuthed) return;
      try {
        const migFlag = localStorage.getItem('ptSales:migratedDbV1');
        if (migFlag) return;
        let snapshot = null;
        try {
          const raw = localStorage.getItem('ptSales:state');
          if (raw) snapshot = JSON.parse(raw);
        } catch {}
        const [srvBranches, srvProducts, srvSuppliers, srvCustomers] = await Promise.all([
          branchesApi.list().catch(() => []),
          productsApi.list().catch(() => []),
          suppliersApi.list().catch(() => []),
          customersApi.list().catch(() => [])
        ]);
        if (snapshot) {
          if (Array.isArray(srvBranches) && srvBranches.length === 0) {
            const list = snapshot.branches?.branches || [];
            if (Array.isArray(list) && list.length > 0) {
              for (const b of list) {
                try { await branchesApi.create({ id: b.id, name: b.name, code: b.code }); } catch {}
              }
            } else {
              try { await branchesApi.create({ id: 'main', name: 'Main Branch', code: 'MAIN' }); } catch {}
            }
          }
          if (Array.isArray(srvProducts) && srvProducts.length === 0) {
            const list = snapshot.products?.products || [];
            for (const p of list) {
              const { id, name, sku, price, category, barcode, lowStock, unitKind, unitValue, unitSymbol, sizeLabel, shoeSize, attributes, packs, variants, stockByBranch, image } = p;
              try { await productsApi.create({ id, name, sku, price, category, barcode, lowStock, unitKind, unitValue, unitSymbol, sizeLabel, shoeSize, attributes, packs, variants, stockByBranch, image }); } catch {}
            }
          }
          if (Array.isArray(srvSuppliers) && srvSuppliers.length === 0) {
            const list = snapshot.suppliers?.suppliers || [];
            for (const s of list) {
              const { id, name, contact, phone, email } = s;
              try { await suppliersApi.create({ id, name, contact, phone, email }); } catch {}
            }
          }
          if (Array.isArray(srvCustomers) && srvCustomers.length === 0) {
            const list = snapshot.customers?.customers || [];
            for (const c of list) {
              const { id, name, phone, email } = c;
              try { await customersApi.create({ id, name, phone, email }); } catch {}
            }
          }
        }
        try { localStorage.removeItem('ptSales:state'); } catch {}
        localStorage.setItem('ptSales:migratedDbV1', '1');
      } catch {}
    })();
  }, [isAuthed]);
  const syncHandler = useCallback(async (item) => {
    if (item.type === 'sale') {
      await createSale(item.payload);
    }
  }, []);
  useAutoSync(syncHandler);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!isAuthed) return;
      try {
        const [p, s, c, b, r, sl, u, au] = await Promise.allSettled([
          productsApi.list(),
          suppliersApi.list(),
          customersApi.list(),
          branchesApi.list(),
          refundsApi.listRequests(),
          salesApi.list(),
          usersApi.list(),
          auditsApi.list()
        ]);
        if (alive && p.status === 'fulfilled' && Array.isArray(p.value)) dispatch(setProducts(p.value));
        if (alive && s.status === 'fulfilled' && Array.isArray(s.value)) dispatch(setSuppliers(s.value));
        if (alive && c.status === 'fulfilled' && Array.isArray(c.value)) dispatch(setCustomers(c.value));
        if (alive && b.status === 'fulfilled' && Array.isArray(b.value) && b.value.length > 0) dispatch(setBranches(b.value));
        if (alive && r.status === 'fulfilled' && Array.isArray(r.value)) dispatch(setRequests(r.value));
        if (alive && sl.status === 'fulfilled' && Array.isArray(sl.value)) dispatch(setSales(sl.value));
        if (alive && u.status === 'fulfilled' && Array.isArray(u.value)) dispatch(setUsers(u.value));
        if (alive && au.status === 'fulfilled' && Array.isArray(au.value) && au.value.length > 0) dispatch(setAuditEntries(au.value));
      } catch {}
    })();
    return () => { alive = false; };
  }, [dispatch, isAuthed]);
  useEffect(() => {
    if (!isAuthed) return;
    const g = (settings && settings.userGrants && userName) ? (settings.userGrants[userName] || []) : [];
    dispatch(setGrants(Array.isArray(g) ? g : []));
  }, [isAuthed, settings?.userGrants, userName, dispatch]);
  useEffect(() => {
    let alive = true;
    const idleMs = 180000;
    let lastActive = Date.now();
    function bump() { lastActive = Date.now(); }
    function onVis() { if (!document.hidden) lastActive = Date.now(); }
    if (isAuthedNow) {
      window.addEventListener('mousemove', bump, { passive: true });
      window.addEventListener('mousedown', bump, { passive: true });
      window.addEventListener('keydown', bump, { passive: true });
      window.addEventListener('touchstart', bump, { passive: true });
      window.addEventListener('scroll', bump, { passive: true });
      document.addEventListener('visibilitychange', onVis, { passive: true });
    }
    const interval = setInterval(async () => {
      if (!navigator.onLine || !alive || !isAuthed) return;
      if (Date.now() - lastActive >= idleMs) {
        try { localStorage.removeItem('ptSales:authToken'); } catch {}
        dispatch(logout());
        return;
      }
      try {
        const [p, s, c, b, r, sl, u, au] = await Promise.allSettled([
          productsApi.list(),
          suppliersApi.list(),
          customersApi.list(),
          branchesApi.list(),
          refundsApi.listRequests(),
          salesApi.list(),
          usersApi.list(),
          auditsApi.list()
        ]);
        if (alive && p.status === 'fulfilled' && Array.isArray(p.value)) dispatch(setProducts(p.value));
        if (alive && s.status === 'fulfilled' && Array.isArray(s.value)) dispatch(setSuppliers(s.value));
        if (alive && c.status === 'fulfilled' && Array.isArray(c.value)) dispatch(setCustomers(c.value));
        if (alive && b.status === 'fulfilled' && Array.isArray(b.value) && b.value.length > 0) dispatch(setBranches(b.value));
        if (alive && r.status === 'fulfilled' && Array.isArray(r.value)) dispatch(setRequests(r.value));
        if (alive && sl.status === 'fulfilled' && Array.isArray(sl.value)) dispatch(setSales(sl.value));
        if (alive && u.status === 'fulfilled' && Array.isArray(u.value)) dispatch(setUsers(u.value));
        if (alive && au.status === 'fulfilled' && Array.isArray(au.value) && au.value.length > 0) dispatch(setAuditEntries(au.value));
      } catch {}
    }, Math.max(10000, Number(refreshSec) * 1000));
    return () => {
      alive = false;
      clearInterval(interval);
      window.removeEventListener('mousemove', bump);
      window.removeEventListener('mousedown', bump);
      window.removeEventListener('keydown', bump);
      window.removeEventListener('touchstart', bump);
      window.removeEventListener('scroll', bump);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [dispatch, refreshSec, isAuthed, isAuthedNow]);
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/r/:id" element={<ReceiptPublicPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Navigate to="/pos" replace />} />
            <Route path="/dashboard" element={<ProtectedRoute roles={['Admin','Manager']} grant={['view_dashboard','see_dashboard']}><DashboardPage /></ProtectedRoute>} />
            <Route path="/pos" element={<ProtectedRoute roles={['Admin','Manager','Cashier']} grant={['view_pos','see_pos']}><PosPage /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute roles={['Admin','Manager','Cashier']} grant={['view_sales','see_sales']}><SalesPage /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute roles={['Admin','Manager','Inventory Staff']} grant={['view_products','see_products']}><ProductsPage /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute roles={['Admin','Manager','Inventory Staff']} grant={['view_inventory','see_inventory']}><InventoryPage /></ProtectedRoute>} />
            <Route path="/purchases" element={<ProtectedRoute roles={['Admin','Manager','Inventory Staff']} grant={['view_purchases','see_purchases']}><PurchasesPage /></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute roles={['Admin','Manager']} grant={['view_expenses','see_expenses','add_expenses']}><ExpensesPage /></ProtectedRoute>} />
            <Route path="/transfers" element={<ProtectedRoute roles={['Admin','Manager','Inventory Staff']} grant={['view_transfers','see_transfers']}><TransfersPage /></ProtectedRoute>} />
            <Route path="/adjustments" element={<ProtectedRoute roles={['Admin','Manager','Inventory Staff']} grant={['view_adjustments','see_adjustments']}><AdjustmentsPage /></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute roles={['Admin','Manager','Inventory Staff']} grant={['view_suppliers','see_suppliers']}><SuppliersPage /></ProtectedRoute>} />
            <Route path="/labels" element={<ProtectedRoute roles={['Admin','Manager','Inventory Staff']} grant={['view_labels','see_labels']}><LabelsPage /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute roles={['Admin','Manager','Auditor']} grant={['view_reports','see_reports']}><ReportsPage /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute roles={['Admin','Manager','Cashier']} grant={['view_customers','see_customers']}><CustomersPage /></ProtectedRoute>} />
            <Route path="/refunds" element={<ProtectedRoute roles={['Admin','Manager','Cashier']} grant={['view_refunds','see_refunds']}><RefundsPage /></ProtectedRoute>} />
            <Route path="/refund-approvals" element={<ProtectedRoute roles={['Admin','Manager','SuperAdmin']} grant="approve_refunds"><RefundApprovalsPage /></ProtectedRoute>} />
            <Route path="/stock-records" element={<ProtectedRoute roles={['Admin','SuperAdmin']} grant={['view_stock_records','see_stock_records']}><StockRecordsPage /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute roles={['Admin','SuperAdmin']} grant={['view_users','see_users']}><UsersPage /></ProtectedRoute>} />
            <Route path="/cashdrawer" element={<ProtectedRoute roles={['Admin','Manager','Cashier']} grant={['view_cashdrawer','see_cashdrawer']}><CashDrawerPage /></ProtectedRoute>} />
            <Route path="/config" element={<ProtectedRoute roles={['Admin','Manager']} grant={['view_config','see_config']}><ConfigSettingsPage /></ProtectedRoute>} />
            <Route path="/audit" element={<ProtectedRoute roles={['Admin','SuperAdmin']} grant={['view_audit','see_audit']}><AuditLogPage /></ProtectedRoute>} />
            <Route path="/manual" element={<ProtectedRoute roles={['Admin','SuperAdmin']}><AdminManualPage /></ProtectedRoute>} />
            <Route path="/server-logs" element={<ProtectedRoute roles={['SuperAdmin']}><ServerLogsPage /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
