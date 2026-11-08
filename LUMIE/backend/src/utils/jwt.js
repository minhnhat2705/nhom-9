/**
 * src/utils/jwt.js - Tiện ích JWT
 * 
 * Các hàm tạo và xác thực JWT token.
 * Access token: Thời hạn ngắn (15 phút)
 * Refresh token: Thời hạn dài (7 ngày)
 */

const jwt = require('jsonwebtoken');

/**
 * Tạo Access Token JWT
 * Chứa thông tin user để xác thực mỗi request
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role.role_name,
      status: user.status,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
};

/**
 * Tạo Refresh Token JWT
 * Dùng để lấy Access Token mới khi hết hạn
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      type: 'refresh',
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

/**
 * Xác thực Access Token
 * @returns {object} payload của token nếu hợp lệ
 * @throws {Error} nếu token không hợp lệ hoặc hết hạn
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
};

/**
 * Xác thực Refresh Token
 * @returns {object} payload của token nếu hợp lệ
 * @throws {Error} nếu token không hợp lệ hoặc hết hạn
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
