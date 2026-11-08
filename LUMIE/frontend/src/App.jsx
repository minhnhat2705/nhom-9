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
import StaffDashboard from './pages/staff/Dashboard';
import ChangePasswordPage from './pages/profile/ChangePassword';

// Component chuyển hướng thông minh theo role
const HomeRedirect = () => {
  const { isAuthenticated, isManager, loading } = useAuth();
  
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={isManager ? '/manager/dashboard' : '/staff/dashboard'} replace />;
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

          {/* ===== ROUTES CHO NHÂN VIÊN KHO ===== */}
          <Route path="/staff/dashboard" element={
            <StaffRoute>
              <StaffDashboard />
            </StaffRoute>
          } />

          {/* ===== ROUTES CHUNG (đã đăng nhập) ===== */}
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
