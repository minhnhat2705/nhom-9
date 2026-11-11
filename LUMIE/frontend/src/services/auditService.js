/**
 * src/services/auditService.js - API client cho Kiểm Kê Tồn Kho
 * 
 * Phân quyền:
 * - getAuditFormData, getWarehouseItems, getAudits, getAuditById: Cả 2
 * - createAudit, approveAuditAdjustment, cancelAudit: Chỉ Quản lý
 * - submitAuditCount: Chỉ Nhân viên
 */

import api from './api';

const auditService = {
  /**
   * Lấy danh sách kho & nhân viên hỗ trợ tạo đợt kiểm kê
   */
  getAuditFormData: async () => {
    const response = await api.get('/audits/meta');
    return response.data.data;
  },

  /**
   * Lấy danh sách mặt hàng & tồn kho hiện tại của kho để chuẩn bị kiểm kê
   */
  getWarehouseItems: async (warehouseId) => {
    const response = await api.get(`/audits/warehouse-items/${warehouseId}`);
    return response.data.data;
  },

  /**
   * Lấy danh sách các đợt kiểm kê (lọc, tìm kiếm, phân trang)
   */
  getAudits: async (params = {}) => {
    const response = await api.get('/audits', { params });
    return response.data;
  },

  /**
   * Lấy chi tiết đợt kiểm kê
   */
  getAuditById: async (id) => {
    const response = await api.get(`/audits/${id}`);
    return response.data.data;
  },

  /**
   * Tạo đợt kiểm kê mới (CHỈ DÀNH CHO QUẢN LÝ)
   */
  createAudit: async (data) => {
    const response = await api.post('/audits', data);
    return response.data;
  },

  /**
   * Nhập kết quả kiểm kê thực tế (CHỈ DÀNH CHO NHÂN VIÊN)
   */
  submitAuditCount: async (id, data) => {
    const response = await api.post(`/audits/${id}/count`, data);
    return response.data;
  },

  /**
   * Duyệt điều chỉnh chênh lệch tồn kho (CHỈ DÀNH CHO QUẢN LÝ)
   */
  approveAuditAdjustment: async (id, data) => {
    const response = await api.post(`/audits/${id}/approve`, data);
    return response.data;
  },

  /**
   * Hủy đợt kiểm kê (CHỈ DÀNH CHO QUẢN LÝ)
   */
  cancelAudit: async (id, data) => {
    const response = await api.post(`/audits/${id}/cancel`, data);
    return response.data;
  },
};

export default auditService;
