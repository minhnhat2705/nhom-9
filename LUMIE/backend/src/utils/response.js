/**
 * src/utils/response.js - Chuẩn hóa Response JSON
 * 
 * Tất cả API response đều dùng các hàm này để đảm bảo
 * định dạng thống nhất cho Frontend dễ xử lý.
 */

/**
 * Response thành công
 * @param {object} res - Express response object
 * @param {object} data - Dữ liệu trả về
 * @param {string} message - Thông báo
 * @param {number} statusCode - HTTP status code (mặc định 200)
 */
const successResponse = (res, data = null, message = 'Thành công', statusCode = 200) => {
  const response = {
    success: true,
    message,
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Response lỗi
 * @param {object} res - Express response object
 * @param {string} message - Thông báo lỗi
 * @param {number} statusCode - HTTP status code (mặc định 400)
 * @param {object} errors - Chi tiết lỗi (tùy chọn)
 */
const errorResponse = (res, message = 'Đã xảy ra lỗi', statusCode = 400, errors = null) => {
  const response = {
    success: false,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

/**
 * Response phân trang
 * @param {object} res - Express response object
 * @param {Array} items - Danh sách dữ liệu
 * @param {object} pagination - Thông tin phân trang
 * @param {string} message - Thông báo
 */
const paginatedResponse = (res, items, pagination, message = 'Thành công') => {
  return res.status(200).json({
    success: true,
    message,
    data: {
      items,
      pagination: {
        total: pagination.total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(pagination.total / pagination.limit),
      },
    },
  });
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
};
