const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { generateTempPassword } = require('../utils/helpers');
const emailService = require('../services/emailService');

const MAX_ATTEMPTS = parseInt(process.env.LOGIN_MAX_ATTEMPTS) || 5;
const LOCK_DURATION_MINS = parseInt(process.env.LOGIN_LOCK_DURATION) || 15;

/**
 * US-01: Login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email và mật khẩu không được để trống.' });
    }

    const [rows] = await pool.query(
      'SELECT id, full_name, email, password_hash, role, warehouse_id, status, login_attempts, locked_until FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
    }

    const user = rows[0];

    // Check if account is deleted/disabled
    if (user.status === 'DELETED') {
      return res.status(401).json({ success: false, message: 'Tài khoản đã bị vô hiệu hóa.' });
    }

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const unlockTime = new Date(user.locked_until).toLocaleTimeString('vi-VN');
      return res.status(423).json({
        success: false,
        message: `Tài khoản bị khóa tạm thời do đăng nhập sai quá ${MAX_ATTEMPTS} lần. Thử lại sau ${unlockTime}.`,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const newAttempts = (user.login_attempts || 0) + 1;
      let updateQuery = 'UPDATE users SET login_attempts = ? WHERE id = ?';
      let updateParams = [newAttempts, user.id];

      if (newAttempts >= MAX_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCK_DURATION_MINS * 60 * 1000);
        updateQuery = 'UPDATE users SET login_attempts = ?, locked_until = ? WHERE id = ?';
        updateParams = [newAttempts, lockUntil, user.id];
        await pool.query(updateQuery, updateParams);
        return res.status(423).json({
          success: false,
          message: `Sai mật khẩu quá ${MAX_ATTEMPTS} lần. Tài khoản bị khóa ${LOCK_DURATION_MINS} phút.`,
        });
      }

      await pool.query(updateQuery, updateParams);
      return res.status(401).json({
        success: false,
        message: `Email hoặc mật khẩu không đúng. Còn ${MAX_ATTEMPTS - newAttempts} lần thử.`,
      });
    }

    // Reset login attempts on success
    await pool.query('UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?', [user.id]);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      success: true,
      message: 'Đăng nhập thành công.',
      data: {
        token,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          warehouse_id: user.warehouse_id,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * US-02: Logout (client-side token invalidation - return confirmation)
 */
const logout = (req, res) => {
  res.json({ success: true, message: 'Đăng xuất thành công.' });
};

/**
 * US-03: Change Password
 */
const changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;
    const userId = req.user.id;

    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin.' });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ success: false, message: 'Mật khẩu xác nhận không khớp.' });
    }

    // Min 8 chars, at least 1 letter and 1 number
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(new_password)) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm cả chữ và số.',
      });
    }

    const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
    const isMatch = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng.' });
    }

    const isSame = await bcrypt.compare(new_password, rows[0].password_hash);
    if (isSame) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải khác mật khẩu cũ.' });
    }

    const hash = await bcrypt.hash(new_password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    await pool.query('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, userId]);

    res.json({ success: true, message: 'Đổi mật khẩu thành công.' });
  } catch (err) {
    next(err);
  }
};

/**
 * Get current user profile
 */
const getProfile = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.warehouse_id, w.name as warehouse_name, u.status, u.created_at
       FROM users u LEFT JOIN warehouses w ON u.warehouse_id = w.id
       WHERE u.id = ?`,
      [req.user.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, logout, changePassword, getProfile };
