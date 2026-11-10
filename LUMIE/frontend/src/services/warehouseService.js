/**
 * src/services/warehouseService.js - API calls cho Quản lý kho và chi nhánh
 */

import api from './api';

const warehouseService = {
  // Lấy danh sách kho và chi nhánh (hỗ trợ search, status, all)
  getWarehouses: async (params = {}) => {
    const response = await api.get('/warehouses', { params });
    return response.data.data;
  },

  // Lấy chi tiết một kho/chi nhánh
  getWarehouseById: async (id) => {
    const response = await api.get(`/warehouses/${id}`);
    return response.data.data;
  },

  // CHỨC NĂNG 1: Thêm kho/chi nhánh mới (chỉ Quản lý)
  createWarehouse: async (data) => {
    const response = await api.post('/warehouses', data);
    return response.data;
  },

  // CHỨC NĂNG 2: Sửa thông tin kho/chi nhánh (chỉ Quản lý)
  updateWarehouse: async (id, data) => {
    const response = await api.put(`/warehouses/${id}`, data);
    return response.data;
  },

  // CHỨC NĂNG 3: Xóa kho/chi nhánh (ngưng hoạt động) (chỉ Quản lý)
  deleteWarehouse: async (id, params = {}) => {
    const response = await api.delete(`/warehouses/${id}`, { params });
    return response.data;
  },

  // Kích hoạt lại kho/chi nhánh hoạt động bình thường
  reactivateWarehouse: async (id) => {
    const response = await api.delete(`/warehouses/${id}`, { params: { action: 'reactivate' } });
    return response.data;
  },
};

export default warehouseService;
