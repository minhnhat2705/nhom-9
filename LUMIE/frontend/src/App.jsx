import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import ImportStock from './pages/ImportStock';
import ExportStock from './pages/ExportStock';
import TransferOrders from './pages/TransferOrders';
import Alerts from './pages/Alerts';
import StockThresholds from './pages/StockThresholds';

function PrivatePage({ children, manager = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-gray-500">Đang tải tài khoản...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (manager && user.role !== 'MANAGER') return <Navigate to="/dashboard" replace />;
  return <MainLayout>{children}</MainLayout>;
}

function AppRoutes() {
  const { user } = useAuth();
  return <Routes>
    <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
    <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    <Route path="/dashboard" element={<PrivatePage><Dashboard /></PrivatePage>} />
    <Route path="/inventory" element={<PrivatePage><Inventory /></PrivatePage>} />
    <Route path="/inbound-orders" element={<PrivatePage><ImportStock /></PrivatePage>} />
    <Route path="/import-stock" element={<PrivatePage><ImportStock /></PrivatePage>} />
    <Route path="/outbound-orders" element={<PrivatePage><ExportStock /></PrivatePage>} />
    <Route path="/export-stock" element={<PrivatePage><ExportStock /></PrivatePage>} />
    <Route path="/transfer-orders" element={<PrivatePage><TransferOrders /></PrivatePage>} />
    <Route path="/alerts" element={<PrivatePage><Alerts /></PrivatePage>} />
    <Route path="/stock-thresholds" element={<PrivatePage manager><StockThresholds /></PrivatePage>} />
    <Route path="/change-password" element={<PrivatePage><ChangePassword /></PrivatePage>} />
    <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
  </Routes>;
}

export default function App() {
  return <BrowserRouter><AuthProvider><NotificationProvider><AppRoutes /></NotificationProvider></AuthProvider></BrowserRouter>;
}