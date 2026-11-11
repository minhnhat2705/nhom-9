/**
 * src/routes/report.routes.js - Routing Dashboard & Báo cáo chuẩn kế toán kho (Theme 6: US-47 -> US-50)
 * 
 * PHÂN QUYỀN CHẶT CHẼ:
 * Dành riêng cho Quản lý kho (WAREHOUSE_MANAGER)
 */

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Khóa chặt: Toàn bộ route chỉ dành cho Quản lý kho
const managerAuth = [authenticate, authorize('WAREHOUSE_MANAGER')];

// 1. US-47: Dashboard tổng quan
router.get('/dashboard', ...managerAuth, reportController.getDashboard);

// 2. US-48: Báo cáo tồn kho theo kho, danh mục, bộ sưu tập & theo thời điểm
router.get('/inventory', ...managerAuth, reportController.getInventoryReport);

// 3. US-49 & US-50: Báo cáo Nhập - Xuất - Tồn theo kỳ
router.get('/in-out-period', ...managerAuth, reportController.getPeriodInOutReport);

module.exports = router;
