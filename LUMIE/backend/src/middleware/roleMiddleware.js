/**
 * Middleware factory: Restrict access to specific roles
 * @param {...string} roles - Allowed roles (e.g., 'MANAGER', 'STAFF')
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chưa xác thực.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Bạn không có quyền thực hiện thao tác này. Yêu cầu vai trò: ${roles.join(' hoặc ')}.`,
      });
    }
    next();
  };
};

module.exports = { requireRole };
