/**
 * LUMIE Smart Warehouse - Report & Dashboard Controller
 * Điều hướng request và bảo mật phân quyền cho Theme 6 (US-47, US-48, US-49, US-50)
 * 
 * PHÂN QUYỀN CHẶT CHẼ: Toàn bộ API chỉ dành riêng cho WAREHOUSE_MANAGER.
 */

const reportService = require('../services/report.service');

const getUserRole = (user) => {
  if (!user) return null;
  if (typeof user.role === 'string') return user.role;
  return user.role?.role_name || null;
};

const requireManager = (req, res) => {
  const role = getUserRole(req.user);
  if (role !== 'WAREHOUSE_MANAGER') {
    res.status(403).json({
      success: false,
      message: 'Từ chối truy cập: Báo cáo và Dashboard chỉ dành riêng cho Quản lý kho (WAREHOUSE_MANAGER).',
    });
    return false;
  }
  return true;
};

/**
 * GET /api/reports/dashboard
 * US-47: Xem Dashboard tổng quan Quản lý kho
 */
const getDashboard = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;
    const { warehouse_id = 'ALL', time_range = '30_days' } = req.query;

    const data = await reportService.getManagerDashboard({ warehouse_id, time_range });
    return res.status(200).json({
      success: true,
      message: 'Lấy dữ liệu Dashboard thành công',
      data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reports/inventory
 * US-48: Báo cáo tồn kho theo kho, danh mục, bộ sưu tập & theo thời điểm (As-of Date)
 */
const getInventoryReport = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;
    const { group_by = 'category', as_of_date = '', warehouse_id = 'ALL' } = req.query;

    const data = await reportService.getInventoryReport({ group_by, as_of_date, warehouse_id });
    return res.status(200).json({
      success: true,
      message: 'Lấy báo cáo tồn kho thành công',
      data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reports/in-out-period
 * US-49: Báo cáo Nhập – Xuất – Tồn theo kỳ chuẩn kế toán kho
 */
const getPeriodInOutReport = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;
    const { from_date, to_date, warehouse_id = 'ALL', search = '', page = 1, limit = 25 } = req.query;

    const data = await reportService.getPeriodInOutReport({
      from_date,
      to_date,
      warehouse_id,
      search,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy báo cáo Nhập - Xuất - Tồn theo kỳ thành công',
      data: data.rows,
      pagination: data.pagination,
      totals: data.totals,
      filters: { from_date: data.from_date, to_date: data.to_date, warehouse_id: data.warehouse_id },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

module.exports = {
  getDashboard,
  getInventoryReport,
  getPeriodInOutReport,
};
