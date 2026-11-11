/**
 * src/services/userService.js - API calls cho User Management
 */

import api from './api';

const userService = {
  /**
   * Lấy danh sách nhân viên
   */
  getUsers: async ({ page = 1, limit = 10, search = '', status = '' } = {}) => {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);
    if (search) params.append('search', search);
    if (status) params.append('status', status);

    const response = await api.get(`/users?${params.toString()}`);
    return response.data.data;
  },

  /**
   * Lấy chi tiết nhân viên
   */
  getUserById: async (id) => {
    const response = await api.get(`/users/${id}`);
    return response.data.data;
  },

  /**
   * Lấy thống kê số lượng nhân viên (Total, Active, Inactive)
   */
  getUserStats: async () => {
    const response = await api.get('/users/stats');
    return response.data.data;
  },

  /**
   * Tạo nhân viên mới
   */
  createUser: async (userData) => {
    const response = await api.post('/users', userData);
    return response.data;
  },

  /**
   * Cập nhật thông tin nhân viên
   */
  updateUser: async (id, userData) => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  },

  /**
   * Thay đổi trạng thái tài khoản
   */
  updateUserStatus: async (id, status) => {
    const response = await api.patch(`/users/${id}/status`, { status });
    return response.data;
  },

  /**
   * Đặt lại mật khẩu nhân viên
   */
  resetPassword: async (id, newPassword) => {
    const response = await api.post(`/users/${id}/reset-password`, { newPassword });
    return response.data;
  },

  /**
   * Xóa nhân viên
   */
  deleteUser: async (id) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },
};

export default userService;
