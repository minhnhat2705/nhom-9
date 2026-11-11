/**
 * src/services/forecastService.js - API Client cho Dự báo nhu cầu bằng AI (Epic 4.1)
 * 
 * Tuân thủ quy tắc giữ nguyên cấu trúc trả về `response.data.data` hoặc `response.data`.
 */

import api from './api';

const forecastService = {
  /**
   * Lấy metadata kho, danh mục, sản phẩm phục vụ bộ lọc
   */
  getMeta: async () => {
    const response = await api.get('/forecast/meta');
    return response.data.data;
  },

  /**
   * Lấy template CSV mẫu 20 dòng từ Database
   */
  getSampleTemplate: async () => {
    const response = await api.get('/forecast/sales-data/template');
    return response.data.data;
  },

  /**
   * US-34: Nhập dữ liệu bán hàng lịch sử
   * @param {Array<Object>} records - Danh sách dòng dữ liệu bán hàng
   * @param {boolean} updateOnDuplicate - Cập nhật số lượng nếu trùng (true)
   */
  uploadSalesData: async (records, updateOnDuplicate = true) => {
    const response = await api.post('/forecast/sales-data/upload', {
      records,
      updateOnDuplicate,
    });
    return response.data;
  },

  /**
   * Lấy danh sách dữ liệu bán hàng lịch sử
   */
  getSalesData: async (params = {}) => {
    const response = await api.get('/forecast/sales-data', { params });
    return response.data;
  },

  /**
   * Lấy tổng quan thống kê dữ liệu bán hàng lịch sử
   */
  getSalesSummary: async () => {
    const response = await api.get('/forecast/sales-data/summary');
    return response.data.data;
  },

  /**
   * Sinh dữ liệu bán hàng mẫu 12 tháng
   */
  generateSampleData: async (months = 12) => {
    const response = await api.post('/forecast/sales-data/generate-sample', { months });
    return response.data;
  },

  /**
   * Xóa sạch dữ liệu bán hàng lịch sử
   */
  clearSalesData: async (warehouseId = null) => {
    const params = warehouseId ? { warehouse_id: warehouseId } : {};
    const response = await api.delete('/forecast/sales-data/clear', { params });
    return response.data;
  },

  /**
   * US-35: Xem dự báo nhu cầu theo SKU, size và màu
   */
  predictDemand: async (params = {}) => {
    const response = await api.get('/forecast/predict', { params });
    return response.data.data;
  },

  /**
   * US-36: Xem độ chính xác của dự báo (Backtesting)
   */
  backtestDemand: async (params = {}) => {
    const response = await api.get('/forecast/backtest', { params });
    return response.data.data;
  },
};

export default forecastService;
