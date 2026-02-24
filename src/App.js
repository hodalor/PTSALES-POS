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
import { useCallback } from 'react';
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
import ToastProvider from './components/ToastProvider';
import LabelsPage from './pages/LabelsPage';
import AuditLogPage from './pages/AuditLogPage';

function App() {
  const syncHandler = useCallback(async (item) => {
    if (item.type === 'sale') {
      await createSale(item.payload);
    }
  }, []);
  useAutoSync(syncHandler);
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Navigate to="/pos" replace />} />
            <Route path="/dashboard" element={<ProtectedRoute roles={['Admin','Manager']}><DashboardPage /></ProtectedRoute>} />
            <Route path="/pos" element={<ProtectedRoute roles={['Admin','Manager','Cashier']}><PosPage /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute roles={['Admin','Manager','Cashier']}><SalesPage /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute roles={['Admin','Manager','Inventory Staff']}><ProductsPage /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute roles={['Admin','Manager','Inventory Staff']}><InventoryPage /></ProtectedRoute>} />
            <Route path="/purchases" element={<ProtectedRoute roles={['Admin','Manager','Inventory Staff']}><PurchasesPage /></ProtectedRoute>} />
            <Route path="/transfers" element={<ProtectedRoute roles={['Admin','Manager','Inventory Staff']}><TransfersPage /></ProtectedRoute>} />
            <Route path="/adjustments" element={<ProtectedRoute roles={['Admin','Manager','Inventory Staff']}><AdjustmentsPage /></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute roles={['Admin','Manager','Inventory Staff']}><SuppliersPage /></ProtectedRoute>} />
            <Route path="/labels" element={<ProtectedRoute roles={['Admin','Manager','Inventory Staff']}><LabelsPage /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute roles={['Admin','Manager','Auditor']}><ReportsPage /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute roles={['Admin','Manager','Cashier']}><CustomersPage /></ProtectedRoute>} />
            <Route path="/refunds" element={<ProtectedRoute roles={['Admin','Manager','Cashier']}><RefundsPage /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute roles={['Admin','Manager']}><UsersPage /></ProtectedRoute>} />
            <Route path="/cashdrawer" element={<ProtectedRoute roles={['Admin','Manager','Cashier']}><CashDrawerPage /></ProtectedRoute>} />
            <Route path="/config" element={<ProtectedRoute roles={['Admin','Manager']}><ConfigSettingsPage /></ProtectedRoute>} />
            <Route path="/audit" element={<ProtectedRoute roles={['Admin','SuperAdmin']}><AuditLogPage /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
