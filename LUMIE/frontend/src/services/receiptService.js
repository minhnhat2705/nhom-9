/**
 * src/services/receiptService.js - API client cho Chức năng Nhập kho
 * 
 * Phân quyền:
 * - getReceipts / getReceiptById / getReceiptFormData: Cả 2
 * - createReceipt: Chỉ Nhân viên
 * - approveReceipt / rejectReceipt: Chỉ Quản lý
 */

import api from './api';

const receiptService = {
  /**
   * Xem và tìm kiếm lịch sử phiếu nhập kho
   * @param {Object} params - { page, limit, search, status, warehouse_id, supplier_id }
   */
  getReceipts: async (params = {}) => {
    const response = await api.get('/inbound/receipts', { params });
    return response.data;
  },

  /**
   * Xem chi tiết phiếu nhập kho
   * @param {number|string} id
   */
  getReceiptById: async (id) => {
    const response = await api.get(`/inbound/receipts/${id}`);
    return response.data.data;
  },

  /**
   * Lấy danh sách kho, NCC và sản phẩm/SKU để tạo phiếu
   */
  getReceiptFormData: async () => {
    const response = await api.get('/inbound/receipts/meta/form-data');
    return response.data.data;
  },

  /**
   * Tạo phiếu nhập kho mới (CHỈ DÀNH CHO NHÂN VIÊN)
   * @param {Object} data - { warehouse_id, supplier_id, notes, items: [{ variant_id, quantity, unit_price, shelf_location, notes }] }
   */
  createReceipt: async (data) => {
    const response = await api.post('/inbound/receipts', data);
    return response.data;
  },

  /**
   * Duyệt phiếu nhập kho (CHỈ DÀNH CHO QUẢN LÝ)
   * @param {number|string} id
   */
  approveReceipt: async (id) => {
    const response = await api.post(`/inbound/receipts/${id}/approve`);
    return response.data;
  },

  /**
   * Từ chối phiếu nhập kho (CHỈ DÀNH CHO QUẢN LÝ)
   * @param {number|string} id
   * @param {Object} data - { rejection_reason }
   */
  rejectReceipt: async (id, data = {}) => {
    const response = await api.post(`/inbound/receipts/${id}/reject`, data);
    return response.data;
  },
};

export default receiptService;
