/**
 * src/controllers/forecast.controller.js - Controller Dự báo nhu cầu bằng AI (Epic 4.1)
 * 
 * PHÂN QUYỀN NGHIÊM NGẶT (RBAC):
 * Cả 3 chức năng US-34, US-35, US-36 CHỈ DÀNH RIÊNG CHO QUẢN LÝ KHO (WAREHOUSE_MANAGER).
 * Tuyệt đối không cho Nhân viên kho (WAREHOUSE_STAFF) gọi các API này (Trả về 403 Forbidden).
 */

const forecastService = require('../services/forecast.service');
const { successResponse, errorResponse } = require('../utils/response');

const getUserRole = (user) => (typeof user?.role === 'object' ? user.role?.role_name : user?.role);

/**
 * Helper kiểm tra quyền Quản lý kho nghiêm ngặt
 */
const requireManager = (req, res) => {
  if (getUserRole(req.user) !== 'WAREHOUSE_MANAGER') {
    errorResponse(res, 'Chức năng Dự báo nhu cầu AI chỉ dành riêng cho Quản lý kho. Nhân viên không có quyền truy cập!', 403);
    return false;
  }
  return true;
};

/**
 * 0. Lấy metadata phục vụ bộ lọc: Danh sách kho, danh mục, sản phẩm
 * GET /api/forecast/meta
 */
const getMeta = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;
    const meta = await forecastService.getForecastMetaData();
    return successResponse(res, meta, 'Lấy metadata dự báo thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * 1. US-34: Nhập dữ liệu bán hàng lịch sử
 * POST /api/forecast/sales-data/upload
 */
const uploadSalesData = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;

    const { records, updateOnDuplicate = true } = req.body;

    if (!records || !Array.isArray(records)) {
      return errorResponse(res, 'Vui lòng cung cấp danh sách dữ liệu bán hàng hợp lệ (mảng JSON hoặc parsed CSV)', 400);
    }

    const result = await forecastService.uploadSalesData(records, updateOnDuplicate);

    return successResponse(
      res,
      result,
      `Đã xử lý nhập ${result.success_count}/${result.total_processed} dòng dữ liệu bán hàng thành công!${result.warning ? ' (' + result.warning + ')' : ''}`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Lấy file mẫu (.csv) có sẵn 20 dòng dữ liệu thực tế từ Database
 * GET /api/forecast/sales-data/template
 */
const getSampleTemplate = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;

    const { rows, csvContent } = await forecastService.getSampleTemplateData();

    // Nếu client yêu cầu dạng file stream
    if (req.query.download === 'file') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="mau_du_lieu_ban_hang_lumie.csv"');
      return res.status(200).send(csvContent);
    }

    return successResponse(res, { rows, csvContent }, 'Lấy dữ liệu mẫu thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Lấy danh sách dữ liệu bán hàng lịch sử
 * GET /api/forecast/sales-data
 */
const getSalesData = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;

    const { page, limit, warehouse_id, search, start_date, end_date } = req.query;
    const data = await forecastService.getSalesDataList({
      page,
      limit,
      warehouse_id,
      search,
      start_date,
      end_date,
    });
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách dữ liệu bán hàng thành công',
      data: data.items,
      pagination: data.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Tổng quan thống kê dữ liệu bán hàng
 * GET /api/forecast/sales-data/summary
 */
const getSalesSummary = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;

    const summary = await forecastService.getSalesDataSummary();
    return successResponse(res, summary, 'Lấy tổng quan dữ liệu bán hàng thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Sinh dữ liệu bán hàng mẫu 12 tháng (Demo Seeder)
 * POST /api/forecast/sales-data/generate-sample
 */
const generateSampleData = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;

    const { months = 12 } = req.body;
    const result = await forecastService.generateSampleSalesData(months);

    return successResponse(
      res,
      result,
      `Đã khởi tạo thành công dữ liệu bán hàng lịch sử ${months} tháng cho toàn bộ kho!`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Xóa sạch dữ liệu bán hàng lịch sử
 * DELETE /api/forecast/sales-data/clear
 */
const clearSalesData = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;

    const { warehouse_id } = req.query;
    const result = await forecastService.clearSalesData(warehouse_id);

    return successResponse(res, result, `Đã xóa ${result.deleted_count} bản ghi dữ liệu bán hàng lịch sử!`);
  } catch (error) {
    next(error);
  }
};

/**
 * 7. US-35: Xem dự báo nhu cầu theo SKU, size và màu
 * GET /api/forecast/predict
 */
const predictDemand = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;

    const { warehouse_id, product_id, category_id, period, horizon } = req.query;

    const result = await forecastService.predictDemand({
      warehouse_id: warehouse_id || 'ALL',
      product_id,
      category_id,
      period: period || 'week',
      horizon: horizon || 6,
    });

    return successResponse(res, result, 'Tính toán dự báo nhu cầu bằng AI thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * 8. US-36: Xem độ chính xác của dự báo (Backtesting)
 * GET /api/forecast/backtest
 */
const backtestDemand = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;

    const { warehouse_id, product_id, category_id, test_periods } = req.query;

    const result = await forecastService.backtestDemand({
      warehouse_id: warehouse_id || 'ALL',
      product_id,
      category_id,
      test_periods: test_periods || 8,
    });

    return successResponse(res, result, 'Chạy kiểm định ngược Backtesting thành công');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMeta,
  uploadSalesData,
  getSampleTemplate,
  getSalesData,
  getSalesSummary,
  generateSampleData,
  clearSalesData,
  predictDemand,
  backtestDemand,
};
