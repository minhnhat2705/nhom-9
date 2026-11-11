/**
 * src/services/inventoryService.js - API client cho Theo dõi tồn kho & Ngưỡng tồn
 * 
 * Phân quyền:
 * - getInventoryTracking: Cả Quản lý và Nhân viên
 * - updateThreshold: Chỉ Quản lý (Chặn phía nhân viên)
 * - batchUpdateThreshold: Chỉ Quản lý
 */

import api from './api';

const inventoryService = {
  /**
   * Lấy danh sách tồn kho theo kho hoặc toàn hệ thống
   * @param {Object} params { warehouse_id, search, category_id, stock_status, sort, page, limit }
   */
  getInventoryTracking: async (params = {}) => {
    const response = await api.get('/inventory', { params });
    return response.data;
  },

  /**
   * Thiết lập ngưỡng tồn tối thiểu cho 1 biến thể (CHỈ DÀNH CHO QUẢN LÝ)
   * @param {number} variantId 
   * @param {number} minStock 
   */
  updateThreshold: async (variantId, minStock) => {
    const response = await api.patch(`/inventory/threshold/${variantId}`, {
      min_stock: minStock,
    });
    return response.data;
  },

  /**
   * Thiết lập ngưỡng tồn tối thiểu hàng loạt (CHỈ DÀNH CHO QUẢN LÝ)
   * @param {Array<number>} variantIds 
   * @param {number} minStock 
   */
  batchUpdateThreshold: async (variantIds, minStock) => {
    const response = await api.post('/inventory/threshold/batch', {
      variant_ids: variantIds,
      min_stock: minStock,
    });
    return response.data;
  },
};

export default inventoryService;
