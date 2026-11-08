/**
 * src/services/auth.service.js - Business Logic cho Authentication
 * 
 * Tách biệt logic nghiệp vụ khỏi controller để dễ bảo trì.
 * Controller chỉ xử lý request/response.
 * Service xử lý logic thực sự.
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');

const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const LOCK_TIME_MINUTES = parseInt(process.env.LOCK_TIME_MINUTES) || 15;
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

/**
 * Hash chuỗi token để lưu vào database (không lưu token gốc)
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Lấy thông tin user an toàn (không có password_hash)
 */
const getSafeUserData = (user) => ({
  id: user.id,
  full_name: user.full_name,
  email: user.email,
  phone: user.phone,
  role: user.role.role_name,
  warehouse_id: user.warehouse_id,
  warehouse: user.warehouse ? {
    id: user.warehouse.id,
    name: user.warehouse.warehouse_name,
    code: user.warehouse.warehouse_code,
  } : null,
  status: user.status,
  must_change_password: user.must_change_password,
  last_login: user.last_login,
});

/**
 * Dịch vụ đăng nhập
 * - Kiểm tra email/password
 * - Xử lý khóa tài khoản sau nhiều lần sai
 * - Tạo và lưu refresh token
 */
const login = async (email, password, ipAddress) => {
  // Tìm user theo email (kể cả inactive - để thông báo đúng)
  const user = await prisma.user.findUnique({
    where: { email, deleted_at: null },
    include: {
      role: true,
      warehouse: { select: { id: true, warehouse_name: true, warehouse_code: true } },
    },
  });

  // BẢO MẬT: Không tiết lộ email có tồn tại hay không
  // Trả về thông báo chung cho cả 2 trường hợp sai email và sai mật khẩu
  if (!user) {
    return { success: false, message: 'Email hoặc mật khẩu không chính xác' };
  }

  // Kiểm tra tài khoản bị xóa mềm
  if (user.deleted_at) {
    return { success: false, message: 'Email hoặc mật khẩu không chính xác' };
  }

  // Kiểm tra tài khoản có đang bị khóa tạm thời không
  if (user.locked_until && new Date() < new Date(user.locked_until)) {
    const remainingMinutes = Math.ceil(
      (new Date(user.locked_until) - new Date()) / (1000 * 60)
    );
    return {
      success: false,
      message: `Tài khoản tạm thời bị khóa. Vui lòng thử lại sau ${remainingMinutes} phút.`,
    };
  }

  // Kiểm tra tài khoản có bị vô hiệu hóa (INACTIVE) không
  if (user.status === 'INACTIVE') {
    return {
      success: false,
      message: 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản lý kho.',
    };
  }

  // So sánh mật khẩu với bcrypt
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    // Tăng số lần đăng nhập sai
    const newFailedAttempts = user.failed_login_attempts + 1;
    
    const updateData = { failed_login_attempts: newFailedAttempts };
    
    // Khóa tài khoản nếu vượt quá số lần sai cho phép
    if (newFailedAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + LOCK_TIME_MINUTES * 60 * 1000);
      updateData.locked_until = lockUntil;
      updateData.status = 'LOCKED';
      
      await prisma.user.update({ where: { id: user.id }, data: updateData });
      
      return {
        success: false,
        message: `Đăng nhập sai quá ${MAX_LOGIN_ATTEMPTS} lần. Tài khoản bị khóa ${LOCK_TIME_MINUTES} phút.`,
      };
    }
    
    await prisma.user.update({ where: { id: user.id }, data: updateData });
    
    const remainingAttempts = MAX_LOGIN_ATTEMPTS - newFailedAttempts;
    return {
      success: false,
      message: `Email hoặc mật khẩu không chính xác. Còn ${remainingAttempts} lần thử.`,
    };
  }

  // ✅ Đăng nhập thành công

  // Reset số lần đăng nhập sai và cập nhật last_login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failed_login_attempts: 0,
      locked_until: null,
      last_login: new Date(),
      // Mở khóa nếu trước đó bị khóa nhưng đã hết thời gian
      status: user.status === 'LOCKED' ? 'ACTIVE' : user.status,
    },
  });

  // Tạo token
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Lưu refresh token vào database (đã hash)
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 ngày
  await prisma.refreshToken.create({
    data: {
      user_id: user.id,
      token_hash: hashToken(refreshToken),
      expires_at: refreshExpiry,
    },
  });

  // Ghi audit log
  await prisma.auditLog.create({
    data: {
      user_id: user.id,
      action: 'LOGIN',
      description: `Đăng nhập thành công`,
      ip_address: ipAddress,
    },
  });

  return {
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: getSafeUserData(user),
    },
  };
};

/**
 * Dịch vụ đăng xuất
 * - Thu hồi refresh token trong database
 */
const logout = async (refreshToken, userId) => {
  if (!refreshToken) return;
  
  const tokenHash = hashToken(refreshToken);
  
  // Thu hồi token cụ thể
  await prisma.refreshToken.updateMany({
    where: {
      token_hash: tokenHash,
      user_id: userId,
      revoked_at: null,
    },
    data: { revoked_at: new Date() },
  });
};

/**
 * Dịch vụ làm mới Access Token
 * - Kiểm tra refresh token hợp lệ
 * - Tạo access token mới
 */
const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    return { success: false, message: 'Refresh token không được cung cấp' };
  }

  // Xác thực refresh token
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return { success: false, message: 'Refresh token không hợp lệ hoặc đã hết hạn' };
  }

  // Kiểm tra token trong database
  const tokenHash = hashToken(refreshToken);
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token_hash: tokenHash },
  });

  if (!storedToken || storedToken.revoked_at !== null) {
    return { success: false, message: 'Refresh token đã bị thu hồi' };
  }

  if (new Date() > new Date(storedToken.expires_at)) {
    return { success: false, message: 'Refresh token đã hết hạn' };
  }

  // Lấy thông tin user mới nhất
  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    include: { role: true },
  });

  if (!user || user.status !== 'ACTIVE' || user.deleted_at) {
    return { success: false, message: 'Tài khoản không hợp lệ' };
  }

  // Tạo access token mới
  const newAccessToken = generateAccessToken(user);

  return {
    success: true,
    data: { accessToken: newAccessToken },
  };
};

/**
 * Dịch vụ đổi mật khẩu
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  
  if (!user) {
    return { success: false, message: 'Tài khoản không tồn tại' };
  }

  // Kiểm tra mật khẩu hiện tại
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isCurrentPasswordValid) {
    return { success: false, message: 'Mật khẩu hiện tại không chính xác' };
  }

  // Mật khẩu mới không được giống mật khẩu cũ
  const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
  if (isSamePassword) {
    return { success: false, message: 'Mật khẩu mới phải khác mật khẩu cũ' };
  }

  // Hash mật khẩu mới
  const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  // Cập nhật mật khẩu và tắt cờ must_change_password
  await prisma.user.update({
    where: { id: userId },
    data: {
      password_hash: newPasswordHash,
      must_change_password: false,
    },
  });

  // Thu hồi tất cả refresh token cũ (bảo mật: đăng xuất khỏi tất cả thiết bị)
  await prisma.refreshToken.updateMany({
    where: { user_id: userId, revoked_at: null },
    data: { revoked_at: new Date() },
  });

  return { success: true, message: 'Đổi mật khẩu thành công' };
};

module.exports = {
  login,
  logout,
  refreshAccessToken,
  changePassword,
  hashToken,
  getSafeUserData,
};
