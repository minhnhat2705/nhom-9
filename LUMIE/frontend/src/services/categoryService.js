/**
 * src/services/categoryService.js - API client cho Danh mục sản phẩm & Nhà cung cấp
 */

import api from './api';

const categoryService = {
  /**
   * Lấy danh sách danh mục sản phẩm kèm số lượng sản phẩm liên kết
   * @param {Object} params - { search, status }
   */
  getCategories: async (params = {}) => {
    const response = await api.get('/categories', { params });
    return response.data.data;
  },

  /**
   * Xem và tìm kiếm danh sách nhà cung cấp
   * @param {Object} params - { search, status }
   */
  getSuppliers: async (params = {}) => {
    const response = await api.get('/categories/suppliers', { params });
    return response.data.data;
  },

  /**
   * Thêm nhà cung cấp mới (Chỉ Quản lý)
   * @param {Object} data - { supplier_code, supplier_name, brand_name, contact_person, phone, email, address }
   */
  createSupplier: async (data) => {
    const response = await api.post('/categories/suppliers', data);
    return response.data;
  },

  /**
   * Sửa thông tin nhà cung cấp (Chỉ Quản lý)
   * @param {number|string} id
   * @param {Object} data
   */
  updateSupplier: async (id, data) => {
    const response = await api.put(`/categories/suppliers/${id}`, data);
    return response.data;
  },

  /**
   * Xóa nhà cung cấp (Chỉ Quản lý)
   * @param {number|string} id
   */
  deleteSupplier: async (id) => {
    const response = await api.delete(`/categories/suppliers/${id}`);
    return response.data;
  },

  /**
   * Lấy chi tiết một danh mục
   * @param {number|string} id
   */
  getCategoryById: async (id) => {
    const response = await api.get(`/categories/${id}`);
    return response.data.data;
  },

  /**
   * CHỨC NĂNG 1: Thêm danh mục sản phẩm (Chỉ Quản lý)
   * @param {Object} data - { category_code, category_name, rack_zone, description }
   */
  createCategory: async (data) => {
    const response = await api.post('/categories', data);
    return response.data;
  },

  /**
   * CHỨC NĂNG 2: Sửa danh mục sản phẩm (Chỉ Quản lý)
   * @param {number|string} id
   * @param {Object} data - { category_name, rack_zone, description, status }
   */
  updateCategory: async (id, data) => {
    const response = await api.put(`/categories/${id}`, data);
    return response.data;
  },

  /**
   * CHỨC NĂNG 3: Xóa danh mục sản phẩm (Chỉ Quản lý)
   * @param {number|string} id
   */
  deleteCategory: async (id) => {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  },
};

export default categoryService;
