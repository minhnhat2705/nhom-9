/**
 * src/routes/receipt.routes.js - Router cho Phiếu Nhập Kho
 * 
 * PHÂN QUYỀN:
 * 1. "Tạo phiếu nhập kho": CHỈ DÀNH CHO NHÂN VIÊN (WAREHOUSE_STAFF), TUYỆT ĐỐI KHÔNG LÀM CHO QUẢN LÝ.
 * 2. "Duyệt phiếu nhập kho": CHỈ DÀNH CHO QUẢN LÝ (WAREHOUSE_MANAGER), TUYỆT ĐỐI KHÔNG LÀM CHO NHÂN VIÊN.
 * 3. "Xem lịch sử phiếu nhập kho": DÀNH CHO CẢ 2 (Staff & Manager).
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const {
  getReceipts,
  getReceiptById,
  getReceiptFormData,
  createReceipt,
  approveReceipt,
  rejectReceipt,
} = require('../controllers/receipt.controller');

// Yêu cầu đăng nhập cho tất cả các endpoint
router.use(authenticate);

// 1. Dữ liệu metadata hỗ trợ tạo phiếu (kho, NCC, danh sách SKU)
router.get('/meta/form-data', getReceiptFormData);

// 2. Xem lịch sử phiếu nhập kho (Dành cho cả Quản lý và Nhân viên)
router.get('/', getReceipts);

// 3. Xem chi tiết phiếu nhập kho (Dành cho cả Quản lý và Nhân viên)
router.get('/:id', getReceiptById);

// 4. Tạo phiếu nhập kho (CHỈ DÀNH CHO NHÂN VIÊN, CẤM QUẢN LÝ)
router.post('/', authorize('WAREHOUSE_STAFF'), createReceipt);

// 5. Duyệt phiếu nhập kho (CHỈ DÀNH CHO QUẢN LÝ, CẤM NHÂN VIÊN)
router.post('/:id/approve', authorize('WAREHOUSE_MANAGER'), approveReceipt);

// 6. Từ chối phiếu nhập kho (CHỈ DÀNH CHO QUẢN LÝ, CẤM NHÂN VIÊN)
router.post('/:id/reject', authorize('WAREHOUSE_MANAGER'), rejectReceipt);

module.exports = router;
