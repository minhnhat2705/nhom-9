/**
 * src/routes/warehouse.routes.js - Routes cho Warehouse
 */

const express = require('express');
const router = express.Router();

const warehouseController = require('../controllers/warehouse.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// GET: Tất cả user đã đăng nhập đều có thể xem danh sách kho
router.get('/', authenticate, warehouseController.getWarehouses);

// POST: Chỉ Quản lý mới được tạo kho
router.post('/', authenticate, authorize('WAREHOUSE_MANAGER'), warehouseController.createWarehouse);

module.exports = router;
