/**
 * LUMIE Smart Warehouse - Alert & Notification Controller
 * Phân hệ Cảnh báo & Thông báo (Theme 5: US-41 -> US-46)
 */

const alertService = require('../services/alert.service');

/**
 * POST /api/notifications/scan
 * Quét dữ liệu và sinh các cảnh báo thông minh
 */
const scanAlerts = async (req, res, next) => {
  try {
    const { warehouse_id = 'ALL', overstockDays, slowMovingDays } = req.body;
    const result = await alertService.scanAndGenerateAlerts({
      warehouse_id,
      overstockDays: overstockDays ? parseInt(overstockDays, 10) : undefined,
      slowMovingDays: slowMovingDays ? parseInt(slowMovingDays, 10) : undefined,
    });
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/notifications
 * Lấy danh sách cảnh báo & thông báo đã được lọc theo vai trò
 */
const getNotifications = async (req, res, next) => {
  try {
    const {
      warehouse_id,
      alert_type,
      urgency,
      status,
      search,
      page,
      limit,
    } = req.query;

    const result = await alertService.getAlerts({
      user: req.user,
      warehouse_id,
      alert_type,
      urgency,
      status,
      search,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách thông báo thành công',
      data: result.data,
      pagination: result.pagination,
      summary: result.summary,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/notifications/unread-count
 * Đếm số lượng thông báo chưa đọc cho Chuông trên Header
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const result = await alertService.getUnreadNotificationCount(req.user);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Đánh dấu 1 thông báo đã đọc
 */
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await alertService.markAsRead(req.user.id, id);
    return res.status(200).json({
      success: true,
      message: 'Đã đánh dấu thông báo là đã đọc',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/notifications/read-all
 * Đánh dấu TẤT CẢ thông báo hợp lệ của user là đã đọc
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const result = await alertService.markAllAsRead(req.user);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/notifications/:id/resolve
 * Đánh dấu cảnh báo đã được xử lý (RESOLVED)
 */
const resolveAlert = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await alertService.resolveAlert(id, req.user.id);
    return res.status(200).json({
      success: true,
      message: 'Đã đánh dấu xử lý cảnh báo thành công',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/notifications/:id
 * Xóa / ẩn thông báo cá nhân của chính user này
 */
const dismissNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await alertService.dismissNotification(req.user.id, id);
    return res.status(200).json({
      success: true,
      message: 'Đã xóa thông báo khỏi danh sách của bạn',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  scanAlerts,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  resolveAlert,
  dismissNotification,
};
