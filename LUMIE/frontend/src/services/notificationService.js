/**
 * src/services/notificationService.js
 * API Client cho phân hệ Cảnh báo & Thông báo (Theme 5: US-41 -> US-46)
 */

import api from './api';

const notificationService = {
  /**
   * US-45: Đếm số thông báo chưa đọc hiển thị ở Chuông Topbar
   */
  getUnreadCount: async () => {
    const response = await api.get('/notifications/unread-count');
    return response.data.data;
  },

  /**
   * US-45: Lấy danh sách cảnh báo & thông báo
   */
  getNotifications: async (params = {}) => {
    const response = await api.get('/notifications', { params });
    return response.data;
  },

  /**
   * Quét và làm mới cảnh báo
   */
  scanAlerts: async (data = {}) => {
    const response = await api.post('/notifications/scan', data);
    return response.data;
  },

  /**
   * US-46: Đánh dấu 1 thông báo đã đọc
   */
  markAsRead: async (id) => {
    const response = await api.patch(`/notifications/${id}/read`);
    return response.data;
  },

  /**
   * US-46: Đánh dấu tất cả thông báo là đã đọc
   */
  markAllAsRead: async () => {
    const response = await api.post('/notifications/read-all');
    return response.data;
  },

  /**
   * US-46: Đánh dấu cảnh báo đã được xử lý (RESOLVED)
   */
  resolveAlert: async (id) => {
    const response = await api.patch(`/notifications/${id}/resolve`);
    return response.data;
  },

  /**
   * US-46: Xóa / Ẩn thông báo cá nhân của user
   */
  dismissNotification: async (id) => {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  },
};

export default notificationService;
