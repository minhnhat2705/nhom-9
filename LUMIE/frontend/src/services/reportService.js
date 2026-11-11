/**
 * src/services/reportService.js
 * API Client cho Dashboard tổng quan & Báo cáo chuẩn kế toán kho (Theme 6: US-47 -> US-50)
 */

import api from './api';

const reportService = {
  /**
   * US-47: Xem Dashboard tổng quan Quản lý kho
   * @param {Object} params
   * @param {string} [params.warehouse_id] - ID kho hoặc 'ALL'
   * @param {string} [params.time_range] - '7_days' | '30_days' | 'this_month' | 'this_quarter' | 'this_year'
   */
  getDashboard: async (params = {}) => {
    const response = await api.get('/reports/dashboard', { params });
    return response.data.data;
  },

  /**
   * US-48: Báo cáo tồn kho theo kho, danh mục, bộ sưu tập & theo thời điểm (As-of Date)
   * @param {Object} params
   * @param {string} [params.group_by] - 'warehouse' | 'category' | 'collection'
   * @param {string} [params.as_of_date] - Ngày xem tồn kho (YYYY-MM-DD)
   * @param {string} [params.warehouse_id] - ID kho hoặc 'ALL'
   */
  getInventoryReport: async (params = {}) => {
    const response = await api.get('/reports/inventory', { params });
    return response.data.data;
  },

  /**
   * US-49 & US-50: Báo cáo Nhập – Xuất – Tồn theo kỳ
   * @param {Object} params
   * @param {string} params.from_date - Từ ngày (bắt buộc)
   * @param {string} params.to_date - Đến ngày (bắt buộc)
   * @param {string} [params.warehouse_id] - ID kho hoặc 'ALL'
   * @param {string} [params.search] - Tìm kiếm theo SKU/Tên SP
   * @param {number} [params.page] - Trang
   * @param {number} [params.limit] - Số dòng/trang
   */
  getPeriodInOutReport: async (params = {}) => {
    const response = await api.get('/reports/in-out-period', { params });
    return response.data;
  },
};

export default reportService;
