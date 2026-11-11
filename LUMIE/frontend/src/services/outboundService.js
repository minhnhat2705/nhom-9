/**
 * src/services/outboundService.js - API client cho Xuất Kho & Điều Chuyển Hàng
 * 
 * Phân quyền:
 * - Xem danh sách, chi tiết, meta: Cả 2
 * - Tạo phiếu xuất kho & Tạo phiếu điều chuyển: Chỉ Nhân viên
 * - Duyệt phiếu xuất kho & Duyệt nhận hàng điều chuyển: Chỉ Quản lý
 */

import api from './api';

const outboundService = {
  /**
   * Lấy danh sách kho và các biến thể sản phẩm kèm tồn kho theo từng kho
   */
  getOutboundFormData: async () => {
    const response = await api.get('/outbound/meta/form-data');
    return response.data.data;
  },

  // ============================================================
  // XUẤT KHO
  // ============================================================
  getExports: async (params = {}) => {
    const response = await api.get('/outbound/exports', { params });
    return response.data;
  },

  getExportById: async (id) => {
    const response = await api.get(`/outbound/exports/${id}`);
    return response.data.data;
  },

  /**
   * Tạo phiếu xuất kho mới (CHỈ DÀNH CHO NHÂN VIÊN)
   */
  createExport: async (data) => {
    const response = await api.post('/outbound/exports', data);
    return response.data;
  },

  /**
   * Duyệt phiếu xuất kho (CHỈ DÀNH CHO QUẢN LÝ)
   */
  approveExport: async (id) => {
    const response = await api.post(`/outbound/exports/${id}/approve`);
    return response.data;
  },

  /**
   * Từ chối phiếu xuất kho (CHỈ DÀNH CHO QUẢN LÝ)
   */
  rejectExport: async (id, data = {}) => {
    const response = await api.post(`/outbound/exports/${id}/reject`, data);
    return response.data;
  },

  // ============================================================
  // ĐIỀU CHUYỂN HÀNG GIỮA CÁC KHO
  // ============================================================
  getTransfers: async (params = {}) => {
    const response = await api.get('/outbound/transfers', { params });
    return response.data;
  },

  getTransferById: async (id) => {
    const response = await api.get(`/outbound/transfers/${id}`);
    return response.data.data;
  },

  /**
   * Tạo phiếu điều chuyển hàng (CHỈ DÀNH CHO NHÂN VIÊN)
   */
  createTransfer: async (data) => {
    const response = await api.post('/outbound/transfers', data);
    return response.data;
  },

  /**
   * Duyệt & xác nhận nhận hàng điều chuyển (CHỈ DÀNH CHO QUẢN LÝ)
   */
  approveTransfer: async (id) => {
    const response = await api.post(`/outbound/transfers/${id}/approve`);
    return response.data;
  },

  /**
   * Từ chối phiếu điều chuyển (CHỈ DÀNH CHO QUẢN LÝ)
   */
  rejectTransfer: async (id, data = {}) => {
    const response = await api.post(`/outbound/transfers/${id}/reject`, data);
    return response.data;
  },
};

export default outboundService;
