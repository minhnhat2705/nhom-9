/**
 * src/routes/warehouse.routes.js - Routes cho Quản lý kho và chi nhánh
 * 
 * Phân quyền:
 * - GET: Người dùng đã đăng nhập có thể xem danh sách kho
 * - POST / PUT / DELETE: TUYỆT ĐỐI CHỈ DÀNH RIÊNG CHO QUẢN LÝ (WAREHOUSE_MANAGER).
 *   Nhân viên kho (WAREHOUSE_STAFF) không có quyền thao tác thay đổi dữ liệu.
 */

const express = require('express');
const router = express.Router();

const warehouseController = require('../controllers/warehouse.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// GET /api/warehouses - Xem danh sách kho/chi nhánh (đã xác thực)
router.get('/', authenticate, warehouseController.getWarehouses);

// GET /api/warehouses/:id - Xem chi tiết kho/chi nhánh
router.get('/:id', authenticate, warehouseController.getWarehouseById);

// POST /api/warehouses - CHỨC NĂNG 1: Thêm kho/chi nhánh (CHỈ QUẢN LÝ)
router.post('/', authenticate, authorize('WAREHOUSE_MANAGER'), warehouseController.createWarehouse);

// PUT /api/warehouses/:id - CHỨC NĂNG 2: Sửa thông tin kho/chi nhánh (CHỈ QUẢN LÝ)
router.put('/:id', authenticate, authorize('WAREHOUSE_MANAGER'), warehouseController.updateWarehouse);

// DELETE /api/warehouses/:id - CHỨC NĂNG 3: Xóa kho/chi nhánh (ngưng hoạt động) (CHỈ QUẢN LÝ)
router.delete('/:id', authenticate, authorize('WAREHOUSE_MANAGER'), warehouseController.deleteWarehouse);

module.exports = router;
