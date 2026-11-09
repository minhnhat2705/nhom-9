/**
 * src/routes/user.routes.js - Routes cho User Management
 * 
 * Tất cả routes đều yêu cầu đăng nhập.
 * Hầu hết routes chỉ dành cho WAREHOUSE_MANAGER.
 * 
 * POST   /api/users                    - Tạo nhân viên mới (Manager)
 * GET    /api/users                    - Danh sách nhân viên (Manager)
 * GET    /api/users/:id                - Chi tiết nhân viên (Manager)
 * PUT    /api/users/:id                - Cập nhật thông tin (Manager)
 * PATCH  /api/users/:id/status        - Thay đổi trạng thái (Manager)
 * POST   /api/users/:id/reset-password - Đặt lại mật khẩu (Manager)
 */

const express = require('express');
const router = express.Router();

const userController = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { validateCreateUser, validateUpdateUser, validateResetPassword } = require('../validators/user.validator');

// Tất cả routes đều cần đăng nhập + là Quản lý kho
const managerOnly = [authenticate, authorize('WAREHOUSE_MANAGER')];

router.get('/', ...managerOnly, userController.getUsers);
router.post('/', ...managerOnly, validateCreateUser, userController.createUser);
router.get('/:id', ...managerOnly, userController.getUserById);
router.put('/:id', ...managerOnly, validateUpdateUser, userController.updateUser);
router.patch('/:id/status', ...managerOnly, userController.updateUserStatus);
router.post('/:id/reset-password', ...managerOnly, validateResetPassword, userController.resetUserPassword);
router.delete('/:id', ...managerOnly, userController.deleteUser);

module.exports = router;
