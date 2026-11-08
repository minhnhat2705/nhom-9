/**
 * src/controllers/auth.controller.js - Controller xử lý Authentication
 * 
 * Controller chỉ xử lý request/response.
 * Logic nghiệp vụ được đặt trong service.
 */

const authService = require('../services/auth.service');
const prisma = require('../config/prisma');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * POST /api/auth/login
 * Đăng nhập
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;

    const result = await authService.login(email, password, ipAddress);

    if (!result.success) {
      return errorResponse(res, result.message, 401);
    }

    // Lưu refresh token vào HttpOnly Cookie
    res.cookie('refreshToken', result.data.refreshToken, {
      httpOnly: true,       // Không thể đọc từ JavaScript
      secure: process.env.NODE_ENV === 'production', // HTTPS only trong production
      sameSite: 'strict',   // Bảo vệ CSRF
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    });

    return successResponse(res, {
      accessToken: result.data.accessToken,
      user: result.data.user,
    }, 'Đăng nhập thành công');

  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 * Đăng xuất
 */
const logout = async (req, res, next) => {
  try {
    // Lấy refresh token từ Cookie hoặc body
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    
    // Thu hồi refresh token trong database
    if (refreshToken && req.user) {
      await authService.logout(refreshToken, req.user.id);
    }

    // Xóa Cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return successResponse(res, null, 'Đăng xuất thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/refresh
 * Làm mới Access Token
 */
const refresh = async (req, res, next) => {
  try {
    // Lấy refresh token từ Cookie hoặc body
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    const result = await authService.refreshAccessToken(refreshToken);

    if (!result.success) {
      return errorResponse(res, result.message, 401);
    }

    return successResponse(res, result.data, 'Làm mới token thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/change-password
 * Đổi mật khẩu (người dùng tự đổi)
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const result = await authService.changePassword(userId, currentPassword, newPassword);

    if (!result.success) {
      return errorResponse(res, result.message, 400);
    }

    // Xóa Cookie refresh token sau khi đổi mật khẩu
    res.clearCookie('refreshToken');

    return successResponse(res, null, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Lấy thông tin tài khoản hiện tại
 */
const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        full_name: true,
        email: true,
        phone: true,
        status: true,
        must_change_password: true,
        last_login: true,
        created_at: true,
        role: { select: { role_name: true } },
        warehouse: { select: { id: true, warehouse_name: true, warehouse_code: true } },
      },
    });

    if (!user) {
      return errorResponse(res, 'Tài khoản không tồn tại', 404);
    }

    return successResponse(res, user, 'Lấy thông tin tài khoản thành công');
  } catch (error) {
    next(error);
  }
};

module.exports = { login, logout, refresh, changePassword, getMe };
