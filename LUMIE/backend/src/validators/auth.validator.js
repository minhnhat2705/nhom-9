/**
 * src/validators/auth.validator.js - Validation rules cho Authentication
 * 
 * Dùng thư viện express-validator để kiểm tra dữ liệu đầu vào.
 * Mỗi route có một mảng validation rules riêng.
 */

const { body, validationResult } = require('express-validator');

/**
 * Hàm helper: Trích xuất lỗi từ express-validator và trả về response
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

/**
 * Validation cho đăng nhập
 */
const validateLogin = [
  body('email')
    .notEmpty().withMessage('Email không được để trống')
    .isEmail().withMessage('Email không đúng định dạng')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Mật khẩu không được để trống')
    .isLength({ min: 1 }).withMessage('Mật khẩu không được để trống'),
  
  handleValidationErrors,
];

/**
 * Validation cho đổi mật khẩu
 */
const validateChangePassword = [
  body('currentPassword')
    .notEmpty().withMessage('Mật khẩu hiện tại không được để trống'),
  
  body('newPassword')
    .notEmpty().withMessage('Mật khẩu mới không được để trống')
    .isLength({ min: 8 }).withMessage('Mật khẩu mới phải có ít nhất 8 ký tự')
    .matches(/^(?=.*[a-zA-Z])(?=.*[0-9])/)
    .withMessage('Mật khẩu mới phải chứa cả chữ cái và số'),
  
  body('confirmPassword')
    .notEmpty().withMessage('Xác nhận mật khẩu không được để trống')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Xác nhận mật khẩu không khớp');
      }
      return true;
    }),
  
  handleValidationErrors,
];

module.exports = {
  validateLogin,
  validateChangePassword,
  handleValidationErrors,
};
