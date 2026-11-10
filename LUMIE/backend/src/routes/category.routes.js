/**
 * src/routes/category.routes.js - Router cho Danh mục sản phẩm & Nhà cung cấp
 * 
 * Phân quyền:
 * - GET: Xem danh sách danh mục & nhà cung cấp (đã đăng nhập)
 * - POST / PUT / DELETE: CHỈ Quản lý (WAREHOUSE_MANAGER), cấm tuyệt đối Nhân viên (WAREHOUSE_STAFF)
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const {
  getCategories,
  getSuppliers,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} = require('../controllers/category.controller');

// Yêu cầu đăng nhập cho toàn bộ API danh mục & nhà cung cấp
router.use(authenticate);

// 1. Xem và tìm kiếm danh mục & nhà cung cấp
router.get('/', getCategories);
router.get('/suppliers', getSuppliers);
router.get('/:id', getCategoryById);

// ============================================================
// CÁC CHỨC NĂNG DÀNH RIÊNG CHO QUẢN LÝ (TUYỆT ĐỐI KHÔNG DÀNH CHO NHÂN VIÊN)
// ============================================================

// QUẢN LÝ DANH MỤC SẢN PHẨM (Chỉ Quản lý)
router.post('/', authorize('WAREHOUSE_MANAGER'), createCategory);
router.put('/:id', authorize('WAREHOUSE_MANAGER'), updateCategory);
router.delete('/:id', authorize('WAREHOUSE_MANAGER'), deleteCategory);

// QUẢN LÝ NHÀ CUNG CẤP (Chỉ Quản lý)
router.post('/suppliers', authorize('WAREHOUSE_MANAGER'), createSupplier);
router.put('/suppliers/:id', authorize('WAREHOUSE_MANAGER'), updateSupplier);
router.delete('/suppliers/:id', authorize('WAREHOUSE_MANAGER'), deleteSupplier);

module.exports = router;
