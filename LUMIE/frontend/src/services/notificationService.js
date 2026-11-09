import api from './api';

export const notificationService = {
  getNotifications: (page = 1, limit = 20) =>
    api.get('/notifications', { params: { page, limit } }),

  getUnreadCount: async () => {
    const res = await api.get('/notifications/unread-count');
    return res.data?.count || 0;
  },

  markAsRead: (id) => api.post(`/notifications/${id}/read`),

  markAllAsRead: () => api.post('/notifications/read-all'),

  markAsResolved: (id) => api.post(`/notifications/${id}/resolve`),

  deleteNotification: (id) => api.delete(`/notifications/${id}`),
};
