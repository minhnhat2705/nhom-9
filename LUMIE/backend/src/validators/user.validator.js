/**
 * src/validators/user.validator.js - Validation rules cho User Management
 */

const { body } = require('express-validator');
const { handleValidationErrors } = require('./auth.validator');

/**
 * Validation khi tạo nhân viên mới
 */
const validateCreateUser = [
  body('full_name')
    .notEmpty().withMessage('Họ và tên không được để trống')
    .isLength({ min: 2, max: 100 }).withMessage('Họ và tên phải từ 2 đến 100 ký tự')
    .trim(),
  
  body('email')
    .notEmpty().withMessage('Email không được để trống')
    .isEmail().withMessage('Email không đúng định dạng')
    .normalizeEmail(),
  
  body('phone')
    .optional({ values: 'falsy' })
    .matches(/^(0|\+84)[3-9][0-9]{8}$/)
    .withMessage('Số điện thoại không hợp lệ (gồm 10 số, bắt đầu bằng 03, 05, 07, 08, 09 hoặc +84)'),
  
  body('password')
    .notEmpty().withMessage('Mật khẩu tạm thời không được để trống')
    .isLength({ min: 8 }).withMessage('Mật khẩu phải có ít nhất 8 ký tự')
    .matches(/^(?=.*[a-zA-Z])(?=.*[0-9])/)
    .withMessage('Mật khẩu phải chứa cả chữ cái và số'),
  
  body('warehouse_id')
    .optional({ values: 'falsy' })
    .isInt({ min: 1 }).withMessage('ID kho không hợp lệ'),

  // QUAN TRỌNG: Không cho phép client tự đặt role_id
  // Role luôn được đặt thành WAREHOUSE_STAFF ở server

  handleValidationErrors,
];

/**
 * Validation khi cập nhật thông tin nhân viên
 */
const validateUpdateUser = [
  body('full_name')
    .optional()
    .isLength({ min: 2, max: 100 }).withMessage('Họ và tên phải từ 2 đến 100 ký tự')
    .trim(),
  
  body('phone')
    .optional({ values: 'falsy' })
    .matches(/^(0|\+84)[3-9][0-9]{8}$/)
    .withMessage('Số điện thoại không hợp lệ (gồm 10 số, bắt đầu bằng 03, 05, 07, 08, 09 hoặc +84)'),
  
  body('warehouse_id')
    .optional({ values: 'falsy' })
    .isInt({ min: 1 }).withMessage('ID kho không hợp lệ'),

  handleValidationErrors,
];

/**
 * Validation khi đặt lại mật khẩu
 */
const validateResetPassword = [
  body('newPassword')
    .notEmpty().withMessage('Mật khẩu mới không được để trống')
    .isLength({ min: 8 }).withMessage('Mật khẩu phải có ít nhất 8 ký tự')
    .matches(/^(?=.*[a-zA-Z])(?=.*[0-9])/)
    .withMessage('Mật khẩu phải chứa cả chữ cái và số'),
  
  handleValidationErrors,
];

module.exports = {
  validateCreateUser,
  validateUpdateUser,
  validateResetPassword,
};
