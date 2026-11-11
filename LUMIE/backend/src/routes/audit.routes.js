/**
 * src/routes/audit.routes.js - Routing Kiểm Kê Tồn Kho
 * 
 * PHÂN QUYỀN CHUẨN XÁC:
 * 1. "Tạo đợt kiểm kê": CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), TUYỆT ĐỐI KHÔNG LÀM CHO NHÂN VIÊN.
 * 2. "Duyệt điều chỉnh chênh lệch kiểm kê": CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), TUYỆT ĐỐI KHÔNG LÀM CHO NHÂN VIÊN.
 * 3. "Nhập kết quả kiểm kê": CHỈ DÀNH CHO NHÂN VIÊN (WAREHOUSE_STAFF), TUYỆT ĐỐI KHÔNG LÀM CHO QUẢN LÝ.
 * 4. "Xem lịch sử kiểm kê": DÀNH CHO CẢ 2.
 */

const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// 0. Dữ liệu meta hỗ trợ form kiểm kê (CẢ 2)
router.get(
  '/meta',
  authenticate,
  authorize('WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF'),
  auditController.getAuditFormData
);

// 0.1 Lấy danh sách mặt hàng tại kho để chuẩn bị kiểm kê (CẢ 2)
router.get(
  '/warehouse-items/:warehouseId',
  authenticate,
  authorize('WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF'),
  auditController.getWarehouseItemsForAudit
);

// 1. Xem danh sách đợt kiểm kê (CẢ 2)
router.get(
  '/',
  authenticate,
  authorize('WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF'),
  auditController.getAudits
);

// 2. Xem chi tiết đợt kiểm kê (CẢ 2)
router.get(
  '/:id',
  authenticate,
  authorize('WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF'),
  auditController.getAuditById
);

// 3. TẠO ĐỢT KIỂM KÊ (CHỈ DÀNH CHO QUẢN LÝ, CẤM NHÂN VIÊN)
router.post(
  '/',
  authenticate,
  authorize('WAREHOUSE_MANAGER'),
  auditController.createAudit
);

// 4. NHẬP KẾT QUẢ KIỂM KÊ (CHỈ DÀNH CHO NHÂN VIÊN, CẤM QUẢN LÝ)
router.post(
  '/:id/count',
  authenticate,
  authorize('WAREHOUSE_STAFF'),
  auditController.submitAuditCount
);

// 5. DUYỆT ĐIỀU CHỈNH CHÊNH LỆCH (CHỈ DÀNH CHO QUẢN LÝ, CẤM NHÂN VIÊN)
router.post(
  '/:id/approve',
  authenticate,
  authorize('WAREHOUSE_MANAGER'),
  auditController.approveAuditAdjustment
);

// 6. HỦY ĐỢT KIỂM KÊ (CHỈ DÀNH CHO QUẢN LÝ)
router.post(
  '/:id/cancel',
  authenticate,
  authorize('WAREHOUSE_MANAGER'),
  auditController.cancelAudit
);

module.exports = router;
