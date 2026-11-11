/**
 * src/App.jsx - Cấu hình Router chính
 * 
 * Định nghĩa toàn bộ routes của ứng dụng:
 * - / → Redirect dựa vào role
 * - /login → Trang đăng nhập
 * - /manager/* → Trang quản lý (chỉ Quản lý kho)
 * - /staff/* → Trang nhân viên (chỉ Nhân viên kho)
 * - /profile/* → Trang cá nhân (đã đăng nhập)
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PublicRoute, ManagerRoute, StaffRoute, ProtectedRoute } from './routes/ProtectedRoute';

// Pages
import LoginPage from './pages/auth/Login';
import ManagerDashboard from './pages/manager/Dashboard';
import EmployeesPage from './pages/manager/Employees';
import ManagerProductsPage from './pages/manager/Products';
import CategoriesPage from './pages/manager/Categories';
import WarehousesPage from './pages/manager/Warehouses';
import StaffDashboard from './pages/staff/Dashboard';
import ProductsPage from './pages/staff/Products';
import ChangePasswordPage from './pages/profile/ChangePassword';
import ReceiptsPage from './pages/inbound/Receipts';
import OutboundPage from './pages/outbound/Outbound';
import InventoryTrackingPage from './pages/inventory/InventoryTracking';
import StockAuditPage from './pages/audit/StockAudit';

// Component chuyển hướng thông minh theo role
const HomeRedirect = () => {
  const { isAuthenticated, isManager, isStaff, loading } = useAuth();
  
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isManager) return <Navigate to="/manager/dashboard" replace />;
  if (isStaff) return <Navigate to="/staff/dashboard" replace />;
  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Trang chủ - redirect thông minh */}
          <Route path="/" element={<HomeRedirect />} />

          {/* Trang đăng nhập - chỉ cho người chưa đăng nhập */}
          <Route path="/login" element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } />

          {/* ===== ROUTES CHO QUẢN LÝ KHO ===== */}
          <Route path="/manager/dashboard" element={
            <ManagerRoute>
              <ManagerDashboard />
            </ManagerRoute>
          } />
          <Route path="/manager/employees" element={
            <ManagerRoute>
              <EmployeesPage />
            </ManagerRoute>
          } />
          <Route path="/manager/products" element={
            <ManagerRoute>
              <ManagerProductsPage />
            </ManagerRoute>
          } />
          <Route path="/manager/categories" element={
            <ManagerRoute>
              <CategoriesPage />
            </ManagerRoute>
          } />
          <Route path="/manager/warehouses" element={
            <ManagerRoute>
              <WarehousesPage />
            </ManagerRoute>
          } />

          {/* ===== ROUTES CHO NHÂN VIÊN KHO ===== */}
          <Route path="/staff/dashboard" element={
            <StaffRoute>
              <StaffDashboard />
            </StaffRoute>
          } />
          <Route path="/staff/products" element={
            <StaffRoute>
              <ProductsPage />
            </StaffRoute>
          } />

          {/* ===== ROUTES CHUNG (đã đăng nhập) ===== */}
          <Route path="/inbound/receipts" element={
            <ProtectedRoute>
              <ReceiptsPage />
            </ProtectedRoute>
          } />
          <Route path="/manager/receipts" element={<Navigate to="/inbound/receipts" replace />} />
          <Route path="/staff/receipts" element={<Navigate to="/inbound/receipts" replace />} />

          <Route path="/outbound" element={
            <ProtectedRoute>
              <OutboundPage />
            </ProtectedRoute>
          } />
          <Route path="/manager/outbound" element={<Navigate to="/outbound" replace />} />
          <Route path="/staff/outbound" element={<Navigate to="/outbound" replace />} />

          <Route path="/inventory" element={
            <ProtectedRoute>
              <InventoryTrackingPage />
            </ProtectedRoute>
          } />
          <Route path="/manager/inventory" element={<Navigate to="/inventory" replace />} />
          <Route path="/staff/inventory" element={<Navigate to="/inventory" replace />} />

          <Route path="/audits" element={
            <ProtectedRoute>
              <StockAuditPage />
            </ProtectedRoute>
          } />
          <Route path="/manager/audits" element={<Navigate to="/audits" replace />} />
          <Route path="/staff/audits" element={<Navigate to="/audits" replace />} />

          <Route path="/profile/change-password" element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          } />

          {/* 404 - Route không tồn tại */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
