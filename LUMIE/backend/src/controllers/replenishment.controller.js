/**
 * LUMIE Smart Warehouse - Replenishment Controller
 * Điều hướng request và xử lý phân quyền cho Epic 4.2 (US-37, US-38, US-39, US-40)
 * 
 * PHÂN QUYỀN CHẶT CHẼ: Toàn bộ API chỉ dành riêng cho WAREHOUSE_MANAGER.
 */

const replenishmentService = require('../services/replenishment.service');

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
      message: 'Từ chối truy cập: Chức năng này chỉ dành riêng cho Quản lý kho (WAREHOUSE_MANAGER).',
    });
    return false;
  }
  return true;
};

/**
 * GET /api/replenishment/meta
 */
const getMeta = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;
    const meta = await replenishmentService.getReplenishmentMeta();
    return res.status(200).json({
      success: true,
      message: 'Lấy metadata đề xuất nhập hàng thành công',
      data: meta,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/replenishment/suggestions/generate
 * US-37: Quét và sinh đề xuất nhập hàng tự động bằng AI
 */
const generateSuggestions = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;
    const { warehouse_id = 'ALL', force = false } = req.body;
    const result = await replenishmentService.generateSuggestions({ warehouse_id, force });
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
 * GET /api/replenishment/suggestions
 * US-37: Lấy danh sách đề xuất nhập hàng
 */
const getSuggestions = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;
    const {
      warehouse_id,
      supplier_id,
      urgency_level,
      status,
      search,
      period_key,
      page,
      limit,
    } = req.query;

    const result = await replenishmentService.getSuggestions({
      warehouse_id,
      supplier_id,
      urgency_level,
      status,
      search,
      period_key,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách đề xuất nhập hàng thành công',
      data: result.data,
      pagination: result.pagination,
      summary: result.summary,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/replenishment/suggestions/:id
 * US-38: Điều chỉnh số lượng hoặc nhà cung cấp đề xuất
 */
const updateSuggestion = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;
    const { id } = req.params;
    const { adjusted_qty, supplier_id } = req.body;

    const updated = await replenishmentService.updateSuggestion(id, {
      adjusted_qty,
      supplier_id,
      user_id: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: 'Cập nhật điều chỉnh đề xuất thành công',
      data: updated,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * POST /api/replenishment/suggestions/approve
 * US-39: Duyệt đề xuất nhập hàng (hàng loạt hoặc đơn lẻ)
 */
const approveSuggestions = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;
    const { ids = [] } = req.body;

    const result = await replenishmentService.approveSuggestions({ ids });
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * POST /api/replenishment/suggestions/reject
 * US-39: Từ chối đề xuất nhập hàng kèm lý do
 */
const rejectSuggestions = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;
    const { ids = [], rejection_reason = '' } = req.body;

    const result = await replenishmentService.rejectSuggestions({ ids, rejection_reason });
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * POST /api/replenishment/purchase-orders/create-from-suggestions
 * US-40: Tạo Đơn đặt hàng (PO) từ danh sách đề xuất APPROVED
 */
const createPurchaseOrders = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;
    const { suggestion_ids = [], notes = '' } = req.body;

    const result = await replenishmentService.createPurchaseOrdersFromSuggestions({
      suggestion_ids,
      user_id: req.user.id,
      notes,
    });

    return res.status(201).json({
      success: true,
      message: result.message,
      data: result.orders,
      count: result.count,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * GET /api/replenishment/purchase-orders
 * US-40: Lấy danh sách Đơn đặt hàng (PO)
 */
const getPurchaseOrders = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;
    const { warehouse_id, supplier_id, status, search, page, limit } = req.query;

    const result = await replenishmentService.getPurchaseOrders({
      warehouse_id,
      supplier_id,
      status,
      search,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách Đơn đặt hàng thành công',
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/replenishment/purchase-orders/:id
 * US-40: Lấy chi tiết một Đơn đặt hàng (PO)
 */
const getPurchaseOrderById = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;
    const { id } = req.params;

    const order = await replenishmentService.getPurchaseOrderById(id);
    return res.status(200).json({
      success: true,
      message: 'Lấy chi tiết Đơn đặt hàng thành công',
      data: order,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * PUT /api/replenishment/purchase-orders/:id/status
 * US-40: Cập nhật trạng thái Đơn đặt hàng
 */
const updatePurchaseOrderStatus = async (req, res, next) => {
  try {
    if (!requireManager(req, res)) return;
    const { id } = req.params;
    const { status, notes } = req.body;

    const updated = await replenishmentService.updatePurchaseOrderStatus(id, { status, notes });
    return res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái Đơn đặt hàng thành công',
      data: updated,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

module.exports = {
  getMeta,
  generateSuggestions,
  getSuggestions,
  updateSuggestion,
  approveSuggestions,
  rejectSuggestions,
  createPurchaseOrders,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrderStatus,
};
