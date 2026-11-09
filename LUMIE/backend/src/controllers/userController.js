const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { generateTempPassword } = require('../utils/helpers');
const emailService = require('../services/emailService');

/**
 * US-05: List and search users (MANAGER only)
 */
const getUsers = async (req, res, next) => {
  try {
    const { search, status, warehouse_id, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = "WHERE u.role = 'STAFF'";
    const params = [];

    if (search) {
      whereClause += ' AND (u.full_name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status) {
      whereClause += ' AND u.status = ?';
      params.push(status);
    } else {
      whereClause += " AND u.status != 'DELETED'";
    }
    if (warehouse_id) {
      whereClause += ' AND u.warehouse_id = ?';
      params.push(warehouse_id);
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.warehouse_id,
              w.name as warehouse_name, u.status, u.created_at
       FROM users u
       LEFT JOIN warehouses w ON u.warehouse_id = w.id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * US-04: Create staff account (MANAGER only)
 */
const createUser = async (req, res, next) => {
  try {
    const { full_name, email, phone, warehouse_id } = req.body;

    if (!full_name || !email || !warehouse_id) {
      return res.status(400).json({ success: false, message: 'Họ tên, email và kho phụ trách là bắt buộc.' });
    }

    // Check email uniqueness
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'Email đã được sử dụng.' });
    }

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, warehouse_id, status)
       VALUES (?, ?, ?, ?, 'STAFF', ?, 'ACTIVE')`,
      [full_name, email.toLowerCase().trim(), phone || null, hash, warehouse_id]
    );

    // Send temp password via email (non-blocking)
    emailService.sendTempPassword(email, full_name, tempPassword).catch(err =>
      console.error('Email send failed:', err.message)
    );

    res.status(201).json({
      success: true,
      message: 'Tạo tài khoản thành công. Mật khẩu tạm thời đã được gửi qua email.',
      data: { id: result.insertId },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * US-06: Update user & reset password (MANAGER only)
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { full_name, phone, warehouse_id } = req.body;

    const [rows] = await pool.query("SELECT id FROM users WHERE id = ? AND status != 'DELETED'", [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Tài khoản không tồn tại.' });
    }

    await pool.query(
      'UPDATE users SET full_name = ?, phone = ?, warehouse_id = ?, updated_at = NOW() WHERE id = ?',
      [full_name, phone || null, warehouse_id || null, id]
    );

    res.json({ success: true, message: 'Cập nhật tài khoản thành công.' });
  } catch (err) {
    next(err);
  }
};

/**
 * US-06: Reset password (send new temp password via email)
 */
const resetPassword = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      "SELECT id, full_name, email FROM users WHERE id = ? AND status = 'ACTIVE'",
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Tài khoản không tồn tại.' });
    }

    const user = rows[0];
    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    await pool.query(
      'UPDATE users SET password_hash = ?, login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = ?',
      [hash, id]
    );

    emailService.sendTempPassword(user.email, user.full_name, tempPassword).catch(err =>
      console.error('Email send failed:', err.message)
    );

    res.json({ success: true, message: 'Đặt lại mật khẩu thành công. Mật khẩu mới đã được gửi qua email.' });
  } catch (err) {
    next(err);
  }
};

/**
 * US-07: Soft delete user (MANAGER only)
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const requesterId = req.user.id;

    // Can't delete yourself
    if (parseInt(id) === requesterId) {
      return res.status(400).json({ success: false, message: 'Không thể xóa tài khoản của chính mình.' });
    }

    const [rows] = await pool.query(
      "SELECT id, role, status FROM users WHERE id = ? AND status != 'DELETED'",
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Tài khoản không tồn tại.' });
    }

    // Can't delete the last MANAGER
    if (rows[0].role === 'MANAGER') {
      const [managerCount] = await pool.query(
        "SELECT COUNT(*) as cnt FROM users WHERE role = 'MANAGER' AND status = 'ACTIVE'",
        []
      );
      if (managerCount[0].cnt <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Không thể xóa quản lý kho cuối cùng của hệ thống.',
        });
      }
    }

    await pool.query("UPDATE users SET status = 'DELETED', updated_at = NOW() WHERE id = ?", [id]);

    res.json({ success: true, message: 'Xóa tài khoản thành công.' });
  } catch (err) {
    next(err);
  }
};

/**
 * Get single user by ID
 */
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.warehouse_id,
              w.name as warehouse_name, u.status, u.created_at
       FROM users u LEFT JOIN warehouses w ON u.warehouse_id = w.id
       WHERE u.id = ? AND u.status != 'DELETED'`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Tài khoản không tồn tại.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = { getUsers, createUser, updateUser, resetPassword, deleteUser, getUserById };
