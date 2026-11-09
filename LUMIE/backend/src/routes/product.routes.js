/**
 * src/routes/product.routes.js - Router cho Sản phẩm
 * 
 * Phân quyền:
 * - GET: Cả Quản lý & Nhân viên đều được xem & tìm kiếm
 * - POST / PUT / DELETE: CHỈ Quản lý (WAREHOUSE_MANAGER), cấm tuyệt đối Nhân viên (WAREHOUSE_STAFF)
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const {
  getProducts,
  getProductFiltersMeta,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  reactivateProduct,
} = require('../controllers/product.controller');

// Tất cả API sản phẩm yêu cầu đã đăng nhập
router.use(authenticate);

// 1. Metadata bộ lọc (Staff & Manager)
router.get('/meta/filters', getProductFiltersMeta);

// 2. Danh sách & tìm kiếm sản phẩm (Staff & Manager)
router.get('/', getProducts);

// 3. Chi tiết sản phẩm (Staff & Manager)
router.get('/:id', getProductById);

// ============================================================
// CÁC CHỨC NĂNG CỦA QUẢN LÝ (TUYỆT ĐỐI KHÔNG DÀNH CHO NHÂN VIÊN)
// ============================================================

// POST /api/products - Thêm sản phẩm kèm biến thể size, màu, SKU (Chỉ Quản lý)
router.post('/', authorize('WAREHOUSE_MANAGER'), createProduct);

// PUT /api/products/:id - Sửa thông tin sản phẩm và biến thể (Chỉ Quản lý)
router.put('/:id', authorize('WAREHOUSE_MANAGER'), updateProduct);

// DELETE /api/products/:id - Xóa sản phẩm / Ngừng kinh doanh (Chỉ Quản lý)
router.delete('/:id', authorize('WAREHOUSE_MANAGER'), deleteProduct);

// PATCH /api/products/:id/reactivate - Kích hoạt kinh doanh trở lại (Chỉ Quản lý)
router.patch('/:id/reactivate', authorize('WAREHOUSE_MANAGER'), reactivateProduct);

module.exports = router;
