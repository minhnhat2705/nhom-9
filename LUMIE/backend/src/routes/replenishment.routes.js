/**
 * src/routes/replenishment.routes.js - Routing Đề xuất nhập hàng thông minh (Epic 4.2)
 * 
 * PHÂN QUYỀN CHẶT CHẼ:
 * Dành riêng cho Quản lý kho (WAREHOUSE_MANAGER)
 */

const express = require('express');
const router = express.Router();
const replenishmentController = require('../controllers/replenishment.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Khóa chặt: Chỉ Quản lý kho mới có quyền gọi bất kỳ API nào trong Epic 4.2
const managerAuth = [authenticate, authorize('WAREHOUSE_MANAGER')];

// 0. Metadata
router.get('/meta', ...managerAuth, replenishmentController.getMeta);

// 1. US-37: Đề xuất nhập hàng (Generate & List)
router.post('/suggestions/generate', ...managerAuth, replenishmentController.generateSuggestions);
router.get('/suggestions', ...managerAuth, replenishmentController.getSuggestions);

// 2. US-38: Điều chỉnh số lượng hoặc Nhà cung cấp đề xuất
router.put('/suggestions/:id', ...managerAuth, replenishmentController.updateSuggestion);

// 3. US-39: Duyệt hoặc Từ chối đề xuất
router.post('/suggestions/approve', ...managerAuth, replenishmentController.approveSuggestions);
router.post('/suggestions/reject', ...managerAuth, replenishmentController.rejectSuggestions);

// 4. US-40: Tạo & Quản lý Đơn đặt hàng nhà cung cấp (PO)
router.post('/purchase-orders/create-from-suggestions', ...managerAuth, replenishmentController.createPurchaseOrders);
router.get('/purchase-orders', ...managerAuth, replenishmentController.getPurchaseOrders);
router.get('/purchase-orders/:id', ...managerAuth, replenishmentController.getPurchaseOrderById);
router.put('/purchase-orders/:id/status', ...managerAuth, replenishmentController.updatePurchaseOrderStatus);

module.exports = router;
