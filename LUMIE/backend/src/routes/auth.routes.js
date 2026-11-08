/**
 * src/routes/auth.routes.js - Routes cho Authentication
 * 
 * POST /api/auth/login         - Đăng nhập
 * POST /api/auth/logout        - Đăng xuất (cần đăng nhập)
 * POST /api/auth/refresh       - Làm mới access token
 * POST /api/auth/change-password - Đổi mật khẩu (cần đăng nhập)
 * GET  /api/auth/me            - Xem thông tin tài khoản (cần đăng nhập)
 */

const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validateLogin, validateChangePassword } = require('../validators/auth.validator');

// --- Public Routes (không cần đăng nhập) ---
router.post('/login', validateLogin, authController.login);
router.post('/refresh', authController.refresh);

// --- Protected Routes (phải đăng nhập) ---
router.post('/logout', authenticate, authController.logout);
router.post('/change-password', authenticate, validateChangePassword, authController.changePassword);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
