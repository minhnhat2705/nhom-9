/**
 * src/services/replenishmentService.js
 * API Client cho phân hệ Đề xuất nhập hàng thông minh bằng AI (Epic 4.2: US-37, US-38, US-39, US-40)
 */

import api from './api';

const replenishmentService = {
  /**
   * Lấy metadata kho, nhà cung cấp, period key
   */
  getMeta: async () => {
    const response = await api.get('/replenishment/meta');
    return response.data.data;
  },

  /**
   * US-37: Quét và sinh đề xuất nhập hàng tự động bằng AI
   */
  generateSuggestions: async (warehouse_id = 'ALL', force = false) => {
    const response = await api.post('/replenishment/suggestions/generate', {
      warehouse_id,
      force,
    });
    return response.data;
  },

  /**
   * US-37: Lấy danh sách đề xuất nhập hàng
   */
  getSuggestions: async (params = {}) => {
    const response = await api.get('/replenishment/suggestions', { params });
    return response.data;
  },

  /**
   * US-38: Điều chỉnh số lượng hoặc nhà cung cấp đề xuất
   */
  updateSuggestion: async (id, data) => {
    const response = await api.put(`/replenishment/suggestions/${id}`, data);
    return response.data;
  },

  /**
   * US-39: Duyệt danh sách đề xuất (hỗ trợ hàng loạt)
   */
  approveSuggestions: async (ids) => {
    const response = await api.post('/replenishment/suggestions/approve', { ids });
    return response.data;
  },

  /**
   * US-39: Từ chối danh sách đề xuất kèm lý do
   */
  rejectSuggestions: async (ids, rejection_reason) => {
    const response = await api.post('/replenishment/suggestions/reject', {
      ids,
      rejection_reason,
    });
    return response.data;
  },

  /**
   * US-40: Tạo Đơn đặt hàng (PO) từ danh sách đề xuất APPROVED
   */
  createPurchaseOrders: async (suggestion_ids, notes = '') => {
    const response = await api.post('/replenishment/purchase-orders/create-from-suggestions', {
      suggestion_ids,
      notes,
    });
    return response.data;
  },

  /**
   * US-40: Lấy danh sách Đơn đặt hàng nhà cung cấp (PO)
   */
  getPurchaseOrders: async (params = {}) => {
    const response = await api.get('/replenishment/purchase-orders', { params });
    return response.data;
  },

  /**
   * US-40: Lấy chi tiết một Đơn đặt hàng (PO)
   */
  getPurchaseOrderById: async (id) => {
    const response = await api.get(`/replenishment/purchase-orders/${id}`);
    return response.data.data;
  },

  /**
   * US-40: Cập nhật trạng thái Đơn đặt hàng (PO)
   */
  updatePurchaseOrderStatus: async (id, status, notes = '') => {
    const response = await api.put(`/replenishment/purchase-orders/${id}/status`, {
      status,
      notes,
    });
    return response.data;
  },
};

export default replenishmentService;
