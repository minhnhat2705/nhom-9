/**
 * src/services/authService.js - API calls liên quan đến Authentication
 */

import axios from 'axios';
import api, { setAccessToken, clearAccessToken } from './api';

const authService = {
  /**
   * Đăng nhập
   */
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { accessToken, user } = response.data.data;
    
    // Lưu access token vào memory
    setAccessToken(accessToken);
    
    return { accessToken, user };
  },

  /**
   * Đăng xuất
   */
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Dù API có lỗi vẫn tiếp tục đăng xuất phía client
    } finally {
      clearAccessToken();
    }
  },

  /**
   * Làm mới access token (gọi khi app khởi động để kiểm tra session)
   */
  refreshToken: async () => {
    const response = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
    const { accessToken } = response.data.data;
    setAccessToken(accessToken);
    return accessToken;
  },

  /**
   * Đổi mật khẩu
   */
  changePassword: async (currentPassword, newPassword, confirmPassword) => {
    const response = await api.post('/auth/change-password', {
      currentPassword,
      newPassword,
      confirmPassword,
    });
    return response.data;
  },

  /**
   * Lấy thông tin tài khoản hiện tại
   */
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data.data;
  },
};

export default authService;
