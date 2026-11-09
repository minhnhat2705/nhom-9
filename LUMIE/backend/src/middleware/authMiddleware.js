const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * Middleware: Verify JWT token and attach user to request
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Chưa xác thực. Vui lòng đăng nhập.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from DB to check status (in case account was disabled after token was issued)
    const [rows] = await pool.query(
      'SELECT id, full_name, email, role, warehouse_id, status FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!rows.length || rows[0].status !== 'ACTIVE') {
      return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Token không hợp lệ.' });
    }
    next(err);
  }
};

module.exports = authMiddleware;
