/**
 * src/routes/ProtectedRoute.jsx - Bảo vệ các route nội bộ
 * 
 * Ba loại route:
 * 1. ProtectedRoute: Chỉ cho người đã đăng nhập
 * 2. ManagerRoute: Chỉ cho Quản lý kho
 * 3. StaffRoute: Chỉ cho Nhân viên kho  
 * 4. PublicRoute: Chỉ cho người CHƯA đăng nhập (trang Login)
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Màn hình loading đơn giản
const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-lumie-cream">
    <div className="text-center">
      <div className="w-8 h-8 border-2 border-lumie-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-sm text-gray-500">Đang kiểm tra phiên đăng nhập...</p>
    </div>
  </div>
);

/**
 * Route chỉ cho người đã đăng nhập
 * Chưa đăng nhập → Chuyển về /login
 */
export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (!isAuthenticated) {
    // Lưu lại URL hiện tại để sau khi login có thể redirect về
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

/**
 * Route chỉ cho Quản lý kho
 * Nhân viên kho → Chuyển về dashboard của nhân viên
 */
export const ManagerRoute = ({ children }) => {
  const { isAuthenticated, isManager, isStaff, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isManager) {
    return <Navigate to={isStaff ? "/staff/dashboard" : "/login"} replace />;
  }

  return children;
};

/**
 * Route chỉ cho Nhân viên kho
 * Quản lý kho → Chuyển về dashboard của quản lý
 */
export const StaffRoute = ({ children }) => {
  const { isAuthenticated, isStaff, isManager, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isStaff) {
    return <Navigate to={isManager ? "/manager/dashboard" : "/login"} replace />;
  }

  return children;
};

/**
 * Route chỉ cho người CHƯA đăng nhập (trang Login)
 * Đã đăng nhập → Chuyển về dashboard tương ứng
 */
export const PublicRoute = ({ children }) => {
  const { isAuthenticated, isManager, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (isAuthenticated) {
    const redirectTo = isManager ? '/manager/dashboard' : '/staff/dashboard';
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};
