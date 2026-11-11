/**
 * src/routes/inventory.routes.js - Routing Theo dõi tồn kho & Ngưỡng tồn
 * 
 * PHÂN QUYỀN CHUẨN XÁC:
 * 1. Xem tồn kho theo kho & toàn hệ thống: Cả Quản lý và Nhân viên
 * 2. Thiết lập ngưỡng tồn tối thiểu: CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER)
 */

const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// 1. Xem tồn kho theo kho và toàn hệ thống (CẢ QUẢN LÝ VÀ NHÂN VIÊN)
router.get(
  '/',
  authenticate,
  authorize('WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF'),
  inventoryController.getInventoryTracking
);

// 2. Thiết lập ngưỡng tồn tối thiểu cho 1 biến thể (CHỈ DÀNH CHO QUẢN LÝ, CẤM NHÂN VIÊN)
router.patch(
  '/threshold/:id',
  authenticate,
  authorize('WAREHOUSE_MANAGER'),
  inventoryController.updateMinStockThreshold
);

// 3. Thiết lập ngưỡng tồn tối thiểu hàng loạt (CHỈ DÀNH CHO QUẢN LÝ, CẤM NHÂN VIÊN)
router.post(
  '/threshold/batch',
  authenticate,
  authorize('WAREHOUSE_MANAGER'),
  inventoryController.batchUpdateMinStockThreshold
);

module.exports = router;
