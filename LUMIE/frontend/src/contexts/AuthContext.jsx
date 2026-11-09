/**
 * src/contexts/AuthContext.jsx - React Context cho Authentication
 * 
 * Quản lý trạng thái đăng nhập toàn cục:
 * - Thông tin người dùng hiện tại
 * - Trạng thái loading khi kiểm tra session
 * - Các hàm login, logout
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

// Tạo Context
const AuthContext = createContext(null);

/**
 * Provider bọc toàn bộ app
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Loading khi kiểm tra session ban đầu

  /**
   * Kiểm tra session khi app khởi động
   * Thử làm mới access token từ refresh token (cookie)
   */
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Thử làm mới token (nếu có cookie refresh token hợp lệ)
        await authService.refreshToken();
        
        // Lấy thông tin user
        const userData = await authService.getMe();
        setUser(userData);
      } catch {
        // Không có session hợp lệ - người dùng chưa đăng nhập
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  /**
   * Đăng nhập
   */
  const login = useCallback(async (email, password) => {
    const { user: userData } = await authService.login(email, password);
    setUser(userData);
    return userData;
  }, []);

  /**
   * Đăng xuất
   */
  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  /**
   * Cập nhật thông tin user (sau khi đổi mật khẩu, v.v.)
   */
  const updateUser = useCallback((updatedData) => {
    setUser(prev => ({ ...prev, ...updatedData }));
  }, []);

  const userRole = typeof user?.role === 'string' ? user.role : user?.role?.role_name;

  const value = {
    user,
    loading,
    login,
    logout,
    updateUser,
    isAuthenticated: !!user,
    isManager: userRole === 'WAREHOUSE_MANAGER',
    isStaff: userRole === 'WAREHOUSE_STAFF',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook để sử dụng AuthContext
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider');
  }
  return context;
};

export default AuthContext;
