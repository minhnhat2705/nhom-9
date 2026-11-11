/**
 * src/routes/outbound.routes.js - Router cho Xuất Kho & Điều Chuyển Hàng
 * 
 * PHÂN QUYỀN CHUẨN:
 * 1. "Tạo phiếu xuất kho": CHỈ DÀNH CHO NHÂN VIÊN (WAREHOUSE_STAFF), CẤM QUẢN LÝ.
 * 2. "Tạo phiếu điều chuyển giữa các kho": CHỈ DÀNH CHO NHÂN VIÊN (WAREHOUSE_STAFF), CẤM QUẢN LÝ.
 * 3. "Duyệt phiếu xuất kho": CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), CẤM NHÂN VIÊN.
 * 4. "Duyệt và xác nhận nhận hàng điều chuyển": CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), CẤM NHÂN VIÊN.
 * 5. Xem lịch sử / chi tiết: Cả 2 (Staff & Manager).
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const {
  getOutboundFormData,
  getExports,
  getExportById,
  createExport,
  approveExport,
  rejectExport,
  getTransfers,
  getTransferById,
  createTransfer,
  approveTransfer,
  rejectTransfer,
} = require('../controllers/outbound.controller');

// Tất cả endpoints đều yêu cầu đăng nhập
router.use(authenticate);

// Dữ liệu meta hỗ trợ form tạo phiếu (kho hàng, biến thể sản phẩm kèm tồn kho)
router.get('/meta/form-data', getOutboundFormData);

// ============================================================
// 1. PHIẾU XUẤT KHO
// ============================================================
// Xem lịch sử & chi tiết (Cả Quản lý & Nhân viên)
router.get('/exports', getExports);
router.get('/exports/:id', getExportById);

// Tạo phiếu xuất kho (CHỈ DÀNH CHO NHÂN VIÊN)
router.post('/exports', authorize('WAREHOUSE_STAFF'), createExport);

// Duyệt & Từ chối phiếu xuất kho (CHỈ DÀNH CHO QUẢN LÝ)
router.post('/exports/:id/approve', authorize('WAREHOUSE_MANAGER'), approveExport);
router.post('/exports/:id/reject', authorize('WAREHOUSE_MANAGER'), rejectExport);

// ============================================================
// 2. PHIẾU ĐIỀU CHUYỂN HÀNG GIỮA CÁC KHO
// ============================================================
// Xem lịch sử & chi tiết (Cả Quản lý & Nhân viên)
router.get('/transfers', getTransfers);
router.get('/transfers/:id', getTransferById);

// Tạo phiếu điều chuyển giữa các kho (CHỈ DÀNH CHO NHÂN VIÊN)
router.post('/transfers', authorize('WAREHOUSE_STAFF'), createTransfer);

// Duyệt và xác nhận nhận hàng điều chuyển (CHỈ DÀNH CHO QUẢN LÝ)
router.post('/transfers/:id/approve', authorize('WAREHOUSE_MANAGER'), approveTransfer);
router.post('/transfers/:id/reject', authorize('WAREHOUSE_MANAGER'), rejectTransfer);

module.exports = router;
