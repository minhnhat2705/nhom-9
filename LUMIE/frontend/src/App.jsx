import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import MainLayout from './layouts/MainLayout';

// Pages
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Suppliers from './pages/Suppliers';
import Warehouses from './pages/Warehouses';
import InboundOrders from './pages/InboundOrders';
import OutboundOrders from './pages/OutboundOrders';
import TransferOrders from './pages/TransferOrders';
import InventoryAndStockCard from './pages/InventoryAndStockCard';
import StockThresholds from './pages/StockThresholds';
import Stocktake from './pages/Stocktake';
import SalesHistoryImport from './pages/SalesHistoryImport';
import DemandForecast from './pages/DemandForecast';
import ReorderSuggestions from './pages/ReorderSuggestions';
import PurchaseOrders from './pages/PurchaseOrders';
import AlertsAndNotifications from './pages/AlertsAndNotifications';
import Reports from './pages/Reports';

function PrivatePage({ children, manager = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-gray-500">Đang tải tài khoản...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (manager && user.role !== 'MANAGER') return <Navigate to="/dashboard" replace />;
  return <MainLayout>{children}</MainLayout>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />

      {/* General Operational Routes */}
      <Route path="/dashboard" element={<PrivatePage><Dashboard /></PrivatePage>} />
      <Route path="/change-password" element={<PrivatePage><ChangePassword /></PrivatePage>} />

      {/* Theme 1: Account Management (Manager only) */}
      <Route path="/users" element={<PrivatePage manager><Users /></PrivatePage>} />

      {/* Theme 2: Catalog & Partners */}
      <Route path="/products" element={<PrivatePage><Products /></PrivatePage>} />
      <Route path="/categories" element={<PrivatePage><Categories /></PrivatePage>} />
      <Route path="/suppliers" element={<PrivatePage><Suppliers /></PrivatePage>} />
      <Route path="/warehouses" element={<PrivatePage><Warehouses /></PrivatePage>} />

      {/* Theme 3: Warehouse Operations */}
      <Route path="/inbound-orders" element={<PrivatePage><InboundOrders /></PrivatePage>} />
      <Route path="/import-stock" element={<Navigate to="/inbound-orders" replace />} />
      <Route path="/outbound-orders" element={<PrivatePage><OutboundOrders /></PrivatePage>} />
      <Route path="/export-stock" element={<Navigate to="/outbound-orders" replace />} />
      <Route path="/transfer-orders" element={<PrivatePage><TransferOrders /></PrivatePage>} />
      <Route path="/inventory" element={<PrivatePage><InventoryAndStockCard /></PrivatePage>} />
      <Route path="/stock-thresholds" element={<PrivatePage manager><StockThresholds /></PrivatePage>} />
      <Route path="/stocktake" element={<PrivatePage><Stocktake /></PrivatePage>} />

      {/* Theme 4: AI & Demand Forecasting (Manager only) */}
      <Route path="/sales-history" element={<PrivatePage manager><SalesHistoryImport /></PrivatePage>} />
      <Route path="/demand-forecast" element={<PrivatePage manager><DemandForecast /></PrivatePage>} />
      <Route path="/forecast" element={<Navigate to="/demand-forecast" replace />} />
      <Route path="/reorder-suggestions" element={<PrivatePage manager><ReorderSuggestions /></PrivatePage>} />
      <Route path="/purchase-orders" element={<PrivatePage manager><PurchaseOrders /></PrivatePage>} />

      {/* Theme 5: Alerts & Notifications */}
      <Route path="/alerts" element={<PrivatePage><AlertsAndNotifications /></PrivatePage>} />
      <Route path="/notifications" element={<Navigate to="/alerts" replace />} />

      {/* Theme 6: Reports & Analytics (Manager only) */}
      <Route path="/reports" element={<PrivatePage manager><Reports /></PrivatePage>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <AppRoutes />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
