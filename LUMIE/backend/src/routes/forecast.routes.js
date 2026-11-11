/**
 * src/routes/forecast.routes.js - Routing Dự báo nhu cầu bằng AI (Epic 4.1)
 * 
 * PHÂN QUYỀN:
 * Dành riêng cho Quản lý kho (WAREHOUSE_MANAGER)
 */

const express = require('express');
const router = express.Router();
const forecastController = require('../controllers/forecast.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Áp dụng middleware xác thực và phân quyền Quản lý kho
const managerAuth = [authenticate, authorize('WAREHOUSE_MANAGER')];

// 0. Metadata phục vụ bộ lọc
router.get('/meta', ...managerAuth, forecastController.getMeta);

// 1. US-34: Dữ liệu bán hàng lịch sử
router.get('/sales-data/template', ...managerAuth, forecastController.getSampleTemplate);
router.post('/sales-data/upload', ...managerAuth, forecastController.uploadSalesData);
router.get('/sales-data', ...managerAuth, forecastController.getSalesData);
router.get('/sales-data/summary', ...managerAuth, forecastController.getSalesSummary);
router.post('/sales-data/generate-sample', ...managerAuth, forecastController.generateSampleData);
router.delete('/sales-data/clear', ...managerAuth, forecastController.clearSalesData);

// 2. US-35: Dự báo nhu cầu AI
router.get('/predict', ...managerAuth, forecastController.predictDemand);

// 3. US-36: Độ chính xác & Backtesting
router.get('/backtest', ...managerAuth, forecastController.backtestDemand);

module.exports = router;
