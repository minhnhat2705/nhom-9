/**
 * src/controllers/user.controller.js - Controller xử lý User Management
 */

const userService = require('../services/user.service');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');

/**
 * GET /api/users
 * Lấy danh sách nhân viên (chỉ Quản lý)
 */
const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search = '', status = '' } = req.query;

    const { users, total } = await userService.getUsers({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      status,
    });

    return paginatedResponse(res, users, {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/:id
 * Xem thông tin chi tiết nhân viên (chỉ Quản lý)
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);

    if (!user) {
      return errorResponse(res, 'Không tìm thấy nhân viên', 404);
    }

    return successResponse(res, user);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/users
 * Tạo tài khoản nhân viên mới (chỉ Quản lý)
 */
const createUser = async (req, res, next) => {
  try {
    const { full_name, email, phone, password, warehouse_id } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;

    const result = await userService.createUser(
      { full_name, email, password, phone, warehouse_id },
      req.user.id,
      ipAddress
    );

    if (!result.success) {
      return errorResponse(res, result.message, 409);
    }

    return successResponse(res, result.data, 'Tạo tài khoản nhân viên thành công', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/users/:id
 * Cập nhật thông tin nhân viên (chỉ Quản lý)
 */
const updateUser = async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.socket.remoteAddress;

    const result = await userService.updateUser(
      req.params.id,
      req.body,
      req.user.id,
      ipAddress
    );

    if (!result.success) {
      return errorResponse(res, result.message, 404);
    }

    return successResponse(res, result.data, 'Cập nhật thông tin thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/users/:id/status
 * Thay đổi trạng thái tài khoản (chỉ Quản lý)
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return errorResponse(res, 'Trạng thái không hợp lệ. Chỉ chấp nhận: ACTIVE, INACTIVE', 400);
    }

    const result = await userService.updateUserStatus(
      req.params.id,
      status,
      req.user.id,
      ipAddress
    );

    if (!result.success) {
      return errorResponse(res, result.message, 400);
    }

    return successResponse(res, null, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/users/:id/reset-password
 * Đặt lại mật khẩu nhân viên (chỉ Quản lý)
 */
const resetUserPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;

    if (!newPassword || newPassword.length < 8) {
      return errorResponse(res, 'Mật khẩu phải có ít nhất 8 ký tự', 400);
    }

    const result = await userService.resetUserPassword(
      req.params.id,
      newPassword,
      req.user.id,
      ipAddress
    );

    if (!result.success) {
      return errorResponse(res, result.message, 404);
    }

    return successResponse(res, null, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/users/:id
 * Xóa nhân viên (chỉ Quản lý)
 */
const deleteUser = async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.socket.remoteAddress;

    const result = await userService.deleteUser(
      req.params.id,
      req.user.id,
      ipAddress
    );

    if (!result.success) {
      return errorResponse(res, result.message, 400);
    }

    return successResponse(res, null, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/stats
 * Thống kê nhanh số lượng nhân viên (Total, Active, Inactive)
 */
const getUserStats = async (req, res, next) => {
  try {
    const stats = await userService.getUserStats();
    return successResponse(res, stats, 'Thống kê nhân viên thành công');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUserById,
  getUserStats,
  createUser,
  updateUser,
  updateUserStatus,
  resetUserPassword,
  deleteUser,
};
