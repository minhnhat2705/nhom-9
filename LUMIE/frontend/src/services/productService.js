/**
 * src/services/productService.js - API client cho sản phẩm & tồn kho
 */

import api from './api';

const productService = {
  /**
   * Lấy danh sách sản phẩm có tìm kiếm, lọc và phân trang
   * @param {Object} params - { search, category_id, supplier_id, gender, stock_status, rack_zone, warehouse_id, status, page, limit, sort }
   */
  getProducts: async (params = {}) => {
    const response = await api.get('/products', { params });
    return response.data.data;
  },

  /**
   * Lấy metadata cho bộ lọc (danh mục, nhà cung cấp, kho, kệ)
   */
  getFiltersMeta: async () => {
    const response = await api.get('/products/meta/filters');
    return response.data.data;
  },

  /**
   * Lấy chi tiết sản phẩm theo ID hoặc mã SP
   */
  getProductById: async (id) => {
    const response = await api.get(`/products/${id}`);
    return response.data.data;
  },

  /**
   * CHỨC NĂNG QUẢN LÝ 1: Thêm sản phẩm kèm biến thể size, màu và SKU
   * @param {Object} productData
   */
  createProduct: async (productData) => {
    const response = await api.post('/products', productData);
    return response.data;
  },

  /**
   * CHỨC NĂNG QUẢN LÝ 2: Sửa thông tin sản phẩm và biến thể
   * @param {number|string} id
   * @param {Object} productData
   */
  updateProduct: async (id, productData) => {
    const response = await api.put(`/products/${id}`, productData);
    return response.data;
  },

  /**
   * CHỨC NĂNG QUẢN LÝ 3: Xóa sản phẩm (ngừng kinh doanh)
   * @param {number|string} id
   */
  deleteProduct: async (id) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  },

  /**
   * Kích hoạt kinh doanh trở lại cho sản phẩm ngừng kinh doanh
   * @param {number|string} id
   */
  reactivateProduct: async (id) => {
    const response = await api.patch(`/products/${id}/reactivate`);
    return response.data;
  },
};

export default productService;
