/**
 * src/routes/alert.routes.js - Routing Cảnh báo & Thông báo (Theme 5: US-41 -> US-46)
 */

const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alert.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Mọi route đều yêu cầu đăng nhập
router.use(authenticate);

// 1. Quét & sinh cảnh báo tự động
router.post('/scan', alertController.scanAlerts);

// 2. Danh sách thông báo & đếm chưa đọc
router.get('/', alertController.getNotifications);
router.get('/unread-count', alertController.getUnreadCount);

// 3. Thao tác thông báo: Đọc, giải quyết, xóa cá nhân
router.patch('/:id/read', alertController.markAsRead);
router.post('/read-all', alertController.markAllAsRead);
router.patch('/:id/resolve', alertController.resolveAlert);
router.delete('/:id', alertController.dismissNotification);

module.exports = router;
