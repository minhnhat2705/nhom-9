/**
 * src/middlewares/auth.middleware.js - Middleware Xác thực & Phân quyền
 * 
 * Hai middleware chính:
 * 1. authenticate: Kiểm tra JWT token trong header
 * 2. authorize: Kiểm tra vai trò người dùng
 * 
 * Mỗi API nhạy cảm phải dùng cả hai middleware này.
 */

const { verifyAccessToken } = require('../utils/jwt');
const { errorResponse } = require('../utils/response');
const prisma = require('../config/prisma');

/**
 * Middleware xác thực: Kiểm tra Bearer Token trong Authorization header
 * Nếu hợp lệ, lưu thông tin user vào req.user
 */
const authenticate = async (req, res, next) => {
  try {
    // Lấy token từ header: "Authorization: Bearer <token>"
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Bạn chưa đăng nhập. Vui lòng đăng nhập để tiếp tục.', 401);
    }

    const token = authHeader.substring(7); // Bỏ "Bearer " (7 ký tự)

    // Xác thực token
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (tokenError) {
      if (tokenError.name === 'TokenExpiredError') {
        return errorResponse(res, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 401);
      }
      return errorResponse(res, 'Token không hợp lệ.', 401);
    }

    // Kiểm tra user vẫn còn tồn tại và còn active trong database
    // (tránh trường hợp user bị vô hiệu hóa nhưng token chưa hết hạn)
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        full_name: true,
        email: true,
        status: true,
        deleted_at: true,
        role: {
          select: { role_name: true }
        }
      }
    });

    if (!user || user.deleted_at !== null) {
      return errorResponse(res, 'Tài khoản không tồn tại.', 401);
    }

    if (user.status !== 'ACTIVE') {
      return errorResponse(res, 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản lý.', 403);
    }

    // Lưu thông tin user vào request để các handler sau sử dụng
    req.user = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role.role_name,
      status: user.status,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware phân quyền: Kiểm tra vai trò người dùng
 * Phải dùng SAU middleware authenticate
 * 
 * Cách dùng: authorize('WAREHOUSE_MANAGER')
 * hoặc: authorize('WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF')
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Bạn chưa được xác thực.', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(
        res,
        'Bạn không có quyền thực hiện thao tác này.',
        403
      );
    }

    next();
  };
};

module.exports = { authenticate, authorize };
